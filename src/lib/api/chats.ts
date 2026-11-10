import { apiFetch } from "./client";

/** «Hội thoại»: the lessons' dialogues as chats (GET /me/chats). */
export interface ChatSummary {
  id: string;
  title_en: string;
  title_vi: string;
  scene_vi?: string | null;
  partner: string;
  lesson_id: number | null;
  lesson_title: string;
  lines: number;
  /** its grammar and words have been met */
  open: boolean;
  done: boolean;
}

export interface ChatTurn {
  who: "F" | "M" | "N";
  speaker: string;
  ko: string;
  vi: string;
  voice: string;
  /** the learner's line: picked out of `options` */
  mine: boolean;
  options: string[];
}

export interface Chat {
  id: string;
  title_en: string;
  title_vi: string;
  scene_vi?: string | null;
  partner: string;
  me: string;
  lesson_id?: number | null;
  lesson_title?: string;
  turns: ChatTurn[];
}

export const CHATS_KEY = ["me", "chats"] as const;
export const listChats = () => apiFetch<ChatSummary[]>("/api/v1/me/chats");
export const getChat = (id: string) => apiFetch<Chat>(`/api/v1/me/chats/${encodeURIComponent(id)}`);
export const finishChat = (id: string, right: number, total: number) =>
  apiFetch<{ ok: boolean }>(`/api/v1/me/chats/${encodeURIComponent(id)}/finish`, {
    method: "POST",
    json: { right, total },
  });
