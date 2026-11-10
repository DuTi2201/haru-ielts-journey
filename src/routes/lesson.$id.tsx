import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  BookX,
  Check,
  Headphones,
  Layers,
  ListChecks,
  NotebookPen,
  PencilRuler,
  Rows3,
} from "lucide-react";

import { LockedLessonView } from "@/components/billing/LockedLesson";
import { Stage } from "@/components/haru/cinema";
import type { MascotMood } from "@/components/mascot/Mascot";
import { lecturePictures } from "@/components/lesson/lecture/SlideLecture";
import { WholeLecture } from "@/components/lesson/lecture/WholeLecture";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { GrammarCards } from "@/components/lesson/GrammarCards";
import { CoachWatchOut, CoachWrapUp, LessonCoach } from "@/components/lesson/LessonCoach";
import { LessonImage } from "@/components/lesson/LessonImage";
import { LessonNotes } from "@/components/lesson/LessonNotes";
import {
  BackToLessons,
  endStepClass,
  NextStepButton,
  Shell,
  StepFooter,
} from "@/components/lesson/LessonShell";
import { PracticeOnward } from "@/components/lesson/PracticeOnward";
import { PracticePanel } from "@/components/lesson/PracticePanel";
import { StepNudge } from "@/components/lesson/StepNudge";
import { SittingPlayer } from "@/components/lesson/session/SittingPlayer";
import { HangulLessonView } from "@/components/lesson/hangul/HangulLessonView";
import { ReviewView } from "@/components/lesson/review/ReviewView";
import { Ko, Rich } from "@/components/lesson/Rich";
import { VocabFlashcards } from "@/components/lesson/VocabFlashcards";
import { VocabList } from "@/components/lesson/VocabList";
import { VocabPriorityFilter } from "@/components/lesson/VocabPriorityFilter";
import { ChunkChips } from "@/components/feathers/FeatherStrip";
import { LessonFeathersDone } from "@/components/feathers/LessonFeathersDone";
import { useAuth } from "@/hooks/use-auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { getLesson, getLessonProgress, getLessonStudy, getMyPlacement } from "@/lib/api/content";
import { getMistakeBook } from "@/lib/api/practice";
import type { CardStudyOut, FeatherOut, LessonOut, LessonStudyOut } from "@/lib/api/types";
import { isLocked } from "@/lib/billing";
import { tap } from "@/lib/feedback";
import {
  isLessonStep,
  LESSON_STEPS,
  readLocal,
  writeLocal,
  type LessonStep,
} from "@/lib/lesson-local";
import { isKiip } from "@/lib/exam";
import {
  lessonProgressKey,
  lessonStudyKey,
  MISTAKE_BOOK_KEY,
  TRACK_LABEL,
  TRACK_TONE,
} from "@/lib/lesson-meta";
import type { StudyMarks } from "@/lib/lesson-sessions";
import { stageProfile } from "@/lib/lesson-stage";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { byPriority, priorityCounts, type PriorityView } from "@/lib/vocab";

