/** One practice text of a sound (a word, the minimal pair, the whole word list, or the sentence):
 * hear the model, record yourself, get the Azure score per word. Same recorder as "Nói thử"; the
 * recording is sent once to /me/pronunciation/assess and kept nowhere. The number is a read-aloud
 * score for this text, not an IELTS band. */
import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import { useRef, useState } from "react";

import { ScoreLine } from "@/components/lesson/session/SayStep";
import { useTextAudio } from "@/hooks/use-text-audio";
import { assessSound } from "@/lib/api/pronunciation";
import { errorMessage } from "@/lib/api/client";
import { tap } from "@/lib/feedback";
import { saveBest } from "@/lib/pron-progress";
import { startRecording, toWavBase64, type SpeechScore } from "@/lib/speech-assess";
import { cn } from "@/lib/utils";

export function PracticeLine({
  slug,
  text,
  label,
  best,
  canScore,
  busyElsewhere,
  onBusy,
  onBest,
}: {
  slug: string;
  text: string;
  label?: string;
  best?: number | undefined;
  /** signed in and the device can record */
  canScore: boolean;
  /** another line is recording or being scored */
  busyElsewhere: boolean;
  onBusy: (busy: boolean) => void;
  onBest: (all: Record<string, number>) => void;
}) {
  const audio = useTextAudio();
  const [recording, setRecording] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [score, setScore] = useState<SpeechScore | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const stopRef = useRef<(() => Promise<Blob>) | null>(null);
  const playing = audio.activeText === text && audio.state === "playing";
  const loading = audio.activeText === text && audio.state === "loading";

  async function toggle() {
    setErr(null);
    if (recording && stopRef.current) {
      const stop = stopRef.current;
      stopRef.current = null;
      setRecording(false);
      setScoring(true);
      try {
        const wav = await toWavBase64(await stop());
        const res = await assessSound(slug, text, wav);
        setScore(res);
        if (res.ok) onBest(saveBest(slug, text, res.accuracy));
      } catch (e) {
        setErr(errorMessage(e));
      } finally {
        setScoring(false);
        onBusy(false);
      }
      return;
    }
    if (busyElsewhere) return;
    try {
      tap();
      onBusy(true);
      const r = await startRecording();
      stopRef.current = r.stop;
      setRecording(true);
    } catch {
      onBusy(false);
      setErr("Chưa dùng được micro. Hãy cho phép micro rồi thử lại.");
    }
  }

  return (
    <li className="rounded-[16px] border border-line bg-card p-3">
      {label && <p className="text-[11.5px] font-bold uppercase tracking-wide text-ink-2">{label}</p>}
      <p lang="en" className="text-[18px] font-bold leading-snug">
        {text}
      </p>
      {best !== undefined && (
        <p className="mt-0.5 text-[12px] font-semibold text-ink-2">Điểm cao nhất: {best}</p>
      )}
      {score && <ScoreLine score={score} />}
      {err && <p className="mt-1.5 text-[12px] font-medium text-danger">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            tap();
            void audio.play(text);
          }}
          className="hit-area inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-fill px-3 text-[13px] font-semibold active:scale-[0.97]"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Volume2 size={16} aria-hidden="true" />
          )}
          {playing ? "Đang phát" : "Nghe mẫu"}
        </button>
        {canScore && (
          <button
            type="button"
            onClick={() => void toggle()}
            disabled={scoring || (busyElsewhere && !recording)}
            aria-pressed={recording}
            className={cn(
              "hit-area inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[12px] px-3 text-[13px] font-semibold text-primary-foreground active:scale-[0.97] disabled:opacity-50",
              recording ? "bg-danger" : "bg-blue",
            )}
          >
            {scoring ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : recording ? (
              <Square size={14} aria-hidden="true" />
            ) : (
              <Mic size={16} aria-hidden="true" />
            )}
            {scoring ? "Đang chấm" : recording ? "Dừng" : score ? "Ghi lại" : "Ghi âm"}
          </button>
        )}
      </div>
      {audio.error && audio.activeText === text && (
        <p className="mt-1.5 text-[12px] font-medium text-danger">{audio.error}</p>
      )}
    </li>
  );
}
