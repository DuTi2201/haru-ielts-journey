import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Lock, Pause, Play, RotateCcw } from "lucide-react";

import { useExerciseAudio } from "@/hooks/use-exercise-audio";
import type { PracticeTurn } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Ko } from "./Rich";

const SPEAKER_LABEL: Record<PracticeTurn["speaker"], string> = { F: "Nữ", M: "Nam", N: "Dẫn" };
const SPEAKER_TONE: Record<PracticeTurn["speaker"], string> = {
  F: "bg-purple-soft",
  M: "bg-teal-soft",
  N: "bg-yellow-soft",
};

/** The spoken turns, written out — for checking after the answer (or any time when
 * the learner is not practising "one listen only"). */
export function TurnList({ turns, className }: { turns: PracticeTurn[]; className?: string }) {
  return (
    <ol className={cn("space-y-1.5", className)}>
      {turns.map((t, i) => (
        <li key={i} className="flex items-start gap-2">
          <span
            className={cn(
              "mt-0.5 inline-flex h-5 min-w-[34px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
              SPEAKER_TONE[t.speaker],
            )}
          >
            {SPEAKER_LABEL[t.speaker]}
          </span>
          <span className="min-w-0">
            <Ko className="text-[13px] leading-6">{t.text}</Ko>
            {t.vi && (
              <span className="block text-[11.5px] font-medium leading-5 text-ink-2">{t.vi}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Play button + (optional) script for one listening exercise. With `once` on, the
 * recording can be started a single time, like the real exam; the script stays
 * hidden until the learner has answered. */
export function ExerciseAudio({
  lessonId,
  exerciseId,
  turns,
  once,
  answered,
  hideScript = false,
  scriptAfterAnswer = false,
  label = "Nghe hội thoại",
}: {
  lessonId: number;
  exerciseId: string;
  turns: PracticeTurn[];
  once: boolean;
  /** At least one question of the exercise has been answered. */
  answered: boolean;
  /** Mock exam: the written script is a hint, so it stays hidden until the exam is handed in. */
  hideScript?: boolean;
  /** The script IS the answer (hear a word, pick how it is spelt): shown only once answered. */
  scriptAfterAnswer?: boolean;
  label?: string;
}) {
  const audio = useExerciseAudio(lessonId, exerciseId);
  const [showScript, setShowScript] = useState(false);
  const [unlocked, setUnlocked] = useState(0); // "Nghe lại" after answering re-opens the lock

  const busy = audio.state === "loading";
  const playing = audio.state === "playing";
  const spent = once && audio.plays > unlocked && audio.state === "idle";
  const canShowScript = !hideScript && ((!once && !scriptAfterAnswer) || answered);
  const oneVoice = turns.length === 1;

  return (
    <div className="rounded-[16px] border border-transparent bg-purple-soft p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (playing ? audio.pause() : void audio.play())}
          disabled={busy || spent}
          aria-label={playing ? "Tạm dừng" : spent ? "Đã nghe một lần" : label}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-card shadow-elev-1 active:scale-[0.97] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={20} strokeWidth={2.4} className="animate-spin" />
          ) : playing ? (
            <Pause size={20} strokeWidth={2.4} />
          ) : spent ? (
            <Lock size={18} strokeWidth={2.4} />
          ) : (
            <Play size={20} strokeWidth={2.4} className="translate-x-0.5" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ink-2">
            {busy
              ? "Đang ghi âm lần đầu — khoảng 10–30 giây, những lần sau nghe ngay."
              : spent
                ? "Đã nghe một lần như thi thật. Trả lời xong sẽ nghe lại được."
                : once
                  ? "Chế độ thi thật: chỉ nghe một lần."
                  : audio.plays > 0
                    ? "Bấm để nghe lại."
                    : oneVoice
                      ? "Bấm để nghe."
                      : "Giọng nữ và giọng nam, tốc độ tự nhiên."}
          </p>
        </div>
        {answered && spent && (
          <button
            type="button"
            onClick={() => setUnlocked(audio.plays)}
            className="hit-area flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-card px-3 text-[12px] font-semibold shadow-elev-1"
          >
            <RotateCcw size={13} strokeWidth={2.4} /> Nghe lại
          </button>
        )}
      </div>

      {audio.state === "error" && audio.error && (
        <p role="alert" className="mt-2 text-[12px] font-semibold text-danger">
          {audio.error}
        </p>
      )}

      {canShowScript && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowScript((v) => !v)}
            aria-expanded={showScript}
            className="flex items-center gap-1 text-[12px] font-semibold text-blue-deep underline"
          >
            {showScript ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showScript ? "Ẩn lời thoại" : "Xem lời thoại"}
          </button>
          {showScript && (
            <TurnList
              turns={turns}
              className="mt-2 rounded-[12px] border border-line bg-card p-3"
            />
          )}
        </div>
      )}
    </div>
  );
}
