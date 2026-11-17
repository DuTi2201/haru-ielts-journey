/** The sounds of Hành trình Thiên Nga: one short sound for each moment of the journey (a feather
 * earned, a new stage, the last petal, the rose reborn, the shield, the crows driven off, a relic,
 * starlight).
 *
 * Nothing is downloaded: every sound is built in the browser with Web Audio (a few oscillators and
 * a little filtered noise), so it costs no bytes and starts at once.
 *
 *  - ON by default, with its own switch in the settings (FeedbackPrefs.journeySound). The moments
 *    are rare (a few a week), unlike the answer "ting", which stays off by default.
 *  - Quiet (the master level is about a third of the background music's ceiling), never played in
 *    a hidden tab, and skipped while a lesson recording is speaking, so it cannot cover it.
 *  - A browser gives a page its voice only after a tap or a key: a moment shown before the first
 *    one is silent, and that is fine.
 */
import { getFeedbackPrefs } from "@/lib/feedback";

export type JourneySound = "feather" | "stage" | "fall" | "reborn" | "shield" | "crows" | "relic" | "sparkle";

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      out = ctx.createGain();
      out.gain.value = 0.5;
      out.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  return ctx;
}

/** True while a lesson's own sound is playing (a recording, a lecture): the journey keeps quiet. */
function lessonSpeaking(): boolean {
  if (typeof document === "undefined") return false;
  return Array.from(document.querySelectorAll("audio, video")).some((m) => {
    const el = m as HTMLMediaElement;
    return !el.paused && !el.muted && !el.loop && el.volume > 0;
  });
}

/** One bell-like tone: a sine with a quiet octave above it, struck and left to ring. */
function bell(c: AudioContext, at: number, freq: number, ring: number, peak: number) {
  for (const [mult, level] of [
    [1, 1],
    [2.01, 0.28],
    [3.02, 0.1],
  ] as const) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * mult, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak * level, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + ring / mult);
    osc.connect(g).connect(out!);
    osc.start(at);
    osc.stop(at + ring / mult + 0.05);
  }
}

/** A breath of filtered noise: wings, wind, a petal brushing the glass. `from`/`to`: the filter's
 * centre in Hz, sliding over the sound. */
function breath(c: AudioContext, at: number, dur: number, from: number, to: number, peak: number, q = 1.2) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(out!);
  src.start(at);
  src.stop(at + dur + 0.05);
}

/** A low, soft thump (something small coming to rest). */
function thud(c: AudioContext, at: number, peak: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, at);
  osc.frequency.exponentialRampToValueAtTime(52, at + 0.22);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
  osc.connect(g).connect(out!);
  osc.start(at);
  osc.stop(at + 0.36);
}

// D major pentatonic, the key the ballet theme sits in
const D5 = 587.33;
const E5 = 659.25;
const FS5 = 739.99;
const A5 = 880;
const B5 = 987.77;
const D6 = 1174.66;

const SCORE: Record<JourneySound, (c: AudioContext, t: number) => void> = {
  // a feather settles: a soft swish, then one clear note
  feather: (c, t) => {
    breath(c, t, 0.35, 2400, 900, 0.05);
    bell(c, t + 0.16, A5, 0.9, 0.11);
    bell(c, t + 0.3, D6, 1.1, 0.07);
  },
  // a new stage: light rising in five steps, wings opening under it
  stage: (c, t) => {
    breath(c, t, 1.4, 500, 3200, 0.07, 0.8);
    [D5, FS5, A5, B5, D6].forEach((f, i) => bell(c, t + 0.25 + i * 0.17, f, 1.6, 0.1));
    bell(c, t + 1.25, D6 * 1.5, 2.2, 0.06);
  },
  // the last petal: three notes falling, and the petal coming to rest
  fall: (c, t) => {
    [B5, FS5, D5].forEach((f, i) => bell(c, t + i * 0.42, f * 0.5, 1.5, 0.09));
    breath(c, t + 0.9, 0.9, 1400, 420, 0.035);
    thud(c, t + 1.75, 0.12);
  },
  // the rose reborn: the petals fly back up
  reborn: (c, t) => {
    breath(c, t, 1.1, 600, 2600, 0.05, 0.9);
    [D5, E5, FS5, A5, B5, D6].forEach((f, i) => bell(c, t + 0.1 + i * 0.11, f, 1.2, 0.085));
  },
  // the shield holds: a struck bowl (partials that are not in tune with each other), then quiet
  shield: (c, t) => {
    for (const [f, level, ring] of [
      [392, 1, 1.6],
      [392 * 2.76, 0.5, 1.1],
      [392 * 5.4, 0.25, 0.7],
      [392 * 8.93, 0.12, 0.4],
    ] as const) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t + 0.3);
      g.gain.setValueAtTime(0.0001, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.1 * level, t + 0.305);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3 + ring);
      osc.connect(g).connect(out!);
      osc.start(t + 0.3);
      osc.stop(t + 0.35 + ring);
    }
    breath(c, t, 0.32, 300, 1800, 0.06);
  },
  // the crows scatter: beating wings going away, then one clear note of morning
  crows: (c, t) => {
    for (let i = 0; i < 7; i++) breath(c, t + i * 0.13, 0.16, 900 - i * 60, 500 - i * 30, 0.07 - i * 0.008, 3);
    breath(c, t + 0.2, 1.5, 1200, 300, 0.04, 0.7);
    bell(c, t + 1.35, A5, 1.4, 0.08);
  },
  // a relic: two notes a fifth apart, like something set down with care
  relic: (c, t) => {
    bell(c, t, D5, 1.4, 0.1);
    bell(c, t + 0.22, A5, 1.6, 0.09);
    breath(c, t, 0.5, 3000, 5000, 0.02);
  },
  // starlight: a handful of high, quick glints
  sparkle: (c, t) => {
    [D6, A5 * 2, FS5 * 2, B5 * 2, D6 * 2].forEach((f, i) => bell(c, t + i * 0.09, f, 0.7, 0.05));
  },
};

export function playJourneySound(sound: JourneySound): void {
  if (!getFeedbackPrefs().journeySound) return;
  if (typeof document !== "undefined" && document.hidden) return;
  if (lessonSpeaking()) return;
  const c = context();
  if (!c || !out) return;
  const go = () => {
    if (c.state !== "running") return; // no tap yet in this visit: the browser keeps the page silent
    try {
      SCORE[sound](c, c.currentTime + 0.03);
    } catch {
      /* a sound is never worth an error */
    }
  };
  if (c.state === "suspended") void c.resume().then(go, () => undefined);
  else go();
}
