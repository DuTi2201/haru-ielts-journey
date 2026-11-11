/** A lesson as ~15-minute sittings ("Theo buổi"): one sitting on screen, its few steps in order
 * (words → patterns → quick check, or a practice set), one "next" button, and a pause between
 * sittings. The plan comes from lib/lesson-sessions.ts; the cards and questions are the lesson's
 * own components, so nothing is learnt or saved differently from the full lesson view. */
import { NotebookCard } from "./NotebookCard";
import { pageForSitting } from "@/lib/notebook-page";
import { CHATS_KEY, listChats } from "@/lib/api/chats";
import type { StageProfile } from "@/lib/lesson-stage";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Feather,
  Headphones,
  Layers,
  ListChecks,
  MessageCircleQuestion,
  MessagesSquare,
  Mic,
  NotebookPen,
  PenLine,
  Rows3,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { lecturePictures, SlideLecture } from "@/components/lesson/lecture/SlideLecture";
import { Mascot } from "@/components/mascot/Mascot";
import { Disclosure } from "@/components/lesson/Disclosure";
import { GrammarCards } from "@/components/lesson/GrammarCards";
import { LessonNotes } from "@/components/lesson/LessonNotes";
import { PracticeSubset } from "@/components/lesson/PracticePanel";
import { SayStep } from "@/components/lesson/session/SayStep";
import { SituationStep } from "@/components/lesson/session/SituationStep";
import { VocabFlashcards } from "@/components/lesson/VocabFlashcards";
import { useAuth } from "@/hooks/use-auth";
import { getLessonPractice } from "@/lib/api/content";
import type { LessonOut, LessonProgressOut } from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import {
  currentSitting,
  planSittings,
  sittingDone,
  stepDone,
  type Sitting,
  type SittingPlan,
  type SittingStep,
  type StudyMarks,
} from "@/lib/lesson-sessions";
import { prefersReducedMotion } from "@/lib/motion";
import { flushTelemetry, track } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

const STEP_ICON: Record<SittingStep["kind"], typeof Rows3> = {
  vocab: Rows3,
  grammar: NotebookPen,
  check: ListChecks,
  practice: ListChecks,
  say: Mic,
  situation: MessageCircleQuestion,
};

const STEP_HINT: Record<SittingStep["kind"], string> = {
  vocab: "Nghe, đọc to, rồi lật thẻ. Chưa nhớ cũng không sao: Haru sẽ nhắc lại.",
  grammar: "Đọc mẫu và ví dụ, tự nói một câu của bạn, rồi đánh dấu.",
  check: "Vài câu ngay trên những gì vừa học. Nhớ lại lúc này là lúc nhớ lâu nhất.",
  practice: "Làm lần lượt. Câu sai tự vào Sổ lỗi sai, kèm giải thích.",
  say: "Nói to đúng những câu vừa học. Nói ra miệng giúp nhớ lâu hơn chỉ đọc bằng mắt.",
  situation:
    "Một đoạn hội thoại ngắn dùng chính những gì vừa học: xếp lượt, chọn lời đáp, so hai cách nói.",
};

