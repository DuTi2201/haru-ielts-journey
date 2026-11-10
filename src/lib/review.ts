import type {
  CapstoneDetectorOut,
  ExerciseResultOut,
  McqExerciseOut,
  PracticeItem,
  ReviewBandOut,
  ReviewFunctionOut,
  ReviewMockOut,
} from "@/lib/api/types";

/** The multiple-choice exercises of a review lesson, in the order of the mock exam. A dictation is
 * listening too, but it has no options to pick, so it is not part of the mock. */
export const mockExercises = (items: PracticeItem[]): McqExerciseOut[] =>
  items.filter(
    (i): i is McqExerciseOut =>
      (i.skill === "listening" || i.skill === "reading") && i.type !== "listen_dictation",
  );

export const mockQuestions = (exercises: McqExerciseOut[]) => exercises.flatMap((e) => e.questions);

/** One attempt at the mock exam: what was picked for each question, how long it took. */
export interface MockRecord {
  picked: Record<string, string>;
  seconds: number;
  at: string;
}
export const mockKey = (lessonId: number) => `mock:${lessonId}`;

export const isRecord = (v: unknown): v is MockRecord =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as MockRecord).picked === "object" &&
  (v as MockRecord).picked !== null;

/** The attempt as the server remembers it (the answer saved with each result is the option
 * picked), for a learner who comes back on another device. Null unless every question has one. */
export function recordFromResults(
  results: ExerciseResultOut[] | undefined,
  ids: string[],
): MockRecord | null {
  if (!results || ids.length === 0) return null;
  const picked: Record<string, string> = {};
  for (const r of results)
    if (ids.includes(r.question_id) && r.answer) picked[r.question_id] = r.answer;
  return ids.every((id) => picked[id] !== undefined) ? { picked, seconds: 0, at: "" } : null;
}

export function score(exercises: McqExerciseOut[], picked: Record<string, string>): number {
  return mockQuestions(exercises).filter((q) => picked[q.id] === q.answer).length;
}

/** The highest band whose threshold the score reaches (bands ascend, the first at 0). */
export function bandFor(correct: number, bands: ReviewBandOut[]) {
  let index = 0;
  bands.forEach((b, i) => {
    if (correct >= b.min_correct) index = i;
  });
  const next = bands[index + 1] ?? null;
  return { band: bands[index]!, index, next, toNext: next ? next.min_correct - correct : 0 };
}

export interface SkillScore {
  right: number;
  total: number;
}

/** Right / asked, split into listening and reading (a question left blank counts as missed). */
export function skillScores(
  exercises: McqExerciseOut[],
  picked: Record<string, string>,
): { listening: SkillScore; reading: SkillScore } {
  const out = { listening: { right: 0, total: 0 }, reading: { right: 0, total: 0 } };
  for (const e of exercises) {
    const bucket = e.skill === "listening" ? out.listening : out.reading;
    for (const q of e.questions) {
      bucket.total += 1;
      if (picked[q.id] === q.answer) bucket.right += 1;
    }
  }
  return out;
}

/** A section's share of its 100 points (the real TOPIK I weighs a question 2–4 points by
 * difficulty; here every question of a section weighs the same, so this is an estimate). */
export const sectionPoints = (s: SkillScore) =>
  s.total > 0 ? Math.round((s.right / s.total) * 100) : 0;

export interface MockSummary {
  /** The big figure: "148" with `unit` "/ 200 điểm", or the number of right answers. */
  figure: string;
  unit: string;
  /** The level / band the result reaches. */
  label: string;
  /** The next level and how far away it is (in `gapUnit`), null at the top. */
  next: { label: string; gap: number } | null;
  gapUnit: string;
  /** Present for a TOPIK I-style set: the two sections out of 100 each. */
  points: { listening: number; reading: number; total: number } | null;
  correct: number;
  total: number;
}

/** What a mock result means: an estimated TOPIK I score when the set is built that way, else
 * the plain count of right answers against the ratio bands. */
export function summarize(
  exercises: McqExerciseOut[],
  picked: Record<string, string>,
  mock: ReviewMockOut,
): MockSummary {
  const total = mockQuestions(exercises).length;
  const correct = score(exercises, picked);
  const scale = mock.score;
  if (scale) {
    const sk = skillScores(exercises, picked);
    const listening = sectionPoints(sk.listening);
    const reading = sectionPoints(sk.reading);
    const sum = listening + reading;
    let index = 0;
    scale.bands.forEach((b, i) => {
      if (sum >= b.min_score) index = i;
    });
    const next = scale.bands[index + 1] ?? null;
    return {
      figure: String(sum),
      unit: "/ 200 điểm (ước lượng)",
      label: scale.bands[index]!.label_vi,
      next: next ? { label: next.label_vi, gap: next.min_score - sum } : null,
      gapUnit: "điểm",
      points: { listening, reading, total: sum },
      correct,
      total,
    };
  }
  const { band, next, toNext } = bandFor(correct, mock.bands);
  return {
    figure: String(correct),
    unit: `/ ${total} câu đúng`,
    label: band.label_vi,
    next: next ? { label: next.label_vi, gap: toNext } : null,
    gapUnit: "câu",
    points: null,
    correct,
    total,
  };
}

export interface PatternStat {
  pattern: string;
  right: number;
  total: number;
}

/** Right / asked per grammar pattern across the mock (a question counts for every pattern it
 * is linked to; a question left blank counts as missed). */
export function patternStats(
  exercises: McqExerciseOut[],
  picked: Record<string, string>,
): Map<string, PatternStat> {
  const stats = new Map<string, PatternStat>();
  for (const q of mockQuestions(exercises)) {
    const ok = picked[q.id] === q.answer;
    for (const pattern of q.grammar ?? []) {
      const s = stats.get(pattern) ?? { pattern, right: 0, total: 0 };
      s.total += 1;
      if (ok) s.right += 1;
      stats.set(pattern, s);
    }
  }
  return stats;
}

export interface FunctionStat {
  fn: ReviewFunctionOut;
  right: number;
  total: number;
  patterns: PatternStat[];
}

/** The pattern stats added up per function of the grammar map; functions the mock never
 * touched are left out. */
export function functionStats(
  functions: ReviewFunctionOut[],
  stats: Map<string, PatternStat>,
): FunctionStat[] {
  const out: FunctionStat[] = [];
  for (const fn of functions) {
    const patterns = fn.patterns.flatMap((p) => (stats.has(p) ? [stats.get(p)!] : []));
    const total = patterns.reduce((n, p) => n + p.total, 0);
    if (total === 0) continue;
    out.push({ fn, right: patterns.reduce((n, p) => n + p.right, 0), total, patterns });
  }
  return out;
}

const compile = (source: string): RegExp | null => {
  try {
    return new RegExp(source, "u");
  } catch {
    try {
      return new RegExp(source);
    } catch {
      return null;
    }
  }
};

/** For each required pattern, whether the learner's text uses it (a regex heuristic, so a
 * tick means "looks used", not "used correctly"). */
export function detect(text: string, required: CapstoneDetectorOut[]): boolean[] {
  return required.map((r) => compile(r.regex)?.test(text) ?? false);
}

export const mmss = (totalSeconds: number) => {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Where the Viết 54 draft (kept by WriteEssay) and the ticks for the spoken answer are stored. */
export const essayDraftKey = (lessonId: number, essayId: string) => `draft:${lessonId}:${essayId}`;
export const speakTickKey = (lessonId: number) => `capstone-speak:${lessonId}`;
