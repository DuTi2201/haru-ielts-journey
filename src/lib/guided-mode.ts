import { useCallback, useState, useSyncExternalStore } from "react";

import { readLocal, writeLocal } from "@/lib/lesson-local";

/** "Có hướng dẫn / Tự do": whether Haru shows its study hints (the steps list in a lesson's
 * "Việc cần làm", the one-line nudges, the how-to card). On by default; a learner who knows how
 * they like to study turns it off once and it stays off on this device. The lesson-specific
 * advice (focus, what is easily confused) is not part of the mode: it is the lesson's own text.
 *
 * Several components read it on one screen, so it is a tiny shared store rather than a
 * per-component state: flipping the switch updates all of them at once. */
const KEY = "guided";
const listeners = new Set<() => void>();
let cached: boolean | null = null;

function snapshot(): boolean {
  if (cached === null) cached = readLocal<boolean>(KEY, true) !== false;
  return cached;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setGuidedMode(on: boolean): void {
  cached = on;
  writeLocal(KEY, on);
  listeners.forEach((l) => l());
}

export function useGuidedMode(): readonly [boolean, (on: boolean) => void] {
  const guided = useSyncExternalStore(subscribe, snapshot, () => true);
  return [guided, setGuidedMode] as const;
}

/** A hint that is shown until the learner closes it, and then never again on this device. */
export function useNudge(id: string): { visible: boolean; dismiss: () => void } {
  const [guided] = useGuidedMode();
  const key = `nudge:${id}`;
  const [dismissed, setDismissed] = useState<boolean>(() => readLocal<boolean>(key, false));
  const dismiss = useCallback(() => {
    writeLocal(key, true);
    setDismissed(true);
  }, [key]);
  return { visible: guided && !dismissed, dismiss };
}
