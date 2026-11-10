/** What the learner does inside a lesson, sent to analytics.learning_event so lesson design is
 * decided on data: sittings started and finished, the step a sitting was left at, moves in the
 * lecture, and whether a question was right the first time.
 *
 * Ids and numbers only, never what the learner wrote. Events wait in a small queue and go in one
 * request every few seconds, or at once when the page is hidden (keepalive). Nothing is sent
 * while signed out, and a failed send is dropped: telemetry never gets in the learner's way. */
import { API_BASE_URL, tokenStore } from "@/lib/api/client";

export type TelemetryType =
  "session_start" | "session_complete" | "step_abandon" | "audio_seek" | "audio_rate" | "first_try";

export interface TelemetryEvent {
  type: TelemetryType;
  value?: number;
  payload?: Record<string, string | number>;
}

const FLUSH_MS = 8000;
const MAX_BATCH = 50;
const queue: (TelemetryEvent & { at: string })[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function send(keepalive: boolean) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const token = tokenStore.get();
  if (!token || queue.length === 0) {
    queue.length = 0;
    return;
  }
  while (queue.length > 0) {
    const events = queue.splice(0, MAX_BATCH);
    void fetch(`${API_BASE_URL}/api/v1/me/events`, {
      method: "POST",
      keepalive,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events }),
    }).catch(() => {
      /* dropped: telemetry is best-effort */
    });
  }
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const flushNow = () => send(true);
  window.addEventListener("pagehide", flushNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
}

/** Queue one event (sent within a few seconds, or when the page is hidden). */
export function track(e: TelemetryEvent) {
  if (typeof window === "undefined" || !tokenStore.get()) return;
  listen();
  queue.push({ ...e, at: new Date().toISOString() });
  if (queue.length >= MAX_BATCH) send(false);
  else if (!timer) timer = setTimeout(() => send(false), FLUSH_MS);
}

/** Send what is queued now (when leaving a screen the learner may not come back to). */
export function flushTelemetry() {
  send(true);
}
