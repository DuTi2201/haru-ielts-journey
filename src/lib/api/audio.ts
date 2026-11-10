import { API_BASE_URL, apiFetch } from "./client";
import type {
  ArticleAudioRequest,
  CorpusAudioRequest,
  JobAccepted,
  PodcastRequest,
  TextAudioRequest,
  VocabAudioRequest,
} from "./types";

/** POST /corpus/{corpus_item_id}/audio — content-addressed: if this exact
 * (corpus_item_id, voice, prompt_version) was already synthesized, the
 * backend returns an already-succeeded job (no new Gemini call, no wait).
 * No login required — see app/api/routers/audio.py's docstring. */
export const requestCorpusAudio = (corpusItemId: string, body: CorpusAudioRequest) =>
  apiFetch<JobAccepted>(`/api/v1/corpus/${encodeURIComponent(corpusItemId)}/audio`, {
    method: "POST",
    json: { voice: "ko-female-1", prompt_version: "v2", ...body },
  });

/** POST /vocab-items/{vocab_item_id}/audio — same content-addressed cache
 * as corpus audio, but for one vocab flashcard's headword. Covers both the
 * lesson-flashcard screen and an editorial article's vocab list, since
 * both read the exact same VocabItem rows. No login required. */
export const requestVocabAudio = (vocabItemId: number, body: VocabAudioRequest) =>
  apiFetch<JobAccepted>(`/api/v1/vocab-items/${vocabItemId}/audio`, {
    method: "POST",
    json: { voice: "ko-female-1", prompt_version: "v1", ...body },
  });

/** POST /audio/text — the recording of ANY Korean text (a reading passage, a
 * dialogue line). The server looks the text up in its store first (a hash of
 * text + voice + version): found → the job comes back already succeeded and the
 * clip plays at once; not found → Chirp voices it once, it is stored, and every
 * later play of the same text, on any device, is free. Needs a login (this door
 * turns text into paid speech); Korean only, up to 600 characters (422 else). */
export const requestTextAudio = (body: TextAudioRequest) =>
  apiFetch<JobAccepted>(`/api/v1/audio/text`, {
    method: "POST",
    json: { voice: "ko-female-1", prompt_version: "v1", ...body },
  });

/** POST /lessons/{lesson_id}/podcast — ONE consolidated lecture covering every
 * vocab word + grammar point of the lesson (not per-word TTS).
 *   mode "template" (default): a fixed script built from the lesson itself,
 *     voiced by Chirp — same words every time, no model involved;
 *   mode "story": Gemini retells the lesson (long lessons are written in parts
 *     and joined), then it is voiced.
 * Each mode is stored and reused under its own key, which follows the lesson's
 * content, so editing a lesson regenerates it. No login required. */
export const requestLessonPodcast = (lessonId: string | number, body: PodcastRequest = {}) =>
  apiFetch<JobAccepted>(`/api/v1/lessons/${encodeURIComponent(String(lessonId))}/podcast`, {
    method: "POST",
    json: { voice: "ko-female-1", prompt_version: "podcast-v2", mode: "template", ...body },
  });

/** POST /lessons/{lesson_id}/exercises/{exercise_id}/audio — the recorded dialogue
 * of a listening question (a woman's and a man's Chirp voice). Stored once and
 * shared by every lesson that holds the same exercise; 404 when the exercise has
 * no spoken turns. No login required. */
export const requestExerciseAudio = (lessonId: string | number, exerciseId: string) =>
  apiFetch<JobAccepted>(
    `/api/v1/lessons/${encodeURIComponent(String(lessonId))}/exercises/${encodeURIComponent(exerciseId)}/audio`,
    { method: "POST" },
  );

/** POST /editorials/{article_id}/podcast — same consolidated-lecture
 * podcast, for one editorial article's vocab/grammar instead of a
 * lesson's. */
export const requestEditorialPodcast = (articleId: string, body: PodcastRequest = {}) =>
  apiFetch<JobAccepted>(`/api/v1/editorials/${encodeURIComponent(articleId)}/podcast`, {
    method: "POST",
    json: { voice: "ko-female-1", prompt_version: "podcast-v2", ...body },
  });

/** POST /editorials/{article_id}/audio — reads the article's OWN scraped
 * body_en text aloud verbatim, no Gemini script-writing step. Completely
 * independent feature/cache from requestEditorialPodcast above: a learner
 * hearing the real news article and a learner hearing a teaching script
 * ABOUT its vocab/grammar are two different study modes. Content-addressed
 * server-side off a hash of body_en itself, so a later text backfill
 * naturally busts stale audio. No login required. */
export const requestArticleAudio = (articleId: string, body: ArticleAudioRequest = {}) =>
  apiFetch<JobAccepted>(`/api/v1/editorials/${encodeURIComponent(articleId)}/audio`, {
    method: "POST",
    json: { voice: "ko-female-1", prompt_version: "article-v1", ...body },
  });

/** Job `result.opus_path`/`aac_path` are already absolute API paths
 * (e.g. "/api/v1/corpus/audio/<cache_key>.opus") — just prefix the API
 * base URL so an <audio> tag can point straight at them. */
export const audioUrl = (path: string) => `${API_BASE_URL}${path}`;

/** The slides of a lesson's lecture, with a cue for every line of its script (lib/lecture-slides.ts). */
export const getLectureSlides = (lessonId: string | number, sitting?: number) =>
  apiFetch<import("@/lib/lecture-slides").LectureSlidesOut>(
    `/api/v1/lessons/${lessonId}/lecture-slides${sitting ? `?sitting=${sitting}` : ""}`,
  );

/** Which lecture recordings of a lesson already exist (the whole lesson's, and each sitting's).
 * Only looks them up: nothing is made and nothing is spent. */
export interface LectureStatus {
  whole: { ready: boolean; duration_sec: number | null };
  sittings: { n: number; ready: boolean; duration_sec: number | null }[];
}
export const getLectureStatus = (lessonId: string | number) =>
  apiFetch<LectureStatus>(`/api/v1/lessons/${encodeURIComponent(String(lessonId))}/lecture-status`);
