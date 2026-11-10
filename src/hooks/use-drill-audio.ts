import { useCallback, useEffect, useRef, useState } from "react";

import { requestTextAudio } from "@/lib/api/audio";
import { getJob } from "@/lib/api/jobs";
import type { AudioJobResult } from "@/lib/api/types";
import { pickAudioSrc, releaseAudioElement, unlockAudioElement } from "@/lib/audio-playback";

/** One step of a drill: a Korean text, the speed to play it at, and the silence after it. */
export interface DrillStep {
  text: string;
  rate?: number;
  gapMs?: number;
  /** what to light up on screen while this step plays */
  mark?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Plays a SEQUENCE of Korean clips (a syllable, a pair, a word at three speeds) through the same
 * backend voice cache as useTextAudio: each text is voiced once and kept, so a drill replays at
 * no cost. Slowed clips keep their pitch (preservesPitch), so a slow 가 is still a low 가. One
 * drill at a time; starting another stops the first. */
export function useDrillAudio() {
  const el = useRef<HTMLAudioElement | null>(null);
  const clips = useRef(new Map<string, string>());
  const run = useRef(0);
  const [mark, setMark] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const clipMap = clips.current;
    return () => {
      run.current += 1;
      releaseAudioElement(el.current);
      el.current = null;
      clipMap.clear();
    };
  }, []);

  const clip = useCallback(async (text: string): Promise<string> => {
    const have = clips.current.get(text);
    if (have) return have;
    const accepted = await requestTextAudio({ text });
    for (let i = 0; i < 40; i += 1) {
      const job = await getJob(accepted.job_id);
      if (job.status === "succeeded" && job.result) {
        const src = pickAudioSrc(job.result as unknown as AudioJobResult);
        clips.current.set(text, src);
        return src;
      }
      if (job.status === "failed" || job.status === "cancelled") throw new Error("voice failed");
      await sleep(i < 5 ? 400 : 900);
    }
    throw new Error("voice timeout");
  }, []);

  const playOne = useCallback((src: string, rate: number) => {
    const a = el.current!;
    return new Promise<void>((resolve) => {
      a.src = src;
      a.playbackRate = rate;
      (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
      a.onended = () => resolve();
      a.onerror = () => resolve();
      void a.play().catch(() => resolve());
    });
  }, []);

  const stop = useCallback(() => {
    run.current += 1;
    el.current?.pause();
    setMark(null);
    setBusy(false);
  }, []);

  /** Call from a tap handler. */
  const play = useCallback(
    async (steps: DrillStep[]) => {
      if (!el.current) el.current = new Audio();
      unlockAudioElement(el.current);
      el.current.pause();
      const me = ++run.current;
      setBusy(true);
      try {
        const srcs = await Promise.all(steps.map((s) => clip(s.text)));
        for (let i = 0; i < steps.length; i += 1) {
          if (run.current !== me) return;
          const s = steps[i]!;
          setMark(s.mark ?? s.text);
          await playOne(srcs[i]!, s.rate ?? 1);
          if (s.gapMs) await sleep(s.gapMs);
        }
      } catch {
        // the device voice, so the button never goes dead
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          for (const s of steps) {
            const u = new SpeechSynthesisUtterance(s.text);
            u.lang = "ko-KR";
            u.rate = (s.rate ?? 1) * 0.9;
            window.speechSynthesis.speak(u);
          }
        }
      } finally {
        if (run.current === me) {
          setMark(null);
          setBusy(false);
        }
      }
    },
    [clip, playOne],
  );

  return { play, stop, mark, busy };
}
