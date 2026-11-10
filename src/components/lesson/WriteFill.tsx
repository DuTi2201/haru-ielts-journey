import { Fragment, useState } from "react";

import { KoreanKeypad } from "./KoreanKeypad";
import { Check, RotateCcw, X } from "lucide-react";

import type { ExerciseResultOut, WriteFillOut } from "@/lib/api/types";
import { matchesAccepted } from "@/lib/lesson-grade";
import { readLocal, removeLocal, writeLocal } from "@/lib/lesson-local";
import { cn } from "@/lib/utils";
import { BulletList, Disclosure } from "./Disclosure";
import { GrammarLinkBox } from "./GrammarLinkBox";
import type { AnswerEvent } from "./McqExercise";
import { Ko, Rich } from "./Rich";

const BLANK = /\(\s*([㉠㉡㉢㉣㉤])\s*\)/;

/** TOPIK writing 51–52: fill the gaps of a short text with one sentence each. The
 * browser checks each typed sentence against the accepted answers (spaces and
 * closing punctuation ignored). A correct sentence that is not on the list can be
 * counted by hand — the learner knows better than a list. */
export function WriteFill({
  lessonId,
  exercise,
  previous,
  onAnswer,
}: {
  lessonId: number;
  exercise: WriteFillOut;
  previous: Record<string, ExerciseResultOut>;
  onAnswer: (a: AnswerEvent) => void;
}) {
  const draftKey = `draft:${lessonId}:${exercise.id}`;
  const [values, setValues] = useState<Record<string, string>>(() =>
    readLocal<Record<string, string>>(draftKey, {}),
  );
  const [checked, setChecked] = useState(false);
  const [overridden, setOverridden] = useState<Set<string>>(new Set());
  // the blank the on-screen Korean keyboard types into (none: the keyboard is closed)
  const [keypad, setKeypad] = useState<string | null>(null);

  const qid = (blankId: string) => `${exercise.id}:${blankId}`;
  const isRight = (blankId: string, accepted: string[]) =>
    overridden.has(blankId) || matchesAccepted(values[blankId] ?? "", accepted);
  const earned = exercise.blanks.reduce(
    (n, b) => n + (isRight(b.id, b.accepted) ? b.points : 0),
    0,
  );
  const anyTyped = exercise.blanks.some((b) => (values[b.id] ?? "").trim() !== "");

  function change(blankId: string, value: string) {
    const next = { ...values, [blankId]: value };
    setValues(next);
    writeLocal(draftKey, next);
  }

  function check() {
    setChecked(true);
    for (const b of exercise.blanks) {
      onAnswer({
        exerciseId: exercise.id,
        questionId: qid(b.id),
        correct: matchesAccepted(values[b.id] ?? "", b.accepted),
        answer: (values[b.id] ?? "").slice(0, 500),
      });
    }
  }

  function countAsRight(blankId: string) {
    setOverridden((s) => new Set(s).add(blankId));
    onAnswer({
      exerciseId: exercise.id,
      questionId: qid(blankId),
      correct: true,
      answer: (values[blankId] ?? "").slice(0, 500),
    });
  }

  function reset() {
    setValues({});
    removeLocal(draftKey);
    setChecked(false);
    setOverridden(new Set());
  }

  const parts = exercise.text.split(BLANK);

  return (
    <article
      aria-label={exercise.title_vi}
      className="rounded-[20px] border border-line bg-paper p-3.5 shadow-elev-1"
    >
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-blue-deep">
          {exercise.title_vi} · {exercise.points} điểm
        </p>
        {exercise.instruction_ko && (
          <p lang="ko" className="font-korean mt-1 text-[13px] font-semibold leading-5">
            {exercise.instruction_ko}
          </p>
        )}
        {exercise.instruction_vi && (
          <p className="text-xs font-semibold leading-5 text-ink-2">{exercise.instruction_vi}</p>
        )}
        {exercise.context_vi && (
          <span className="mt-1.5 inline-block rounded-full bg-blue-soft px-2.5 py-0.5 text-[12px] font-semibold text-blue-deep">
            {exercise.context_vi}
          </span>
        )}
      </header>

      <div className="mt-3 rounded-[16px] border border-line bg-card p-3.5">
        {exercise.heading_ko && (
          <p
            lang="ko"
            className="font-korean mb-1.5 border-b border-progress pb-1.5 text-[13px] font-semibold"
          >
            {exercise.heading_ko}
          </p>
        )}
        <p lang="ko" className="font-korean whitespace-pre-line text-[14.5px] leading-8">
          {parts.map((p, i) =>
            i % 2 === 1 ? (
              <span
                key={i}
                className="mx-0.5 inline-flex min-w-[2.2em] justify-center rounded-[8px] bg-yellow-soft px-1.5 font-semibold"
              >
                {p}
              </span>
            ) : (
              <Fragment key={i}>{p}</Fragment>
            ),
          )}
        </p>
      </div>

      <div className="mt-3 space-y-3">
        {exercise.blanks.map((b) => {
          const right = isRight(b.id, b.accepted);
          const prev = previous[qid(b.id)];
          return (
            <div key={b.id}>
              <label
                htmlFor={`${exercise.id}-${b.id}`}
                className="flex items-center gap-1.5 text-xs font-semibold"
              >
                <span lang="ko" className="font-korean text-base text-blue-deep">
                  {b.id}
                </span>
                <span className="font-semibold text-ink-2">· {b.points} điểm</span>
              </label>
              <input
                id={`${exercise.id}-${b.id}`}
                type="text"
                lang="en"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={checked}
                value={values[b.id] ?? ""}
                onChange={(e) => change(b.id, e.target.value)}
                placeholder={exercise.rung === 2 ? "Điền dạng đúng…" : "Viết một câu hoàn chỉnh…"}
                className={cn(
                  "font-korean mt-1 min-h-11 w-full rounded-[12px] border bg-card px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-blue/50",
                  !checked && "border-line",
                  checked &&
                    (right ? "border-green bg-green-soft" : "border-danger bg-danger-soft"),
                )}
              />
              {!checked && prev && (
                <p className="mt-1 text-[12px] font-semibold text-ink-2">
                  Lần trước: {prev.correct ? "đúng" : "sai"}
                  {prev.answer ? ` (“${prev.answer}”)` : ""}
                </p>
              )}
              {checked && (
                <div role="status" className="mt-1.5 space-y-1.5 text-xs leading-5">
                  <p className="flex items-center gap-1.5 font-semibold">
                    {right ? (
                      <>
                        <Check size={15} strokeWidth={3} className="text-green" /> Đúng
                      </>
                    ) : (
                      <>
                        <X size={15} strokeWidth={3} className="text-danger" /> Chưa khớp đáp án
                      </>
                    )}
                  </p>
                  <p className="text-ink-2">
                    <span className="font-semibold text-ink">Đáp án chấp nhận: </span>
                    {b.accepted.map((a, i) => (
                      <Fragment key={a}>
                        {i > 0 && " · "}
                        <Ko className="font-semibold text-ink">{a}</Ko>
                      </Fragment>
                    ))}
                  </p>
                  {!right && b.common_errors_vi && (
                    <p className="rounded-[10px] bg-yellow-soft px-2.5 py-1.5 font-semibold text-ink">
                      <Rich text={`Lỗi hay gặp: ${b.common_errors_vi}`} />
                    </p>
                  )}
                  {!right && (values[b.id] ?? "").trim() !== "" && (
                    <button
                      type="button"
                      onClick={() => countAsRight(b.id)}
                      className="hit-area text-[12px] font-semibold text-blue-deep underline"
                    >
                      Câu của tôi cũng đúng — tính là đúng
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {checked && (
        <GrammarLinkBox
          patterns={exercise.grammar}
          correct={exercise.blanks.every((b) => isRight(b.id, b.accepted))}
        />
      )}

      {exercise.tips_vi && exercise.tips_vi.length > 0 && (
        <Disclosure title="Mẹo làm bài" className="mt-3">
          <BulletList items={exercise.tips_vi} />
        </Disclosure>
      )}

      <div className="mt-3.5 flex items-center justify-between gap-2">
        {checked ? (
          <>
            <p className="text-sm font-semibold">
              Được {earned}/{exercise.points} điểm
            </p>
            <button
              type="button"
              onClick={reset}
              className="hit-area flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-xs font-semibold shadow-elev-1 active:scale-[0.97] "
            >
              <RotateCcw size={13} strokeWidth={2.4} /> Viết lại
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={check}
            disabled={!anyTyped}
            className="hit-area ml-auto flex min-h-11 items-center gap-1.5 rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
          >
            Chấm bài
          </button>
        )}
      </div>
    </article>
  );
}
