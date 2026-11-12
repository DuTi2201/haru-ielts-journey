import { ReadingPassage, isEnglishPassage } from "./ReadingPassage";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, RotateCcw, X } from "lucide-react";

import type {
  ExerciseResultOut,
  McqExerciseOut,
  PracticeOption,
  PracticeQuestion,
  PracticeStimulus,
} from "@/lib/api/types";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ChartView, DataBlockView } from "./DataBlock";
import { ExerciseAudio } from "./ExerciseAudio";
import { GrammarLinkBox } from "./GrammarLinkBox";
import { renderMarks } from "./render-marks";
import { Ko, Rich } from "./Rich";
import { ExerciseHead, firstSentence, splitProgress } from "./ExerciseHead";
import { SceneView } from "./SceneView";

const CIRCLED = ["①", "②", "③", "④", "⑤"];

export interface AnswerEvent {
  exerciseId: string;
  questionId: string;
  correct: boolean;
  answer: string;
}

function Gap({ fill }: { fill: { text: string; ok: boolean } | null }) {
  return (
    <span
      aria-label={fill ? `Chỗ trống: ${fill.text}` : "Chỗ trống"}
      className={cn(
        "mx-1 inline-block min-w-[3.6em] border-b-2 px-1.5 text-center font-semibold",
        fill ? (fill.ok ? "border-green text-green" : "border-danger text-danger") : "border-line",
      )}
    >
      {fill ? fill.text : " "}
    </span>
  );
}

export function StimulusView({
  stimulus,
  exercise,
  lessonId,
  once,
  answered,
  fill,
  exam = false,
}: {
  stimulus: PracticeStimulus;
  exercise: McqExerciseOut;
  lessonId: number;
  once: boolean;
  answered: boolean;
  fill: { text: string; ok: boolean } | null;
  /** Mock exam in progress: nothing on the page may give the answer away. */
  exam?: boolean;
}) {
  switch (stimulus.kind) {
    case "audio": {
      // hear one line and pick how it is written: the script would be the answer
      const line = stimulus.turns.length === 1 ? stimulus.turns[0]!.text : null;
      const spelt =
        !!line &&
        exercise.questions.some((q) => q.options.some((o) => o.text && line.includes(o.text)));
      return (
        <ExerciseAudio
          lessonId={lessonId}
          exerciseId={exercise.id}
          turns={stimulus.turns}
          once={once}
          answered={answered}
          hideScript={exam}
          scriptAfterAnswer={spelt}
          {...(line ? { label: "Nghe" } : {})}
        />
      );
    }
    case "cloze": {
      const parts = stimulus.text.split("( )");
      return (
        <p className="font-korean whitespace-pre-line rounded-[16px] border border-line bg-card p-3.5 text-[15px] leading-8">
          {parts.map((p, i) => (
            <Fragment key={i}>
              {p}
              {i < parts.length - 1 && <Gap fill={fill} />}
            </Fragment>
          ))}
        </p>
      );
    }
    case "underline":
      return (
        <p className="font-korean rounded-[16px] border border-line bg-card p-3.5 text-[15px] leading-8">
          {renderMarks(stimulus.text)}
        </p>
      );
    case "notice":
      return (
        <div className="rounded-[16px] border border-transparent bg-yellow-soft p-3.5">
          {stimulus.title && (
            <p lang="ko" className="font-korean text-sm font-semibold">
              {stimulus.title}
            </p>
          )}
          <div className={cn("space-y-0.5", stimulus.title && "mt-1.5")}>
            {stimulus.lines.map((line, i) => (
              <p key={i} lang="ko" className="font-korean text-[15px] leading-6">
                {line}
              </p>
            ))}
          </div>
        </div>
      );
    case "chart":
      return <DataBlockView block={stimulus.block} />;
    case "order":
      return (
        <ul className="space-y-1.5 rounded-[16px] border border-line bg-card p-3.5">
          {stimulus.items.map((it) => (
            <li key={it.id} className="flex gap-2">
              <span lang="ko" className="font-korean shrink-0 font-semibold text-blue-deep">
                ({it.id})
              </span>
              <span lang="ko" className="font-korean text-[15px] leading-6">
                {it.text}
              </span>
            </li>
          ))}
        </ul>
      );
    case "headline":
      return <Headline text={stimulus.text} hint={stimulus.hint_vi ?? null} />;
    case "passage":
      if (isEnglishPassage(stimulus.text)) return <ReadingPassage text={stimulus.text} />;
      return (
        <div className="space-y-2 rounded-[16px] border border-line bg-card p-3.5">
          {stimulus.text.split("\n").map((para, i) => (
            <p key={i} lang="ko" className="font-korean text-[14.5px] leading-7">
              {renderMarks(para)}
            </p>
          ))}
        </div>
      );
    case "insert":
      return (
        <div className="space-y-2.5">
          <div className="rounded-[14px] border border-dashed border-transparent bg-purple-soft p-3">
            <p className="text-[12px] font-semibold text-ink-2">{"<보기>"}</p>
            <p lang="ko" className="font-korean mt-1 text-[15px] leading-6">
              {stimulus.given}
            </p>
          </div>
          <div className="space-y-2 rounded-[16px] border border-line bg-card p-3.5">
            {stimulus.text.split("\n").map((para, i) => (
              <p key={i} lang="ko" className="font-korean text-[14.5px] leading-7">
                {para}
              </p>
            ))}
          </div>
        </div>
      );
  }
}

