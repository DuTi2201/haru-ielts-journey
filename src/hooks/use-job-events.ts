import { useEffect, useState } from "react";
import { API_BASE_URL, ApiError, errorMessage, tokenStore } from "@/lib/api/client";
import { getJob } from "@/lib/api/jobs";
import type { JobOut, JobStatus } from "@/lib/api/types";

const TERMINAL: JobStatus[] = ["succeeded", "failed", "cancelled"];

export interface JobEventsState {
  job: JobOut | null;
  status: JobStatus | null;
  progress: number;
  step: string | null;
  error: string | null;
  transport: "sse" | "poll" | null;
}

const initial: JobEventsState = {
  job: null,
  status: null,
  progress: 0,
  step: null,
  error: null,
  transport: null,
};

/** Realtime job tracking via SSE; falls back to polling every 2s if SSE fails. */
export function useJobEvents(jobId: string | null | undefined): JobEventsState {
  const [state, setState] = useState<JobEventsState>(initial);

  useEffect(() => {
    if (!jobId || typeof window === "undefined") {
      setState(initial);
      return;
    }
    let closed = false;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const apply = (job: JobOut) => {
      if (closed) return;
      // Backend job.error is always shaped {code, message, retryable} (see
      // app/workers/tasks.py) — it never has .detail/.title, so those two
      // never matched and every failed job in the app silently fell back to
      // the generic string below instead of showing the real reason.
      setState((s) => ({
        ...s,
        job,
        status: job.status,
        progress: job.progress,
        step: job.step,
        error:
          job.status === "failed"
            ? (job.error?.["message"] ??
              job.error?.["detail"] ??
              job.error?.["title"] ??
              "Tác vụ thất bại")
            : null,
      }));
      if (TERMINAL.includes(job.status)) stop();
    };
    const stop = () => {
      es?.close();
      es = null;
      if (timer) clearInterval(timer);
      timer = null;
    };

    const startPolling = () => {
      if (closed || timer) return;
      setState((s) => ({ ...s, transport: "poll" }));
      const tick = async () => {
        try {
          apply(await getJob(jobId));
        } catch (e) {
          if (closed) return;
          setState((s) => ({ ...s, error: errorMessage(e) }));
          if (e instanceof ApiError && [401, 403, 404].includes(e.status)) stop();
        }
      };
      void tick();
      timer = setInterval(tick, 2000);
    };

    const token = tokenStore.get();
    const url = `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/events${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    try {
      es = new EventSource(url);
      setState((s) => ({ ...s, transport: "sse" }));
      const handler = (ev: MessageEvent) => {
        try {
          apply(JSON.parse(ev.data) as JobOut);
        } catch {
          /* ignore malformed */
        }
      };
      es.addEventListener("job.progress", handler as EventListener);
      es.addEventListener("job.succeeded", handler as EventListener);
      es.addEventListener("job.failed", handler as EventListener);
      es.onerror = () => {
        es?.close();
        es = null;
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      closed = true;
      stop();
    };
  }, [jobId]);

  return state;
}
