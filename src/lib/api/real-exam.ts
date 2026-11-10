import { API_BASE_URL, apiFetch, tokenStore } from "./client";
import type {
  RxAnswerIn,
  RxAnswerOut,
  RxExamDetailOut,
  RxHintOut,
  RxLessonOut,
  RxOverviewOut,
  RxScopeIn,
  RxSelfCheckIn,
  RxSelfCheckOut,
  RxSetOut,
  RxSummaryOut,
  RxTypeDetailOut,
} from "./types";

const BASE = "/api/v1/me/real-exam";

/** Login required for all of these: the papers are for the owner's own study. */
export const getRealExam = () => apiFetch<RxOverviewOut>(BASE);

export const getRealExamType = (code: string) =>
  apiFetch<RxTypeDetailOut>(`${BASE}/types/${encodeURIComponent(code)}`);

export const getRealExamPaper = (exam: string) =>
  apiFetch<RxExamDetailOut>(`${BASE}/exams/${encodeURIComponent(exam)}`);

/** The real questions a lesson offers as "Thử sức TOPIK II", each with a primer. */
export const getRealExamLesson = (lessonId: number) =>
  apiFetch<RxLessonOut>(`${BASE}/lessons/${lessonId}`);

/** A sitting for this scope (nothing = the app chooses). 409 `nothing_to_practice` when
 * every question in the scope is resting. */
export const createRealExamSet = (scope: RxScopeIn) =>
  apiFetch<RxSetOut>(`${BASE}/sets`, { method: "POST", json: scope });

export const getRealExamSet = (id: string) =>
  apiFetch<RxSetOut>(`${BASE}/sets/${encodeURIComponent(id)}`);

export const getRealExamSetAnswers = (id: string) =>
  apiFetch<RxAnswerOut[]>(`${BASE}/sets/${encodeURIComponent(id)}/answers`);

export const openRealExamHint = (id: string, qid: string, level: number) =>
  apiFetch<RxHintOut>(`${BASE}/sets/${encodeURIComponent(id)}/hint`, {
    method: "POST",
    json: { qid, level },
  });

export const answerRealExam = (id: string, body: RxAnswerIn) =>
  apiFetch<RxAnswerOut>(`${BASE}/sets/${encodeURIComponent(id)}/answer`, {
    method: "POST",
    json: body,
  });

export const selfCheckRealExam = (attemptId: string, body: RxSelfCheckIn) =>
  apiFetch<RxSelfCheckOut>(`${BASE}/attempts/${encodeURIComponent(attemptId)}/self-check`, {
    method: "POST",
    json: body,
  });

export const getRealExamSummary = (id: string) =>
  apiFetch<RxSummaryOut>(`${BASE}/sets/${encodeURIComponent(id)}/summary`);

export const finishRealExamSet = (id: string) =>
  apiFetch<RxSummaryOut>(`${BASE}/sets/${encodeURIComponent(id)}/finish`, { method: "POST" });

/** A picture of a question, fetched with the login token (the image URL is behind login, so an
 * <img src> cannot carry it) and handed back as a blob URL the caller must revoke. */
export async function fetchExamImage(path: string): Promise<string> {
  const token = tokenStore.get();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`image ${res.status}`);
  return URL.createObjectURL(await res.blob());
}
