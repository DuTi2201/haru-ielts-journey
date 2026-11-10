import { useState } from "react";
import { Check, Headphones, RotateCcw } from "lucide-react";

import type { DictationOut, ExerciseResultOut } from "@/lib/api/types";
import { checkDictation, packAnswer, type DictationResult, type Mark } from "@/lib/dictation";
import { readLocal, removeLocal, writeLocal } from "@/lib/lesson-local";
import { cn } from "@/lib/utils";
import { BulletList, Disclosure } from "./Disclosure";
import { ExerciseAudio, TurnList } from "./ExerciseAudio";
import { GrammarLinkBox } from "./GrammarLinkBox";
import type { AnswerEvent } from "./McqExercise";
import { Ko } from "./Rich";

const SPEAKER_LABEL = { F: "Nữ", M: "Nam", N: "Dẫn" } as const;

/** Chép chính tả (dictation): listen as often as you like, type each line, check. The check
 * shows, character by character, what the ear missed; the second step plays the recording
 * again with the script and its meaning and lists the words to learn. Spaces and punctuation do
 * not count — the point is the ear, not the spelling — and a lesson holds only a few of these,
 * because too many wears the learner out. */
export function DictationExercise({
  lessonId,
  exercise,
  previous,
  onAnswer,
}: {
  lessonId: number;
  exercise: DictationOut;
  previous: Record<string, ExerciseResultOut>;
  onAnswer: (a: AnswerEvent) => void;
}) {
  const turns = exercise.stimulus.turns;
  const draftKey = `draft:${lessonId}:${exercise.id}`;
  const [values, setValues] = useState<string[]>(() => {
    const saved = readLocal<unknown>(draftKey, []);
    return turns.map((_, i) =>
      Array.isArray(saved) && typeof saved[i] === "string" ? (saved[i] as string) : "",
    );
  });
  const [result, setResult] = useState<DictationResult | null>(null);

  const anyTyped = values.some((v) => v.trim() !== "");
  const prev = previous[exercise.id];

  function change(index: number, value: string) {
    const next = values.map((v, i) => (i === index ? value : v));
    setValues(next);
    writeLocal(draftKey, next);
  }

  function check() {
    const res = checkDictation(
      values,
      turns.map((t) => t.text),
    );
    setResult(res);
    onAnswer({
      exerciseId: exercise.id,
      questionId: exercise.id,
      correct: res.passed,
      answer: packAnswer(values),
    });
  }

  function reset() {
    setValues(turns.map(() => ""));
    removeLocal(draftKey);
    setResult(null);
  }

  return (
    <article
      aria-label={exercise.title_vi}
      className="rounded-[20px] border border-line bg-paper p-3.5 shadow-elev-1"
    >
      <header>
        <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-blue-deep">
          <Headphones size={13} strokeWidth={2.6} aria-hidden="true" /> {exercise.title_vi}
        </p>
        {exercise.instruction_vi && (
          <p className="mt-1 text-xs font-semibold leading-5 text-ink-2">
            {exercise.instruction_vi}
          </p>
        )}
      </header>

      <div className="mt-3">
        <ExerciseAudio
          lessonId={lessonId}
          exerciseId={exercise.id}
          turns={turns}
          once={false}
          answered={result !== null}
          hideScript
          label="Nghe và chép"
        />
      </div>

      <ol className="mt-3 space-y-3" aria-label="Các câu cần chép">
        {turns.map((t, i) => {
          const line = result?.lines[i];
          return (
            <li key={i}>
              <label
                htmlFor={`${exercise.id}-line-${i}`}
                className="flex items-center gap-1.5 text-xs font-semibold"
              >
                Câu {i + 1}
                <span className="rounded-full bg-purple-soft px-1.5 py-0.5 text-[11px] font-semibold">
                  {SPEAKER_LABEL[t.speaker]}
                </span>
                {line && (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 text-[12px] font-semibold",
                      line.similarity >= 0.85 ? "bg-green-soft" : "bg-yellow-soft",
                    )}
                  >
                    Khớp {Math.round(line.similarity * 100)}%
                  </span>
                )}
              </label>
              <textarea
                id={`${exercise.id}-line-${i}`}
                lang="ko"
                rows={2}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={result !== null}
                value={values[i] ?? ""}
                onChange={(e) => change(i, e.target.value)}
                placeholder="Gõ những gì bạn nghe được…"
                className={cn(
                  "font-korean mt-1 w-full resize-none rounded-[12px] border border-line bg-card px-3 py-2 text-[15px] leading-6 outline-none focus-visible:ring-2 focus-visible:ring-blue/50",
                  result !== null && "bg-paper",
                )}
              />
              {line && (
                <div className="mt-1.5 space-y-1 rounded-[12px] border border-line bg-card p-2.5 text-[15px] leading-7">
                  <p>
                    <span className="mr-1.5 text-[10.5px] font-semibold uppercase text-ink-2">
                      Bạn gõ
                    </span>
                    <Marks marks={line.typed} wrong="text-danger underline decoration-wavy" />
                    {line.typed.length === 0 && <em className="text-xs text-ink-2">(để trống)</em>}
                  </p>
                  <p>
                    <span className="mr-1.5 text-[10.5px] font-semibold uppercase text-ink-2">
                      Đáp án
                    </span>
                    <Marks marks={line.script} wrong="bg-yellow-soft font-semibold underline" />
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!result && prev && (
        <p className="mt-2 text-[12px] font-semibold text-ink-2">
          Lần trước: {prev.correct ? "đã khớp gần hết" : "còn nhiều chỗ chưa nghe ra"}
        </p>
      )}

      {result && (
        <>
          <div
            role="status"
            className="mt-3 rounded-[14px] bg-blue-soft px-3 py-2 text-xs leading-5"
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {result.passed && <Check size={16} strokeWidth={3} className="text-green" />}
              Khớp {Math.round(result.similarity * 100)}% với lời thoại
            </p>
            <p className="font-semibold text-ink-2">
              {result.passed
                ? "Tai bạn đã bắt được gần hết. Sang bước 2 để nắm chắc từ và mẫu câu."
                : "Chưa sao — mục tiêu là quen tốc độ, không cần đúng hết. Sang bước 2, nghe lại cùng lời thoại rồi chép lại một lần nữa."}
            </p>
            <p className="mt-1 text-[12px] font-medium text-ink-2">
              <span className="font-semibold text-danger underline decoration-wavy">Gạch đỏ</span> =
              ký tự bạn gõ thừa hoặc sai ·{" "}
              <span className="rounded bg-yellow-soft px-0.5 font-semibold underline">
                nền vàng
              </span>{" "}
              = ký tự trong đáp án mà bạn chưa nghe ra · dấu cách và dấu câu không tính.
            </p>
          </div>

          <section aria-label="Bước 2: nghe lại và học từ" className="mt-3">
            <h4 className="text-[13px] font-semibold">Bước 2 · Nghe lại và học từ</h4>
            <p className="text-xs font-semibold leading-5 text-ink-2">
              Bấm nghe lại ở trên, vừa nghe vừa đọc lời thoại. Sau đó học thuộc các từ này.
            </p>
            <TurnList
              turns={turns}
              className="mt-2 rounded-[12px] border border-line bg-card p-3"
            />
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2" aria-label="Từ và mẫu câu cần nhớ">
              {exercise.focus.map((g) => (
                <li
                  key={g.ko}
                  className="flex items-baseline gap-2 rounded-[10px] bg-yellow-soft px-2.5 py-1.5 text-xs"
                >
                  <Ko className="text-[13.5px] font-semibold">{g.ko}</Ko>
                  <span className="font-semibold text-ink-2">{g.vi}</span>
                </li>
              ))}
            </ul>
          </section>

          <GrammarLinkBox patterns={exercise.grammar} correct={result.passed} />
        </>
      )}

      {exercise.tips_vi && exercise.tips_vi.length > 0 && (
        <Disclosure title="Mẹo nghe" className="mt-3">
          <BulletList items={exercise.tips_vi} />
        </Disclosure>
      )}

      <div className="mt-3.5 flex items-center justify-between gap-2">
        {result ? (
          <button
            type="button"
            onClick={reset}
            className="hit-area ml-auto flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-xs font-semibold shadow-elev-1 active:scale-[0.97] "
          >
            <RotateCcw size={13} strokeWidth={2.4} /> Chép lại
          </button>
        ) : (
          <>
            <p className="text-[12px] font-semibold text-ink-2">
              Luyện tai thôi — không tính vào điểm thi thử.
            </p>
            <button
              type="button"
              onClick={check}
              disabled={!anyTyped}
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

/** A row of characters, the ones that did not match styled with `wrong` (never by colour alone:
 * the styles add an underline). */
function Marks({ marks, wrong }: { marks: Mark[]; wrong: string }) {
  return (
    <Ko>
      {marks.map((m, i) => (
        <span key={i} className={cn(!m.ok && wrong)}>
          {m.ch}
        </span>
      ))}
    </Ko>
  );
}
