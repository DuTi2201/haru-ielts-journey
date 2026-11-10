import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { requestArticleAudio } from "@/lib/api/audio";
import { getJob } from "@/lib/api/jobs";
import type { AudioJobResult } from "@/lib/api/types";
import {
  isAutoplayBlocked,
  isPlayInterrupted,
  pickAudioSrc,
  releaseAudioElement,
  unlockAudioElement,
} from "@/lib/audio-playback";
import { findSpokenIndex, type ReadAlongTimings, type SpokenPos } from "@/lib/read-along";
import { useJobEvents } from "./use-job-events";

export type ArticleAudioState = "idle" | "loading" | "playing" | "paused" | "error";

export type ArticleAudioVariant = "original" | "easy";

export const PLAYBACK_RATES = [0.75, 1, 1.25] as const;

export interface ArticleAudioMeta {
  title?: string | null | undefined;
  artist?: string | null | undefined;
}

/** Backs "Nghe toàn văn" — the article's OWN title + body read aloud, so a
 * learner can hear native-length sentences, real pronunciation and pausing
 * on the actual news text. Deliberately independent of usePodcast
 * (use-podcast-audio.ts): that hook plays a Gemini-WRITTEN teaching script
 * about the article's vocab/grammar, never the article's real words (see
 * POST /editorials/{id}/audio, app.workers.tasks.generate_article_audio).
 *
 * The first play per article generates audio server-side chunk by chunk
 * (a minute or two), so this hook exposes the job's real progress/step.
 * Every later play for the same (article, voice, cleaned text) is a cache
 * hit and starts immediately.
 *
 * iOS Safari only lets an <audio> element play() from inside a tap. The
 * element is therefore created and "unlocked" synchronously in the tap
 * handler; if the browser still refuses when generation finishes, the audio
 * stays loaded in "paused" with `needsTap` set so the next tap just plays. */
