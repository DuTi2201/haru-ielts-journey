/**
 * Audio for a Gemini Live conversation: the microphone as 16 kHz 16-bit PCM chunks (what Live
 * takes in) and a player for the 24 kHz 16-bit PCM it answers with.
 *
 * The capture runs in an AudioWorklet (inlined as a Blob URL, so there is no extra file to serve):
 * it averages the device's samples down to 16 kHz, sends ~100 ms chunks, and reports how loud each
 * chunk was so the screen can tell when the learner is speaking (the model only knows when they
 * stop). Echo cancellation is asked of the browser, so Haru's voice from the speaker is not sent
 * back as the learner's.
 */

const WORKLET = `
class Pcm16Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.acc = 0; this.n = 0; this.pos = 0;
    this.out = new Int16Array(1600); this.len = 0; this.sq = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i]; this.n++; this.pos++;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        const v = Math.max(-1, Math.min(1, this.acc / this.n));
        this.acc = 0; this.n = 0;
        this.sq += v * v;
        this.out[this.len++] = v < 0 ? v * 0x8000 : v * 0x7fff;
        if (this.len === this.out.length) {
          this.port.postMessage({ pcm: this.out.buffer.slice(0), rms: Math.sqrt(this.sq / this.len) });
          this.len = 0; this.sq = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("pcm16-capture", Pcm16Capture);
`;

export function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

type AudioCtor = typeof AudioContext;
function audioContextClass(): AudioCtor {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  const C = w.AudioContext ?? w.webkitAudioContext;
  if (!C) throw new Error("no-audio");
  return C;
}

export interface MicCapture {
  /** Muted: chunks keep flowing (as silence) so the model's turn-taking is not confused. */
  setMuted(muted: boolean): void;
  stop(): void;
}

/** Ask for the microphone and start sending chunks. Must run from a tap (browsers ask the
 * learner then). Throws DOMException "NotAllowedError" when refused. */
export async function startMic(
  onChunk: (base64Pcm: string, rms: number, pcm: Int16Array) => void,
): Promise<MicCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });
  const Ctx = audioContextClass();
  const ctx = new Ctx();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  try {
    await ctx.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "pcm16-capture");
  let muted = false;
  node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; rms: number }>) => {
    const pcm = muted ? new ArrayBuffer(e.data.pcm.byteLength) : e.data.pcm;
    onChunk(bytesToBase64(pcm), muted ? 0 : e.data.rms, new Int16Array(pcm));
  };
  source.connect(node);
  // a worklet only runs when it reaches the destination; a silent gain keeps it off the speaker
  const sink = ctx.createGain();
  sink.gain.value = 0;
  node.connect(sink).connect(ctx.destination);
  if (ctx.state === "suspended") await ctx.resume();
  return {
    setMuted(m) {
      muted = m;
    },
    stop() {
      node.port.onmessage = null;
      try {
        source.disconnect();
        node.disconnect();
      } catch {
        // already gone
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}

/** Plays the model's PCM chunks back to back, without gaps. `interrupt()` drops what is queued
 * (the learner started talking over Haru). */
export class PcmPlayer {
  private ctx: AudioContext;
  private next = 0;
  private sources = new Set<AudioBufferSourceNode>();

  constructor() {
    const Ctx = audioContextClass();
    this.ctx = new Ctx();
  }

  /** Call from the tap that starts the session: iOS only lets audio start from a gesture. */
  async unlock() {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  play(base64Pcm: string, sampleRate = 24000) {
    const bytes = base64ToBytes(base64Pcm);
    const samples = new Int16Array(
      bytes.buffer,
      bytes.byteOffset,
      Math.floor(bytes.byteLength / 2),
    );
    if (!samples.length) return;
    const buf = this.ctx.createBuffer(1, samples.length, sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < samples.length; i++) ch[i] = (samples[i] ?? 0) / 0x8000;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const at = Math.max(this.ctx.currentTime + 0.03, this.next);
    src.start(at);
    this.next = at + buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** True while something is still coming out of the speaker. */
  get playing(): boolean {
    return this.next > this.ctx.currentTime + 0.05;
  }

  interrupt() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // not started yet
      }
    }
    this.sources.clear();
    this.next = 0;
  }

  close() {
    this.interrupt();
    void this.ctx.close();
  }
}

/** "audio/pcm;rate=24000" -> 24000 */
export function rateOf(mimeType: string | undefined, fallback = 24000): number {
  const m = /rate=(\d+)/.exec(mimeType ?? "");
  return m ? Number(m[1]) : fallback;
}

/** 16-bit mono PCM -> a WAV file (what the pronunciation check takes). */
export function pcmToWav(samples: Int16Array, sampleRate = 16000): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(44 + samples.length * 2));
  const v = new DataView(out.buffer);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  new Int16Array(out.buffer, 44).set(samples);
  return out;
}
