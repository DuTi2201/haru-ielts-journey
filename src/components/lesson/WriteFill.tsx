import { Fragment, useState } from "react";

import { Check, RotateCcw, X } from "lucide-react";

import type { ExerciseResultOut, WriteFillOut } from "@/lib/api/types";
import { matchesAccepted } from "@/lib/lesson-grade";
import { readLocal, removeLocal, writeLocal } from "@/lib/lesson-local";
import { cn } from "@/lib/utils";
import { BulletList, Disclosure } from "./Disclosure";
import { GrammarLinkBox } from "./GrammarLinkBox";
import type { AnswerEvent } from "./McqExercise";
import { ExerciseHead, firstSentence, splitProgress } from "./ExerciseHead";
import { Ko, Rich } from "./Rich";

// «( ㉠ )», and the hint some items put right after it: «( ㉠ ) (work)»
const BLANK = /\(\s*([㉠㉡㉢㉣㉤])\s*\)(?:\s*\(([^()]{1,28})\))?/;
const INLINE_MAX = 26;

const KIND_CHIP: Record<string, string> = {
  fix: "Sửa lỗi",
  inflect: "Chia động từ",
  word: "Điền từ",
  bank: "Điền từ trong khung",
  rewrite: "Viết lại câu",
};

/** What kind of task this is: said by the data when it says so, else read from the title. */
function kindOf(ex: WriteFillOut, hasHint: boolean): string {
  if (ex.kind && KIND_CHIP[ex.kind]) return ex.kind;
  if (/sửa/i.test(ex.title_vi)) return "fix";
  if ((ex.bank?.length ?? 0) > 0 || /trong khung/i.test(ex.title_vi)) return "bank";
  if (hasHint || /chia/i.test(ex.title_vi)) return "inflect";
  return "word";
}

