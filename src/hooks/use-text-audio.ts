import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { requestTextAudio } from "@/lib/api/audio";
import { getJob } from "@/lib/api/jobs";
import type { AudioJobResult } from "@/lib/api/types";
import { pickAudioSrc, releaseAudioElement, unlockAudioElement } from "@/lib/audio-playback";
import { useJobEvents } from "./use-job-events";

export type TextAudioState = "idle" | "loading" | "playing" | "error";

/** A heard clip is filed under the voice too: one sentence can be said by both voices of a dialogue. */
const clipKey = (textKo: string, voice: string) => `${voice}\n${textKo}`;

function speakWithBrowser(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

/** Plays any Korean text (a reading passage, a line of a dialogue) in the Chirp
 * voice through the backend's audio cache (POST /audio/text): a text that was
 * voiced before comes back already succeeded and starts at once; a new one waits
 * for the job (a few seconds), then is stored for every later play. Texts heard
 * on this screen are remembered, so replaying one makes no request at all. Falls
 * back to the device's own Korean voice only if the backend call fails, so the
 * button never goes dead. One text plays at a time. */
export function useTextAudio() {
  const [state, setState] = useState<TextAudioState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [activeText, setActiveText] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingTextRef = useRef("");
  const pendingKeyRef = useRef("");
  const heardRef = useRef(new Map<string, AudioJobResult>());
  const job = useJobEvents(jobId);

  const playResult = useCallback((result: AudioJobResult) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const el = audioRef.current;
    el.src = pickAudioSrc(result);
    el.onended = () => {
      setState("idle");
      setActiveText(null);
    };
    el.onerror = () => {
      setError("Không phát được âm thanh.");
      setState("error");
    };
    setState("playing");
    void el.play().catch(() => {
      setError("Không phát được âm thanh.");
      setState("error");
    });
  }, []);

  useEffect(() => {
    if (!jobId) return;
    if (job.status === "succeeded" && job.job?.result) {
      const result = job.job.result as unknown as AudioJobResult;
      heardRef.current.set(pendingKeyRef.current, result);
      playResult(result);
      setJobId(null);
    } else if (job.status === "failed") {
      setUsedFallback(speakWithBrowser(pendingTextRef.current));
      setError(job.error ?? "Không tạo được giọng đọc.");
      setState((s) => (s === "playing" ? s : "error"));
      setJobId(null);
    }
  }, [jobId, job.status, job.job, job.error, playResult]);

  // Release the decoder/network when the screen goes away.
  useEffect(() => {
    const heard = heardRef.current;
    return () => {
      releaseAudioElement(audioRef.current);
      audioRef.current = null;
      heard.clear();
    };
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setJobId(null);
    setState("idle");
    setActiveText(null);
    setError(null);
    setUsedFallback(false);
  }, []);

  /** Asks the server to voice a text ahead of time (nothing plays), so that a later play() of it
   * starts at once — the next lines of a dialogue while the first one is being heard. A failure is
   * ignored: play() will ask again and fall back to the device voice. */
  const prefetch = useCallback((textKo: string, voice = "ko-female-1") => {
    if (heardRef.current.has(clipKey(textKo, voice))) return;
    void requestTextAudio({ text: textKo, voice }).catch(() => undefined);
  }, []);

  /** Call from a tap handler. `textKo` is sent as written; the server normalises it. */
  const play = useCallback(
    async (textKo: string, voice = "ko-female-1") => {
      const key = clipKey(textKo, voice);
      pendingTextRef.current = textKo;
      pendingKeyRef.current = key;
      setActiveText(textKo);
      // Unlock the element inside the tap so iOS lets us play() after the await.
      if (!audioRef.current) audioRef.current = new Audio();
      unlockAudioElement(audioRef.current);
      setError(null);
      setUsedFallback(false);
      const heard = heardRef.current.get(key);
      if (heard) {
        playResult(heard);
        return;
      }
      setState("loading");
      try {
        const accepted = await requestTextAudio({ text: textKo, voice });
        if (accepted.status === "succeeded") {
          // Found in the store — succeeded synchronously, no SSE event will fire.
          const full = await getJob(accepted.job_id);
          if (full.result) {
            const result = full.result as unknown as AudioJobResult;
            heardRef.current.set(key, result);
            playResult(result);
            return;
          }
        }
        setJobId(accepted.job_id);
      } catch (e) {
        setUsedFallback(speakWithBrowser(textKo));
        setError(errorMessage(e));
        setState((s) => (s === "playing" ? s : "error"));
      }
    },
    [playResult],
  );

  return { state, error, usedFallback, activeText, play, prefetch, stop };
}
