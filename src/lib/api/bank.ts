import type { PresentSession } from "./presentation";
import { apiFetch } from "./client";
import type { BankDeckOut, BankDeckWordsOut } from "./types";

/** The decks of the TOPIK word bank (with the learner's progress when signed in). */
export const listBankDecks = (opts: { lesson_id?: number } = {}) =>
  apiFetch<BankDeckOut[]>(
    `/api/v1/bank/decks${opts.lesson_id !== undefined ? `?lesson_id=${opts.lesson_id}` : ""}`,
  );

export const getBankDeck = (key: string) =>
  apiFetch<BankDeckWordsOut>(`/api/v1/bank/decks/${encodeURIComponent(key)}`);

/** Login required — new words of the deck then come into the daily reviews. */
export const addBankDeck = (key: string) =>
  apiFetch<BankDeckOut[]>(`/api/v1/me/bank/decks/${encodeURIComponent(key)}`, { method: "PUT" });

/** No more new words from the deck; words already started stay in the reviews. */
export const removeBankDeck = (key: string) =>
  apiFetch<BankDeckOut[]>(`/api/v1/me/bank/decks/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });

/** Login required — "Trình bày 2 phút" / "Phản biện" about the deck's topic, using the deck words
 * the learner has answered right at least twice. 409 `not_enough_words` until then. */
export const presentBankDeck = (key: string, kind: "present" | "debate") =>
  apiFetch<PresentSession>(`/api/v1/me/bank/decks/${encodeURIComponent(key)}/presentation`, {
    method: "POST",
    json: { kind },
  });
