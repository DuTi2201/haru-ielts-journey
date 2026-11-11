/** "Nói thử" with a score: record one sentence on the device, turn it into the 16 kHz 16-bit mono
 * WAV the scoring service takes, and send it with the sentence it was read from
 * (POST /api/v1/me/speech/assess, Azure pronunciation assessment behind it). The recording is sent
 * once and kept nowhere. */
import { apiFetch } from "@/lib/api/client";

export interface SpeechWord {
  word: string;
  accuracy: number | null;
  error: "ok" | "omitted" | "inserted" | "mispronounced";
}

export type SpeechScore =
  | {
      ok: true;
      heard: string;
      accuracy: number;
      fluency: number | null;
      completeness: number | null;
      pron: number | null;
      level: "good" | "fair" | "retry";
      words: SpeechWord[];
      weak: string[];
    }
  | { ok: false; heard: string; reason: "no_speech" | "not_scored" };

export const MAX_RECORD_MS = 15_000;
const RATE = 16_000;

export const canRecord = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== "undefined";

/** Start recording; the returned `stop` resolves with what was recorded. */
export async function startRecording(): Promise<{ stop: () => Promise<Blob> }> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream);
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
    };
  });
  rec.start();
  const limit = setTimeout(() => rec.state !== "inactive" && rec.stop(), MAX_RECORD_MS);
  return {
    stop: () => {
      clearTimeout(limit);
      if (rec.state !== "inactive") rec.stop();
      return done;
    },
  };
}

/** Whatever the browser recorded (webm/opus, mp4/aac) -> 16 kHz mono 16-bit PCM WAV, base64. */
export async function toWavBase64(blob: Blob): Promise<string> {
  const Ctx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void ctx.close();
  }
  const frames = Math.max(1, Math.ceil(decoded.duration * RATE));
  const off = new OfflineAudioContext(1, frames, RATE);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const mono = (await off.startRendering()).getChannelData(0);
  const pcm = new DataView(new ArrayBuffer(44 + mono.length * 2));
  const put = (o: number, t: string) => [...t].forEach((c, i) => pcm.setUint8(o + i, c.charCodeAt(0)));
  put(0, "RIFF");
  pcm.setUint32(4, 36 + mono.length * 2, true);
  put(8, "WAVEfmt ");
  pcm.setUint32(16, 16, true);
  pcm.setUint16(20, 1, true);
  pcm.setUint16(22, 1, true);
  pcm.setUint32(24, RATE, true);
  pcm.setUint32(28, RATE * 2, true);
  pcm.setUint16(32, 2, true);
  pcm.setUint16(34, 16, true);
  put(36, "data");
  pcm.setUint32(40, mono.length * 2, true);
  for (let i = 0; i < mono.length; i++) {
    const v = Math.max(-1, Math.min(1, mono[i]!));
    pcm.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  const bytes = new Uint8Array(pcm.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export const assessSpeech = (lessonId: number, text: string, wavB64: string) =>
  apiFetch<SpeechScore>("/api/v1/me/speech/assess", {
    method: "POST",
    json: { lesson_id: lessonId, text, wav_b64: wavB64 },
  });
