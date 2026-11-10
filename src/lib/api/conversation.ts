import { apiFetch } from "./client";

/** "Trò chuyện với Haru" — see the backend's app.api.routers.conversation. */
export interface ConversationStartOut {
  session_id: string;
  /** Single-use Gemini Live token, to be opened within a minute. */
  token: string;
  ws_url: string;
  /** The BidiGenerateContentSetup the token is locked to; sent as the first WebSocket message. */
  setup: Record<string, unknown>;
  /** The app's own messages to the model, by step of the silence ladder. */
  nudges: Record<"start" | "easier" | "bilingual" | "hint" | "wrap_up", string> &
    Partial<Record<"slower" | "normal_pace", string>>;
  max_seconds: number;
  seconds_left_today: number;
  lesson: { id: number; title: string } | null;
  topic: string | null;
  earlier_lessons: string[];
  hints: {
    words: { ko: string; vi: string }[];
    frames: { ko: string; vi: string; pattern: string }[];
  };
  /** The conversation band (1-5) Haru talks at this time. */
  band: number;
  band_label_vi: string;
  band_note_vi: string;
  /** The step of a full answer Haru trains this time ("câu trọn + lý do"). */
  answer_goal_vi?: string;
}

export interface ConversationTurn {
  role: "learner" | "haru";
  text: string;
}

export interface ConversationReport {
  summary_vi: string;
  praise_vi: string;
  fixes: { said: string; better: string; why_vi: string }[];
  words: { ko: string; vi: string }[];
  next_time_vi: string;
  learner_facts: string[];
  topics_vi?: string[];
}

export interface ConversationFinishOut {
  session_id: string;
  seconds: number;
  learner_turns: number;
  report: ConversationReport | null;
  report_error_vi: string | null;
  band_before?: number | null;
  band_after?: number | null;
  band_note_vi?: string | null;
}

export interface TalkProfile {
  band: number;
  band_label_vi: string;
  band_note_vi: string;
  /** What Haru remembers about the learner (only what they allowed), newest first. */
  facts: { text: string; at: string }[];
  sessions: number;
  seconds_left_today: number;
  daily_minutes: number;
}

export interface PronunciationItem {
  index: number;
  heard_ko: string;
  target_ko: string;
  score: number;
  issues: PronunciationIssue[];
  good_vi: string;
}

export interface PronunciationOut {
  items: PronunciationItem[];
  overall_vi: string;
  average: number | null;
}

/** `lessonId`: talk about this lesson (from the lesson screen); none: the lesson studied last. */
export const startConversation = (remember: boolean, lessonId?: number | null, typing?: boolean) =>
  apiFetch<ConversationStartOut>("/api/v1/me/conversations", {
    method: "POST",
    json: {
      remember,
      ...(lessonId ? { lesson_id: lessonId } : {}),
      ...(typing ? { typing: true } : {}),
    },
  });

/** Haru's next line when the learner types (no Live connection); an empty list: Haru opens. */
export const replyConversation = (sessionId: string, turns: ConversationTurn[]) =>
  apiFetch<{ text: string }>(`/api/v1/me/conversations/${encodeURIComponent(sessionId)}/reply`, {
    method: "POST",
    json: { turns },
  });

export const finishConversation = (
  sessionId: string,
  body: { seconds: number; nudges: number; turns: ConversationTurn[] },
) =>
  apiFetch<ConversationFinishOut>(
    `/api/v1/me/conversations/${encodeURIComponent(sessionId)}/finish`,
    { method: "POST", json: body },
  );

export const getTalkProfile = () => apiFetch<TalkProfile>("/api/v1/me/conversations/profile");

/** Forget one remembered fact (its position in `facts`) or, without an index, all of them. */
export const forgetTalkFacts = (index?: number) =>
  apiFetch<TalkProfile>(
    `/api/v1/me/conversations/profile/facts${index === undefined ? "" : `?index=${index}`}`,
    { method: "DELETE" },
  );

export const checkPronunciation = (
  sessionId: string,
  clips: { index: number; heard: string; wav_b64: string }[],
) =>
  apiFetch<PronunciationOut>(
    `/api/v1/me/conversations/${encodeURIComponent(sessionId)}/pronunciation`,
    { method: "POST", json: { clips } },
  );

// ---------------------------------------------------------------- history --
export interface PronunciationIssue {
  word: string;
  heard_as: string;
  /** batchim | vowel | consonant | linking | intonation | other */
  kind?: string;
  problem_vi: string;
  tip_vi: string;
}

export interface TalkSessionRow {
  id: string;
  started_at: string;
  seconds: number;
  lesson_title: string | null;
  band: number | null;
  band_after: number | null;
  learner_turns: number;
  pron_avg: number | null;
  headline_vi: string | null;
  topics_vi: string[];
  has_report: boolean;
  saved: boolean;
}

export interface TalkSessionDetail extends TalkSessionRow {
  report: ConversationReport | null;
  pronunciation: PronunciationOut | null;
  turns: ConversationTurn[];
  band_note_vi: string | null;
}

export interface TalkInsights {
  sessions: number;
  minutes: number;
  points: {
    at: string;
    pron_avg: number | null;
    band: number | null;
    ko_words_per_turn: number | null;
  }[];
  pron_first: number | null;
  pron_last: number | null;
  checked_sessions: number;
  issue_kinds: { kind: string; label_vi: string; sessions: number; words: string[] }[];
  repeat_words: { ko: string; vi: string; times: number }[];
}

export interface TalkNote {
  id: string;
  kind: "word" | "sentence";
  ko: string;
  vi: string;
  /** The word is a lesson card and is now in the review queue. */
  in_review: boolean;
  done: boolean;
  created_at: string;
}

export interface TalkSaveOut {
  notes_added: number;
  added_to_review: string[];
  notes: TalkNote[];
}

export const listTalkSessions = (limit = 30) =>
  apiFetch<TalkSessionRow[]>(`/api/v1/me/conversations?limit=${limit}`);

export const getTalkSession = (id: string) =>
  apiFetch<TalkSessionDetail>(`/api/v1/me/conversations/${encodeURIComponent(id)}`);

export const getTalkInsights = () => apiFetch<TalkInsights>("/api/v1/me/conversations/insights");

export const listTalkNotes = () => apiFetch<TalkNote[]>("/api/v1/me/conversations/notes");

export const updateTalkNote = (id: string, done: boolean) =>
  apiFetch<TalkNote>(`/api/v1/me/conversations/notes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: { done },
  });

export const deleteTalkNote = (id: string) =>
  apiFetch<void>(`/api/v1/me/conversations/notes/${encodeURIComponent(id)}`, { method: "DELETE" });

export const saveTalkSession = (id: string) =>
  apiFetch<TalkSaveOut>(`/api/v1/me/conversations/${encodeURIComponent(id)}/save`, {
    method: "POST",
  });