export function SittingPlayer({
  lesson,
  marks,
  progress,
  vocabStudied,
  grammarVerdicts,
  placement,
  onVocabReviewed,
  onGrammarReviewed,
  onOpenWhole,
  onListened,
  profile,
  feathers,
}: {
  lesson: LessonOut;
  marks: StudyMarks;
  progress: LessonProgressOut | undefined;
  vocabStudied: ReadonlyMap<number, boolean>;
  grammarVerdicts: Readonly<Record<number, boolean>>;
  placement?: { known: ReadonlySet<number>; solid: ReadonlySet<number> } | undefined;
  onVocabReviewed: (id: number, correct: boolean) => void;
  onGrammarReviewed: (id: number, correct: boolean) => void;
  /** Leaves for the full lesson (all words, all patterns, all questions on one page). */
  onOpenWhole: () => void;
  onListened: () => void;
  /** how far along the learner is (lib/lesson-stage): what comes first, what is offered after */
  profile: StageProfile;
  /** the lesson's feathers (the swan's journey): earned of all */
  feathers: { earned: number; total: number };
}) {
  const auth = useAuth();
  const practice = useQuery({
    queryKey: ["lesson-practice", lesson.id],
    queryFn: () => getLessonPractice(lesson.id),
    staleTime: 10 * 60_000,
  });
  const sittings = useMemo(
    () =>
      planSittings(lesson.vocab, lesson.grammar, practice.data?.items ?? [], lesson.sessions ?? []),
    [lesson.vocab, lesson.grammar, lesson.sessions, practice.data?.items],
  );

  // which sitting: the one the learner picked here, else the first one not finished (from the
  // server's record, so it is the same on another phone)
  const [picked, setPicked] = useState<number | null>(null);
  const index = Math.min(picked ?? currentSitting(sittings, marks), sittings.length - 1);
  const sitting = sittings[index];
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  // the practice steps with no mark on the server (say aloud, a dialogue): ticked once opened
  const [visitedSteps, setVisitedSteps] = useState<ReadonlySet<string>>(new Set());
  const firstOpenStep = sitting ? sitting.steps.findIndex((st) => !stepDone(st, marks)) : 0;
  const si = stepIndex ?? (firstOpenStep === -1 ? 0 : firstOpenStep);
  const step = sitting?.steps[si];
  const stepKey = `${sitting?.n ?? 0}:${si}`;
  const stepKind = step?.kind;
  useEffect(() => {
    if (stepKind === "say" || stepKind === "situation")
      setVisitedSteps((o) => (o.has(stepKey) ? o : new Set(o).add(stepKey)));
  }, [stepKey, stepKind]);
  const [finished, setFinished] = useState<Sitting | null>(null);

  // -- telemetry: a sitting opened, finished, or left part-way
  const opened = useRef<{ n: number; at: number; stepAt: number; step: string } | null>(null);
  useEffect(() => {
    if (!sitting || !auth.isAuthenticated) return;
    const now = Date.now();
    opened.current = { n: sitting.n, at: now, stepAt: now, step: sitting.steps[0]?.kind ?? "" };
    track({
      type: "session_start",
      payload: { lesson_id: lesson.id, session: sitting.n, of: sittings.length, mode: "sittings" },
    });
    const leave = () => {
      const o = opened.current;
      if (!o) return;
      track({
        type: "step_abandon",
        value: Math.round((Date.now() - o.stepAt) / 1000),
        payload: { lesson_id: lesson.id, session: o.n, step: o.step },
      });
      opened.current = null;
      flushTelemetry();
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
    // a new sitting is a new start; the list growing as practice loads is not
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitting?.n, lesson.id, auth.isAuthenticated]);
  useEffect(() => {
    if (opened.current && step) {
      opened.current.step = step.kind;
      opened.current.stepAt = Date.now();
    }
  }, [step]);

  const top = useCallback(() => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, []);

  const openSitting = useCallback(
    (i: number) => {
      tap();
      setPicked(i);
      setStepIndex(null);
      setFinished(null);
      top();
    },
    [top],
  );

  const finish = useCallback(() => {
    if (!sitting) return;
    tap();
    const o = opened.current;
    if (o) {
      track({
        type: "session_complete",
        value: Math.round(((Date.now() - o.at) / 60000) * 10) / 10,
        payload: { lesson_id: lesson.id, session: sitting.n, of: sittings.length },
      });
      opened.current = null;
    }
    setFinished(sitting);
    top();
  }, [sitting, sittings.length, lesson.id, top]);

  if (practice.isLoading || !sitting || !step) {
    return (
      <div className="mt-4 space-y-3" aria-busy="true" aria-label="Đang chia bài thành các buổi">
        <div className="h-20 animate-pulse rounded-[20px] bg-progress" />
        <div className="h-64 animate-pulse rounded-[20px] bg-progress" />
      </div>
    );
  }

  if (finished) {
    const next = sittings[finished.n];
    const checkIds = finished.steps.flatMap((st) => ("questionIds" in st ? st.questionIds : []));
    const answered = (progress?.results ?? []).filter((r) => checkIds.includes(r.question_id));
    const right = answered.filter((r) => r.correct).length;
    const notePage =
      profile.stage === "foundation"
        ? pageForSitting(finished, lesson.vocab, lesson.grammar)
        : null;
    return (
      <section aria-label={`Xong buổi ${finished.n}`} className="mt-4 pb-28 text-center">
        <Mascot mood="celebrate" className="mx-auto h-24 w-24" />
        <h2 className="mt-2 text-xl font-bold">Xong buổi {finished.n}!</h2>
        <p className="mt-1 text-[13px] font-medium leading-5 text-ink-2">
          {answered.length > 0 ? `Đúng ${right}/${answered.length} câu. ` : ""}
          Phần vừa học sẽ quay lại trong Ôn tập.
        </p>
        {finished.plan && <CanDoCard plan={finished.plan} done />}
        <div className="mt-5 space-y-2">
          {next ? (
            <button
              type="button"
              onClick={() => openSitting(next.n - 1)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-blue px-4 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
            >
              Học buổi {next.n} · ~{next.minutes} phút <ArrowRight size={16} strokeWidth={2.6} />
            </button>
          ) : (
            <p className="rounded-[14px] bg-green-soft px-3 py-2.5 text-[13px] font-semibold">
              Bạn đã đi hết các buổi của bài này.
            </p>
          )}
          <Link
            to="/today"
            onClick={() => tap()}
            className="flex min-h-11 w-full items-center justify-center rounded-[16px] border border-line bg-card px-4 text-[13px] font-semibold shadow-elev-1 active:scale-[0.97]"
          >
            Nghỉ ở đây, về Hôm nay
          </Link>
        </div>
        {notePage && <NotebookCard page={notePage} pageId={`${lesson.id}:${finished.n}`} />}
        {feathers.total > 0 && (
          <Link
            to="/progress"
            onClick={() => tap()}
            className="hit-area mt-4 inline-flex min-h-11 items-center justify-center gap-1.5 text-[13px] font-semibold"
          >
            <Feather size={16} className="text-blue" aria-hidden="true" /> Lông của bài:{" "}
            {feathers.earned}/{feathers.total}
            <span className="font-medium text-ink-2 underline underline-offset-2">
              · xem Hành trình thiên nga
            </span>
          </Link>
        )}
        <PracticeAfter lesson={lesson} profile={profile} />
      </section>
    );
  }

  const isLast = si === sitting.steps.length - 1;
  // A hand-planned sitting has its own lecture (its words and cards only); an evenly cut lesson
  // keeps the whole lesson's lecture on its first sitting.
  const scopedLecture =
    !!sitting.plan && sitting.steps.some((st) => st.kind === "vocab" || st.kind === "grammar");
  const items = (ids: number[]) => {
    const set = new Set(ids);
    return { set, vocab: lesson.vocab.filter((v) => set.has(v.id)) };
  };

  return (
    <div className="mt-4">
      {profile.product && (
        <ProductCard
          product={profile.product}
          target={sittings.findIndex((s) =>
            s.steps.some((st) => st.kind === "practice" && st.skill === profile.product!.skill),
          )}
          onGo={openSitting}
        />
      )}
      <SittingMap sittings={sittings} index={index} marks={marks} onPick={openSitting} />

      <section className="mt-3 rounded-[20px] border border-line bg-card p-4 shadow-elev-1">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-bold">
            Buổi {sitting.n}
            <span className="font-semibold text-ink-2">/{sittings.length}</span>
            {sitting.plan && (
              <span className="block text-[14px] font-semibold leading-5 text-ink">
                {sitting.title}
              </span>
            )}
          </h2>
          <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-ink-2">
            <Clock size={13} strokeWidth={2.4} aria-hidden="true" /> ~{sitting.minutes} phút
          </span>
        </div>
        <ol className="mt-3 flex gap-1.5" aria-label="Các bước của buổi này">
          {sitting.steps.map((st, i) => {
            const done =
              st.kind === "say" || st.kind === "situation"
                ? visitedSteps.has(`${sitting.n}:${i}`)
                : stepDone(st, marks);
            const Icon = STEP_ICON[st.kind];
            const active = i === si;
            return (
              <li key={`${st.kind}-${i}`} className="min-w-0 flex-1">
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => {
                    tap();
                    setStepIndex(i);
                  }}
                  className={cn(
                    "flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-[12px] px-1 text-[11px] font-semibold leading-tight",
                    active
                      ? "bg-blue text-primary-foreground"
                      : done
                        ? "bg-green-soft text-ink"
                        : "bg-fill text-ink-2",
                  )}
                >
                  {done && !active ? (
                    <Check size={14} strokeWidth={2.8} aria-hidden="true" />
                  ) : (
                    <Icon size={14} strokeWidth={2.4} aria-hidden="true" />
                  )}
                  <span className="max-w-full truncate">{st.label.replace(/ · .*$/, "")}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-[12px] font-medium leading-5 text-ink-2">{STEP_HINT[step.kind]}</p>
        {sitting.plan && si === 0 && <CanDoCard plan={sitting.plan} />}
      </section>

      {si === 0 && (sitting.n === 1 || scopedLecture) && (
        <div className="mt-3 space-y-2">
          {profile.lectureFirst ? (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
                <Headphones size={15} strokeWidth={2.4} aria-hidden="true" /> Nghe cô giáo giảng
                trước, rồi tự học từng phần bên dưới
              </p>
              <SlideLecture
                lessonId={lesson.id}
                {...(scopedLecture ? { sitting: sitting.n } : {})}
                onPlay={onListened}
                pictures={lecturePictures(lesson)}
                {...(!isLast
                  ? {
                      onNext: {
                        label: `học ${sitting.steps[si + 1]!.label.replace(/ · .*$/, "")}`,
                        go: () => setStepIndex(si + 1),
                      },
                    }
                  : {})}
              />
            </div>
          ) : (
            <Disclosure
              title={
                <span className="flex items-center gap-1.5">
                  <Headphones size={14} strokeWidth={2.4} aria-hidden="true" /> Nghe bài giảng trước
                  (không bắt buộc)
                </span>
              }
            >
              <div className="px-3 pb-3">
                <SlideLecture
                  lessonId={lesson.id}
                  {...(scopedLecture ? { sitting: sitting.n } : {})}
                  onPlay={onListened}
                  pictures={lecturePictures(lesson)}
                  {...(!isLast
                    ? {
                        onNext: {
                          label: `học ${sitting.steps[si + 1]!.label.replace(/ · .*$/, "")}`,
                          go: () => setStepIndex(si + 1),
                        },
                      }
                    : {})}
                />
              </div>
            </Disclosure>
          )}
          {sitting.n === 1 && (lesson.notes ?? []).length > 0 && (
            <Disclosure title="Ghi chú của bài">
              <div className="px-3 pb-3">
                <LessonNotes notes={lesson.notes ?? []} onOpenWriting={onOpenWhole} />
              </div>
            </Disclosure>
          )}
        </div>
      )}

      <div className="mt-3">
        {step.kind === "vocab" && (
          <VocabFlashcards
            key={`${sitting.n}-v`}
            vocab={items(step.ids).vocab}
            onReviewed={onVocabReviewed}
            studied={vocabStudied}
          />
        )}
        {step.kind === "grammar" && (
          <GrammarCards
            key={`${sitting.n}-g`}
            profile={profile}
            grammar={lesson.grammar.filter((g) => step.ids.includes(g.id))}
            onReviewed={onGrammarReviewed}
            placement={placement}
            verdicts={grammarVerdicts}
          />
        )}
        {step.kind === "say" && (
          <SayStep
            key={`${sitting.n}-say`}
            lines={step.lines}
            lessonId={lesson.id}
            session={sitting.n}
          />
        )}
        {step.kind === "situation" && (
          <SituationStep key={`${sitting.n}-sit`} situation={step.situation} />
        )}
        {(step.kind === "check" || step.kind === "practice") && (
          <PracticeSubset key={`${sitting.n}-${si}`} lessonId={lesson.id} itemIds={step.itemIds} />
        )}
      </div>

      <div className="mt-5">
        {isLast ? (
          <button
            type="button"
            onClick={finish}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-blue px-4 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
          >
            <Check size={16} strokeWidth={2.8} /> Xong buổi {sitting.n}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              tap();
              setStepIndex(si + 1);
              top();
            }}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-blue px-4 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
          >
            Tiếp: {sitting.steps[si + 1]!.label.replace(/ · .*$/, "")}
            <ArrowRight size={16} strokeWidth={2.6} />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenWhole}
          className="mx-auto mt-3 block min-h-10 text-[12px] font-semibold text-ink-2 underline underline-offset-2"
        >
          Xem cả bài một trang (tra cứu)
        </button>
      </div>
    </div>
  );
}

/** What a planned sitting is for, said as something the learner will be able to DO; after the
 * sitting the same card says what they now can. */
/** Pull «vi» (한국어) pairs out of the plan sentence so the Korean gets its own line. */
function splitCanDo(s: string) {
  const examples: { ko: string; vi: string }[] = [];
  const re = /«([^«»]+)»\s*\(([^()]*[가-힣][^()]*)\)/g;
  for (const m of s.matchAll(re)) examples.push({ vi: m[1]!.trim(), ko: m[2]!.trim() });
  const text = s
    .replace(/\s*\(([^()]*[가-힣][^()]*)\)/g, "")
    .replace(/«/g, "“")
    .replace(/»/g, "”")
    .replace(/\s+([,.])/g, "$1")
    .trim();
  return { text, examples };
}

function CanDoCard({ plan, done = false }: { plan: SittingPlan; done?: boolean }) {
  const { text, examples } = splitCanDo(plan.canDo);
  const Icon = done ? CheckCircle2 : Target;
  const hasMore = !done && (plan.use || plan.topik);
  return (
    <section className="mt-3 rounded-[14px] bg-blue-soft p-3.5 text-left">
      <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-blue">
        <Icon size={14} strokeWidth={2.6} aria-hidden />
        {done ? "Bạn đã làm được" : "Mục tiêu buổi này"}
      </p>
      <p className="mt-1.5 text-[15px] font-semibold leading-[22px] text-ink">{text}</p>
      {examples.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {examples.map((ex) => (
            <li key={ex.ko} className="rounded-[10px] bg-card px-3 py-2">
              <span
                lang="ko"
                className="block font-korean break-keep text-[17px] font-bold text-ink"
              >
                {ex.ko}
              </span>
              <span className="mt-0.5 block text-[12px] font-medium leading-4 text-ink-2">
                {ex.vi}
              </span>
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <details className="group mt-2.5">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 text-[12.5px] font-semibold text-blue [&::-webkit-details-marker]:hidden">
            Dùng ở đâu?
            <ChevronDown
              size={14}
              strokeWidth={2.6}
              className="transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <dl className="mt-1 space-y-2 border-t border-line pt-2.5 text-[13px] leading-5">
            {plan.use && (
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-2">
                  Ngoài đời
                </dt>
                <dd className="mt-0.5 text-ink">{plan.use}</dd>
              </div>
            )}
            {plan.topik && (
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-2">
                  Trong bài thi IELTS
                </dt>
                <dd className="mt-0.5 text-ink">{plan.topik}</dd>
              </div>
            )}
          </dl>
        </details>
      )}
    </section>
  );
}

/** The sittings as a row of numbered dots: done, the one open, the rest. */
function SittingMap({
  sittings,
  index,
  marks,
  onPick,
}: {
  sittings: Sitting[];
  index: number;
  marks: StudyMarks;
  onPick: (i: number) => void;
}) {
  const doneCount = sittings.filter((s) => sittingDone(s, marks)).length;
  return (
    <nav aria-label="Các buổi của bài">
      <p className="text-[12px] font-semibold text-ink-2">
        {sittings.length} buổi · đã xong {doneCount}
      </p>
      <ol className="-mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {sittings.map((s, i) => {
          const done = sittingDone(s, marks);
          const active = i === index;
          return (
            <li key={s.n} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-current={active ? "true" : undefined}
                aria-label={`Buổi ${s.n}: ${s.title}${done ? ", đã xong" : ""}`}
                title={s.title}
                className={cn(
                  "flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-[13px] font-bold tabular-nums",
                  active
                    ? "bg-blue text-primary-foreground shadow-elev-1"
                    : done
                      ? "bg-green-soft text-ink"
                      : s.kind === "practice"
                        ? "border border-dashed border-line bg-card text-ink-2"
                        : "bg-fill text-ink-2",
                )}
              >
                {done && !active ? <Check size={14} strokeWidth={3} /> : s.n}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A skill course says first what it produces, and goes straight to it on demand. */
function ProductCard({
  product,
  target,
  onGo,
}: {
  product: NonNullable<StageProfile["product"]>;
  target: number;
  onGo: (i: number) => void;
}) {
  return (
    <section className="mb-3 rounded-[20px] bg-yellow-soft p-4">
      <p className="flex items-center gap-1.5 text-[14px] font-bold">
        <Target size={16} strokeWidth={2.4} aria-hidden="true" /> {product.title}
      </p>
      <p className="mt-1 text-[12.5px] font-medium leading-5 text-ink-2">{product.hint}</p>
      {target >= 0 && (
        <button
          type="button"
          onClick={() => onGo(target)}
          className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-card px-4 text-[13px] font-semibold shadow-elev-1 active:scale-[0.97]"
        >
          {product.skill === "writing" ? "Tới phần viết" : "Tới phần đọc"}
          <ArrowRight size={14} strokeWidth={2.6} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

/** After a sitting: practice tied to this lesson — its dialogue as a chat, a talk with Haru about
 * it, a writing drill from its phrases, the cards due. Which ones depends on the stage. */
function PracticeAfter({ lesson, profile }: { lesson: LessonOut; profile: StageProfile }) {
  const links: ReactNode[] = [];
  const cls =
    "flex min-h-12 items-center gap-3 rounded-[16px] border border-line bg-card px-3.5 text-left text-[13px] font-semibold shadow-elev-1 active:scale-[0.98]";
  for (const kind of profile.practice) {
    if (kind === "talk")
      links.push(
        <Link
          key="talk"
          to="/talk"
          search={{ lesson: lesson.id }}
          onClick={() => tap()}
          className={cls}
        >
          <Mic size={18} className="shrink-0 text-blue" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            Nói với Haru về bài này
            <span className="block text-[11.5px] font-medium text-ink-2">
              Dùng từ và mẫu vừa học
            </span>
          </span>
        </Link>,
      );
    if (kind === "review")
      links.push(
        <Link key="review" to="/review" onClick={() => tap()} className={cls}>
          <Layers size={18} className="shrink-0 text-blue" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            Ôn thẻ đến hạn
            <span className="block text-[11.5px] font-medium text-ink-2">
              Nhớ lâu nhờ ôn đúng lúc
            </span>
          </span>
        </Link>,
      );
  }
  if (links.length === 0) return null;
  return (
    <div className="mt-5 text-left">
      <h3 className="text-[13px] font-semibold text-ink-2">Luyện với bài này</h3>
      <div className="mt-2 space-y-2">{links.slice(0, 3)}</div>
    </div>
  );
}