export function useArticleAudio(articleId: string, variant: ArticleAudioVariant = "original") {
  const key = `${articleId}:${variant}`;
  const [state, setState] = useState<ArticleAudioState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState<number>(1);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // when each sentence of the loaded recording starts (read-along)
  const [timings, setTimings] = useState<ReadAlongTimings | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // true only while the element holds the generated audio (not the silent
  // unlock clip), so the unlock never triggers the real handlers.
  const realRef = useRef(false);
  const fallbackDurationRef = useRef(0);
  const metaRef = useRef<ArticleAudioMeta>({});
  const rateRef = useRef(1);
  const pendingKeyRef = useRef<string | null>(null);
  const job = useJobEvents(jobId);

  const syncMediaSession = useCallback((el: HTMLAudioElement) => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      const title = metaRef.current.title;
      if (title && typeof MediaMetadata !== "undefined") {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist: metaRef.current.artist ?? "Haru",
        });
      }
      navigator.mediaSession.setActionHandler("play", () => void el.play());
      navigator.mediaSession.setActionHandler("pause", () => el.pause());
      navigator.mediaSession.setActionHandler("seekbackward", () => {
        el.currentTime = Math.max(0, el.currentTime - 10);
      });
      navigator.mediaSession.setActionHandler("seekforward", () => {
        el.currentTime = Math.min(el.duration || Infinity, el.currentTime + 10);
      });
    } catch {
      /* Media Session is a nicety (lock-screen controls), never required */
    }
  }, []);

  /** One element for the hook's lifetime, created on first use. Listeners
   * are attached once here, not per result, so unlocking (which plays a
   * silent clip on the same element) never fires the "real" handlers. */
  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const el = new Audio();
    el.preload = "auto";
    el.addEventListener("timeupdate", () => setCurrentTime(el.currentTime));
    const syncDuration = () => {
      if (!realRef.current) return;
      const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
      setDuration(d || fallbackDurationRef.current);
    };
    el.addEventListener("loadedmetadata", syncDuration);
    el.addEventListener("durationchange", syncDuration);
    el.addEventListener("play", () => {
      if (realRef.current) setState("playing");
    });
    el.addEventListener("pause", () => {
      if (realRef.current && !el.ended) setState((s) => (s === "playing" ? "paused" : s));
    });
    el.addEventListener("ended", () => {
      if (!realRef.current) return;
      el.currentTime = 0;
      setCurrentTime(0);
      setState("paused");
    });
    el.addEventListener("error", () => {
      if (!realRef.current) return;
      // Forget the broken load so the retry tap re-requests the (cached) job
      // and reloads a fresh src instead of resuming a dead element.
      realRef.current = false;
      setLoadedKey(null);
      setError("Không phát được âm thanh.");
      setState("error");
    });
    audioRef.current = el;
    return el;
  }, []);

  const startPlayback = useCallback((el: HTMLAudioElement) => {
    const p = el.play();
    if (!p) return;
    p.catch((err: unknown) => {
      if (isPlayInterrupted(err)) return;
      if (isAutoplayBlocked(err)) {
        // Long generation wait → the tap's permission expired. Keep the audio
        // loaded so the learner's next tap plays it instantly.
        setNeedsTap(true);
        setState("paused");
        return;
      }
      setError("Không phát được âm thanh.");
      setState("error");
    });
  }, []);

  const loadResult = useCallback(
    (result: AudioJobResult, forKey: string) => {
      const el = ensureAudio();
      fallbackDurationRef.current = result.duration_sec || 0;
      setTimings(result.timings ?? null);
      setDuration(result.duration_sec || 0);
      setCurrentTime(0);
      setNeedsTap(false);
      setLoadedKey(forKey);
      realRef.current = true;
      el.src = pickAudioSrc(result);
      el.defaultPlaybackRate = rateRef.current;
      el.playbackRate = rateRef.current;
      syncMediaSession(el);
      startPlayback(el);
    },
    [ensureAudio, startPlayback, syncMediaSession],
  );

  useEffect(() => {
    if (!jobId) return;
    if (job.status === "succeeded" && job.job?.result) {
      const forKey = pendingKeyRef.current;
      setJobId(null);
      if (forKey) loadResult(job.job.result as unknown as AudioJobResult, forKey);
    } else if (job.status === "failed") {
      setError(job.error ?? "Không tạo được giọng đọc, thử lại nhé.");
      setState("error");
      setJobId(null);
    } else if (job.status === "cancelled") {
      setError("Tác vụ tạo giọng đọc đã bị huỷ, thử lại nhé.");
      setState("error");
      setJobId(null);
    }
  }, [jobId, job.status, job.job, job.error, loadResult]);

  // Switching between the original and the simplified text: whatever is
  // playing or being generated belongs to the other one, so stop it. (The
  // loaded audio stays, so switching back resumes instantly.)
  useEffect(() => {
    audioRef.current?.pause();
    setJobId(null);
    setError(null);
    setNeedsTap(false);
    setState("idle");
  }, [key]);

  // Release the decoder/network when the reader screen goes away.
  useEffect(() => {
    return () => {
      releaseAudioElement(audioRef.current);
      audioRef.current = null;
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        try {
          navigator.mediaSession.metadata = null;
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setJobId(null);
    setCurrentTime(0);
    setState("idle");
  }, []);

  /** Must be called straight from a tap handler (no `await` before it). */
  const play = useCallback(
    async (meta?: ArticleAudioMeta) => {
      if (meta) metaRef.current = meta;
      const el = ensureAudio();
      // Already loaded for this article (paused, finished, or autoplay was
      // blocked): just resume — never regenerate or refetch.
      if (loadedKey === key && realRef.current && el.src) {
        setNeedsTap(false);
        setError(null);
        startPlayback(el);
        return;
      }
      // Unlock while we're still inside the user's tap.
      if (realRef.current) el.pause();
      realRef.current = false;
      unlockAudioElement(el);

      pendingKeyRef.current = key;
      setError(null);
      setNeedsTap(false);
      setState("loading");
      try {
        const accepted = await requestArticleAudio(articleId, { variant });
        if (accepted.status === "succeeded") {
          // Cache hit — succeeded synchronously, no SSE event will fire.
          const full = await getJob(accepted.job_id);
          if (full.result) {
            loadResult(full.result as unknown as AudioJobResult, key);
            return;
          }
        }
        setJobId(accepted.job_id);
      } catch (e) {
        setError(errorMessage(e));
        setState("error");
      }
    },
    [ensureAudio, key, articleId, variant, loadResult, loadedKey, startPlayback],
  );

  const seek = useCallback((seconds: number) => {
    const el = audioRef.current;
    if (!el || !realRef.current) return;
    const max =
      Number.isFinite(el.duration) && el.duration > 0 ? el.duration : fallbackDurationRef.current;
    el.currentTime = Math.max(0, max > 0 ? Math.min(seconds, max) : seconds);
    setCurrentTime(el.currentTime);
  }, []);

  const skip = useCallback(
    (delta: number) => {
      const el = audioRef.current;
      if (!el || !realRef.current) return;
      seek(el.currentTime + delta);
    },
    [seek],
  );

  const setRate = useCallback((next: number) => {
    rateRef.current = next;
    setRateState(next);
    const el = audioRef.current;
    if (el) {
      el.defaultPlaybackRate = next;
      el.playbackRate = next;
    }
  }, []);

  // Which sentence is being read: only for the recording that is loaded for
  // THIS article/variant, and only once playback has started (a finished or
  // never-started recording highlights nothing).
  const loaded = loadedKey === key;
  const spokenIndex =
    loaded && (state === "playing" || (state === "paused" && currentTime > 0.05))
      ? findSpokenIndex(timings, currentTime)
      : -1;
  const spoken = useMemo<SpokenPos | null>(() => {
    const item = spokenIndex >= 0 ? timings?.items[spokenIndex] : undefined;
    return item ? { p: item[0], s: item[1] } : null;
  }, [spokenIndex, timings]);

  const generating = state === "loading";
  return {
    state,
    error,
    needsTap,
    /** true once audio exists for the article (even while paused) */
    ready: loadedKey === key,
    /** the sentence (or simplified paragraph) being read, null when none */
    spoken,
    /** true when this recording carries a read-along timeline */
    canFollow: loaded && timings !== null && timings.items.length > 0,
    currentTime,
    duration,
    rate,
    /** 0..1 while the server is still synthesizing; null before the job exists */
    progress: generating && jobId ? job.progress : null,
    step: generating && jobId ? job.step : null,
    play,
    pause,
    stop,
    seek,
    skip,
    setRate,
  };
}
