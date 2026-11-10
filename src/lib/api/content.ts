import { apiFetch } from "./client";
import type {
  CorpusFacetsOut,
  DailyFinishOut,
  DailyReadingOut,
  CorpusItemOut,
  CorpusPageOut,
  CorpusSimilarOut,
  ItemStateOut,
  ExerciseAnswerRequest,
  ExerciseResultOut,
  ItemStateReviewRequest,
  LessonOut,
  LessonPracticeOut,
  LessonProgressOut,
  FeatherOut,
  LessonStudyOut,
  LessonSummaryOut,
  CompetencyOut,
  MixOut,
  AdaptiveFinishIn,
  AdaptiveResultOut,
  AdaptiveStepIn,
  AdaptiveStepOut,
  PlacementAnswerIn,
  PlacementOut,
  PlacementSummaryOut,
  ReviewOnlyOut,
  ReviewQueueOut,
  TodayPlanOut,
} from "./types";

/** The lesson picker: every lesson with something to study. Public; when a
 * token is sent each row also carries the learner's progress. */
export const listLessons = () => apiFetch<LessonSummaryOut[]>(`/api/v1/lessons`);

/** lessonId may be a numeric id (as a string) or the literal "today". */
export const getLesson = (lessonId: string) =>
  apiFetch<LessonOut>(`/api/v1/lessons/${encodeURIComponent(lessonId)}`);

/** The lesson's whole practice set (nghe / đọc / viết / nói). Public; the answers
 * and explanations ship with it because the browser grades at once. */
export const getLessonPractice = (lessonId: number | string) =>
  apiFetch<LessonPracticeOut>(`/api/v1/lessons/${encodeURIComponent(String(lessonId))}/practice`);

/** Login required — which practice questions this learner has answered, and how. */
export const getLessonProgress = (lessonId: number | string) =>
  apiFetch<LessonProgressOut>(`/api/v1/lessons/${encodeURIComponent(String(lessonId))}/progress`);

/** Login required — where the learner stands in this lesson: which words / cards have a record
 * (and the last answer to each), the practice answered, and the part left to do. */
export const getLessonStudy = (lessonId: number | string) =>
  apiFetch<LessonStudyOut>(`/api/v1/lessons/${encodeURIComponent(String(lessonId))}/study`);

/** Login required — the learner finished a part of a lesson that leaves no other record (the
 * alphabet lesson's five parts): its feather is earned. Returns the lesson's feathers. */
export const finishLessonPart = (lessonId: number | string, partId: string) =>
  apiFetch<FeatherOut[]>(
    `/api/v1/lessons/${encodeURIComponent(String(lessonId))}/parts/${encodeURIComponent(partId)}`,
    { method: "POST" },
  );

/** Login required — records one answer (a wrong one also lands in the error log). */
export const postLessonAnswer = (lessonId: number | string, body: ExerciseAnswerRequest) =>
  apiFetch<ExerciseResultOut>(`/api/v1/lessons/${encodeURIComponent(String(lessonId))}/answers`, {
    method: "POST",
    json: body,
  });

export interface ListCorpusItemsParams {
  level?: number | undefined;
  limit?: number | undefined;
}

/** What the listening picker can filter by, with sentence counts. */
export const getCorpusFacets = () => apiFetch<CorpusFacetsOut>(`/api/v1/corpus/facets`);

export interface BrowseCorpusParams {
  level?: number | undefined;
  topic?: number | undefined;
  register?: string | undefined;
  grammar?: number | undefined;
  film?: number | undefined;
  /** Fixes the order: the same seed with offset 0, 10, 20… never repeats a sentence. */
  seed?: string | undefined;
  offset?: number | undefined;
  limit?: number | undefined;
}

/** A page of distinct sentences matching the filters (see BrowseCorpusParams.seed). */
export function browseCorpus(params: BrowseCorpusParams = {}) {
  const qs = new URLSearchParams();
  if (params.level !== undefined) qs.set("level", String(params.level));
  if (params.topic !== undefined) qs.set("topic_id", String(params.topic));
  if (params.register) qs.set("register", params.register);
  if (params.grammar !== undefined) qs.set("grammar_id", String(params.grammar));
  if (params.film !== undefined) qs.set("film_id", String(params.film));
  if (params.seed) qs.set("seed", params.seed);
  if (params.offset) qs.set("offset", String(params.offset));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<CorpusPageOut>(`/api/v1/corpus/browse${suffix}`);
}

/** The same idea said another way (other ending / word forms), nearest first. */
export const getSimilarCorpus = (itemId: string) =>
  apiFetch<CorpusSimilarOut[]>(`/api/v1/corpus/items/${encodeURIComponent(itemId)}/similar`);

