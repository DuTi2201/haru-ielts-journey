import type { LessonSummaryOut, LessonTrack } from "@/lib/api/types";

/** Sơ cấp / Trung cấp / Cao cấp, lowest first — the order the picker lists them. */
export const TRACK_ORDER: readonly LessonTrack[] = ["beginner", "intermediate", "advanced"];

export const TRACK_LABEL: Record<LessonTrack, string> = {
  beginner: "Sơ cấp",
  intermediate: "Trung cấp",
  advanced: "Cao cấp",
};

/** Hanji Pop tone of each track's chip. */
export const TRACK_TONE: Record<LessonTrack, string> = {
  beginner: "bg-green-soft text-ink",
  intermediate: "bg-blue-soft text-blue-deep",
  advanced: "bg-purple-soft text-ink",
};

/** "12 từ · 3 ngữ pháp · 14 câu luyện" — a part that is zero is left out. */
export function lessonContentLine(
  l: Pick<LessonSummaryOut, "vocab_count" | "grammar_count" | "practice" | "kind">,
) {
  if (l.kind === "review") {
    const by = l.practice?.by_skill ?? {};
    const mock = (by.listening ?? 0) + (by.reading ?? 0);
    return [
      mock > 0 ? `${mock} câu thi thử` : "",
      (by.writing ?? 0) > 0 ? "Viết 54" : "",
      (by.speaking ?? 0) > 0 ? "Nói S6" : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const parts: string[] = [];
  if (l.vocab_count > 0) parts.push(`${l.vocab_count} từ`);
  if (l.grammar_count > 0) parts.push(`${l.grammar_count} ngữ pháp`);
  if (l.practice && l.practice.questions > 0) parts.push(`${l.practice.questions} câu luyện`);
  return parts.join(" · ");
}

/** Minutes a lesson takes at a steady pace, from what is in it (first pass; reviews come later):
 * a word ~25 s (hear, read, flip), a grammar card ~2.5 min (read, examples, one check), a
 * practice question ~35 s. Rough on purpose: it is shown rounded to 15-minute sittings. */
export function lessonMinutes(
  l: Pick<LessonSummaryOut, "vocab_count" | "grammar_count" | "practice">,
): number {
  return l.vocab_count * 0.42 + l.grammar_count * 2.5 + (l.practice?.questions ?? 0) * 0.6;
}

/** How many ~15-minute sittings a lesson is, at least one. */
export const lessonSittings = (l: Parameters<typeof lessonMinutes>[0]) =>
  Math.max(1, Math.round(lessonMinutes(l) / 15));

/** What a lesson card says instead of raw totals: "≈ 15 phút" or "≈ 4 buổi · 15 phút/buổi". */
export function lessonTimeLine(l: Parameters<typeof lessonMinutes>[0]): string {
  const n = lessonSittings(l);
  return n === 1 ? "≈ 15 phút" : `≈ ${n} buổi · 15 phút/buổi`;
}

/** react-query key of a learner's practice progress in one lesson. */
export const lessonProgressKey = (lessonId: number) => ["lesson-progress", lessonId] as const;

/** react-query key of where a learner stands in one lesson (cards marked, part left to do). */
export const lessonStudyKey = (lessonId: number) => ["lesson-study", lessonId] as const;

/** react-query key of the learner's Sổ lỗi sai (the practice questions they have wrong). */
export const MISTAKE_BOOK_KEY = ["me", "mistakes"] as const;

/** The topic a lesson is filed under ("Khác" for a lesson with none). */
export const topicOf = (l: Pick<LessonSummaryOut, "topics">) => l.topics[0] ?? "Khác";

/** A topic named "Bổ trợ · …" is extra study (immigration paperwork, writing from scratch, …) that
 * sits beside the main sequence rather than in it: the picker lists those topics apart. (Not to
 * be confused with the "Bổ trợ" label on a grammar card, which only says it can wait.) */
const SUPPLEMENT_PREFIX = /^Bổ trợ\s*[·:–-]\s*/u;
export const isSupplementTopic = (topic: string) => SUPPLEMENT_PREFIX.test(topic.normalize("NFC"));
/** The topic's name as shown: "Bổ trợ · Nhập cảnh" is shown as "Nhập cảnh" (the group says the rest). */
export const topicTitle = (topic: string) =>
  topic.normalize("NFC").replace(SUPPLEMENT_PREFIX, "").trim() || topic;

/** The lessons of one topic within one track, in the order the API lists them. */
export interface TopicGroup {
  track: LessonTrack | null;
  topic: string;
  /** What the card says: the topic's name, with its level when the topic spans two levels
   * ("Sinh hoạt hàng ngày · Sơ cấp": the Nền tảng parts, Buổi sáng and Việc nhà are Sơ cấp, the rest of the topic Trung cấp). */
  title: string;
  lessons: LessonSummaryOut[];
}

/** Lessons grouped by (track, topic): tracks lowest first, lessons without a track last,
 * topics in the order they first appear. */
export function groupByTopic(lessons: LessonSummaryOut[]): TopicGroup[] {
  const groups: TopicGroup[] = [];
  const order: (LessonTrack | null)[] = [...TRACK_ORDER, null];
  for (const track of order) {
    for (const l of lessons) {
      if ((l.track ?? null) !== track) continue;
      const topic = topicOf(l);
      const group = groups.find((g) => g.track === track && g.topic === topic);
      if (group) group.lessons.push(l);
      else groups.push({ track, topic, title: topicTitle(topic), lessons: [l] });
    }
  }
  for (const g of groups) {
    if (g.track && groups.some((o) => o !== g && o.topic === g.topic))
      g.title = `${topicTitle(g.topic)} · ${TRACK_LABEL[g.track]}`;
  }
  return groups;
}

/** What a topic card says about its lessons, added up. `mastered` is null while signed out. */
export function topicStats(all: LessonSummaryOut[]) {
  // the review lesson closes the topic but adds no words or cards, so it is kept out of the sums
  const review = all.find((l) => l.kind === "review") ?? null;
  const lessons = all.filter((l) => l.kind !== "review");
  const vocab = lessons.reduce((n, l) => n + l.vocab_count, 0);
  const grammar = lessons.reduce((n, l) => n + l.grammar_count, 0);
  const questions = lessons.reduce((n, l) => n + (l.practice?.questions ?? 0), 0);
  const tracked = lessons.some((l) => l.mastered !== null);
  const mastered = tracked ? lessons.reduce((n, l) => n + (l.mastered ?? 0), 0) : null;
  const total = vocab + grammar;
  const lessonsDone = tracked
    ? lessons.filter((l) => {
        const t = l.vocab_count + l.grammar_count;
        return t > 0 && (l.mastered ?? 0) >= t;
      }).length
    : null;
  return {
    lessonsDone,
    review,
    count: lessons.length,
    vocab,
    grammar,
    questions,
    total,
    mastered,
    // feathers of Hành trình thiên nga, summed from the same per-lesson counts the Journey uses
    // (null while signed out or when the topic has none)
    feathers: (() => {
      const all = [...lessons, ...(review ? [review] : [])];
      const total = all.reduce((n, l) => n + (l.feathers_total ?? 0), 0);
      if (total === 0 || !all.some((l) => l.feathers_earned != null)) return null;
      return { total, earned: all.reduce((n, l) => n + (l.feathers_earned ?? 0), 0) };
    })(),
    finished: mastered !== null && total > 0 && mastered >= total,
    hasNext: all.some((l) => l.is_next),
    // the topic's own cover first, then the lessons' banners, for the topic card's picture
    pictures: [
      ...lessons.flatMap((l) => (l.topic_image_url ? [l.topic_image_url] : [])).slice(0, 1),
      ...lessons.flatMap((l) => (l.image_url ? [l.image_url] : [])),
    ],
  };
}
