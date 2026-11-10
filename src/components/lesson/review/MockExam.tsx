import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, Loader2, Play, RotateCcw, Target } from "lucide-react";

import type { McqExerciseOut, PracticeQuestion, ReviewOut } from "@/lib/api/types";
import { miss, success, tap } from "@/lib/feedback";
import { writeLocal } from "@/lib/lesson-local";
import {
  functionStats,
  mmss,
  mockKey,
  mockQuestions,
  patternStats,
  score,
  skillScores,
  summarize,
  type MockRecord,
} from "@/lib/review";
import { cn } from "@/lib/utils";
import { Disclosure } from "../Disclosure";
import { OptionButton, Question, StimulusView, type AnswerEvent } from "../McqExercise";
import { renderMarks } from "../render-marks";
import { Rich } from "../Rich";
import { PatternChip } from "./PatternChip";

type Phase = "intro" | "running" | "result";

/** Where each question sits in the whole set (1-based), so an exercise with two questions
 * keeps counting on. */
function numbering(exercises: McqExerciseOut[]) {
  const first = new Map<string, number>();
  let n = 0;
  for (const e of exercises) {
    first.set(e.id, n + 1);
    n += e.questions.length;
  }
  return first;
}

function ExamQuestion({
  question,
  number,
  picked,
  onPick,
}: {
  question: PracticeQuestion;
  number: number;
  picked: string | undefined;
  onPick: (optionId: string) => void;
}) {
  const visual = question.options.some((o) => o.scene || o.chart);
  return (
    <div className="space-y-2.5">
      {(question.prompt_en || question.prompt_vi) && (
        <div>
          {question.prompt_en && (
            <p lang="ko" className="font-korean text-[14.5px] font-semibold leading-6">
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
        aria-label={`Đáp án câu ${number}`}
        className={cn(visual ? "grid grid-cols-2 gap-2.5" : "space-y-2")}
      >
        {question.options.map((o, i) => (
          <OptionButton
            key={o.id}
            option={o}
            index={i}
            state={picked === o.id ? "chosen" : "idle"}
            locked={false}
            visual={visual}
            onPick={() => onPick(o.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ExamCard({
  lessonId,
  exercise,
  number,
  picked,
  onPick,
}: {
  lessonId: number;
  exercise: McqExerciseOut;
  number: number;
  picked: Record<string, string>;
  onPick: (questionId: string, optionId: string) => void;
}) {
  return (
    <article
      aria-label={`Câu ${number}`}
      className="rounded-[20px] border border-line bg-paper p-3.5 shadow-elev-1"
    >
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-blue-deep">
          Câu {number}
          {exercise.questions.length > 1 && `–${number + exercise.questions.length - 1}`}
        </p>
        {exercise.instruction_en && (
          <p lang="ko" className="font-korean mt-1 text-[13px] font-semibold leading-5">
            {exercise.instruction_en}
          </p>
        )}
      </header>
      {exercise.stimulus && (
        <div className="mt-3">
          <StimulusView
            stimulus={exercise.stimulus}
            exercise={exercise}
            lessonId={lessonId}
            once={false}
            answered={false}
            fill={null}
            exam
          />
        </div>
      )}
      <div className="mt-3.5 space-y-5">
        {exercise.questions.map((q, i) => (
          <ExamQuestion
            key={q.id}
            question={q}
            number={number + i}
            picked={picked[q.id]}
            onPick={(optionId) => onPick(q.id, optionId)}
          />
        ))}
      </div>
    </article>
  );
}

/** One answered question, marked, with its explanation and the grammar behind it. */
function ReviewedExercise({
  lessonId,
  exercise,
  number,
  picked,
}: {
  lessonId: number;
  exercise: McqExerciseOut;
  number: number;
  picked: Record<string, string>;
}) {
  const first = exercise.questions[0];
  const firstPicked = first ? (picked[first.id] ?? "") : "";
  const fill = first
    ? {
        text: first.options.find((o) => o.id === first.answer)?.text ?? "",
        ok: firstPicked === first.answer,
      }
    : null;
  return (
    <article
      aria-label={`Câu ${number} đã chấm`}
      className="rounded-[20px] border border-line bg-paper p-3.5 shadow-elev-1"
    >
      <p className="text-[12px] font-semibold uppercase tracking-wide text-blue-deep">
        Câu {number}
      </p>
      {exercise.instruction_en && (
        <p lang="ko" className="font-korean mt-1 text-[13px] font-semibold leading-5">
          {exercise.instruction_en}
        </p>
      )}
      {exercise.stimulus && (
        <div className="mt-3">
          <StimulusView
            stimulus={exercise.stimulus}
            exercise={exercise}
            lessonId={lessonId}
            once={false}
            answered
            fill={fill}
          />
        </div>
      )}
      <div className="mt-3.5 space-y-5">
        {exercise.questions.map((q) => (
          <Question
            key={q.id}
            question={q}
            // a question left blank is shown as missed, with the right option marked
            picked={picked[q.id] ?? ""}
            previous={undefined}
            showNumber={false}
            onPick={() => undefined}
          />
        ))}
      </div>
    </article>
  );
}

/** The exam clock: lives in the lesson's sticky header (through a portal) so it stays in view
 * while the learner scrolls, and on the other steps too. */
function ClockBar({
  remaining,
  answered,
  total,
  onSubmit,
}: {
  remaining: number;
  answered: number;
  total: number;
  onSubmit: () => void;
}) {
  const urgent = remaining <= 120;
  return (
    <div
      role="timer"
      aria-label="Đồng hồ thi thử"
      className={cn(
        "mt-2 flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-semibold",
        urgent ? "bg-danger-soft" : "bg-yellow-soft",
      )}
    >
      <Clock size={14} strokeWidth={2.6} aria-hidden="true" />
      <span className="tabular-nums">{mmss(remaining)}</span>
      <span className="text-ink-2">
        · đã chọn {answered}/{total}
      </span>
      <button
        type="button"
        onClick={onSubmit}
        className="hit-area ml-auto rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-paper active:scale-95"
      >
        Nộp bài
      </button>
    </div>
  );
}

function Hero({
  record,
  exercises,
  review,
}: {
  record: MockRecord;
  exercises: McqExerciseOut[];
  review: ReviewOut;
}) {
  const sum = summarize(exercises, record.picked, review.mock);
  const scale = review.mock.score;
  return (
    <div className="rounded-[20px] border border-transparent bg-blue-soft p-4 shadow-elev-1">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">
        Kết quả thi thử
      </p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums leading-none">
          {scale ? `≈ ${sum.figure}` : sum.figure}
        </span>
        <span className="text-lg font-semibold text-ink-2">{sum.unit}</span>
      </p>
      <p className="mt-2 text-sm font-semibold">{sum.label}</p>
      {sum.next ? (
        <p className="text-xs font-semibold leading-5 text-ink-2">
          Còn {sum.next.gap} {sum.gapUnit} nữa là chạm “{sum.next.label}”.
        </p>
      ) : (
        <p className="text-xs font-semibold leading-5 text-ink-2">
          Bạn đã đạt mức cao nhất của bộ này.
        </p>
      )}
      {sum.points && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              ["Nghe", sum.points.listening],
              ["Đọc", sum.points.reading],
            ] as const
          ).map(([name, pts]) => (
            <div
              key={name}
              className="rounded-[14px] border border-line bg-paper px-3 py-2 text-center"
            >
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">{name}</p>
              <p className="text-lg font-semibold tabular-nums leading-6">
                {pts}
                <span className="text-xs font-semibold text-ink-2"> / 100</span>
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs font-semibold text-ink-2">
        {sum.correct}/{sum.total} câu đúng
        {record.seconds > 0 &&
          ` · làm trong ${mmss(record.seconds)} / ${mmss(review.mock.minutes * 60)}`}
      </p>
      <p className="mt-2 text-[12px] font-medium leading-4 text-ink-2">
        {scale
          ? scale.note_vi
          : `Mức này chỉ là tỉ lệ câu đúng trên ${sum.total} câu, đặt cạnh tỉ lệ cần để đạt từng cấp ở kỳ thi thật (40/50/63/77%). Nó cho bạn biết mình đang ở đâu, không phải điểm TOPIK thật.`}
      </p>
    </div>
  );
}

function Result({
  lessonId,
  exercises,
  review,
  record,
  saving,
  onRetry,
  onReport,
}: {
  lessonId: number;
  exercises: McqExerciseOut[];
  review: ReviewOut;
  record: MockRecord;
  saving: boolean;
  onRetry: () => void;
  onReport: () => void;
}) {
  const numberOf = useMemo(() => numbering(exercises), [exercises]);
  const questions = mockQuestions(exercises);
  const wrong = exercises.filter((e) => e.questions.some((q) => record.picked[q.id] !== q.answer));
  const right = exercises.filter((e) => !wrong.includes(e));
  const stats = useMemo(() => patternStats(exercises, record.picked), [exercises, record.picked]);
  const weak = [...stats.values()]
    .filter((s) => s.right < s.total)
    .sort((a, b) => a.right / a.total - b.right / b.total || b.total - a.total)
    .slice(0, 6);
  const fnCount = functionStats(review.functions, stats).filter((f) => f.right < f.total).length;

  return (
    <div className="space-y-4">
      <Hero record={record} exercises={exercises} review={review} />
      {saving && (
        <p role="status" className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
          <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Đang lưu kết quả…
        </p>
      )}

      <div role="list" aria-label="Kết quả từng câu" className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => {
          const ok = record.picked[q.id] === q.answer;
          return (
            <span
              role="listitem"
              key={q.id}
              aria-label={`Câu ${i + 1}: ${ok ? "đúng" : "sai"}`}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border border-line text-xs font-semibold tabular-nums",
                ok ? "bg-green-soft" : "bg-danger-soft",
              )}
            >
              {i + 1}
            </span>
          );
        })}
      </div>

      {weak.length > 0 ? (
        <section
          aria-label="Mẫu cần ôn lại"
          className="rounded-[18px] border border-transparent bg-yellow-soft p-3.5"
        >
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Target size={15} strokeWidth={2.6} aria-hidden="true" /> Mẫu cần ôn lại
          </h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {weak.map((s) => (
              <li key={s.pattern} className="flex items-center gap-1">
                <PatternChip pattern={s.pattern} card={review.cards[s.pattern]} />
                <span className="text-[12px] font-semibold tabular-nums text-ink-2">
                  {s.right}/{s.total}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] font-semibold leading-4 text-ink-2">
            Chạm vào mẫu để mở thẻ trong bài đã học.
            {fnCount > 0 && ` ${fnCount} nhóm chức năng còn câu sai — xem ở Báo cáo.`}
          </p>
        </section>
      ) : (
        <p className="rounded-[14px] border border-transparent bg-green-soft px-3 py-2.5 text-sm font-semibold">
          Không sai câu nào — các mẫu của chủ đề đều vững.
        </p>
      )}

      {wrong.length > 0 && (
        <Disclosure title="Chữa đề theo 3 bước">
          <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-5">
            <li>
              <b>Không biết từ</b> → học lại từ và cụm từ đó (thêm vào hàng ôn tập).
            </li>
            <li>
              <b>Biết từ nhưng không nghe ra</b> → nghe lại câu đó vài lần, rồi mới xem lời thoại.
            </li>
            <li>
              <b>Nghe được nhưng vẫn chọn sai</b> → đọc lại câu hỏi và tìm xem mình bị đánh lừa ở
              đâu (thường là một từ nhỏ như 아직, 이미, 별로, 전혀).
            </li>
          </ol>
          <p className="mt-2 text-[12px] font-medium leading-4 text-ink-2">
            Xong cả ba, nghe lại một lượt không nhìn lời thoại: nếu theo kịp thì câu đó đã vào tai.
          </p>
        </Disclosure>
      )}

      {wrong.length > 0 && (
        <section aria-label="Các câu sai" className="space-y-3">
          <h3 className="text-sm font-semibold">Xem lại {wrong.length} câu sai</h3>
          {wrong.map((e) => (
            <ReviewedExercise
              key={e.id}
              lessonId={lessonId}
              exercise={e}
              number={numberOf.get(e.id) ?? 0}
              picked={record.picked}
            />
          ))}
        </section>
      )}

      {right.length > 0 && (
        <Disclosure title={`Các câu đã đúng (${right.length})`}>
          <div className="space-y-3">
            {right.map((e) => (
              <ReviewedExercise
                key={e.id}
                lessonId={lessonId}
                exercise={e}
                number={numberOf.get(e.id) ?? 0}
                picked={record.picked}
              />
            ))}
          </div>
        </Disclosure>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="hit-area flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm font-semibold shadow-elev-1 active:scale-[0.97] "
        >
          <RotateCcw size={15} strokeWidth={2.6} aria-hidden="true" /> Thi lại
        </button>
        <button
          type="button"
          onClick={onReport}
          className="hit-area flex min-h-11 items-center justify-center rounded-full border border-transparent bg-blue px-3 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] "
        >
          Xem báo cáo
        </button>
      </div>
    </div>
  );
}

/** Step 2 of the topic review: a timed mixed set with no hints. Answers stay private until
 * the paper is handed in (or the time runs out); then every question is marked, the result is
 * read against the exam's pass ratios, and the answers are saved so a missed pattern goes back
 * to the review queue. */
export function MockExam({
  lessonId,
  exercises,
  review,
  record,
  clockSlot,
  onFinish,
  onRunning,
  saveAll,
  onReport,
}: {
  lessonId: number;
  exercises: McqExerciseOut[];
  review: ReviewOut;
  record: MockRecord | null;
  clockSlot: HTMLElement | null;
  onFinish: (r: MockRecord) => void;
  onRunning: (running: boolean) => void;
  saveAll: (a: AnswerEvent[]) => Promise<void>;
  onReport: () => void;
}) {
  const questions = useMemo(() => mockQuestions(exercises), [exercises]);
  const numberOf = useMemo(() => numbering(exercises), [exercises]);
  const counts = useMemo(() => skillScores(exercises, {}), [exercises]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const limit = review.mock.minutes * 60;
  const elapsed = phase === "running" ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const remaining = Math.max(0, limit - elapsed);
  const answered = questions.filter((q) => picked[q.id] !== undefined).length;

  const submit = useCallback(() => {
    if (phase !== "running") return;
    const seconds = Math.min(limit, Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
    const result: MockRecord = { picked, seconds, at: new Date().toISOString() };
    writeLocal(mockKey(lessonId), result);
    onFinish(result);
    setConfirming(false);
    setPhase("result");
    onRunning(false);
    const events: AnswerEvent[] = exercises.flatMap((e) =>
      e.questions.flatMap((q) =>
        picked[q.id] === undefined
          ? []
          : [
              {
                exerciseId: e.id,
                questionId: q.id,
                correct: picked[q.id] === q.answer,
                answer: picked[q.id]!,
              },
            ],
      ),
    );
    if (score(exercises, picked) * 2 >= questions.length) success();
    else miss();
    setSaving(true);
    void saveAll(events).finally(() => setSaving(false));
    topRef.current?.scrollIntoView({ block: "start" });
  }, [
    phase,
    limit,
    startedAt,
    picked,
    lessonId,
    onFinish,
    onRunning,
    exercises,
    questions.length,
    saveAll,
  ]);

  // the clock runs from the wall clock, so a throttled background tab still hands in on time
  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [phase]);
  useEffect(() => {
    if (phase === "running" && remaining === 0 && now > 0) submit();
  }, [phase, remaining, now, submit]);

  const start = () => {
    tap();
    const t = Date.now();
    setPicked({});
    setStartedAt(t);
    setNow(t);
    setConfirming(false);
    setPhase("running");
    onRunning(true);
    topRef.current?.scrollIntoView({ block: "start" });
  };

  // handing in with blanks asks once; the second tap hands in
  const requestSubmit = () => {
    if (answered === questions.length || confirming) {
      submit();
      return;
    }
    setConfirming(true);
    bottomRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const showing: MockRecord | null = phase === "result" ? record : null;
  const lastSummary = record ? summarize(exercises, record.picked, review.mock) : null;

  return (
    <section aria-label="Thi thử" className="space-y-4">
      <div ref={topRef} className="scroll-mt-24" />

      {phase === "intro" && (
        <>
          <div>
            <h2 className="text-lg font-semibold">Thi thử</h2>
            <p className="mt-0.5 text-xs font-medium leading-5 text-ink-2">
              {counts.listening.total} câu nghe + {counts.reading.total} câu đọc, trộn các mẫu của
              cả chủ đề: nghe trước, rồi đọc.
            </p>
          </div>
          <ul className="space-y-2 rounded-[18px] border border-line bg-card p-3.5 text-xs leading-5">
            {[
              <>
                <b>{review.mock.minutes} phút</b>, hết giờ tự nộp bài.
              </>,
              <>Không có gợi ý và không báo đúng/sai trong lúc làm — chỉ chọn, đổi tùy ý.</>,
              <>Nghe được nhiều lần; lời thoại viết ra chỉ hiện sau khi nộp.</>,
              review.mock.score ? (
                <>
                  Nộp xong mới chấm: điểm ước lượng trên 200 (nghe 100 + đọc 100), mức gần với 1급
                  hay 2급 và báo cáo theo từng mẫu. Câu sai được đưa vào hàng ôn tập của thẻ ngữ
                  pháp tương ứng.
                </>
              ) : (
                <>
                  Nộp xong mới chấm: điểm, mức so với ngưỡng 3·4·5·6급 và báo cáo theo từng mẫu. Câu
                  sai được đưa vào hàng ôn tập của thẻ ngữ pháp tương ứng.
                </>
              ),
            ].map((line, i) => (
              <li key={i} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue"
                />
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>
          {counts.listening.total > 0 && (
            <Disclosure title="Mẹo làm bài nghe">
              <ul className="space-y-1.5 text-xs leading-5">
                <li>
                  Chọn xong câu này là đọc ngay 4 đáp án của câu sau. Đừng dịch từng chữ, chỉ xem
                  chúng khác nhau ở đâu: thời gian, nơi chốn, người làm, hành động hay phủ định.
                </li>
                <li>
                  Nghe để bắt từ khóa, không phải từng chữ. Chú ý những từ nhỏ có thể đổi hẳn đáp
                  án: 이미 · 아직 · 다시 · 전혀 · 거의 · 반드시 · 별로.
                </li>
                <li>
                  Lỡ một câu thì chọn nhanh một đáp án rồi bỏ: sai một câu đỡ hơn mất thêm 2–3 câu
                  phía sau.
                </li>
                <li>
                  Với câu nghe hai lần, lần một để lấy thông tin, lần hai để kiểm lại chỗ chưa chắc;
                  nếu đã chắc rồi thì tranh thủ đọc câu kế.
                </li>
              </ul>
            </Disclosure>
          )}
          {record && (
            <div className="rounded-[18px] border border-transparent bg-blue-soft p-3.5">
              <p className="text-xs font-semibold">
                Lần gần nhất:{" "}
                {lastSummary?.points
                  ? `≈ ${lastSummary.figure}/200`
                  : `${lastSummary?.correct}/${questions.length}`}{" "}
                · {lastSummary?.label}
              </p>
              <button
                type="button"
                onClick={() => {
                  tap();
                  setPhase("result");
                }}
                className="hit-area mt-1 text-xs font-semibold text-blue-deep underline"
              >
                Xem lại kết quả và các câu sai
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={start}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-2 active:scale-[0.97] "
          >
            <Play size={16} strokeWidth={2.8} aria-hidden="true" />
            {record ? "Thi lại từ đầu" : "Bắt đầu thi"}
          </button>
        </>
      )}

      {phase === "running" && (
        <>
          {clockSlot &&
            createPortal(
              <ClockBar
                remaining={remaining}
                answered={answered}
                total={questions.length}
                onSubmit={requestSubmit}
              />,
              clockSlot,
            )}
          <div className="space-y-4">
            {exercises.map((e) => (
              <ExamCard
                key={e.id}
                lessonId={lessonId}
                exercise={e}
                number={numberOf.get(e.id) ?? 0}
                picked={picked}
                onPick={(qid, oid) => {
                  setPicked((p) => ({ ...p, [qid]: oid }));
                  setConfirming(false);
                }}
              />
            ))}
          </div>
          <div ref={bottomRef} className="space-y-2">
            {confirming && (
              <p
                role="alert"
                className="rounded-[14px] border border-transparent bg-yellow-soft px-3 py-2.5 text-xs font-semibold leading-5"
              >
                Còn {questions.length - answered} câu chưa chọn (tính là sai). Nộp luôn?
              </p>
            )}
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={requestSubmit}
                className="flex min-h-12 w-full items-center justify-center rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-2 active:scale-[0.97] "
              >
                {confirming ? "Nộp luôn" : `Nộp bài (${answered}/${questions.length} câu)`}
              </button>
              {confirming && (
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="hit-area min-h-10 text-xs font-semibold text-blue-deep underline"
                >
                  Làm tiếp
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {phase === "result" && showing && (
        <Result
          lessonId={lessonId}
          exercises={exercises}
          review={review}
          record={showing}
          saving={saving}
          onRetry={() => setPhase("intro")}
          onReport={onReport}
        />
      )}
    </section>
  );
}
