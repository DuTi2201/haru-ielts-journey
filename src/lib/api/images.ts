import { API_BASE_URL, apiFetch } from "./client";
import type {
  ImageGenerateRequest,
  ImageReusedOut,
  ImagesOverviewOut,
  ImagesReusedOut,
  JobAccepted,
  LessonImagesOut,
} from "./types";

/** Lesson/word/grammar/scene pictures come back as API paths
 * ("/api/v1/lessons/scene-image/<key>?v=<time drawn>"): prefix the API base so an
 * <img> can point straight at them (the app is served from another origin). The `v`
 * changes when a picture is drawn again, so the browser's year-long cache never keeps
 * a replaced one. */
export const pictureUrl = (path: string) =>
  /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path}`;

// ---- Studio (editor / admin) ------------------------------------------------
/** Per lesson: pictures wanted, drawn, hidden — and the run in progress, if any. */
export const getImagesOverview = () => apiFetch<ImagesOverviewOut>(`/api/v1/lesson-images`);

/** Every picture one lesson wants, with its prompt and state. */
export const getLessonImages = (lessonId: number) =>
  apiFetch<LessonImagesOut>(`/api/v1/lessons/${lessonId}/images`);

/** Draws what is missing in the background (one run at a time: pressing it while a run
 * is going returns that run). A picture already made is only drawn again when `force`
 * names it in `keys`. */
export const startImageDrawing = (body: ImageGenerateRequest) =>
  apiFetch<JobAccepted>(`/api/v1/lesson-images`, { method: "POST", json: body });

/** Takes a picture off the lessons (or puts it back) without deleting it. */
export const setImageHidden = (key: string, hidden: boolean) =>
  apiFetch<{ key: string; hidden: boolean }>(`/api/v1/lesson-images/${encodeURIComponent(key)}`, {
    method: "PATCH",
    json: { hidden },
  });

/** Gives a word that has no picture a copy of another word's picture (same meaning): no
 * Gemini call, nothing paid. Refused while a drawing run is going. */
export const reuseImage = (fromKey: string, toKey: string) =>
  apiFetch<ImageReusedOut>(`/api/v1/lesson-images/reuse`, {
    method: "POST",
    json: { from_key: fromKey, to_key: toKey },
  });

/** Fills every missing word picture (of one lesson, or of all) that has a SURE match. */
export const reuseSuggestedImages = (lessonId?: number) =>
  apiFetch<ImagesReusedOut>(`/api/v1/lesson-images/reuse-suggested`, {
    method: "POST",
    json: lessonId === undefined ? {} : { lesson_id: lessonId },
  });
