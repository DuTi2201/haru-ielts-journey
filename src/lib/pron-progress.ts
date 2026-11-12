import type { PronSound } from "@/lib/api/pronunciation";

/** Best score per practice text, kept on this device only (nothing is sent to the server). */
const KEY = "haru.pron.best.v1";
type Store = Record<string, Record<string, number>>;

function read(): Store {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

export const bestScores = (slug: string): Record<string, number> => read()[slug] ?? {};

export function saveBest(slug: string, text: string, score: number): Record<string, number> {
  const all = read();
  const mine = { ...(all[slug] ?? {}) };
  if (score > (mine[text] ?? -1)) mine[text] = Math.round(score);
  all[slug] = mine;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode: scores just are not kept */
  }
  return mine;
}

/** Fraction of a sound's practice texts that reached "Rõ" (80) at least once. */
export function soundDone(best: Record<string, number>, texts: string[]): number {
  if (!texts.length) return 0;
  return texts.filter((t) => (best[t] ?? 0) >= 80).length / texts.length;
}

/** Same list the server accepts for a sound: words, the pair, all words in one go, the sentence. */
export const practiceTexts = (s: PronSound): string[] => [
  ...s.words,
  ...(s.pair ?? []),
  s.words.join(" "),
  s.sentence,
];
