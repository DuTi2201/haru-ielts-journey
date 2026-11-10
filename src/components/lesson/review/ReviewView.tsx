import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Check,
  ClipboardCheck,
  Compass,
  PenLine,
  Trophy,
} from "lucide-react";

import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { getLessonPractice, getLessonProgress } from "@/lib/api/content";
import type {
  DictationOut,
  ExerciseResultOut,
  LessonOut,
  SpeakOut,
  WriteEssayOut,
  WriteFillOut,
} from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { readLocal, writeLocal } from "@/lib/lesson-local";
import { lessonProgressKey, TRACK_LABEL, TRACK_TONE } from "@/lib/lesson-meta";
import { prefersReducedMotion } from "@/lib/motion";
import {
  isRecord,
  mockExercises,
  mockKey,
  mockQuestions,
  recordFromResults,
  score,
  summarize,
  type MockRecord,
} from "@/lib/review";
import { cn } from "@/lib/utils";
import { BackToLessons, endStepClass, NextStepButton, Shell, StepFooter } from "../LessonShell";
import { LinkedGrammarContext } from "../linked-grammar-context";
import { Ko, Rich } from "../Rich";
import { SceneImagesContext } from "../scene-images-context";
import { useAnswerSaver } from "../use-answer-saver";
import { BulletList, Disclosure, GuideBlocks } from "../Disclosure";
import { Capstone } from "./Capstone";
import { MockExam } from "./MockExam";
import { ReviewDictation } from "./ReviewDictation";
import { ReviewMap } from "./ReviewMap";
import { ReviewReport } from "./ReviewReport";
import { ReviewWriting } from "./ReviewWriting";

/** The topic's intro in two lines; the rest on a tap (the four steps below say what to do). */
function ClampedIntro({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <Rich
        as="p"
        text={text}
        className={cn("text-[13px] leading-5 text-ink-2", !open && "line-clamp-2")}
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-0.5 min-h-8 text-[12.5px] font-semibold text-blue-deep"
      >
        {open ? "Thu gọn" : "Xem thêm"}
      </button>
    </div>
  );
}

type ReviewStep = "map" | "mock" | "capstone" | "report";
const STEPS: readonly ReviewStep[] = ["map", "mock", "capstone", "report"];
const isStep = (v: unknown): v is ReviewStep => STEPS.includes(v as ReviewStep);

const STEP_META: Record<ReviewStep, { label: string; icon: typeof Compass; next: string | null }> =
  {
    map: { label: "Bản đồ", icon: Compass, next: "Tiếp: Thi thử" },
    mock: { label: "Thi thử", icon: ClipboardCheck, next: "Tiếp: Luyện thêm" },
    capstone: { label: "Luyện thêm", icon: PenLine, next: "Tiếp: Báo cáo" },
    report: { label: "Báo cáo", icon: BarChart3, next: null },
  };

