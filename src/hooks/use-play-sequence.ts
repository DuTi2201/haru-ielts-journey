import { useCallback, useEffect, useRef, useState } from "react";
import type { useTextAudio } from "./use-text-audio";

export interface SequenceItem {
  text: string;
  voice: string;
}

interface Run {
  /** What is being played (the id of the dialogue), to tell its screen from the others. */
  id: string;
  items: SequenceItem[];
  index: number;
}

/** Plays a list of clips one after another through a `useTextAudio` — the lines of a
 * dialogue, each in its own voice. While the first line plays, the others are asked of
 * the server (`prefetch`), so by the time one ends the next is usually stored and starts
 * at once. The first clip must be started from a tap (`start` is called by a tap handler);
 * the rest follow on their own because the same audio element has been unlocked by it.
 * A clip that fails ends the run (the device voice, if any, has spoken that one line). */
export function usePlaySequence(audio: ReturnType<typeof useTextAudio>) {
  const [run, setRun] = useState<Run | null>(null);
  const started = useRef(false);
  const { state, play, prefetch, stop } = audio;

  useEffect(() => {
    if (!run) return;
    if (state === "loading" || state === "playing") {
      started.current = true;
      return;
    }
    if (state === "error") {
      started.current = false;
      setRun(null);
      return;
    }
    // idle: either the run has not begun yet, or a clip has just ended
    if (!started.current) return;
    started.current = false;
    const next = run.index + 1;
    const item = run.items[next];
    if (!item) {
      setRun(null);
      return;
    }
    setRun({ ...run, index: next });
    void play(item.text, item.voice);
  }, [run, state, play]);

  const start = useCallback(
    (id: string, items: SequenceItem[]) => {
      const first = items[0];
      if (!first) return;
      started.current = false;
      setRun({ id, items, index: 0 });
      for (const item of items.slice(1)) prefetch(item.text, item.voice);
      void play(first.text, first.voice);
    },
    [play, prefetch],
  );

  const stopAll = useCallback(() => {
    started.current = false;
    setRun(null);
    stop();
  }, [stop]);

  return {
    /** The run in progress, if any: which dialogue, and which line is being heard. */
    activeId: run?.id ?? null,
    activeIndex: run?.index ?? null,
    start,
    stop: stopAll,
  };
}
