import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { requestVocabAudio } from "@/lib/api/audio";
import { getJob } from "@/lib/api/jobs";
import type { AudioJobResult } from "@/lib/api/types";
import { pickAudioSrc, releaseAudioElement, unlockAudioElement } from "@/lib/audio-playback";
import { useJobEvents } from "./use-job-events";

export type VocabAudioState = "idle" | "loading" | "playing" | "error";

/** Most warmed-up words kept at once (each holds a small decoded clip). */
const PREFETCH_LIMIT = 4;

function speakWithBrowser(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

/** Same shape as useCorpusAudio (src/hooks/use-corpus-audio.ts), but for a
 * vocab flashcard's hangul instead of a /listening sentence — plays it
 * through the backend TTS pipeline (Google Chirp 3 HD, Gemini as its
 * fallback — app/api/routers/audio.py's vocab_router), reusing the
 * content-addressed cache so replaying a word never re-synthesizes. Falls back to the device's own
 * speech synthesis only if the backend call itself fails, so the button
 * never goes dead. Tracks one vocab item's playback at a time — a caller
 * showing several words (a flashcard deck, an article's vocab list)
 * mounts one of these per visible/active word. */
export function useVocabAudio() {
  const [state, setState] = useState<VocabAudioState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingTextRef = useRef<string>("");
  // Look-ahead cache (see prefetch): vocab id -> its finished audio (or null
  // while the server is still generating it), plus the element that warmed it.
  const prefetchedRef = useRef(
    new Map<number, { result: AudioJobResult | null; el: HTMLAudioElement | null }>(),
  );
  const job = useJobEvents(jobId);

  const playResult = useCallback((result: AudioJobResult) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const el = audioRef.current;
    el.src = pickAudioSrc(result);
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

  useEffect(() => {
    if (!jobId) return;
    if (job.status === "succeeded" && job.job?.result) {
      playResult(job.job.result as unknown as AudioJobResult);
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
    const prefetched = prefetchedRef.current;
    return () => {
      releaseAudioElement(audioRef.current);
      audioRef.current = null;
      for (const entry of prefetched.values()) releaseAudioElement(entry.el);
      prefetched.clear();
    };
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setJobId(null);
    setState("idle");
    setError(null);
    setUsedFallback(false);
  }, []);

  /** Look-ahead: ask for the NEXT card's audio in the background (never plays
   * it) so its "Nghe" button answers instantly. Each call costs one server
   * synthesis the first time a word is heard, so callers should only use it
   * for learners who actually listen (see VocabFlashcards) and stop once a
   * play has failed. Cached words return immediately server-side, and each
   * word is requested at most once per screen visit. Errors are swallowed —
   * a normal tap will simply do the work then. */
  const prefetch = useCallback(
    async (vocabItemId: number, textKo: string, voice = "ko-female-1") => {
      const cache = prefetchedRef.current;
      if (cache.has(vocabItemId)) return;
      if (cache.size >= PREFETCH_LIMIT) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) {
          releaseAudioElement(cache.get(oldest)?.el ?? null);
          cache.delete(oldest);
        }
      }
      cache.set(vocabItemId, { result: null, el: null });
      try {
        const accepted = await requestVocabAudio(vocabItemId, { text_ko: textKo, voice });
        if (accepted.status !== "succeeded") return; // still generating: lands in the server cache
        const full = await getJob(accepted.job_id);
        if (!full.result || !cache.has(vocabItemId)) return;
        const result = full.result as unknown as AudioJobResult;
        const el = new Audio();
        el.preload = "auto";
        el.src = pickAudioSrc(result); // warms the browser cache; not played
        cache.set(vocabItemId, { result, el });
      } catch {
        /* best effort */
      }
    },
    [],
  );

  const play = useCallback(
    async (vocabItemId: number, textKo: string, voice = "ko-female-1") => {
      pendingTextRef.current = textKo;
      // Unlock the element inside the tap so iOS lets us play() after the await.
      if (!audioRef.current) audioRef.current = new Audio();
      unlockAudioElement(audioRef.current);
      setError(null);
      setUsedFallback(false);
      // Warmed up by prefetch: start right away, still inside the tap.
      const warmed = prefetchedRef.current.get(vocabItemId)?.result;
      if (warmed) {
        playResult(warmed);
        return;
      }
      setState("loading");
      try {
        const accepted = await requestVocabAudio(vocabItemId, { text_ko: textKo, voice });
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
        setUsedFallback(speakWithBrowser(textKo));
        setError(errorMessage(e));
        setState((s) => (s === "playing" ? s : "error"));
      }
    },
    [playResult],
  );

  return { state, error, usedFallback, play, stop, prefetch };
}
