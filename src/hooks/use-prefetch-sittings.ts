/** Once a learner has a lecture of a lesson playing, make the lectures of its other sittings in the
 * background (one at a time), so the next sitting opens ready instead of making the learner wait.
 * Requests are idempotent on the server (a recording or running job is reused), and it stops as
 * soon as every sitting has its recording or the server refuses (e.g. the allowance is spent). */
import { useEffect } from "react";
import { getLectureStatus, requestLessonPodcast } from "@/lib/api/audio";

const EVERY_MS = 30_000;
const MAX_TICKS = 120; // an hour

export function usePrefetchSittings(lessonId: number, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ticks = 0;
    const tick = async () => {
      if (stopped) return;
      try {
        const st = await getLectureStatus(lessonId);
        const next = st.sittings.find((s) => !s.ready);
        if (!next || ++ticks > MAX_TICKS) return;
        await requestLessonPodcast(lessonId, { sitting: next.n });
      } catch {
        return; // refused or offline: leave it, the sitting is made when it is opened
      }
      if (!stopped) timer = setTimeout(() => void tick(), EVERY_MS);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [lessonId, enabled]);
}
