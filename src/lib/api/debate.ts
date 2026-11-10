import { apiFetch } from "./client";
import type { ConversationTurn } from "./conversation";

/** "Tranh luận · Đàm phán · Phản biện" — see the backend's app.api.routers.debate. */

export type DebateKind = "debate" | "negotiate" | "critique";

export interface DebateScenario {
  id: string;
  kind: DebateKind;
  tier: number;
  title_vi: string;
  situation_vi: string;
  learner_role_vi: string;
  haru_role_vi: string;
  learner_goal_vi: string;
  /** The motion / Haru's first line; empty for a critique (the claim is the surprise). */
  opener_en: string;
  sides: string[];
}

export interface Phrase {
  ko: string;
  vi: string;
}

export interface DebateOptions {
  band: number;
  band_label_vi: string;
  tier: number;
  kinds: Record<DebateKind, string>;
  scenarios: DebateScenario[];
  phrases: Record<DebateKind, Phrase[]>;
  criteria: Record<DebateKind, Record<string, string>>;
  /** What a 4 means at the learner's tier, by kind and criterion. */
  rubric: Record<DebateKind, Record<string, string>>;
  seconds_left_today: number;
  daily_minutes: number;
}

export interface DebateStartIn {
  kind: DebateKind;
  scenario_id?: string;
  motion?: string;
  side?: "찬성" | "반대";
  band_shift?: -1 | 0 | 1;
}

export interface DebateStartOut {
  session_id: string;
  token: string;
  ws_url: string;
  setup: Record<string, unknown>;
  nudges: Record<string, string>;
  max_seconds: number;
  seconds_left_today: number;
  band: number;
  band_label_vi: string;
  scenario: DebateScenario;
  side: string | null;
  phrases: Phrase[];
  criteria: Record<string, string>;
}

export interface DebateReport {
  kind: DebateKind;
  summary_vi: string;
  outcome_vi: string;
  scores: Record<string, number>;
  score_notes_vi: Record<string, string>;
  overall: number;
  best_move: { said_en?: string; why_vi?: string };
  missed: {
    haru_said_en: string;
    you_said_en: string;
    better_en: string;
    better_vi: string;
    why_vi: string;
  }[];
  phrases_used: string[];
  fixes: { said: string; better: string; why_vi: string }[];
  goal_reached: boolean;
  flaw_found: boolean;
  next_time_vi: string;
  /** Critique: the planted flaw, revealed after the session. */
  flaw_vi: string;
}

export interface DebateFinishOut {
  session_id: string;
  seconds: number;
  learner_turns: number;
  report: DebateReport | null;
  report_error_vi: string | null;
  band_before?: number | null;
  band_after?: number | null;
  criteria: Record<string, string>;
}

export interface DebateRow {
  id: string;
  started_at: string;
  seconds: number;
  kind: DebateKind;
  title_vi: string;
  band: number | null;
  overall: number | null;
  goal_reached: boolean;
}

export interface DebateDetail extends DebateFinishOut {
  started_at: string;
  kind: DebateKind;
  title_vi: string;
  side: string | null;
  turns: ConversationTurn[];
}

export const getDebateOptions = () => apiFetch<DebateOptions>("/api/v1/me/debates/options");

export const startDebate = (body: DebateStartIn) =>
  apiFetch<DebateStartOut>("/api/v1/me/debates", { method: "POST", json: body });

export const finishDebate = (
  sessionId: string,
  body: { seconds: number; nudges: number; turns: ConversationTurn[] },
) =>
  apiFetch<DebateFinishOut>(`/api/v1/me/debates/${encodeURIComponent(sessionId)}/finish`, {
    method: "POST",
    json: body,
  });

export const listDebates = (limit = 30) =>
  apiFetch<DebateRow[]>(`/api/v1/me/debates?limit=${limit}`);

export const getDebate = (id: string) =>
  apiFetch<DebateDetail>(`/api/v1/me/debates/${encodeURIComponent(id)}`);
