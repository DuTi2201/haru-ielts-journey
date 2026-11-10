import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, errorMessage } from "@/lib/api/client";
import { requestEditorialPodcast, requestLessonPodcast } from "@/lib/api/audio";
import { getJob } from "@/lib/api/jobs";
import type { AudioJobResult } from "@/lib/api/types";
import {
  isAutoplayBlocked,
  isPlayInterrupted,
  pickAudioSrc,
  releaseAudioElement,
  unlockAudioElement,
} from "@/lib/audio-playback";
import { useJobEvents } from "./use-job-events";

export type PodcastState = "idle" | "loading" | "playing" | "paused" | "error";

/** Lessons only: "template" is a fixed script built from the lesson itself (the
 * default); "story" is Gemini retelling it. Articles always use Gemini. */
export type LessonPodcastMode = "template" | "story";

/** Backs the "Nghe bài giảng tổng hợp" (consolidated podcast) feature —
 * NOT per-word TTS. Gemini first synthesizes one teaching script covering
 * every vocab word + grammar point of a lesson/article (nghe-và-nhại-lại
 * style), then that script is turned into audio — see
 * app.workers.tasks.generate_content_podcast. The FIRST play for a given
 * lesson/article can take a while (Gemini writes + speaks a whole
 * script); every later play is instant, served from the same
 * content-addressed cache as the other audio hooks (busts automatically
 * if the lesson's/article's vocab or grammar changes later). */
export function usePodcast(kind: "lesson" | "article") {
  const [state, setState] = useState<PodcastState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scriptText, setScriptText] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<[number, number, number][] | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Which lecture the element currently holds: a lesson's "template" and "story"
  // lectures are two different recordings, so a paused one is only resumed when the
  // learner asks for the same one again.
  const loadedModeRef = useRef<LessonPodcastMode | null>(null);
  const job = useJobEvents(jobId);
  // where the recording is, for the seek bar (updated a few times a second while it plays)
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  const rateRef = useRef(1);

  const playResult = useCallback((result: AudioJobResult) => {
    if (result.script_text) setScriptText(result.script_text);
    setTimeline(result.timeline ?? null);
    if (!audioRef.current) audioRef.current = new Audio();
    const el = audioRef.current;
    el.src = pickAudioSrc(result);
    el.playbackRate = rateRef.current;
    el.preservesPitch = true;
    setDuration(result.duration_sec || 0);
    setTime(0);
    el.ontimeupdate = () => setTime(el.currentTime);
    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
    };
    el.onended = () => setState("idle");
    el.onerror = () => {
      setError("Không phát được âm thanh.");
      setState("error");
    };
    setState("playing");
    void el.play().catch((err: unknown) => {
      if (isPlayInterrupted(err)) return;
      if (isAutoplayBlocked(err)) {
        // Generation took a while and iOS Safari no longer trusts the tap
        // that started it — keep the audio loaded; the next tap plays it.
        setState("paused");
        return;
      }
      setError("Không phát được âm thanh.");
      setState("error");
    });
  }, []);

  useEffect(() => {
    if (!jobId) return;
    if (job.status === "succeeded" && job.job?.result) {
      playResult(job.job.result as unknown as AudioJobResult);
      setJobId(null);
    } else if (job.status === "failed") {
      setError(job.error ?? "Không tạo được bài giảng, thử lại nhé.");
      setState("error");
      setJobId(null);
    }
  }, [jobId, job.status, job.job, job.error, playResult]);

  // Release the decoder/network when the screen goes away.
  useEffect(() => {
    return () => {
      releaseAudioElement(audioRef.current);
      audioRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    loadedModeRef.current = null;
    setJobId(null);
    setState("idle");
    setScriptText(null);
    setError(null);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState((s) => (s === "playing" ? "paused" : s));
  }, []);

  const play = useCallback(
    async (ownerId: string | number, mode: LessonPodcastMode = "template", sitting?: number) => {
      if (!audioRef.current) audioRef.current = new Audio();
      if (state === "paused" && loadedModeRef.current === mode) {
        setState("playing");
        void audioRef.current.play().catch(() => setState("paused"));
        return;
      }
      // Unlock the element inside the tap so iOS lets us play() when the
      // (slow) script generation finishes.
      unlockAudioElement(audioRef.current);
      audioRef.current.pause();
      loadedModeRef.current = mode;
      setError(null);
      setScriptText(null);
      setState("loading");
      try {
        const accepted =
          kind === "lesson"
            ? await requestLessonPodcast(ownerId, { mode, ...(sitting ? { sitting } : {}) })
            : await requestEditorialPodcast(String(ownerId));
        if (accepted.status === "succeeded") {
          // Cache hit — succeeded synchronously, no SSE event will fire.
          const full = await getJob(accepted.job_id);
          if (full.result) {
            playResult(full.result as unknown as AudioJobResult);
            return;
          }
        }
        setJobId(accepted.job_id);
      } catch (e) {
        // 401 = no (or a dead) login on this browser; the raw "Missing bearer token" means nothing to a learner.
        setError(
          e instanceof ApiError && e.status === 401
            ? "Cần đăng nhập để nghe bài giảng. Đăng nhập rồi bấm nghe lại."
            : errorMessage(e),
        );
        setState("error");
      }
    },
    [kind, playResult, state],
  );

  /** Moves the recording to `to` seconds; returns where it was (null when nothing is loaded). */
  const seek = useCallback((to: number): number | null => {
    const el = audioRef.current;
    if (!el || !el.src) return null;
    const from = el.currentTime;
    const end = Number.isFinite(el.duration) ? el.duration : to;
    el.currentTime = Math.max(0, Math.min(to, end - 0.25));
    setTime(el.currentTime);
    return from;
  }, []);

  const setRate = useCallback((r: number) => {
    rateRef.current = r;
    setRateState(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  }, []);

  const resume = useCallback(() => {
    const el = audioRef.current;
    if (!el || !el.src) return;
    setState("playing");
    void el.play().catch(() => setState("paused"));
  }, []);

  return {
    state,
    error,
    scriptText,
    timeline,
    time,
    duration,
    rate,
    seek,
    setRate,
    resume,
    play,
    pause,
    stop,
    /** How far the server has got with the recording (0..1) and what it is doing — only while
     * the learner is waiting for it. */
    progress: state === "loading" && jobId ? job.progress : 0,
    step: state === "loading" && jobId ? job.step : null,
  };
}
