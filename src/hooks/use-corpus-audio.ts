import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { requestCorpusAudio } from "@/lib/api/audio";
import { getJob } from "@/lib/api/jobs";
import type { AudioJobResult } from "@/lib/api/types";
import {
  pickAudioSrc,
  primeSpeechVoices,
  releaseAudioElement,
  speakKorean,
  stopSpeaking,
  unlockAudioElement,
} from "@/lib/audio-playback";
import { useJobEvents } from "./use-job-events";

export type CorpusAudioState = "idle" | "loading" | "playing" | "error";

/** Most warmed-up sentences kept at once (each holds a small decoded clip). */
const PREFETCH_LIMIT = 4;
/** Playback speed of the "Chậm" button — slow enough to catch every syllable. */
const SLOW_RATE = 0.75;

/** Plays one /listening sentence in the server's voice: Google Chirp 3 HD,
 * cached content-addressed on the backend (so each sentence is synthesized once,
 * ever, and replays are free — see app/api/routers/audio.py). The device's own
 * ko-KR voice is only the last resort when the server cannot deliver, so the
 * button never goes dead.
 *
 * `prefetch` warms the sentence the learner is about to hear, so the first tap
 * answers at once instead of waiting for the synthesis. */
export function useCorpusAudio() {
  const [state, setState] = useState<CorpusAudioState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  // Which sentence the state above belongs to (the player and the "similar"
  // rows share one hook, so each needs to know if it is the one playing).
  const [activeId, setActiveId] = useState<string | null>(null);
  const [slow, setSlowState] = useState(false);
  const slowRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingRef = useRef<{ id: string; text: string }>({ id: "", text: "" });
  const prefetchedRef = useRef(
    new Map<string, { result: AudioJobResult | null; el: HTMLAudioElement | null }>(),
  );
  // Bumped per device utterance so an interrupted one (its end event fires
  // AFTER the next sentence started) cannot reset the new one's state.
  const speechTokenRef = useRef(0);
  const job = useJobEvents(jobId);

  const playResult = useCallback((result: AudioJobResult) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const el = audioRef.current;
    el.src = pickAudioSrc(result);
    el.preservesPitch = true;
    el.playbackRate = slowRef.current ? SLOW_RATE : 1;
    el.onended = () => setState("idle");
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

  /** The server could not deliver: say the sentence with the device voice. */
  const speakOnDevice = useCallback((text: string) => {
    const token = ++speechTokenRef.current;
    const spoke = speakKorean(text, slowRef.current ? 0.7 : 0.85, {
      onEnd: () => {
        if (speechTokenRef.current === token) setState("idle");
      },
    });
    setUsedFallback(spoke);
    return spoke;
  }, []);

  // Async path: a real (non-cached) generation, tracked via the same
  // SSE/poll job hook the Studio import screens already use.
  useEffect(() => {
    if (!jobId) return;
    if (job.status === "succeeded" && job.job?.result) {
      playResult(job.job.result as unknown as AudioJobResult);
      setJobId(null);
    } else if (job.status === "failed") {
      const spoke = speakOnDevice(pendingRef.current.text);
      setError(job.error ?? "Không tạo được giọng đọc.");
      setState(spoke ? "playing" : "error");
      setJobId(null);
    }
  }, [jobId, job.status, job.job, job.error, playResult, speakOnDevice]);

  // Release the decoder/network when the screen goes away.
  useEffect(() => {
    primeSpeechVoices(); // only needed if the device voice has to step in
    const prefetched = prefetchedRef.current;
    return () => {
      releaseAudioElement(audioRef.current);
      audioRef.current = null;
      for (const entry of prefetched.values()) releaseAudioElement(entry.el);
      prefetched.clear();
      stopSpeaking();
    };
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    speechTokenRef.current += 1;
    stopSpeaking();
    setJobId(null);
    setActiveId(null);
    setState("idle");
    setError(null);
    setUsedFallback(false);
  }, []);

  const setSlow = useCallback((value: boolean) => {
    slowRef.current = value;
    setSlowState(value);
    // takes effect on the clip that is playing right now, too
    if (audioRef.current) audioRef.current.playbackRate = value ? SLOW_RATE : 1;
  }, []);

  /** Look-ahead: ask for a sentence's audio in the background (never plays it)
   * so its play button answers instantly. The first time a sentence is ever
   * heard it costs one server synthesis; afterwards it is a cache hit. Each
   * sentence is requested at most once per screen visit and errors are
   * swallowed — a normal tap will simply do the work then. */
  const prefetch = useCallback(
    async (corpusItemId: string, textKo: string, voice = "ko-female-1") => {
      const cache = prefetchedRef.current;
      if (cache.has(corpusItemId)) return;
      if (cache.size >= PREFETCH_LIMIT) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) {
          releaseAudioElement(cache.get(oldest)?.el ?? null);
          cache.delete(oldest);
        }
      }
      cache.set(corpusItemId, { result: null, el: null });
      try {
        const accepted = await requestCorpusAudio(corpusItemId, { text_en: textKo, voice });
        if (accepted.status !== "succeeded") return; // still generating: lands in the server cache
        const full = await getJob(accepted.job_id);
        if (!full.result || !cache.has(corpusItemId)) return;
        const result = full.result as unknown as AudioJobResult;
        const el = new Audio();
        el.preload = "auto";
        el.src = pickAudioSrc(result); // warms the browser cache; not played
        cache.set(corpusItemId, { result, el });
      } catch {
        /* best effort */
      }
    },
    [],
  );

  const play = useCallback(
    async (corpusItemId: string, textKo: string, voice = "ko-female-1") => {
      pendingRef.current = { id: corpusItemId, text: textKo };
      audioRef.current?.pause();
      speechTokenRef.current += 1;
      stopSpeaking();
      setActiveId(corpusItemId);
      // Unlock the element inside the tap so iOS lets us play() after the await.
      if (!audioRef.current) audioRef.current = new Audio();
      unlockAudioElement(audioRef.current);
      setError(null);
      setUsedFallback(false);
      // Warmed up by prefetch: start right away, still inside the tap.
      const warmed = prefetchedRef.current.get(corpusItemId)?.result;
      if (warmed) {
        playResult(warmed);
        return;
      }
      setState("loading");
      try {
        const accepted = await requestCorpusAudio(corpusItemId, { text_en: textKo, voice });
        if (accepted.status === "succeeded") {
          // Cache hit — the job was already marked succeeded synchronously
          // (no Celery run, so no SSE event will ever fire for it): fetch
          // its result directly instead of waiting on useJobEvents.
          const full = await getJob(accepted.job_id);
          if (full.result) {
            // The learner may have moved on while the request was in flight.
            if (pendingRef.current.id === corpusItemId)
              playResult(full.result as unknown as AudioJobResult);
            return;
          }
        }
        setJobId(accepted.job_id);
      } catch (e) {
        const spoke = speakOnDevice(textKo);
        setError(errorMessage(e));
        setState(spoke ? "playing" : "error");
      }
    },
    [playResult, speakOnDevice],
  );

  return { state, error, usedFallback, activeId, slow, setSlow, play, stop, prefetch };
}

export type CorpusAudio = ReturnType<typeof useCorpusAudio>;
