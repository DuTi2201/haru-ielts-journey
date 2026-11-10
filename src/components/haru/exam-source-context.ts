import { createContext, useContext } from "react";

/* What a card can ask of the original-paper viewer (components/haru/ExamPageViewer.tsx).
 * Kept apart from the viewer so that file exports only components. */

export interface ExamSourceApi {
  /** open the viewer on a page of the original paper (null: wherever it was) */
  openPage: (page: number | null) => void;
}

export const ExamSourceContext = createContext<ExamSourceApi | null>(null);

/** null outside a paper review: cards then show a plain "trang N". */
export const useExamSource = (): ExamSourceApi | null => useContext(ExamSourceContext);
