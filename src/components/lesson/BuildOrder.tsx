import { Fragment, useState } from "react";
import { Check, RotateCcw, Undo2, X } from "lucide-react";

import { useTextAudio } from "@/hooks/use-text-audio";
import type { BuildOrderOut, ExerciseResultOut } from "@/lib/api/types";
import { matchesAccepted } from "@/lib/lesson-grade";
import { cn } from "@/lib/utils";
import { BulletList } from "./Disclosure";
import { GrammarLinkBox } from "./GrammarLinkBox";
import type { AnswerEvent } from "./McqExercise";
import { Ko, Rich } from "./Rich";
import { ExerciseHead, splitProgress } from "./ExerciseHead";

/** "Tạo câu" rung 1: put word tiles in order to make one sentence. A tap moves a tile onto
 * the answer line and a tap on it there takes it back. Tiles no answer uses are distractors
 * (usually the wrong form of the same word). The browser checks the line against the accepted
 * orders (spaces and closing punctuation ignored), so two tile splits that spell the same
 * sentence count the same. */
export function BuildOrder({
  exercise,
  previous,
  onAnswer,
}: {
  exercise: BuildOrderOut;
  previous: Record<string, ExerciseResultOut>;
  onAnswer: (a: AnswerEvent) => void;
}) {
  const [placed, setPlaced] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const audio = useTextAudio();

  const sentence = placed.map((i) => exercise.tiles[i]).join(" ");
  const right = matchesAccepted(sentence, exercise.answers);
  const free = exercise.tiles.map((_, i) => i).filter((i) => !placed.includes(i));
  const prev = previous[exercise.id];
  const errors = exercise.common_errors_vi ?? [];

  function check() {
    if (placed.length === 0) return;
    setChecked(true);
    // the right sentence, heard whole at the moment it is made: the ear gets the finished line
    if (right) void audio.play(sentence);
    onAnswer({
      exerciseId: exercise.id,
      questionId: exercise.id,
      correct: right,
      answer: sentence.slice(0, 500),
    });
  }

  function reset() {
    setPlaced([]);
    setChecked(false);
  }

  const tileClass =
    "hit-area font-korean min-h-11 rounded-[12px] border px-3 text-[15px] font-semibold leading-5 active:scale-[0.97] disabled:active:translate-y-0";

  return (
    <article
      aria-label={exercise.title_vi}
      className="rounded-[20px] border border-line bg-paper p-3.5 shadow-elev-1"
    >
      <ExerciseHead
        chip="Xếp câu"
        n={splitProgress(exercise.title_vi).n}
        total={splitProgress(exercise.title_vi).total}
        task="Xếp các mảnh thành một câu đúng"
        detail={exercise.situation_vi ?? null}
      />

      <p className="mt-3 rounded-[14px] bg-yellow-soft px-3 py-2 text-sm font-semibold leading-6">
        Hãy nói: <Rich text={exercise.meaning_vi} />
      </p>

      <div
        role="group"
        aria-label="Câu của bạn"
        className={cn(
          "mt-3 flex min-h-[3.75rem] flex-wrap items-center gap-2 rounded-[16px] border bg-card p-2.5",
          !checked && "border-dashed border-line",
          checked && (right ? "border-green bg-green-soft" : "border-danger bg-danger-soft"),
        )}
      >
        {placed.length === 0 && (
          <p className="px-1 text-xs font-semibold text-ink-2">Chạm vào các mảnh bên dưới…</p>
        )}
        {placed.map((i, pos) => (
          <button
            key={i}
            type="button"
            lang="ko"
            disabled={checked}
            onClick={() => setPlaced((p) => p.filter((x) => x !== i))}
            aria-label={`${exercise.tiles[i]} — mảnh thứ ${pos + 1}, chạm để bỏ ra`}
            className={cn(tileClass, "border-transparent bg-blue-soft")}
          >
            {exercise.tiles[i]}
          </button>
        ))}
      </div>

      {!checked && (
        <div
          role="group"
          aria-label="Các mảnh còn lại"
          className="mt-3 flex min-h-11 flex-wrap gap-2"
        >
          {free.map((i) => (
            <button
              key={i}
              type="button"
              lang="ko"
              onClick={() => setPlaced((p) => [...p, i])}
              className={cn(tileClass, "border-line bg-card shadow-elev-1 ")}
            >
              {exercise.tiles[i]}
            </button>
          ))}
          {free.length === 0 && (
            <p className="px-1 text-xs font-semibold text-ink-2">
              Đã dùng hết các mảnh — bấm “Kiểm tra”, hoặc bỏ bớt mảnh nếu bạn nghĩ có mảnh thừa.
            </p>
          )}
        </div>
      )}

      {!checked && prev && (
        <p className="mt-2 text-[12px] font-semibold text-ink-2">
          Lần trước: {prev.correct ? "đúng" : "sai"}
          {prev.answer ? ` (“${prev.answer}”)` : ""}
        </p>
      )}

      {checked && (
        <div role="status" className="mt-3 space-y-2 text-xs leading-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            {right ? (
              <>
                <Check size={16} strokeWidth={3} className="text-green" /> Đúng rồi
              </>
            ) : (
              <>
                <X size={16} strokeWidth={3} className="text-danger" /> Chưa đúng
              </>
            )}
          </p>
          <p className="text-ink-2">
            <span className="font-semibold text-ink">
              {right ? "Các cách xếp đúng: " : "Đáp án: "}
            </span>
            {exercise.answers.map((a, i) => (
              <Fragment key={a}>
                {i > 0 && " · "}
                <Ko className="font-semibold text-ink">{a}</Ko>
              </Fragment>
            ))}
          </p>
          {exercise.explain_vi && (
            <Rich as="p" text={exercise.explain_vi} className="font-semibold text-ink-2" />
          )}
          {!right && errors.length > 0 && (
            <div className="rounded-[10px] bg-yellow-soft px-2.5 py-2">
              <p className="mb-1 font-semibold">Lỗi hay gặp</p>
              <BulletList items={errors} />
            </div>
          )}
        </div>
      )}

      {checked && <GrammarLinkBox patterns={exercise.grammar} correct={right} />}

      <div className="mt-3.5 flex items-center justify-between gap-2">
        {checked ? (
          <button
            type="button"
            onClick={reset}
            className="hit-area ml-auto flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-xs font-semibold shadow-elev-1 active:scale-[0.97] "
          >
            <RotateCcw size={13} strokeWidth={2.4} /> Xếp lại
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setPlaced((p) => p.slice(0, -1))}
              disabled={placed.length === 0}
              className="hit-area flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-xs font-semibold active:scale-[0.97] disabled:opacity-40"
            >
              <Undo2 size={13} strokeWidth={2.4} /> Bỏ mảnh cuối
            </button>
            <button
              type="button"
              onClick={check}
              disabled={placed.length === 0}
              className="hit-area flex min-h-11 items-center gap-1.5 rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
            >
              Kiểm tra
            </button>
          </>
        )}
      </div>
    </article>
  );
}
