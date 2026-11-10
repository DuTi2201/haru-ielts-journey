import type { ExamTag, LessonSummaryOut } from "@/lib/api/types";

/** What the exam tags mean on screen. A tag follows the TOPIC of the KIIP lesson an item belongs
 * to ("kiip-3" = the stage-3 course, 중급1); stage 5 is 한국사회이해 (Korean society). */
const KIIP_STAGE: Record<number, string> = {
  1: "Sơ cấp 1 (초급1)",
  2: "Sơ cấp 2 (초급2)",
  3: "Trung cấp 1 (중급1)",
  4: "Trung cấp 2 (중급2)",
  5: "Hiểu biết xã hội Hàn Quốc (한국사회이해)",
};

/** "kiip-3" → 3; anything else → null. */
export function examStage(tag: string | null | undefined): number | null {
  const m = /^kiip-([1-5])$/.exec(tag ?? "");
  return m ? Number(m[1]) : null;
}

/** "kiip-3" → "KIIP 3". */
export function examLabel(tag: string | null | undefined): string | null {
  const stage = examStage(tag);
  return stage === null ? null : `KIIP ${stage}`;
}

/** The longer name, for a tooltip and a screen reader. */
export function examTitle(tag: string | null | undefined): string | null {
  const stage = examStage(tag);
  return stage === null
    ? null
    : `Có trong chương trình KIIP bậc ${stage} · ${KIIP_STAGE[stage]} — gắn theo chủ đề bài KIIP tương ứng`;
}

export const isKiip = (tag: string | null | undefined): boolean => examStage(tag) !== null;

/** The KIIP part of a list of lessons, added up (a topic card / the picker's coverage block). */
export function kiipStats(lessons: Pick<LessonSummaryOut, "kiip" | "kind">[]) {
  let vocab = 0;
  let grammar = 0;
  let notes = 0;
  let mastered = 0;
  let tracked = false;
  const stages: Partial<Record<ExamTag, number>> = {};
  for (const l of lessons) {
    if (l.kind === "review" || !l.kiip) continue;
    vocab += l.kiip.vocab;
    grammar += l.kiip.grammar;
    notes += l.kiip.notes;
    if (l.kiip.mastered !== null) {
      tracked = true;
      mastered += l.kiip.mastered;
    }
    for (const [tag, n] of Object.entries(l.kiip.stages) as [ExamTag, number][]) {
      stages[tag] = (stages[tag] ?? 0) + n;
    }
  }
  const total = vocab + grammar;
  return {
    vocab,
    grammar,
    notes,
    total,
    lessons: lessons.filter((l) => l.kind !== "review" && l.kiip).length,
    stages: Object.entries(stages)
      .map(([tag, n]) => ({ tag: tag as ExamTag, n: n ?? 0 }))
      .sort((a, b) => (examStage(a.tag) ?? 0) - (examStage(b.tag) ?? 0)),
    mastered: tracked ? mastered : null,
  };
}

/** "12 từ · 2 ngữ pháp · 1 ghi chú" — a part that is zero is left out. */
export function kiipLine(k: { vocab: number; grammar: number; notes: number }): string {
  const parts: string[] = [];
  if (k.vocab > 0) parts.push(`${k.vocab} từ`);
  if (k.grammar > 0) parts.push(`${k.grammar} ngữ pháp`);
  if (k.notes > 0) parts.push(`${k.notes} ghi chú`);
  return parts.join(" · ");
}
