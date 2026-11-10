import { useEffect, useRef, useState } from "react";

/** Remembers which feathers were earned on the last render, and says which are new (not on the
 * first load: those were earned before). */
export function useNewlyEarned(earned: string[], ready: boolean): string[] {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const key = earned.join("|");
  useEffect(() => {
    if (!ready) return;
    if (seen.current === null) {
      seen.current = new Set(earned);
      return;
    }
    const added = earned.filter((id) => !seen.current!.has(id));
    if (added.length) {
      added.forEach((id) => seen.current!.add(id));
      setFresh(added);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);
  return fresh;
}