function Tabs({
  active,
  detail,
  onPick,
}: {
  active: ReviewStep;
  detail: Record<ReviewStep, { text: string; done: boolean }>;
  onPick: (s: ReviewStep) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Các phần của bài ôn tập"
      className="grid grid-cols-4 gap-1.5 lg:grid-cols-1 lg:gap-2"
    >
      {STEPS.map((s, i) => {
        const meta = STEP_META[s];
        const Icon = meta.icon;
        const selected = s === active;
        const d = detail[s];
        return (
          <button
            key={s}
            type="button"
            role="tab"
            id={`review-tab-${s}`}
            aria-selected={selected}
            aria-controls={`review-panel-${s}`}
            onClick={() => onPick(s)}
            className={cn(
              "hit-area relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-[16px] border border-line px-1 py-1.5 text-center transition-colors lg:min-h-14 lg:flex-row lg:justify-start lg:gap-3 lg:px-3.5 lg:text-left",
              selected ? "bg-blue text-primary-foreground shadow-elev-1" : "bg-card text-ink",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold lg:h-7 lg:w-7",
                d.done
                  ? "bg-green text-primary-foreground"
                  : selected
                    ? "bg-primary-foreground text-blue-deep"
                    : "bg-progress text-ink-2",
              )}
            >
              {d.done ? (
                <Check size={13} strokeWidth={3.2} />
              ) : (
                <Icon size={13} strokeWidth={2.6} />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold leading-4 lg:text-[13px]">
                <span className="sr-only">Bước {i + 1}: </span>
                {meta.label}
              </span>
              <span
                className={cn(
                  "block text-[11px] font-semibold leading-3 tabular-nums lg:text-[12px]",
                  selected ? "text-primary-foreground/85" : "text-ink-2",
                )}
              >
                {d.text}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The review lesson that closes a topic: a grammar map by function, a timed mixed mock exam,
 * a Viết 54 + Nói S6 capstone that has to use the topic's patterns, and a report by pattern.
 * It owns no vocabulary or cards — it reads the topic's own. */
export function ReviewView({ lesson }: { lesson: LessonOut }) {
  const auth = useAuth();
  const id = lesson.id;
  const panelRef = useRef<HTMLDivElement>(null);
  const [clockSlot, setClockSlot] = useState<HTMLDivElement | null>(null);
  const [running, setRunning] = useState(false);

  const practice = useQuery({
    queryKey: ["lesson-practice", id],
    queryFn: () => getLessonPractice(id),
    staleTime: 10 * 60_000,
  });
  const progress = useQuery({
    queryKey: lessonProgressKey(id),
    queryFn: () => getLessonProgress(id),
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
  });
  const { onAnswer, saveAll } = useAnswerSaver(id);

  const [step, setStep] = useState<ReviewStep>(() => {
    const saved = readLocal<string>(`rstep:${id}`, "map");
    return isStep(saved) ? saved : "map";
  });
  // panels are mounted the first time they are opened and kept (hidden) afterwards, so a
  // mock exam in progress survives a look at the map
  const [visited, setVisited] = useState<ReviewStep[]>(() => [step]);
  const [mapSeen, setMapSeen] = useState<string[]>(() => readLocal<string[]>(`rmap:${id}`, []));
  const [local, setLocal] = useState<MockRecord | null>(() => {
    const v = readLocal<unknown>(mockKey(id), null);
    return isRecord(v) ? v : null;
  });

  const review = practice.data?.review ?? null;
  const exercises = useMemo(() => mockExercises(practice.data?.items ?? []), [practice.data]);
  const ids = useMemo(() => mockQuestions(exercises).map((q) => q.id), [exercises]);
  const previous = useMemo(() => {
    const map: Record<string, ExerciseResultOut> = {};
    for (const r of progress.data?.results ?? []) map[r.question_id] = r;
    return map;
  }, [progress.data]);
  const record = local ?? recordFromResults(progress.data?.results, ids);

  const goTo = useCallback(
    (next: ReviewStep) => {
      tap();
      setStep(next);
      setVisited((v) => (v.includes(next) ? v : [...v, next]));
      writeLocal(`rstep:${id}`, next);
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    },
    [id],
  );

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    panelRef.current?.focus({ preventScroll: true });
  }, [step]);

  const markSeen = useCallback(
    (fnId: string) =>
      setMapSeen((s) => {
        if (s.includes(fnId)) return s;
        const next = [...s, fnId];
        writeLocal(`rmap:${id}`, next);
        return next;
      }),
    [id],
  );

  const essay = practice.data?.items.find(
    (i): i is WriteEssayOut => i.id === review?.capstone.essay_id && i.type === "write_essay",
  );
  const speak = practice.data?.items.find(
    (i): i is SpeakOut => i.id === review?.capstone.speak_id && i.type === "speak",
  );
  // Viết 51–53 of the same sheet: every written item that is not the capstone essay
  const writing = useMemo(
    () =>
      (practice.data?.items ?? []).filter(
        (i): i is WriteFillOut | WriteEssayOut =>
          (i.type === "write_fill" || i.type === "write_essay") &&
          i.id !== review?.capstone.essay_id,
      ),
    [practice.data, review?.capstone.essay_id],
  );
  const dictations = useMemo(
    () =>
      (practice.data?.items ?? []).filter((i): i is DictationOut => i.type === "listen_dictation"),
    [practice.data],
  );
  const dictationDone = dictations.filter((d) => previous[d.id]).length;
  const capstoneDone =
    (review && previous[review.capstone.essay_id] ? 1 : 0) +
    (review && previous[review.capstone.speak_id] ? 1 : 0);
  const fnTotal = review?.functions.length ?? 0;
  const detail: Record<ReviewStep, { text: string; done: boolean }> = {
    map: {
      text: `${Math.min(mapSeen.length, fnTotal)}/${fnTotal}`,
      done: fnTotal > 0 && mapSeen.length >= fnTotal,
    },
    mock: {
      text: running
        ? "Đang thi"
        : record
          ? review?.mock.score
            ? `≈ ${summarize(exercises, record.picked, review.mock).figure}/200`
            : `${score(exercises, record.picked)}/${ids.length}`
          : "Chưa thi",
      done: !!record && !running,
    },
    capstone: {
      text:
        dictations.length > 0
          ? `${capstoneDone}/2 · ${dictationDone}/${dictations.length}`
          : `${capstoneDone}/2`,
      done: capstoneDone >= 2,
    },
    report: { text: record ? "Đã có" : "Chờ thi", done: false },
  };

  const index = STEPS.indexOf(step);
  const nextStep = STEPS[index + 1];
  const track = lesson.track ?? null;
  const intro = lesson.summary ?? lesson.content;

  const body = () => {
    if (practice.isLoading) {
      return (
        <LoadingBlocks label="Đang tải bài ôn tập" blocks={["h-10 rounded-full", "h-40", "h-40"]} />
      );
    }
    if (practice.isError) {
      return (
        <ErrorState
          title="Không tải được bài ôn tập."
          message={errorMessage(practice.error)}
          onRetry={() => void practice.refetch()}
          retrying={practice.isRefetching}
        />
      );
    }
    if (!review) {
      return (
        <EmptyState
          title="Bài ôn tập chưa sẵn sàng."
          hint="Học các bài của chủ đề trước, rồi quay lại nhé."
        />
      );
    }
    const panel = (s: ReviewStep, children: React.ReactNode) =>
      visited.includes(s) && (
        <div
          key={s}
          id={`review-panel-${s}`}
          role="tabpanel"
          aria-labelledby={`review-tab-${s}`}
          hidden={s !== step}
          ref={s === step ? panelRef : undefined}
          tabIndex={-1}
          className="outline-none"
        >
          {children}
        </div>
      );
    return (
      <>
        {panel(
          "map",
          <>
            <ReviewMap review={review} seen={mapSeen} onSeen={markSeen} />
            {(practice.data?.overview?.blocks?.length ?? 0) > 0 && (
              <Disclosure
                title="Cấu trúc đề TOPIK II, cách tính điểm và kế hoạch ôn"
                className="mt-6"
              >
                <GuideBlocks blocks={practice.data?.overview?.blocks ?? []} />
                {(practice.data?.overview?.disclaimer_vi?.length ?? 0) > 0 && (
                  <Disclosure title="Đọc thêm về bộ đề này" className="mt-2.5">
                    <BulletList items={practice.data?.overview?.disclaimer_vi ?? []} />
                  </Disclosure>
                )}
              </Disclosure>
            )}
          </>,
        )}
        {panel(
          "mock",
          <MockExam
            lessonId={id}
            exercises={exercises}
            review={review}
            record={record}
            clockSlot={clockSlot}
            onFinish={setLocal}
            onRunning={setRunning}
            saveAll={saveAll}
            onReport={() => goTo("report")}
          />,
        )}
        {panel(
          "capstone",
          <>
            <ReviewWriting
              lessonId={id}
              items={writing}
              guide={practice.data?.guides.writing ?? []}
              previous={previous}
              onAnswer={onAnswer}
            />
            <Capstone
              lessonId={id}
              capstone={review.capstone}
              essay={essay}
              speak={speak}
              previous={previous}
              onAnswer={onAnswer}
            />
            <ReviewDictation
              lessonId={id}
              items={dictations}
              previous={previous}
              onAnswer={onAnswer}
            />
          </>,
        )}
        {panel(
          "report",
          <ReviewReport
            lessonId={id}
            review={review}
            exercises={exercises}
            record={record}
            previous={previous}
            onGoMock={() => goTo("mock")}
            onGoCapstone={() => goTo("capstone")}
          />,
        )}
      </>
    );
  };

  const linked = useMemo(
    () => ({
      cards: practice.data?.grammar ?? {},
      lessonId: id,
      signedIn: auth.isAuthenticated,
    }),
    [practice.data?.grammar, id, auth.isAuthenticated],
  );

  return (
    <Shell>
      <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <header>
            <BackToLessons topic={lesson.topics[0]?.name ?? null} track={track} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-soft px-2.5 py-0.5 text-[12px] font-semibold">
                <Trophy size={12} strokeWidth={2.8} aria-hidden="true" /> Ôn tập chủ đề
              </span>
              {track && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                    TRACK_TONE[track],
                  )}
                >
                  {TRACK_LABEL[track]}
                </span>
              )}
              <span className="text-[13px] font-semibold text-ink-2">Cấp độ {lesson.level}</span>
            </div>
            {lesson.title_en && (
              <Ko className="mt-2 block text-[13px] font-semibold text-ink-2">{lesson.title_en}</Ko>
            )}
            <h1 className="mt-0.5 text-2xl font-bold leading-tight">
              <span className="min-w-0 break-words">{lesson.title}</span>
            </h1>
            {intro && <ClampedIntro text={intro} />}
          </header>

          <div className="sticky top-0 z-30 -mx-6 mt-4 bg-paper/95 px-6 py-2 backdrop-blur-sm lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <Tabs active={step} detail={detail} onPick={goTo} />
            <div ref={setClockSlot} />
          </div>
        </aside>

        <div className="mt-4 lg:mt-0">
          <SceneImagesContext.Provider value={practice.data?.scene_images ?? {}}>
            <LinkedGrammarContext.Provider value={linked}>{body()}</LinkedGrammarContext.Provider>
          </SceneImagesContext.Provider>
        </div>
      </div>

      {/* the way on, at the foot of the content; not shown while a paper is being sat */}
      {!(running && step === "mock") && (
        <StepFooter>
          {nextStep ? (
            <NextStepButton label={STEP_META[step].next ?? ""} onClick={() => goTo(nextStep)} />
          ) : (
            <Link
              to="/lesson"
              search={
                lesson.topics[0]
                  ? { topic: lesson.topics[0].name, ...(track ? { track } : {}) }
                  : {}
              }
              onClick={() => tap()}
              className={endStepClass}
            >
              Về danh sách bài <ArrowRight size={16} strokeWidth={2.8} />
            </Link>
          )}
        </StepFooter>
      )}
    </Shell>
  );
}
