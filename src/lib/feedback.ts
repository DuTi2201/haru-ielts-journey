/**
 * Small sensory feedback for taps and answers: a short haptic buzz and — only
 * if the learner turns it on — quiet UI sounds.
 *
 * Deliberate choices:
 *  - Sounds are OFF by default. Many people study on the bus with headphones or
 *    with the article read aloud, and on iOS a Web Audio blip can interrupt an
 *    <audio> element that is playing; nobody should get that by surprise.
 *  - One shared AudioContext (browsers cap how many can exist), created lazily
 *    from a tap and resumed if the browser suspended it.
 *  - Haptics use navigator.vibrate, which Android/Chrome supports and iOS
 *    Safari does not — there it is a silent no-op, never an error. Skipped when
 *    the user asked for reduced motion.
 *  - Preferences live in localStorage per device; every storage access is
 *    guarded because it throws in private mode.
 */

import { prefersReducedMotion } from "@/lib/motion";

const PREFS_KEY = "haru.feedback.v1";

export interface FeedbackPrefs {
  sound: boolean;
  haptics: boolean;
}

const DEFAULT_PREFS: FeedbackPrefs = { sound: false, haptics: true };

let cached: FeedbackPrefs | null = null;

export function getFeedbackPrefs(): FeedbackPrefs {
  if (cached) return cached;
  let next = DEFAULT_PREFS;
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FeedbackPrefs>;
      next = {
        sound: typeof parsed.sound === "boolean" ? parsed.sound : DEFAULT_PREFS.sound,
        haptics: typeof parsed.haptics === "boolean" ? parsed.haptics : DEFAULT_PREFS.haptics,
      };
    }
  } catch {
    /* no saved prefs — defaults are fine */
  }
  cached = next;
  return next;
}

export function setFeedbackPrefs(patch: Partial<FeedbackPrefs>): FeedbackPrefs {
  const next = { ...getFeedbackPrefs(), ...patch };
  cached = next;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    /* not persisted — still applies until the page closes */
  }
  return next;
}

function vibrate(pattern: number | number[]): void {
  if (!getFeedbackPrefs().haptics || prefersReducedMotion()) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers block vibrate outside a user gesture — harmless */
  }
}

// ------------------------------------------------------------------- sound --
let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/** A sequence of short sine notes with a soft attack/decay (no click). */
function notes(freqs: number[], noteSec: number, peak = 0.05): void {
  if (!getFeedbackPrefs().sound || (typeof document !== "undefined" && document.hidden)) return;
  const audio = audioContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume().catch(() => undefined);

  const start = audio.currentTime + 0.005;
  freqs.forEach((freq, i) => {
    const t0 = start + i * noteSec;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + noteSec);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + noteSec + 0.02);
  });
}

// --------------------------------------------------------------------- API --
/** A light tap: navigation, flipping a card. */
export function tap(): void {
  vibrate(8);
  notes([440], 0.05, 0.03);
}

/** A right answer / finished set. */
export function success(): void {
  vibrate([12, 40, 18]);
  notes([523.25, 659.25, 783.99], 0.09);
}

/** A "not yet" answer — neutral, not a punishment. */
export function miss(): void {
  vibrate(14);
  notes([330, 262], 0.09, 0.04);
}
