/** Marking helpers for a lesson's practice set. Everything here runs in the browser:
 * the exercises ship with their answers, so a typed answer can be checked at once. */

/** A typed Korean answer, reduced to what matters for a comparison: no spaces, no
 * closing punctuation or quotes, one Unicode form. "바꿀 수 있습니까?" and
 * "바꿀수 있습니까" are the same answer. */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\s\u00a0]+/g, "")
    .replace(/["'“”‘’「」]/g, "")
    .replace(/[.。,，!?？！]+$/u, "");
}

/** True when `input` equals one of the accepted answers (after normalizing both). */
export function matchesAccepted(input: string, accepted: readonly string[]): boolean {
  const typed = normalizeAnswer(input);
  if (!typed) return false;
  return accepted.some((a) => normalizeAnswer(a) === typed);
}

/** Characters as TOPIK counts them in a writing answer: every character, spaces
 * included, line breaks not (a code-point count, so a Hangul syllable is one). */
export function countChars(text: string): number {
  return [...text.replace(/[\r\n]+/g, "")].length;
}

export type LengthStatus = "empty" | "short" | "ok" | "long";

export function lengthStatus(count: number, min: number, max: number): LengthStatus {
  if (count === 0) return "empty";
  if (count < min) return "short";
  if (count > max) return "long";
  return "ok";
}

/** A self-marked task counts as "right" from this share of the points upwards. */
export const SELF_PASS_RATIO = 0.6;

export function selfPassed(score: number, max: number): boolean {
  return max > 0 && score / max >= SELF_PASS_RATIO;
}

/** mm:ss for a countdown. */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
