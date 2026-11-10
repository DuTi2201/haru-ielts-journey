/** "Trang vở": the page a learner writes in their own notebook after a sitting.
 *
 * Writing notes is a skill a beginner has not learnt, and the easy way out is to have an AI lay the
 * lesson out and copy that. So Haru shows the page itself: chosen from what the sitting taught
 * (never new content), small enough to write by hand in three minutes, and laid out the way a
 * notebook page is (keyword on the left, meaning on the right, one sentence of one's own at the
 * bottom). The help fades with use: first copy it, then fill in what is hidden, then write it from
 * memory and compare. Pure; the component keeps the count of pages done.
 */
import type { Sitting } from "@/lib/lesson-sessions";

/** Few enough to write in three minutes: choosing is part of the skill. */
export const MAX_NOTE_WORDS = 6;
export const MAX_NOTE_PATTERNS = 2;

export interface NoteWord {
  ko: string;
  vi: string;
  /** how it is read when that differs from the spelling */
  pron?: string | undefined;
}
export interface NotePattern {
  formula: string;
  ko: string;
  vi: string;
}
export interface NotebookPage {
  words: NoteWord[];
  patterns: NotePattern[];
  /** the one sentence the learner writes at the bottom, in their own words */
  canDo?: string | undefined;
}

export type NoteMode = "copy" | "fill" | "recall";
export const NOTE_MODES: { id: NoteMode; label: string; how: string }[] = [
  { id: "copy", label: "Chép lại", how: "Chép nguyên trang này vào vở. Đọc to từng từ khi viết." },
  {
    id: "fill",
    label: "Điền chỗ trống",
    how: "Chữ Hàn đang ẩn. Nhìn nghĩa, viết chữ Hàn vào vở, rồi hiện ra để so.",
  },
  {
    id: "recall",
    label: "Tự viết",
    how: "Đóng trang lại, tự viết từ trí nhớ vào vở, rồi mở trang mẫu để so. Gạch đỏ chỗ sai.",
  },
];

/** Pages done so far decide the way the page is first offered: copy, then fill, then recall. */
export function modeFor(pagesDone: number): NoteMode {
  return pagesDone < 2 ? "copy" : pagesDone < 5 ? "fill" : "recall";
}

const MARGIN = 28;

/** Short enough for a margin, but the bracket that tells look-alikes apart stays when it fits:
 * "Tôi (tôi: khiêm nhường · 나: thân mật)" → "Tôi"; "Hôm nay (thời tiết)" stays whole. */
export function shortMeaning(vi: string): string {
  const m = vi.trim().match(/^([^(;·]+?)\s*(\([^)]*\))?\s*(?:[;·]\s*([^(;·]+))?/);
  const head = m?.[1]?.trim() || vi.trim();
  const bracket = m?.[2];
  if (bracket && `${head} ${bracket}`.length <= MARGIN) return `${head} ${bracket}`;
  const second = m?.[3]?.trim();
  if (!bracket && second && `${head}; ${second}`.length <= MARGIN) return `${head}; ${second}`;
  return head;
}

type SittingSource = {
  vocab: {
    hangul: string;
    meaning_vi: string;
    pron_ko?: string | null | undefined;
    priority?: "core" | "recognize" | null | undefined;
  }[];
  grammar: {
    pattern: string;
    example_ko?: string | null | undefined;
    example_vi?: string | null | undefined;
  }[];
};

/** The page for one sitting, from the words and cards it taught. Words marked "core" come first. */
export function notebookPage(src: SittingSource, canDo?: string): NotebookPage | null {
  const aim = (canDo ?? "").toLowerCase();
  const examples = src.grammar.map((g) => (g.example_ko ?? "").split("\n")[0]!.trim());
  // What the sitting is for comes first (its can-do names the words), then core words, then the
  // rest; lesson order alone would hand out the first six of an alphabetical list.
  const score = (v: SittingSource["vocab"][number]) =>
    (aim.includes(v.hangul) || aim.includes(shortMeaning(v.meaning_vi).toLowerCase()) ? 4 : 0) +
    (examples.some((e) => e.includes(v.hangul)) ? 2 : 0) +
    (v.priority === "core" ? 1 : 0);
  const ranked = src.vocab
    .map((v, i) => ({ v, i, sc: score(v) }))
    .sort((a, b) => b.sc - a.sc || a.i - b.i)
    .slice(0, MAX_NOTE_WORDS)
    .map((x) => x.v);
  const shorts = ranked.map((v) => shortMeaning(v.meaning_vi));
  // two words that end up with the same margin meaning keep their full meaning
  const words: NoteWord[] = ranked.map((v, i) => ({
    ko: v.hangul,
    vi: shorts.filter((x) => x === shorts[i]).length > 1 ? v.meaning_vi.trim() : shorts[i]!,
    pron: v.pron_ko ?? undefined,
  }));
  const chosen = new Set(ranked.map((v) => v.hangul));
  const patterns: NotePattern[] = src.grammar.slice(0, MAX_NOTE_PATTERNS).map((g) => {
    const lines = (g.example_ko ?? "").split("\n").map((x) => x.trim());
    const at = Math.max(
      0,
      lines.findIndex((l) => [...chosen].some((w) => l.includes(w))),
    );
    const ko = lines[at] ?? "";
    const vi = ((g.example_vi ?? "").split("\n")[at] ?? "").trim();
    return { formula: g.pattern, ko, vi };
  });
  if (words.length === 0 && patterns.length === 0) return null;
  return { words, patterns, canDo };
}

/** What a sitting teaches, as the page source; `sitting.steps` carry only ids. */
export function pageForSitting(
  sitting: Sitting,
  vocab: (SittingSource["vocab"][number] & { id: number })[],
  grammar: (SittingSource["grammar"][number] & { id: number })[],
): NotebookPage | null {
  const vIds = new Set(sitting.steps.flatMap((s) => (s.kind === "vocab" ? s.ids : [])));
  const gIds = new Set(sitting.steps.flatMap((s) => (s.kind === "grammar" ? s.ids : [])));
  return notebookPage(
    { vocab: vocab.filter((v) => vIds.has(v.id)), grammar: grammar.filter((g) => gIds.has(g.id)) },
    sitting.plan?.canDo,
  );
}
