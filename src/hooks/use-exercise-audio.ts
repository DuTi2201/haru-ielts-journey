import { useCallback, useEffect, useRef, useState } from "react";

import { requestExerciseAudio } from "@/lib/api/audio";
import { errorMessage } from "@/lib/api/client";
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

export type ExerciseAudioState = "idle" | "loading" | "playing" | "paused" | "error";

/** Plays the recorded dialogue of one listening exercise (a woman's and a man's
 * voice). The first play of an exercise asks the server to record it (a job);
 * after that — for every learner and every lesson that holds the exercise — it
 * is a stored file. The finished recording is kept in the hook, so "nghe lại"
 * never asks the server again.
 *
 * `plays` counts how many times playback STARTED, which the exam-style "nghe một
 * lần" switch uses to lock the button. */
export function useExerciseAudio(lessonId: number | string, exerciseId: string) {
  const [state, setState] = useState<ExerciseAudioState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [plays, setPlays] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resultRef = useRef<AudioJobResult | null>(null);
  const job = useJobEvents(jobId);

  const start = useCallback((result: AudioJobResult) => {
    resultRef.current = result;
    if (!audioRef.current) audioRef.current = new Audio();
    const el = audioRef.current;
    el.src = pickAudioSrc(result);
    el.onended = () => setState("idle");
    el.onerror = () => {
      setError("Không phát được âm thanh.");
      setState("error");
    };
    setState("playing");
    setPlays((n) => n + 1);
    void el.play().catch((err: unknown) => {
      if (isPlayInterrupted(err)) return;
      if (isAutoplayBlocked(err)) {
        // Recording took a while and the browser no longer trusts the tap that
        // started it — keep the audio loaded; the next tap plays it.
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
      start(job.job.result as unknown as AudioJobResult);
      setJobId(null);
    } else if (job.status === "failed") {
      setError(job.error ?? "Không tạo được bản ghi âm, thử lại nhé.");
      setState("error");
      setJobId(null);
    }
  }, [jobId, job.status, job.job, job.error, start]);

  // Release the decoder/network when the exercise goes away.
  useEffect(() => {
    return () => {
      releaseAudioElement(audioRef.current);
      audioRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setJobId(null);
    setState("idle");
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState((s) => (s === "playing" ? "paused" : s));
  }, []);

  const play = useCallback(async () => {
    if (!audioRef.current) audioRef.current = new Audio();
    if (state === "paused") {
      setState("playing");
      void audioRef.current.play().catch(() => setState("paused"));
      return;
    }
    // Unlock the element inside the tap so iOS lets us play() when the (first)
    // recording finishes.
    unlockAudioElement(audioRef.current);
    setError(null);
    if (resultRef.current) {
      start(resultRef.current);
      return;
    }
    setState("loading");
    try {
      const accepted = await requestExerciseAudio(lessonId, exerciseId);
      if (accepted.status === "succeeded") {
        // Already recorded — the job is done, no event will fire.
        const full = await getJob(accepted.job_id);
        if (full.result) {
          start(full.result as unknown as AudioJobResult);
          return;
        }
      }
      setJobId(accepted.job_id);
    } catch (e) {
      setError(errorMessage(e));
      setState("error");
    }
  }, [lessonId, exerciseId, start, state]);

  return { state, error, plays, play, pause, stop };
}
