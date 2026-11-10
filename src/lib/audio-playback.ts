import { audioUrl } from "@/lib/api/audio";
import type { AudioJobResult } from "@/lib/api/types";

/** True on iPhone/iPad (every iOS browser is WebKit underneath) and on
 * desktop Safari. Ogg-Opus is unreliable there — Safari only added it
 * recently and iOS still stalls or reports no duration on some builds —
 * so those browsers get the AAC rendition instead. */
export function isAppleWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iP(hone|ad|od)/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isDesktopSafari =
    /safari/i.test(ua) && !/chrome|chromium|android|crios|fxios|edg/i.test(ua);
  return isIOS || isDesktopSafari;
}

/** Every audio job result carries both an Opus and an AAC rendition; pick
 * the one this browser plays most reliably. */
export function pickAudioSrc(result: AudioJobResult): string {
  if (isAppleWebKit()) return audioUrl(result.aac_path);
  const probe = typeof document !== "undefined" ? document.createElement("audio") : null;
  const supportsOpus = !!probe?.canPlayType('audio/ogg; codecs="opus"');
  return audioUrl(supportsOpus ? result.opus_path : result.aac_path);
}

// 20 ms of silence. Playing it INSIDE a tap handler is what "unlocks" an
// <audio> element on iOS Safari: once an element has been started by a user
// gesture it may later be given a new src and play()ed without another one.
const SILENCE_WAV =
  "data:audio/wav;base64,UklGRmQBAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

const unlockedElements = new WeakSet<HTMLAudioElement>();

/** Call synchronously from a click/tap handler (before any `await`) on the
 * element that will later play the generated audio. Generating an article's
 * audio takes a minute or two; without this, iOS Safari refuses the
 * play() that fires when generation finishes ("NotAllowedError") because
 * by then the tap that started it is long gone. */
export function unlockAudioElement(el: HTMLAudioElement): void {
  if (unlockedElements.has(el)) return;
  try {
    unlockedElements.add(el);
    el.muted = false;
    el.src = SILENCE_WAV;
    const p = el.play();
    if (p) p.catch(() => unlockedElements.delete(el));
  } catch {
    unlockedElements.delete(el);
  }
}

/** play() rejected because the browser wants a fresh tap (as opposed to
 * being interrupted by a src change/pause, or a decode failure). */
export function isAutoplayBlocked(err: unknown): boolean {
  return err instanceof DOMException && err.name === "NotAllowedError";
}

/** play() was cancelled by a later pause()/src change — not an error. */
export function isPlayInterrupted(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** Fully release an <audio> element so no download/decoder outlives the
 * screen that created it. */
export function releaseAudioElement(el: HTMLAudioElement | null): void {
  if (!el) return;
  try {
    el.onended = null;
    el.onerror = null;
    el.pause();
    el.removeAttribute("src");
    el.load();
  } catch {
    /* nothing useful to do */
  }
}

const isKoreanVoice = (v: SpeechSynthesisVoice) =>
  v.lang.toLowerCase().replace("_", "-").startsWith("ko");

/** Some browsers (Chrome) fill the voice list lazily: asking once early means
 * the list is ready by the time a learner taps. Harmless everywhere else. */
export function primeSpeechVoices(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window)
    window.speechSynthesis.getVoices();
}

/** Reads one short Korean text with the device's own ko-KR voice — free,
 * instant, offline, no server round-trip. Used for single sentences (the
 * "Nghe câu" button, the listening drill); a whole article uses the generated
 * audio instead. Must be called from a tap.
 *
 * Returns false when nothing was spoken: no speech synthesis, or — with
 * `requireKoreanVoice` — no Korean voice on this device (a device without one
 * would read Hangul with an English voice, which is worse than asking the
 * server). `onEnd` fires when the utterance finishes OR is interrupted. */
export function speakKorean(
  text: string,
  rate = 0.85,
  opts: { requireKoreanVoice?: boolean; onEnd?: () => void } = {},
): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  const korean = synth.getVoices().find(isKoreanVoice);
  if (opts.requireKoreanVoice && !korean) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = rate;
  if (korean) utterance.voice = korean;
  if (opts.onEnd) {
    utterance.onend = opts.onEnd;
    utterance.onerror = opts.onEnd;
  }
  synth.cancel();
  synth.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