function Headline({ text, hint }: { text: string; hint: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[16px] border border-line bg-card p-3.5">
      <p lang="ko" className="font-korean-serif text-[17px] font-semibold leading-7">
        {text}
      </p>
      {hint && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-2 text-[12px] font-semibold text-blue-deep underline"
          >
            {open ? "Ẩn gợi ý từ" : "Gợi ý từ khó"}
          </button>
          {open && (
            <p className="mt-1.5 rounded-[10px] bg-yellow-soft px-2.5 py-1.5 text-[12px] font-semibold leading-5">
              <Rich text={hint} />
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** "chosen" = picked but not yet marked (the mock exam keeps its answers to itself). */
export type OptionState = "idle" | "chosen" | "correct" | "wrong" | "missed" | "dim";

function OptionBody({ option, compactVisual }: { option: PracticeOption; compactVisual: boolean }) {
  if (option.scene) return <SceneView scene={option.scene} compact={compactVisual} />;
  if (option.chart) return <ChartView chart={option.chart} small />;
  return (
    <span lang="ko" className="font-korean text-[14.5px] leading-6">
      {option.text}
    </span>
  );
}

export function OptionButton({
  option,
  index,
  state,
  locked,
  visual,
  onPick,
}: {
  option: PracticeOption;
  index: number;
  state: OptionState;
  locked: boolean;
  visual: boolean;
  onPick: () => void;
}) {
  const mark =
    state === "correct" || state === "missed" ? "đúng" : state === "wrong" ? "sai" : null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={state === "correct" || state === "wrong" || state === "chosen"}
      aria-disabled={locked}
      onClick={() => {
        if (!locked) onPick();
      }}
      className={cn(
        "relative flex w-full items-start gap-2.5 rounded-[14px] border border-line p-3 text-left transition-transform duration-150 motion-reduce:transition-none",
        !locked && "bg-card active:scale-[0.98]",
        state === "chosen" && "bg-blue-soft",
        state === "correct" && "bg-green-soft",
        state === "missed" && "border-dashed bg-green-soft",
        state === "wrong" && "bg-danger-soft",
        state === "dim" && "bg-card opacity-60",
        state === "idle" && locked && "bg-card",
        visual && "flex-col gap-1.5",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold",
          state === "correct" || state === "missed"
            ? "bg-green text-primary-foreground"
            : state === "wrong"
              ? "bg-danger text-primary-foreground"
              : state === "chosen"
                ? "bg-blue text-primary-foreground"
                : "text-ink-2",
        )}
      >
        {state === "correct" || state === "missed" ? (
          <Check size={14} strokeWidth={3} />
        ) : state === "wrong" ? (
          <X size={14} strokeWidth={3} />
        ) : (
          (CIRCLED[index] ?? option.id)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <OptionBody option={option} compactVisual={visual} />
      </span>
      {mark && <span className="sr-only">({mark})</span>}
    </button>
  );
}

export function Question({
  question,
  picked,
  previous,
  showNumber,
  onPick,
}: {
  question: PracticeQuestion;
  picked: string | undefined;
  previous: ExerciseResultOut | undefined;
  showNumber: boolean;
  onPick: (optionId: string) => void;
}) {
  const answered = picked !== undefined;
  // the explanation opens under the tab bar on a phone: bring it up above it
  const note = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (answered)
      note.current?.scrollIntoView({
        block: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
  }, [answered]);
  const right = picked === question.answer;
  const visual = question.options.some((o) => o.scene || o.chart);
  const answerIndex = question.options.findIndex((o) => o.id === question.answer);

  return (
    <div className="space-y-2.5">
      {(question.prompt_en || question.prompt_vi) && (
        <div>
          {question.prompt_en && (
            <p lang="ko" className="font-korean text-[14.5px] font-semibold leading-6">
              {showNumber && <span className="mr-1.5 text-blue-deep">{question.id}.</span>}
              {renderMarks(question.prompt_en)}
            </p>
          )}
          {question.prompt_vi && (
            <p className="mt-0.5 text-xs font-semibold leading-5 text-ink-2">
              <Rich text={question.prompt_vi} />
            </p>
          )}
        </div>
      )}

      <div
        role="radiogroup"
        aria-label={`Đáp án câu ${question.id}`}
        className={cn(visual ? "grid grid-cols-2 gap-2.5" : "space-y-2")}
      >
        {question.options.map((o, i) => {
          let state: OptionState = "idle";
          if (answered) {
            if (o.id === question.answer) state = right ? "correct" : "missed";
            else if (o.id === picked) state = "wrong";
            else state = "dim";
          }
          return (
            <OptionButton
              key={o.id}
              option={o}
              index={i}
              state={state}
              locked={answered}
              visual={visual}
              onPick={() => onPick(o.id)}
            />
          );
        })}
      </div>

      {!answered && previous && (
        <p className="text-[12px] font-semibold text-ink-2">
          Lần trước: {previous.correct ? "đúng" : "sai"} · đã làm {previous.attempts} lần
        </p>
      )}

      {answered && (
        <div
          ref={note}
          role="status"
          className={cn(
            "animate-in scroll-mb-[calc(var(--tabbar-h)+1.5rem)] rounded-[16px] border border-line p-3 duration-200 fade-in motion-reduce:animate-none",
            right ? "bg-green-soft" : "bg-yellow-soft",
          )}
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            {right ? (
              <>
                <Check size={16} strokeWidth={3} /> Chính xác!
              </>
            ) : (
              <>
                <X size={16} strokeWidth={3} /> Chưa đúng — đáp án là{" "}
                {CIRCLED[answerIndex] ?? question.answer}
              </>
            )}
          </p>
          <Rich
            as="p"
            text={question.explanation_vi}
            className="mt-1.5 text-xs leading-5 text-ink-2"
          />
          <GrammarLinkBox patterns={question.grammar} correct={right} />
          {question.tags && question.tags.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-ink-2">
              Kiến thức:
              {question.tags.map((t) => (
                <Ko key={t} className="rounded-full bg-card px-2 py-0.5 font-semibold text-ink">
                  {t}
                </Ko>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** One listening or reading exercise: its stimulus (recording, text, picture, chart…)
 * and one or more multiple-choice questions, marked the moment an option is tapped.
 * The browser grades — answers ship with the lesson — and reports each answer up so
 * it can be saved. */
export function McqExercise({
  lessonId,
  exercise,
  once,
  previous,
  onAnswer,
}: {
  lessonId: number;
  exercise: McqExerciseOut;
  once: boolean;
  previous: Record<string, ExerciseResultOut>;
  onAnswer: (a: AnswerEvent) => void;
}) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [round, setRound] = useState(0);

  const answeredAny = Object.keys(picked).length > 0;
  const allAnswered = exercise.questions.every((q) => picked[q.id] !== undefined);
  const first = exercise.questions[0];
  const firstPicked = first ? picked[first.id] : undefined;
  const fill =
    first && firstPicked !== undefined
      ? {
          text: first.options.find((o) => o.id === first.answer)?.text ?? "",
          ok: firstPicked === first.answer,
        }
      : null;

  const correctCount = exercise.questions.filter((q) => picked[q.id] === q.answer).length;

  return (
    <article
      key={round}
      aria-label={exercise.title_vi}
      className="rounded-[20px] border border-line bg-paper p-3.5 shadow-elev-1"
    >
      <ExerciseHead
        chip="Chọn đáp án"
        n={splitProgress(exercise.title_vi).n}
        total={splitProgress(exercise.title_vi).total}
        task={firstSentence(exercise.instruction_vi || splitProgress(exercise.title_vi).name).head}
        detail={firstSentence(exercise.instruction_vi).rest || null}
      />

      {exercise.stimulus && (
        <div className="mt-3">
          <StimulusView
            stimulus={exercise.stimulus}
            exercise={exercise}
            lessonId={lessonId}
            once={once}
            answered={answeredAny}
            fill={fill}
          />
        </div>
      )}

      <div className="mt-3.5 space-y-5">
        {exercise.questions.map((q) => (
          <Question
            key={q.id}
            question={q}
            picked={picked[q.id]}
            previous={previous[q.id]}
            showNumber={exercise.questions.length > 1}
            onPick={(optionId) => {
              setPicked((p) => ({ ...p, [q.id]: optionId }));
              onAnswer({
                exerciseId: exercise.id,
                questionId: q.id,
                correct: optionId === q.answer,
                answer: optionId,
              });
            }}
          />
        ))}
      </div>

      {allAnswered && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink-2">
            Đúng {correctCount}/{exercise.questions.length} câu
          </p>
          <button
            type="button"
            onClick={() => {
              setPicked({});
              setRound((r) => r + 1);
            }}
            className="hit-area flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-xs font-semibold shadow-elev-1 active:scale-[0.97] "
          >
            <RotateCcw size={13} strokeWidth={2.4} /> Làm lại
          </button>
        </div>
      )}
    </article>
  );
}
