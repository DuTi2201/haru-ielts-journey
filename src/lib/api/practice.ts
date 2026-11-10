import { apiFetch } from "./client";
import type {
  EssayCheckOut,
  ExamAnswerOut,
  ExamAnswerRequest,
  ExamDrillOut,
  MistakeBookOut,
  WeaknessesOut,
  WritingAnswersRequest,
  WritingDrillOut,
  WritingDrillStartOut,
} from "./types";

/** Login required — where the learner keeps going wrong (counts, not a score). */
export const getWeaknesses = () => apiFetch<WeaknessesOut>(`/api/v1/me/weaknesses`);

/** Login required — Sổ lỗi sai: the practice questions the learner has wrong right now. */
export const getMistakeBook = () => apiFetch<MistakeBookOut>(`/api/v1/me/mistakes`);

/** "Đã hiểu" on one mistake (or taking it back); returns the whole book. */
export const setMistakeUnderstood = (lessonId: number, questionId: string, understood: boolean) =>
  apiFetch<MistakeBookOut>(`/api/v1/me/mistakes/understood`, {
    method: "PUT",
    json: { lesson_id: lessonId, question_id: questionId, understood },
  });

/** Login required — a few confirmed reading questions from real exam papers. The
 * answer key is never sent; it comes back with each answer. */
export function getExamDrill(n?: number) {
  const suffix = n !== undefined ? `?n=${n}` : "";
  return apiFetch<ExamDrillOut>(`/api/v1/me/exam-drill${suffix}`);
}

export const answerExamQuestion = (body: ExamAnswerRequest) =>
  apiFetch<ExamAnswerOut>(`/api/v1/me/exam-drill/answers`, { method: "POST", json: body });

/** Starts (or returns the one still waiting) a writing exercise built from the
 * learner's own cards. 202: follow `job_id` with useJobEvents while it is made. */
export const startWritingDrill = (deckKey?: string) =>
  apiFetch<WritingDrillStartOut>(`/api/v1/me/writing-drills`, {
    method: "POST",
    ...(deckKey ? { json: { deck_key: deckKey } } : {}),
  });

export const getWritingDrill = (drillId: string) =>
  apiFetch<WritingDrillOut>(`/api/v1/me/writing-drills/${encodeURIComponent(drillId)}`);

/** Sends the sentences for checking (202). An exercise is checked once. */
export const answerWritingDrill = (drillId: string, body: WritingAnswersRequest) =>
  apiFetch<WritingDrillStartOut>(
    `/api/v1/me/writing-drills/${encodeURIComponent(drillId)}/answers`,
    {
      method: "POST",
      json: body,
    },
  );

/** Login required — sends a lesson paragraph (write_essay) to be checked by AI (202). The same
 * text already checked is returned instead of checked again. Follow `job_id` while pending. */
export const startEssayCheck = (lessonId: number, exerciseId: string, text: string) =>
  apiFetch<EssayCheckOut>(
    `/api/v1/lessons/${lessonId}/essays/${encodeURIComponent(exerciseId)}/checks`,
    { method: "POST", json: { text } },
  );

/** The learner's last check of this paragraph, or null. */
export const getLatestEssayCheck = (lessonId: number, exerciseId: string) =>
  apiFetch<EssayCheckOut | null>(
    `/api/v1/lessons/${lessonId}/essays/${encodeURIComponent(exerciseId)}/checks/latest`,
  );
