import { useCallback, useEffect, useState } from "react";

/** How the article is shown: the original Korean, the original with a
 * Vietnamese translation under every paragraph (and tap-a-sentence analysis),
 * or a simple-Korean rewrite for beginners. Remembered per device. */
export type ReadMode = "original" | "bilingual" | "easy";
const MODE_KEY = "haru.reader.mode.v1";

/** Defaults to "bilingual": a learner who has just finished the beginner
 * vocabulary needs the translation next to the Korean far more than a bare
 * page of TOPIK 5-6 text; whoever prefers the original picks it once and it
 * sticks. Read after mount so server and client renders agree. */
export function useReadMode(): [ReadMode, (m: ReadMode) => void] {
  const [mode, setMode] = useState<ReadMode>("bilingual");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODE_KEY);
      if (saved === "original" || saved === "bilingual" || saved === "easy") setMode(saved);
    } catch {
      /* no saved choice */
    }
  }, []);
  const update = useCallback((next: ReadMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      /* not persisted */
    }
  }, []);
  return [mode, update];
}