export const Route = createFileRoute("/lesson/$id")({
  head: () => ({
    meta: [
      { title: "Bài học — Haru English" },
      { name: "description", content: "Bài học trong ứng dụng học tiếng Anh IELTS Haru." },
      { property: "og:title", content: "Bài học — Haru English" },
      { property: "og:description", content: "Bài học trong ứng dụng học tiếng Anh IELTS Haru." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LessonScreen,
});

// ----------------------------------------------------------- what was looked at --
interface Seen {
  listened: boolean;
  vocab: number[];
  grammar: number[];
}
const NOTHING_SEEN: Seen = { listened: false, vocab: [], grammar: [] };

/** Per-device record of what the learner has already gone through in this lesson
 * (the stepper's little counters). Mastery itself is the server's, via spaced review. */
function useSeen(lessonId: number) {
  const key = `seen:${lessonId}`;
  const [seen, setSeen] = useState<Seen>(() => readLocal<Seen>(key, NOTHING_SEEN));
  const update = useCallback(
    (fn: (s: Seen) => Seen) =>
      setSeen((s) => {
        const next = fn(s);
        writeLocal(key, next);
        return next;
      }),
    [key],
  );
  return {
    seen,
    markListened: useCallback(
      () => update((s) => (s.listened ? s : { ...s, listened: true })),
      [update],
    ),
    markVocab: useCallback(
      (id: number) => update((s) => (s.vocab.includes(id) ? s : { ...s, vocab: [...s.vocab, id] })),
      [update],
    ),
    markGrammar: useCallback(
      (id: number) =>
        update((s) => (s.grammar.includes(id) ? s : { ...s, grammar: [...s.grammar, id] })),
      [update],
    ),
  };
}

// ------------------------------------------------------------------- the stepper --
const STEP_META: Record<
  LessonStep,
  { label: string; icon: typeof Headphones; next: string | null }
> = {
  listen: { label: "Nghe", icon: Headphones, next: "Tiếp: Từ vựng" },
  vocab: { label: "Từ vựng", icon: Layers, next: "Tiếp: Ngữ pháp" },
  grammar: { label: "Ngữ pháp", icon: NotebookPen, next: "Tiếp: Luyện tập" },
  practice: { label: "Luyện tập", icon: PencilRuler, next: null },
};

function Stepper({
  steps,
  active,
  detail,
  onPick,
}: {
  steps: LessonStep[];
  active: LessonStep;
  /** The small line under each step's name ("5/11"), and whether it is complete. */
  detail: Record<LessonStep, { text: string; done: boolean }>;
  onPick: (s: LessonStep) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Các phần của bài học"
      className="grid grid-cols-[repeat(var(--steps),minmax(0,1fr))] gap-1.5 lg:grid-cols-1 lg:gap-2"
      style={{ "--steps": steps.length } as React.CSSProperties}
    >
      {steps.map((s, i) => {
        const meta = STEP_META[s];
        const Icon = meta.icon;
        const selected = s === active;
        const d = detail[s];
        return (
          <button
            key={s}
            type="button"
            role="tab"
            id={`lesson-tab-${s}`}
            aria-selected={selected}
            aria-controls="lesson-panel"
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

function ViewToggle({
  view,
  onChange,
}: {
  view: "list" | "cards";
  onChange: (v: "list" | "cards") => void;
}) {
  const options = [
    { id: "list" as const, label: "Danh sách", icon: Rows3 },
    { id: "cards" as const, label: "Thẻ ghi nhớ", icon: ListChecks },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Cách học từ vựng"
      className="ml-auto flex shrink-0 gap-0.5 rounded-full bg-fill p-0.5"
    >
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={view === o.id}
            onClick={() => onChange(o.id)}
            aria-label={o.label}
            title={o.label}
            className={cn(
              "flex h-8 w-10 items-center justify-center rounded-full",
              view === o.id ? "bg-card text-ink shadow-elev-1" : "text-ink-2",
            )}
          >
            <Icon size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------- the page --
/** Theo buổi / Cả bài: how the lesson is shown (what is in it is the same). */
function ModeSwitch({
  mode,
  onChange,
}: {
  mode: "sittings" | "whole";
  onChange: (m: "sittings" | "whole") => void;
}) {
  const opts = [
    { id: "sittings" as const, label: "Theo buổi 15 phút" },
    { id: "whole" as const, label: "Cả bài" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Cách xem bài"
      className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-fill p-1"
    >
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={mode === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-10 rounded-full text-[13px] font-semibold transition-colors",
            mode === o.id ? "bg-card text-ink shadow-elev-1" : "text-ink-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LessonView({ lesson }: { lesson: LessonOut }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const { seen, markListened, markVocab, markGrammar } = useSeen(lesson.id);
  const panelRef = useRef<HTMLDivElement>(null);

  const profile = useMemo(() => stageProfile(lesson), [lesson]);
  const hasGrammar = lesson.grammar.length > 0;
  const steps = useMemo(
    () => LESSON_STEPS.filter((s) => s !== "grammar" || hasGrammar),
    [hasGrammar],
  );
  const [step, setStep] = useState<LessonStep>(() => {
    const saved = readLocal<string>(`step:${lesson.id}`, "listen");
    return isLessonStep(saved) && steps.includes(saved) ? saved : "listen";
  });
  // "Theo buổi" (default): the lesson in ~15-minute sittings; "Cả bài": every part on its tab
  const [mode, setMode] = useState<"sittings" | "whole">(() =>
    readLocal<string>("lesson-mode", "sittings") === "whole" ? "whole" : "sittings",
  );
  const pickMode = useCallback((m: "sittings" | "whole") => {
    tap();
    setMode(m);
    writeLocal("lesson-mode", m);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, []);
  const [vocabView, setVocabView] = useState<"list" | "cards">(() =>
    readLocal<string>("vocab-view", "list") === "cards" ? "cards" : "list",
  );

  // "Chỉ xem phần KIIP": one switch for the lesson, remembered on this device. It only
  // narrows the lists when the lesson has KIIP items at all.
  const kiipVocab = lesson.vocab.filter((v) => isKiip(v.exam));
  const kiipGrammar = lesson.grammar.filter((g) => isKiip(g.exam));
  const kiipNotes = (lesson.notes ?? []).filter((n) => isKiip(n.exam));
  const hasKiip = kiipVocab.length + kiipGrammar.length + kiipNotes.length > 0;
  const [kiipPref, setKiipPref] = useState<boolean>(() => readLocal<boolean>("kiip-only", false));
  const kiipOnly = hasKiip && kiipPref;
  const kiipScoped = kiipOnly ? kiipVocab : lesson.vocab;
  // "Cần thuộc ngay / Chỉ nhận ra": the second narrowing, on top of the KIIP one
  const [priorityPref, setPriorityPref] = useState<PriorityView>(() => {
    const saved = readLocal<string>("vocab-priority", "all");
    return saved === "core" || saved === "recognize" ? saved : "all";
  });
  const hasBothKinds =
    priorityCounts(kiipScoped).core > 0 && priorityCounts(kiipScoped).recognize > 0;
  const priorityView: PriorityView = hasBothKinds ? priorityPref : "all";
  const filteredVocab = byPriority(kiipScoped, priorityView);
  const filteredGrammar = kiipOnly ? kiipGrammar : lesson.grammar;
  // the small part (feather) on screen: "all", one feather's id, or null until a step is opened
  const [vocabChunk, setVocabChunk] = useState<string | null>(null);
  const [grammarChunk, setGrammarChunk] = useState<string | null>(null);
  const [practiceKey, setPracticeKey] = useState(0);
  // the goal of the lesson stays: it says what the lesson is for
  const shownNotes = kiipOnly
    ? (lesson.notes ?? []).filter((n) => n.kind === "goal" || isKiip(n.exam))
    : (lesson.notes ?? []);

  const progress = useQuery({
    queryKey: lessonProgressKey(lesson.id),
    queryFn: () => getLessonProgress(lesson.id),
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
  });

  // Where the learner stands, kept on the server (so it is the same after closing the app, or on
  // another phone): the part to open on, the cards already marked, the words already answered.
  const study = useQuery({
    queryKey: lessonStudyKey(lesson.id),
    queryFn: () => getLessonStudy(lesson.id),
    enabled: auth.isAuthenticated,
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });
  const studyData = study.data;
  const studyFresh = study.isFetchedAfterMount;
  const studyFailed = study.isError;
  const grammarVerdicts = useMemo(() => {
    const out: Record<number, boolean> = {};
    for (const c of studyData?.cards ?? []) {
      if (c.item_type === "grammar_point") out[c.item_id] = c.last_correct;
    }
    return out;
  }, [studyData]);
  const vocabStudied = useMemo(() => {
    const out = new Map<number, boolean>();
    for (const c of studyData?.cards ?? []) {
      if (c.item_type === "vocab_item") out.set(c.item_id, c.last_correct);
    }
    return out;
  }, [studyData]);

  // The lesson's feathers: the server's list, earned as soon as their cards / questions are done on
  // this screen (the cached records are kept in step as the learner goes)
  const feathers = useMemo<FeatherOut[]>(() => {
    const met = new Set((studyData?.cards ?? []).map((c) => `${c.item_type}:${c.item_id}`));
    const answered = new Set((progress.data?.results ?? []).map((r) => r.question_id));
    return (studyData?.feathers ?? []).map((f) => {
      if (f.earned) return f;
      const type = f.kind === "vocab" ? "vocab_item" : "grammar_point";
      const live =
        f.kind === "part"
          ? false
          : f.item_ids.every((i) => met.has(`${type}:${i}`)) &&
            f.question_ids.every((q) => answered.has(q));
      return live ? { ...f, earned: true } : f;
    });
  }, [studyData, progress.data]);
  const vocabFeathers = feathers.filter((f) => f.kind === "vocab");
  const grammarFeathers = feathers.filter((f) => f.kind === "grammar");
  const practiceFeathers = feathers.filter((f) => f.kind === "practice");
  const featherDone = feathers.length > 0 && feathers.every((f) => f.earned);
  const [doneScene, setDoneScene] = useState(false);
  const wasDone = useRef<boolean | null>(null);
  const feathersReady = !!studyData && studyFresh && (!progress.isLoading || !auth.isAuthenticated);
  useEffect(() => {
    if (!feathersReady || feathers.length === 0) return;
    if (wasDone.current === false && featherDone) setDoneScene(true);
    wasDone.current = featherDone;
  }, [feathersReady, featherDone, feathers.length]);

  const pickChunk = (list: FeatherOut[], chosen: string | null) =>
    chosen === null ? null : chosen === "all" ? null : (list.find((f) => f.id === chosen) ?? null);
  const vocabPart = pickChunk(vocabFeathers, vocabChunk);
  const grammarPart = pickChunk(grammarFeathers, grammarChunk);
  const inVocabPart = vocabPart
    ? filteredVocab.filter((v) => vocabPart.item_ids.includes(v.id))
    : [];
  const shownVocab = vocabPart && inVocabPart.length > 0 ? inVocabPart : filteredVocab;
  const inGrammarPart = grammarPart
    ? filteredGrammar.filter((g) => grammarPart.item_ids.includes(g.id))
    : [];
  const shownGrammar = grammarPart && inGrammarPart.length > 0 ? inGrammarPart : filteredGrammar;
  const firstOpen = (list: FeatherOut[]) => (list.find((f) => !f.earned) ?? list[0])?.id ?? "all";

  // A card was answered: keep the cached record in step with the server (the stepper and the
  // marked cards read it) and mark the plan / lesson list stale for the next time they open.
  const noteCard = useCallback(
    (type: CardStudyOut["item_type"], id: number, correct: boolean) => {
      qc.setQueryData<LessonStudyOut>(lessonStudyKey(lesson.id), (old) => {
        if (!old) return old;
        const before = old.cards.find((c) => c.item_type === type && c.item_id === id);
        const cards = [
          ...old.cards.filter((c) => c !== before),
          { item_type: type, item_id: id, last_correct: correct, strength: before?.strength ?? 0 },
        ];
        const vocabMet = cards.filter((c) => c.item_type === "vocab_item").length;
        return {
          ...old,
          cards,
          vocab_met: vocabMet,
          grammar_met: cards.length - vocabMet,
        };
      });
      void qc.invalidateQueries({ queryKey: ["me", "plan"], refetchType: "none" });
      void qc.invalidateQueries({ queryKey: ["lessons"], refetchType: "none" });
    },
    [qc, lesson.id],
  );
  const onVocabReviewed = useCallback(
    (id: number, correct: boolean) => {
      markVocab(id);
      noteCard("vocab_item", id, correct);
    },
    [markVocab, noteCard],
  );
  const onGrammarReviewed = useCallback(
    (id: number, correct: boolean) => {
      markGrammar(id);
      noteCard("grammar_point", id, correct);
    },
    [markGrammar, noteCard],
  );

  // what the sittings need to know: words and cards met (server record + this device), answers
  const marks = useMemo<StudyMarks>(() => {
    const vocabMet = new Set<number>(seen.vocab);
    const grammarMet = new Set<number>(seen.grammar);
    for (const c of studyData?.cards ?? [])
      (c.item_type === "vocab_item" ? vocabMet : grammarMet).add(c.item_id);
    const answered = new Set((progress.data?.results ?? []).map((r) => r.question_id));
    return { vocabMet, grammarMet, answered };
  }, [seen.vocab, seen.grammar, studyData, progress.data]);

  // Sổ lỗi sai exists for the lessons that have the study guide: how many of this lesson's
  // questions are waiting to be read again
  const hasMistakeBook = !!lesson.coach && auth.isAuthenticated;
  const mistakeBook = useQuery({
    queryKey: MISTAKE_BOOK_KEY,
    queryFn: getMistakeBook,
    enabled: hasMistakeBook,
    staleTime: 15_000,
  });
  const mistakesToRead =
    mistakeBook.data?.lessons
      .find((l) => l.lesson_id === lesson.id)
      ?.mistakes.filter((m) => !m.understood).length ?? 0;

  // the entry diagnostic's result: cards the learner already answered right are marked / folded
  const placement = useQuery({
    queryKey: ["me", "placement"],
    queryFn: getMyPlacement,
    enabled: false,
    staleTime: 5 * 60_000,
  });
  const placed = useMemo(
    () =>
      placement.data
        ? { known: new Set(placement.data.known_ids), solid: new Set(placement.data.solid_ids) }
        : undefined,
    [placement.data],
  );

  // Until the server has said where the learner stands, the panel waits (a moment) rather than
  // showing the wrong part and then jumping; picking a tab ends the wait at once.
  const [resolved, setResolved] = useState(false);
  const deciding = !resolved && (auth.isLoading || auth.isAuthenticated);
  useEffect(() => {
    const t = setTimeout(() => setResolved(true), 2500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    // (a signed-out learner never waits: `deciding` is false for them)
    if (resolved || auth.isLoading || !auth.isAuthenticated) return;
    if (studyFailed) {
      setResolved(true);
      return;
    }
    if (!studyFresh || !studyData) return;
    // The part the learner was on stays unless it is already finished: then on to the next
    // part with something left (the server's rule; listening is only known on this device).
    const done =
      step === "listen"
        ? seen.listened || studyData.resume_step !== "listen"
        : step === "vocab"
          ? studyData.vocab_met >= studyData.vocab_total
          : step === "grammar"
            ? studyData.grammar_met >= studyData.grammar_total
            : studyData.practice_answered >= studyData.practice_total;
    let target: LessonStep = studyData.resume_step ?? step;
    if (target === "listen" && seen.listened) target = "vocab";
    if (done && target !== step && steps.includes(target)) {
      setStep(target);
      writeLocal(`step:${lesson.id}`, target);
    }
    setResolved(true);
  }, [
    resolved,
    auth.isLoading,
    auth.isAuthenticated,
    studyFailed,
    studyFresh,
    studyData,
    step,
    steps,
    seen.listened,
    lesson.id,
  ]);

  const goTo = useCallback(
    (next: LessonStep) => {
      tap();
      setResolved(true);
      setStep(next);
      writeLocal(`step:${lesson.id}`, next);
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    },
    [lesson.id],
  );

  // Opening the words or the patterns opens the first small part not yet earned (the learner can
  // still pick another one, or all of them)
  useEffect(() => {
    if (!feathersReady) return;
    if (step === "vocab" && vocabChunk === null && vocabFeathers.length > 1)
      setVocabChunk(firstOpen(vocabFeathers));
    if (step === "grammar" && grammarChunk === null && grammarFeathers.length > 1)
      setGrammarChunk(firstOpen(grammarFeathers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, feathersReady, vocabFeathers.length, grammarFeathers.length]);

  const openFeather = useCallback(
    (f: FeatherOut) => {
      if (f.kind === "vocab") {
        setVocabChunk(f.id);
        goTo("vocab");
      } else if (f.kind === "grammar") {
        setGrammarChunk(f.id);
        goTo("grammar");
      } else if (f.kind === "practice") {
        if (f.skill) writeLocal(`skill:${lesson.id}`, f.skill);
        setPracticeKey((k) => k + 1);
        goTo("practice");
      }
    },
    [goTo, lesson.id],
  );
  // the way on inside a step: the next small part of the same kind, before the next step
  const nextPart =
    step === "vocab" && vocabPart
      ? vocabFeathers[vocabFeathers.indexOf(vocabPart) + 1]
      : step === "grammar" && grammarPart
        ? grammarFeathers[grammarFeathers.indexOf(grammarPart) + 1]
        : undefined;

  /** The model texts for Viết 51–52 have exercises of their own: open that tab directly. */
  const openWriting = useCallback(() => {
    writeLocal(`skill:${lesson.id}`, "writing");
    goTo("practice");
  }, [goTo, lesson.id]);

  // After a step change the panel takes focus, so a keyboard / screen-reader learner
  // lands on the new content instead of the tab they just pressed.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    panelRef.current?.focus({ preventScroll: true });
  }, [step]);

  const practiceTotal = progress.data?.total ?? lesson.practice?.questions ?? 0;
  const practiceDone = progress.data?.answered ?? 0;
  const allPracticeDone =
    auth.isAuthenticated && practiceTotal > 0 && practiceDone >= practiceTotal;
  // what this device saw and what the server has on record: the larger count is the truth
  const vocabMet = Math.min(
    Math.max(seen.vocab.length, studyData?.vocab_met ?? 0),
    lesson.vocab.length,
  );
  const grammarMet = Math.min(
    Math.max(seen.grammar.length, studyData?.grammar_met ?? 0),
    lesson.grammar.length,
  );
  const listened = seen.listened || (studyData !== undefined && studyData.resume_step !== "listen");
  const detail: Record<LessonStep, { text: string; done: boolean }> = {
    listen: { text: listened ? "Đã nghe" : "Chưa nghe", done: listened },
    vocab: {
      text: `${vocabMet}/${lesson.vocab.length} từ`,
      done: lesson.vocab.length > 0 && vocabMet >= lesson.vocab.length,
    },
    grammar: {
      text: `${grammarMet}/${lesson.grammar.length} mẫu`,
      done: lesson.grammar.length > 0 && grammarMet >= lesson.grammar.length,
    },
    practice: {
      text: auth.isAuthenticated ? `${practiceDone}/${practiceTotal} câu` : `${practiceTotal} câu`,
      done: allPracticeDone,
    },
  };

  const index = steps.indexOf(step);
  const nextStep = steps[index + 1];
  const track = lesson.track ?? null;
  // A lesson with a "Việc cần làm" block says the same things there (goal, counts, focus), so the
  // paragraph under the title is left out; the other lessons keep it.
  // what the lesson is for, in one line: the first point of its goal note (else its summary)
  const goalNote = (lesson.notes ?? []).find((n) => n.kind === "goal");
  // with a "Học xong bài này bạn làm được" card on top, the goal note is shown there, not twice
  const listenNotes = lesson.coach ? shownNotes.filter((n) => n.kind !== "goal") : shownNotes;
  // the lesson's product («🎯 Đầu ra: …») says best what it is for; else its first point (a lead-in
  // that ends in «:» is not a point)
  const goalLines = (goalNote?.body ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*[•-]\s*/, "").trim())
    .filter(Boolean);
  const outcome = goalLines.find((l) => l.includes("Đầu ra"));
  const goalLine = outcome
    ? outcome.replace(/^.*?Đầu ra:?\**:?\s*/, "")
    : (goalLines.find((l) => !l.endsWith(":"))?.replace(/^[①-⑩]\s*/, "") ?? null);
  // plain text on the header (code chips are unreadable on its dark ground), one closing stop
  const goalText =
    goalLine
      ?.replace(/[`*]/g, "")
      .replace(/[;,.\s]+$/, "")
      .concat(".") ?? null;

  return (
    <Shell>
      <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Stage as="header" className="p-4 lg:p-5">
            <BackToLessons
              topic={lesson.topics[0]?.name ?? null}
              track={track}
              className="text-current opacity-85"
            />
            {/* the lesson's picture: a thumbnail beside the title on a phone, the
                whole 16:9 banner above it in the desktop sidebar */}
            <div className="mt-2 flex items-start gap-3 lg:flex-col-reverse lg:gap-0">
              <div className="min-w-0 flex-1 lg:w-full lg:flex-none">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                      "bg-white/18 text-current ring-1 ring-white/25",
                    )}
                  >
                    {profile.label}
                  </span>
                  {mode === "whole" && (
                    <span className="text-[12px] font-semibold opacity-80">
                      Cấp độ {lesson.level}
                      {lesson.topics.length > 0
                        ? ` · ${lesson.topics.map((t) => t.name).join(", ")}`
                        : ""}
                    </span>
                  )}
                </div>
                {lesson.title_ko && (
                  <Ko className="mt-2 block text-[13px] font-semibold opacity-80">
                    {lesson.title_ko}
                  </Ko>
                )}
                <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight lg:text-2xl">
                  <span className="min-w-0 break-words">{lesson.title}</span>
                </h1>
              </div>
              <LessonImage
                src={lesson.image_url}
                eager
                className="h-[68px] w-24 lg:mb-3 lg:h-auto lg:w-full lg:aspect-[16/9]"
              />
            </div>
            {goalText && (
              <Rich
                as="p"
                text={outcome ? `🎯 ${goalText}` : `Sau bài này: ${goalText}`}
                className="mt-2 text-[13px] font-medium leading-5 opacity-90"
              />
            )}
          </Stage>
          <ModeSwitch mode={mode} onChange={pickMode} />
          {mode === "whole" && (
            <div className="sticky top-0 z-30 -mx-6 mt-4 bg-paper/95 px-6 py-2 backdrop-blur-sm lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
              <Stepper steps={steps} active={step} detail={detail} onPick={goTo} />
            </div>
          )}
        </aside>

        {mode === "sittings" ? (
          <div className="lg:mt-0">
            {deciding ? (
              <LoadingBlocks
                className="mt-4"
                label="Đang mở đúng buổi bạn đang học"
                blocks={["h-20", "h-64"]}
              />
            ) : (
              <SittingPlayer
                lesson={lesson}
                marks={marks}
                progress={progress.data}
                vocabStudied={vocabStudied}
                grammarVerdicts={grammarVerdicts}
                placement={placed}
                onVocabReviewed={onVocabReviewed}
                onGrammarReviewed={onGrammarReviewed}
                onOpenWhole={() => pickMode("whole")}
                onListened={markListened}
                profile={profile}
                feathers={{
                  earned: feathers.filter((f) => f.earned).length,
                  total: feathers.length,
                }}
              />
            )}
          </div>
        ) : (
          <div
            id="lesson-panel"
            role="tabpanel"
            aria-labelledby={`lesson-tab-${step}`}
            tabIndex={-1}
            ref={panelRef}
            className="mt-4 outline-none lg:mt-0"
          >
            {deciding && (
              <LoadingBlocks
                className="mt-2"
                label="Đang mở đúng phần bạn đang học"
                blocks={["h-6 w-1/2 rounded-full", "h-24", "h-40"]}
              />
            )}

            {!deciding && lesson.coach && (
              <LessonCoach
                key={step}
                lessonId={lesson.id}
                step={step}
                steps={steps.map((id) => ({ id, label: STEP_META[id].label }))}
                coach={lesson.coach}
                goal={goalNote?.body ?? null}
                counts={{
                  vocab: lesson.vocab.length,
                  grammar: lesson.grammar.length,
                  questions: practiceTotal,
                }}
              />
            )}

            {!deciding && step === "listen" && (
              <section aria-label="Nghe bài giảng" className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Nghe & tổng quan</h2>
                  <p className="mt-0.5 text-xs font-medium leading-5 text-ink-2">
                    Nghe bài giảng trước, rồi xem phần tổng quan bên dưới.
                  </p>
                  {!seen.listened && (
                    <StepNudge id="listen">Bắt đầu bằng Nghe. Chưa cần nhìn chữ.</StepNudge>
                  )}
                </div>
                {(lesson.vocab.length > 0 || lesson.grammar.length > 0) && (
                  <WholeLecture
                    lessonId={lesson.id}
                    onPlay={markListened}
                    pictures={lecturePictures(lesson)}
                    onSkip={{ label: "Học Từ vựng trước", go: () => goTo("vocab") }}
                  />
                )}
                {shownNotes.length > 0 && (
                  <LessonNotes notes={shownNotes} onOpenWriting={openWriting} />
                )}
              </section>
            )}

            {!deciding && step === "vocab" && (
              <section aria-label="Từ vựng">
                <h2 className="text-lg font-semibold">
                  Từ vựng ·{" "}
                  {shownVocab.length !== lesson.vocab.length
                    ? `${shownVocab.length}/${lesson.vocab.length} từ${kiipOnly ? " KIIP" : ""}`
                    : `${lesson.vocab.length} từ`}
                </h2>
                <div className="mt-2 flex items-center gap-1.5">
                  {hasKiip && (
                    <button
                      type="button"
                      aria-pressed={kiipOnly}
                      title="Chỉ phần thuộc chương trình Hội nhập xã hội (KIIP)"
                      onClick={() => {
                        setKiipPref(!kiipOnly);
                        writeLocal("kiip-only", !kiipOnly);
                      }}
                      className={cn(
                        "min-h-9 shrink-0 rounded-full border border-line px-3 text-[12px] font-semibold",
                        kiipOnly ? "bg-blue text-primary-foreground" : "bg-card text-ink-2",
                      )}
                    >
                      KIIP
                    </button>
                  )}
                  <VocabPriorityFilter
                    vocab={kiipScoped}
                    view={priorityView}
                    onChange={(v) => {
                      setPriorityPref(v);
                      writeLocal("vocab-priority", v);
                    }}
                  />
                  <ViewToggle
                    view={vocabView}
                    onChange={(v) => {
                      setVocabView(v);
                      writeLocal("vocab-view", v);
                    }}
                  />
                </div>
                <ChunkChips
                  feathers={vocabFeathers}
                  value={vocabPart?.id ?? "all"}
                  onChange={setVocabChunk}
                  allLabel={`Cả ${lesson.vocab.length} từ`}
                />
                {shownVocab.length === 0 ? (
                  <p className="mt-3 text-sm font-medium text-ink-2">
                    Bài này chưa có từ KIIP. Tắt bộ lọc để xem cả bài.
                  </p>
                ) : vocabView === "list" ? (
                  <VocabList vocab={shownVocab} />
                ) : (
                  <VocabFlashcards
                    key={vocabPart?.id ?? "all"}
                    vocab={shownVocab}
                    onReviewed={onVocabReviewed}
                    studied={vocabStudied}
                    onNext={
                      nextPart
                        ? { label: nextPart.label, go: () => openFeather(nextPart) }
                        : nextStep
                          ? { label: STEP_META[nextStep].label, go: () => goTo(nextStep) }
                          : undefined
                    }
                  />
                )}
              </section>
            )}

            {!deciding && step === "grammar" && (
              <section aria-label="Ngữ pháp">
                <h2 className="text-lg font-semibold">
                  Ngữ pháp ·{" "}
                  {kiipOnly
                    ? `${shownGrammar.length}/${lesson.grammar.length} mẫu KIIP`
                    : `${lesson.grammar.length} mẫu`}
                </h2>
                <StepNudge id="grammar">
                  Đọc mẫu xong, tự đặt một câu của bạn rồi hãy sang Luyện tập.
                </StepNudge>
                <div className="mt-3 empty:hidden">
                  <CoachWatchOut coach={lesson.coach} />
                </div>
                <ChunkChips
                  feathers={grammarFeathers}
                  value={grammarPart?.id ?? "all"}
                  onChange={setGrammarChunk}
                  allLabel={`Cả ${lesson.grammar.length} mẫu`}
                />
                {shownGrammar.length === 0 ? (
                  <p className="mt-3 text-sm font-medium text-ink-2">
                    Bài này chưa có mẫu ngữ pháp KIIP. Tắt bộ lọc để xem cả bài.
                  </p>
                ) : (
                  <GrammarCards
                    grammar={shownGrammar}
                    onReviewed={onGrammarReviewed}
                    placement={placed}
                    verdicts={grammarVerdicts}
                  />
                )}
              </section>
            )}

            {!deciding && step === "practice" && (
              <section aria-label="Luyện tập">
                <h2 className="text-lg font-semibold">Luyện tập</h2>
                <p className="mt-0.5 text-xs font-medium leading-5 text-ink-2">
                  Nghe, đọc, viết, nói — chấm ngay khi bạn trả lời.
                </p>
                {kiipOnly && (
                  <p className="mt-2 rounded-[12px] bg-yellow-soft px-3 py-2 text-xs font-medium leading-5">
                    Bộ lọc KIIP chỉ áp cho Từ vựng và Ngữ pháp. Bài luyện vẫn gồm cả bài, nên có từ
                    ngoài KIIP.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setKiipPref(false);
                        writeLocal("kiip-only", false);
                      }}
                      className="font-semibold underline"
                    >
                      Tắt bộ lọc
                    </button>
                  </p>
                )}
                {/* a signed-out learner already sees the panel's own sign-in notice: one note per screen */}
                {auth.isAuthenticated &&
                  (allPracticeDone ? (
                    <StepNudge id="practice-done">
                      Xong rồi. Mai quay lại ôn vài phút, Haru sẽ nhắc những gì sắp quên.
                    </StepNudge>
                  ) : (
                    <StepNudge id="practice">
                      {lesson.coach
                        ? "Sai câu nào, đọc giải thích rồi chép lại câu đúng. Câu sai tự vào Sổ lỗi sai."
                        : "Sai câu nào, đọc giải thích rồi chép lại câu đúng vào sổ của bạn."}
                    </StepNudge>
                  ))}
                {hasMistakeBook && (
                  <Link
                    to="/mistakes"
                    onClick={() => tap()}
                    className="hit-area mt-3 flex min-h-11 items-center gap-2.5 rounded-[14px] border border-line bg-card px-3.5 py-2 text-xs font-semibold shadow-elev-1 active:scale-[0.97]"
                  >
                    <BookX size={16} strokeWidth={2.4} aria-hidden="true" className="shrink-0" />
                    <span className="min-w-0 flex-1">Sổ lỗi sai</span>
                    {mistakesToRead > 0 && (
                      <span className="shrink-0 rounded-full bg-danger-soft px-2.5 py-0.5 text-[12px] text-danger">
                        {mistakesToRead} câu cần đọc lại
                      </span>
                    )}
                    <ArrowRight
                      size={15}
                      strokeWidth={2.6}
                      aria-hidden="true"
                      className="shrink-0"
                    />
                  </Link>
                )}
                <PracticePanel
                  key={practiceKey}
                  lessonId={lesson.id}
                  onOpenGrammar={() => goTo("grammar")}
                />
                <div className="mt-4 empty:hidden">
                  <CoachWrapUp coach={lesson.coach} />
                </div>
                {auth.isAuthenticated && lesson.vocab.length > 0 && (
                  <PracticeOnward lessonId={lesson.id} title={lesson.title} />
                )}
              </section>
            )}

            {/* the way on, at the foot of the content (the step tabs above stay pinned) */}
            {!deciding && (
              <StepFooter>
                {nextPart ? (
                  <NextStepButton
                    label={`Tiếp: ${nextPart.label}`}
                    onClick={() => openFeather(nextPart)}
                  />
                ) : nextStep ? (
                  <NextStepButton
                    label={STEP_META[step].next ?? ""}
                    onClick={() => goTo(nextStep)}
                  />
                ) : (
                  <Link to="/lesson" onClick={() => tap()} className={endStepClass}>
                    Chọn bài khác <ArrowRight size={16} strokeWidth={2.8} />
                  </Link>
                )}
              </StepFooter>
            )}
          </div>
        )}
      </div>
      {doneScene && (
        <LessonFeathersDone
          count={feathers.length}
          chapter={studyData?.chapter ?? null}
          star={studyData?.chapter == null && !!studyData?.support}
          onClose={() => setDoneScene(false)}
        />
      )}
    </Shell>
  );
}

function LessonScreen() {
  const { id } = Route.useParams();
  const query = useQuery({ queryKey: ["lesson", id], queryFn: () => getLesson(id) });

  if (query.isLoading) {
    return (
      <Shell>
        <LoadingBlocks
          className="mt-10"
          label="Đang tải bài học"
          blocks={["h-6 w-2/3 rounded-full", "h-4 w-1/2 rounded-full", "h-16", "h-40"]}
        />
      </Shell>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Shell>
        {notFound ? (
          <EmptyState
            className="mt-10"
            title="Không tìm thấy bài học này."
            hint="Bài học có thể đã được thay đổi — chọn lại trong danh sách nhé."
            action={
              <Link
                to="/lesson"
                className="hit-area mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-xs font-semibold shadow-elev-1"
              >
                Tất cả bài học
              </Link>
            }
          />
        ) : (
          <ErrorState
            className="mt-10"
            title="Không tải được bài học."
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isRefetching}
          />
        )}
      </Shell>
    );
  }

  // keyed by lesson so moving between lessons never carries a step or a deck over
  const lesson = query.data!;
  if (isLocked(lesson.access)) return <LockedLessonView key={lesson.id} lesson={lesson} />;
  if (lesson.kind === "hangul") return <HangulLessonView key={lesson.id} lesson={lesson} />;
  return lesson.kind === "review" ? (
    <ReviewView key={lesson.id} lesson={lesson} />
  ) : (
    <LessonView key={lesson.id} lesson={lesson} />
  );
}
