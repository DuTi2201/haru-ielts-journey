import { createContext } from "react";

import type { LinkedCardOut } from "@/lib/api/types";

/** What a practice question needs to show "the grammar in this sentence": the cards its
 * set is linked to (by pattern), which lesson the learner is in, whether answers are
 * being saved (a wrong one then sends the card back to the review queue), and how to
 * open this lesson's own grammar tab. */
export interface LinkedGrammarValue {
  cards: Record<string, LinkedCardOut>;
  lessonId: number | null;
  signedIn: boolean;
  openGrammar?: (() => void) | undefined;
}

export const LinkedGrammarContext = createContext<LinkedGrammarValue>({
  cards: {},
  lessonId: null,
  signedIn: false,
});