export function listCorpusItems(params: ListCorpusItemsParams = {}) {
  const qs = new URLSearchParams();
  if (params.level !== undefined) qs.set("level", String(params.level));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<CorpusItemOut[]>(`/api/v1/corpus/items${suffix}`);
}

export const recordItemReview = (body: ItemStateReviewRequest) =>
  apiFetch<ItemStateOut>(`/api/v1/progress/reviews`, { method: "POST", json: body });

type ItemType = ItemStateReviewRequest["item_type"];
const knownPath = (type: ItemType, id: number) =>
  `/api/v1/srs/items/${type}/${encodeURIComponent(String(id))}/known`;

/** "Đã biết": the card leaves the review queue (never new, never due) until undone. */
export const markKnown = (type: ItemType, id: number) =>
  apiFetch<ItemStateOut>(knownPath(type, id), { method: "POST" });

/** Undo "Đã biết": the card goes back where it was (new again if it was never studied). */
export const unmarkKnown = (type: ItemType, id: number) =>
  apiFetch<void>(knownPath(type, id), { method: "DELETE" });

/** "Hôm nay bận — chỉ ôn": no new cards today (it lapses on its own tomorrow). */
export const setReviewOnly = (on: boolean) =>
  apiFetch<ReviewOnlyOut>(`/api/v1/me/review-only`, { method: "PUT", json: { on } });

/** Login required — real streak/readiness/task data derived from the
 * learner's own ItemState history and confirmed content, never a mock. */
export const getMyPlan = () => apiFetch<TodayPlanOut>(`/api/v1/me/plan`);

export interface ReviewQueueParams {
  /** Most due cards in one sitting. */
  limit?: number | undefined;
  /** Most new cards per rolling 24 hours. */
  newCards?: number | undefined;
  /** "weak": only the cards the learner keeps forgetting, due or not. */
  focus?: "due" | "weak" | undefined;
}

/** Login required — today's sitting: due cards first, then new ones; a due card
 * that was answered right before may come as a fill-in-the-blank. */
export function getReviewQueue(params: ReviewQueueParams = {}) {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.newCards !== undefined) qs.set("new", String(params.newCards));
  if (params.focus === "weak") qs.set("focus", "weak");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<ReviewQueueOut>(`/api/v1/me/review-queue${suffix}`);
}

/** Login required — the mixed review for the end of a lesson: exercises of this and earlier
 * lessons about the grammar cards the learner has met (due first, then answered wrong, then
 * not done yet). Each item is answered under its own lesson. */
export const getLessonMix = (lessonId: number | string, limit?: number) =>
  apiFetch<MixOut>(
    `/api/v1/lessons/${encodeURIComponent(String(lessonId))}/mix${limit ? `?limit=${limit}` : ""}`,
  );

/** Login required — what the learner can do, per topic: met, used, remembered, weak spots, next steps. */
export const getMyCompetency = () => apiFetch<CompetencyOut>(`/api/v1/me/competency`);

/** Login required — the entry diagnostic (graded here; the answers come back whole). */
export const getPlacement = () => apiFetch<PlacementOut>(`/api/v1/placement`);

/** Login required — the latest diagnostic result, or null when it was never taken. */
export const getMyPlacement = () => apiFetch<PlacementSummaryOut | null>(`/api/v1/me/placement`);

/** Login required — the adaptive entry check: the answers so far -> the next question, or done. */
export const placementNext = (body: AdaptiveStepIn) =>
  apiFetch<AdaptiveStepOut>(`/api/v1/me/placement/next`, { method: "POST", json: body });

/** Login required — the survey and the answers -> the result and the road (stored). */
export const finishPlacement = (body: AdaptiveFinishIn) =>
  apiFetch<AdaptiveResultOut>(`/api/v1/me/placement/adaptive`, { method: "POST", json: body });

/** Login required — the latest adaptive result, or null. */
export const getAdaptivePlacement = () =>
  apiFetch<AdaptiveResultOut | null>(`/api/v1/me/placement/adaptive`);

/** Login required — stores one sitting of the diagnostic. */
export const submitPlacement = (answers: PlacementAnswerIn[]) =>
  apiFetch<PlacementSummaryOut>(`/api/v1/me/placement`, { method: "POST", json: { answers } });

/** Login required — today's dialogue and reading, drawn from the grammar the
 * learner has already met (weak or due cards come up more often). The same two
 * all day; a new draw tomorrow. Voice them with POST /audio/text. */
export const getDailyReading = () => apiFetch<DailyReadingOut>(`/api/v1/me/daily-reading`);

/** Grades one of today's texts on the server (one answer per question, null =
 * blank) and explains every answer. The first submission is the one kept. */
export const finishDailyReading = (passageId: string, answers: (number | null)[]) =>
  apiFetch<DailyFinishOut>(`/api/v1/me/daily-reading/${encodeURIComponent(passageId)}/finish`, {
    method: "POST",
    json: { answers },
  });
