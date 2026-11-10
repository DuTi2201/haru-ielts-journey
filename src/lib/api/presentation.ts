import { apiFetch } from "./client";

/** "Trình bày với Haru" — see the backend's app.api.routers.presentation. */

export type PresentPartKey =
  | "point"
  | "reason"
  | "example"
  | "other_side"
  | "conclusion"
  | "opening"
  | "content"
  | "evidence"
  | "limitation";
export type PresentMode = "topic" | "defense";
export type PresentCriterion = "coherence" | "development" | "connectives" | "language" | "fluency";

export interface PresentFrame {
  band: number;
  mode: PresentMode;
  /** [min, max] seconds of speaking the band aims at. */
  target_seconds: [number, number];
  /** The recording stops on its own here. */
  max_seconds: number;
  parts: { key: PresentPartKey; label_vi: string; hint_vi: string; starters: string[] }[];
}

export interface PresentTopic {
  question_ko: string;
  question_vi: string;
  angle_vi: string;
  words: { ko: string; vi: string }[];
  source: string;
}

export interface PresentOutlinePart {
  part: PresentPartKey;
  label_vi: string;
  idea_vi: string;
  keywords_ko: string[];
  starter_ko: string;
  /** Haru proposed the idea: the learner's notes had none for this part. */
  suggested: boolean;
  /** Studied items that fit this part. */
  targets: { key: string; ko: string }[];
}

export interface PresentMetrics {
  seconds: number;
  speaking_seconds: number;
  voiced_seconds: number;
  pauses: number;
  long_pauses: number;
  longest_pause: number;
  fillers: number;
  syllables: number;
  syllables_per_sec: number | null;
  in_target: boolean;
  /** Trôi chảy measured against the band's targets (1-5), before blending with the model. */
  fluency_measured: number | null;
}

export interface PresentEval {
  transcript_ko: string;
  off_topic: boolean;
  parts: {
    part: PresentPartKey;
    label_vi: string;
    present: boolean;
    said_ko: string;
    note_vi: string;
  }[];
  scores: Record<PresentCriterion, number>;
  score_notes_vi: Partial<Record<PresentCriterion, string>>;
  overall: number;
  connectives_used: string[];
  strength_vi: string;
  tips_vi: string[];
  upgraded: { part: PresentPartKey; label_vi: string; ko: string; vi: string }[];
  pron_issues: { word: string; heard_as: string; kind: string; tip_vi: string }[];
  compare_vi: string;
  targets_used: {
    key: string;
    kind: string;
    ko: string;
    vi: string;
    used: boolean;
    correct: boolean;
    said_ko: string;
    note_vi: string;
  }[];
  stretch: { ko: string; vi: string; why_vi: string }[];
  follow_ups: { q_ko: string; q_vi: string; kind: string }[];
}

export type AnswerCriterion = "directness" | "support" | "language";

export interface PresentAnswer {
  transcript_ko: string;
  scores: Record<AnswerCriterion, number>;
  overall: number;
  note_vi: string;
  better_ko: string;
  better_vi: string;
  seconds: number;
  pauses: number;
  fillers: number;
  tries: number;
}

export interface PresentAttempt {
  index: number;
  at: string;
  metrics: PresentMetrics;
  eval: PresentEval;
  /** By follow-up question index. */
  answers: Record<string, PresentAnswer>;
  /** On a round's first try: how it moved the presentation band. */
  verdict?: number;
  band_after?: number;
}

export interface PresentTarget {
  key: string;
  kind: "grammar" | "word" | "phrase";
  ko: string;
  vi: string;
  example_ko: string;
  why_vi: string;
}

export interface PresentSession {
  id: string;
  mode: PresentMode;
  title: string;
  material: string;
  band: number;
  band_label_vi: string;
  /** The learner's presentation band; `band` = base_band + shift for this round. */
  base_band: number | null;
  shift: number;
  focus: PresentCriterion | null;
  focus_label_vi: string | null;
  targets: PresentTarget[];
  answer_criteria: Record<AnswerCriterion, string>;
  frame: PresentFrame;
  topic: PresentTopic;
  lesson: { id: number; title: string } | null;
  outline: PresentOutlinePart[] | null;
  notes_vi: string;
  attempts: PresentAttempt[];
  attempts_left: number;
  attempts_left_today: number | null;
  criteria: Record<PresentCriterion, string>;
}

export interface PresentIdea {
  tool_vi: string;
  stance_vi: string;
  reason_vi: string;
  example_vi: string;
  hook_ko: string;
  hook_vi: string;
}

export interface PresentRow {
  id: string;
  created_at: string;
  mode: PresentMode;
  title_ko: string;
  band: number;
  tries: number;
  first_overall: number | null;
  best_overall: number | null;
  answers: number;
}

export interface PresentInsights {
  rounds: number;
  present_band: number;
  band_label_vi: string;
  /** What a 4 means at the learner's band, per criterion label. */
  band_rubric_vi: Record<string, string>;
  focus: PresentCriterion | null;
  focus_label_vi: string | null;
  points: {
    at: string;
    overall: number;
    scores: Record<PresentCriterion, number>;
    band: number;
    mode: PresentMode;
  }[];
  best_overall: number | null;
  mastered: { key: string; ko: string; vi: string; kind: string; ok: number }[];
  practicing: { key: string; ko: string; vi: string; kind: string; ok: number; miss: number }[];
  answer_avg: number | null;
}

export interface PresentStart {
  mode?: PresentMode;
  band_shift?: -1 | 0 | 1;
  title?: string;
  material?: string;
  /** "topic": a question from this lesson; none: the lesson studied last. */
  lesson_id?: number;
}

export const startPresentation = (body: PresentStart = {}) =>
  apiFetch<PresentSession>("/api/v1/me/presentations", { method: "POST", json: body });

export const listPresentations = (limit = 30) =>
  apiFetch<PresentRow[]>(`/api/v1/me/presentations?limit=${limit}`);

export const getPresentInsights = () =>
  apiFetch<PresentInsights>("/api/v1/me/presentations/insights");

export const getPresentIdeas = (id: string) =>
  apiFetch<PresentIdea[]>(`/api/v1/me/presentations/${encodeURIComponent(id)}/ideas`, {
    method: "POST",
    json: {},
  });

export const sendPresentAnswer = (id: string, attempt: number, q: number, wav_b64: string) =>
  apiFetch<PresentSession>(
    `/api/v1/me/presentations/${encodeURIComponent(id)}/attempts/${attempt}/answers/${q}`,
    { method: "POST", json: { wav_b64 } },
  );

export const getPresentation = (id: string) =>
  apiFetch<PresentSession>(`/api/v1/me/presentations/${encodeURIComponent(id)}`);

export const makePresentOutline = (id: string, notes_vi: string) =>
  apiFetch<PresentSession>(`/api/v1/me/presentations/${encodeURIComponent(id)}/outline`, {
    method: "POST",
    json: { notes_vi },
  });

export const sendPresentAttempt = (id: string, wav_b64: string) =>
  apiFetch<PresentSession>(`/api/v1/me/presentations/${encodeURIComponent(id)}/attempts`, {
    method: "POST",
    json: { wav_b64 },
  });
