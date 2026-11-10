/** Small per-device conveniences for a lesson (which step the learner was on, what
 * they have already looked at, an unsent essay draft). Browser storage can be
 * blocked, full or absent (private window, server render), so every read and
 * write is guarded and the screen works without it. Nothing here is the learner's
 * record — that lives on the server. */

const PREFIX = "haru.lesson.";

export function readLocal<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the screen simply forgets next time */
  }
}

export function removeLocal(key: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** The lesson steps, in the order the stepper shows them. */
export type LessonStep = "listen" | "vocab" | "grammar" | "practice";
export const LESSON_STEPS: readonly LessonStep[] = ["listen", "vocab", "grammar", "practice"];

export const isLessonStep = (v: unknown): v is LessonStep =>
  typeof v === "string" && (LESSON_STEPS as readonly string[]).includes(v);
