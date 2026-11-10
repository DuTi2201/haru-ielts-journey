import type { TodayPlanTask } from "@/lib/api/types";

/** The local day a dialogue was last finished (set by the chat screen): the session's dialogue
 * step is done today. */
export const CHAT_DONE_DAY = "haru.chat-done-day";
export const localDay = () => new Date().toLocaleDateString("sv");

/** The kinds «Buổi hôm nay» takes from the day's plan (the rest stay listed under it). */
export const SESSION_KINDS = new Set<TodayPlanTask["kind"]>(["placement", "vocab_review", "review"]);