/** Writing 51–52 of the old TOPIK app, now the IELTS fill-in tasks: type the missing word or phrase
 * into the gap inside the sentence. The browser checks it against the accepted answers (spaces and
 * closing punctuation ignored). A correct answer that is not on the list can be counted by hand —
 * the learner knows better than a list. */
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
  // the gap the word bank fills (the last one the learner touched)
  const [focusId, setFocusId] = useState<string | null>(null);

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
    if (!anyTyped || checked) return;
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

  // text, id, hint, text, id, hint, …
  const pieces = exercise.text.split(BLANK);
  const hints: Record<string, string> = {};
  for (let i = 1; i < pieces.length; i += 3) {
    const h = pieces[i + 1];
    if (h) hints[pieces[i] ?? ""] = h.trim();
  }
  const firstHint = Object.values(hints)[0];
  const kind = kindOf(exercise, firstHint !== undefined);
  const { name, n, total } = splitProgress(exercise.title_vi);
  const longest = Math.max(...exercise.blanks.flatMap((b) => b.accepted.map((a) => a.length)));
  const inline = longest <= INLINE_MAX;
  const numberOf = (id: string) => exercise.blanks.findIndex((b) => b.id === id) + 1;
  const many = exercise.blanks.length > 1;

  const instr = firstSentence(exercise.instruction_vi);
  // a list of words cut off with «…» is not an instruction; the bank shows it properly
  const cleanRest = instr.rest
    .replace(/[^.]*(?:,\s*[a-z'’-]+){3,}…\s*$/i, "")
    .split(/(?<=[.!?])\s+/)
    .filter((x) => x && !(kind === "fix" && !exercise.original && /in đậm/.test(x)))
    .join(" ")
    .trim();
  const task =
    exercise.task_vi ??
    (kind === "fix"
      ? exercise.original
        ? "Sửa phần gạch ngang"
        : "Gõ phần còn thiếu cho đúng nghĩa"
      : kind === "inflect" && firstHint
        ? `Chia động từ (${firstHint})`
        : kind === "bank"
          ? "Chọn từ trong khung để điền"
          : instr.head.replace(/^Câu gốc đang sai.*$/, "") || "Điền chỗ trống");

  function fillFromBank(word: string) {
    const target =
      focusId && exercise.blanks.some((b) => b.id === focusId)
        ? focusId
        : (exercise.blanks.find((b) => (values[b.id] ?? "").trim() === "") ?? exercise.blanks[0])?.id;
    if (target) change(target, word);
  }

  const gapInput = (id: string) => {
    const b = exercise.blanks.find((x) => x.id === id);
    if (!b) return null;
    const right = isRight(id, b.accepted);
    const w = Math.min(INLINE_MAX, Math.max(5, Math.max(...b.accepted.map((a) => a.length)) + 2));
    return (
      <span className="whitespace-nowrap">
        <input
          id={`${exercise.id}-${id}`}
          type="text"
          lang="en"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          disabled={checked}
          value={values[id] ?? ""}
          onChange={(e) => change(id, e.target.value)}
          onFocus={() => setFocusId(id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") check();
          }}
          aria-label={
            many ? `Chỗ trống ${numberOf(id)} trong ${exercise.blanks.length}` : "Chỗ trống trong câu"
          }
          style={{ width: `${w}ch` }}
          className={cn(
            "mx-1 inline-block min-h-10 max-w-full rounded-t-[8px] border-0 border-b-2 px-1 text-center align-baseline text-[17px] font-semibold outline-none focus-visible:bg-blue-soft",
            !checked && "border-blue bg-blue-soft/50",
            checked && (right ? "border-green bg-green-soft" : "border-danger bg-danger-soft"),
          )}
        />
        {hints[id] && (
          <span className="mr-1 rounded-[6px] bg-blue-soft px-1.5 py-0.5 text-[14px] font-bold text-blue-deep">
            {hints[id]}
          </span>
        )}
      </span>
    );
  };

  return (
    <article
      aria-label={name}
      className="rounded-[20px] border border-line bg-paper p-3.5 shadow-elev-1"
    >
      <ExerciseHead
        chip={KIND_CHIP[kind]}
        n={n}
        total={total}
        task={task}
        detail={cleanRest.length > 0 && cleanRest.length <= 150 ? cleanRest : null}
      />
      {cleanRest.length > 150 && (
        <Disclosure title="Cách làm" className="mt-2">
          <p className="text-[13.5px] leading-5 text-ink-2">{cleanRest}</p>
        </Disclosure>
      )}
      {exercise.context_vi && (
        <span className="mt-1.5 inline-block rounded-full bg-blue-soft px-2.5 py-0.5 text-[12px] font-semibold text-blue-deep">
          {exercise.context_vi}
        </span>
      )}

      {(exercise.bank?.length ?? 0) > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Từ trong khung">
          {exercise.bank?.map((w) => {
            const used = Object.values(values).some((v) => v.trim().toLowerCase() === w.toLowerCase());
            return (
              <li key={w}>
                <button
                  type="button"
                  disabled={checked}
                  onClick={() => fillFromBank(w)}
                  className={cn(
                    "min-h-11 rounded-full border border-line bg-card px-3.5 text-[15px] font-semibold active:scale-95",
                    used && "opacity-40",
                  )}
                >
                  {w}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 rounded-[16px] border border-line bg-card p-3.5">
        {exercise.heading_en && (
          <p lang="en" className="mb-1.5 border-b border-progress pb-1.5 text-[13px] font-semibold">
            {exercise.heading_en}
          </p>
        )}
        {exercise.situation_vi && (
          <p className="mb-2 rounded-[10px] bg-yellow-soft px-3 py-2 text-[14px] font-medium leading-5">
            <span className="font-bold">Ý muốn nói: </span>
            <Rich text={exercise.situation_vi} />
          </p>
        )}
        {exercise.original && (
          <p className="mb-2 flex gap-2 rounded-[10px] bg-danger-soft px-3 py-2 text-[16px] leading-6">
            <span aria-hidden="true" className="font-bold text-danger">
              ✗
            </span>
            <span lang="en" className="min-w-0">
              <span className="sr-only">Câu sai: </span>
              <Rich text={exercise.original} />
            </span>
          </p>
        )}
        <p lang="en" className="whitespace-pre-line text-[17px] leading-[2.6rem]">
          {pieces.map((p, i) => {
            const slot = i % 3;
            if (slot === 1) {
              return inline ? (
                <Fragment key={i}>{gapInput(p)}</Fragment>
              ) : (
                <span
                  key={i}
                  className="mx-1 inline-flex min-w-[3.2em] items-center justify-center rounded-[8px] border-b-2 border-blue bg-blue-soft/50 px-1.5 text-[14px] font-bold text-blue-deep"
                >
                  {many ? numberOf(p) : "…"}
                </span>
              );
            }
            if (slot === 2) return null; // the hint, shown with the gap
            return <Fragment key={i}>{p}</Fragment>;
          })}
        </p>
      </div>

      {!inline && (
        <div className="mt-3 space-y-3">
          {exercise.blanks.map((b) => (
            <div key={b.id}>
              {many && (
                <label htmlFor={`${exercise.id}-${b.id}`} className="text-[13px] font-bold text-blue-deep">
                  Chỗ trống {numberOf(b.id)}
                </label>
              )}
              <input
                id={`${exercise.id}-${b.id}`}
                type="text"
                lang="en"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="done"
                disabled={checked}
                value={values[b.id] ?? ""}
                onChange={(e) => change(b.id, e.target.value)}
                onFocus={() => setFocusId(b.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") check();
                }}
                aria-label={many ? undefined : "Câu trả lời của bạn"}
                placeholder="Gõ câu trả lời của bạn"
                className={cn(
                  "mt-1 min-h-11 w-full rounded-[12px] border bg-card px-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-blue",
                  !checked && "border-line",
                  checked && (isRight(b.id, b.accepted) ? "border-green bg-green-soft" : "border-danger bg-danger-soft"),
                )}
              />
            </div>
          ))}
        </div>
      )}

      {checked && (
        <div role="status" className="mt-3 space-y-2.5">
          {exercise.blanks.map((b) => {
            const right = isRight(b.id, b.accepted);
            return (
              <div key={b.id} className="space-y-1.5 text-[13.5px] leading-5">
                <p className="flex items-center gap-1.5 font-bold">
                  {right ? (
                    <>
                      <Check size={16} strokeWidth={3} className="text-green" /> Đúng
                      {many ? ` (chỗ trống ${numberOf(b.id)})` : ""}
                    </>
                  ) : (
                    <>
                      <X size={16} strokeWidth={3} className="text-danger" /> Chưa đúng
                      {many ? ` (chỗ trống ${numberOf(b.id)})` : ""}
                    </>
                  )}
                </p>
                <p className="text-ink-2">
                  <span className="font-semibold text-ink">Đáp án: </span>
                  {b.accepted.map((a, i) => (
                    <Fragment key={a}>
                      {i > 0 && " · "}
                      <Ko className={cn("text-ink", i === 0 ? "font-bold" : "font-medium")}>{a}</Ko>
                    </Fragment>
                  ))}
                </p>
                {!right && b.common_errors_vi && (
                  <p className="rounded-[10px] bg-yellow-soft px-2.5 py-1.5 font-medium text-ink">
                    <Rich text={b.common_errors_vi} />
                  </p>
                )}
                {!right && (values[b.id] ?? "").trim() !== "" && (
                  <button
                    type="button"
                    onClick={() => countAsRight(b.id)}
                    className="hit-area min-h-11 text-[13px] font-semibold text-blue-deep underline"
                  >
                    Câu của tôi cũng đúng, tính là đúng
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!checked &&
        exercise.blanks.some((b) => previous[qid(b.id)]) &&
        (() => {
          const prev = previous[qid(exercise.blanks[0]?.id ?? "")];
          return prev ? (
            <p className="mt-2 text-[12px] font-semibold text-ink-2">
              Lần trước: {prev.correct ? "đúng" : "sai"}
              {prev.answer ? ` (“${prev.answer}”)` : ""}
            </p>
          ) : null;
        })()}

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
              className="hit-area flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-[13px] font-semibold shadow-elev-1 active:scale-[0.97]"
            >
              <RotateCcw size={14} strokeWidth={2.4} /> Làm lại
            </button>
          </>
        ) : (
          <>
            <p className="text-[12.5px] font-medium text-ink-2" aria-live="polite">
              {anyTyped ? "Xong thì bấm Chấm bài, hoặc Enter." : "Gõ đáp án để chấm."}
            </p>
            <button
              type="button"
              onClick={check}
              aria-disabled={!anyTyped}
              className={cn(
                "hit-area flex min-h-11 items-center gap-1.5 rounded-full border border-transparent px-5 text-sm font-semibold active:scale-[0.97]",
                anyTyped
                  ? "bg-blue text-primary-foreground shadow-elev-1"
                  : "bg-progress text-ink-2",
              )}
            >
              Chấm bài
            </button>
          </>
        )}
      </div>
    </article>
  );
}
