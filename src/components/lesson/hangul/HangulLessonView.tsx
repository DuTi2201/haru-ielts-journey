import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ClipboardCheck } from "lucide-react";

import { FeatherGlyph } from "@/components/feathers/Feather";
import { FeatherStrip } from "@/components/feathers/FeatherStrip";
import { LessonFeathersDone } from "@/components/feathers/LessonFeathersDone";
import { SwanFigure } from "@/components/journey/Journey";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { useAuth } from "@/hooks/use-auth";
import { useTextAudio } from "@/hooks/use-text-audio";
import { errorMessage } from "@/lib/api/client";
import {
  finishLessonPart,
  getLessonPractice,
  getLessonProgress,
  getLessonStudy,
  listLessons,
} from "@/lib/api/content";
import type {
  FeatherOut,
  HangulOut,
  HangulPartOut,
  LessonOut,
  LessonStudyOut,
} from "@/lib/api/types";
import { success, tap } from "@/lib/feedback";
import { readLocal, writeLocal } from "@/lib/lesson-local";
import { lessonProgressKey, lessonStudyKey } from "@/lib/lesson-meta";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { BackToLessons, endStepClass, Shell, StepFooter } from "../LessonShell";
import { PracticePanel } from "../PracticePanel";
import { Ko, Rich } from "../Rich";
import {
  BlockBuilder,
  BlockShapes,
  ExplainCard,
  GuidedKeyboard,
  KeyboardSetup,
  LetterGroup,
  ListenPick,
  PatchimSorter,
  ReadWords,
  SoundRule,
} from "./parts";
import { SayContext, ViHintContext, type Say } from "./say";
import { PairDrill } from "./coach";
import { StrokeOrder } from "./StrokeOrder";
import { PrepTour } from "./PrepTour";
import { PAIRS } from "./pairs";
import "./hangul.css";

/* Bài 1 · Bảng chữ cái & phát âm. Five short parts, each built backwards from Nền tảng 1 (every
 * word read here is one of that lesson's), then the 20-question end check that counts the lesson
 * as studied. Six feathers, as every lesson has its own (components/feathers): one per part, one
 * for the check. The swan of chapter I sits in the dark tower and says one short line for each
 * part finished. A signed-in learner's parts are kept on the server (they count toward chapter
 * I); a signed-out one's on this device. */

type Tab = string; // a part id (p1…p5) or "check"
const CHECK = "check";

/** Blocks drawn taken apart where a part introduces the shape of a block. */
const SHAPES: Record<string, { ch: string; caption: string }[]> = {
  p1: [
    { ch: "아", caption: "Nguyên âm đứng: bên phải" },
    { ch: "오", caption: "Nguyên âm nằm: bên dưới" },
  ],
  p4: [
    { ch: "학", caption: "Patchim nằm ở đáy" },
    { ch: "방", caption: "ㅇ ở đáy đọc «ng»" },
  ],
};

const shortTitle = (p: HangulPartOut) => p.title_vi.split(/[&:]/)[0]!.trim();

/** The letters taught up to and including a part: the pieces the block builder offers. */
function taughtUpTo(h: HangulOut, partIndex: number): string[] {
  const out: string[] = [];
  h.parts
    .slice(0, partIndex + 1)
    .forEach((p) => p.groups.forEach((g) => g.letters.forEach((l) => out.push(l.jamo))));
  return [...new Set(out)];
}

function SwanCard({ line, share }: { line: string; share: number }) {
  return (
    <div
      className="hg-night relative overflow-hidden rounded-[22px] p-3 pr-4 text-[oklch(0.97_0.01_90)] shadow-elev-2"
      style={{ "--lit": share } as CSSProperties}
    >
      <div className="relative flex items-center gap-3">
        <SwanFigure stage={1} className="h-[84px] w-[84px]" label="Thiên nga trong tháp gai" />
        <p
          key={line}
          className="hg-line min-w-0 flex-1 text-[13px] font-semibold leading-5"
          aria-live="polite"
        >
          {line}
        </p>
      </div>
    </div>
  );
}

function Tabs({
  parts,
  active,
  lit,
  onPick,
}: {
  parts: HangulPartOut[];
  active: Tab;
  lit: string[];
  onPick: (t: Tab) => void;
}) {
  const tabs = [
    ...parts.map((p, n) => ({
      id: p.id,
      label: shortTitle(p),
      n: n + 1,
      done: lit.includes(p.id),
    })),
    { id: CHECK, label: "Kiểm tra", n: 0, done: false },
  ];
  return (
    <div
      role="tablist"
      aria-label="Các phần của bài"
      className="grid grid-cols-6 gap-1 lg:grid-cols-1 lg:gap-1.5"
    >
      {tabs.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`hg-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`hg-panel-${t.id}`}
            onClick={() => onPick(t.id)}
            className={cn(
              "hit-area flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-[14px] border border-line px-0.5 py-1 text-center transition-colors lg:min-h-11 lg:flex-row lg:justify-start lg:gap-2.5 lg:px-3 lg:text-left",
              selected ? "bg-blue text-primary-foreground shadow-elev-1" : "bg-card text-ink",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                t.done
                  ? "bg-yellow-soft text-ink"
                  : selected
                    ? "bg-primary-foreground text-blue-deep"
                    : "bg-progress text-ink-2",
              )}
            >
              {t.done ? (
                <FeatherGlyph look="earned" size={18} />
              ) : t.id === CHECK ? (
                <ClipboardCheck size={13} strokeWidth={2.6} />
              ) : (
                t.n
              )}
            </span>
            <span className="line-clamp-2 text-[11px] font-semibold leading-[13px] lg:text-[13px] lg:leading-4">
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** «Hiện mốc chữ Việt»: off by default, so the ear meets the Korean sound before the eye reads a
 * Vietnamese letter; the mouth cue on each card is there instead. */
function ViToggle() {
  const vi = useContext(ViHintContext);
  return (
    <label className="mb-2 flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-[14px] bg-paper px-3 text-[12.5px] font-semibold">
      <span>
        Hiện mốc chữ Việt <span className="font-medium text-ink-2">(chỉ là gần đúng)</span>
      </span>
      <input type="checkbox" checked={vi.on} onChange={vi.toggle} className="h-5 w-5 accent-blue" />
    </label>
  );
}

/** One step of a part: a single screen (a title, a line on how to do it, the activity). */
interface PartStep {
  key: string;
  title: string;
  hint?: string;
  node: ReactNode;
}

/** A part as short steps, one screen each, in the order they were stacked before: what the part is
 * for and how it works, then each activity. Nothing is dropped; «Cả phần» shows them all. */
function partSteps(
  part: HangulPartOut,
  hangul: HangulOut,
  index: number,
  onPrep: () => void,
): PartStep[] {
  const pool = taughtUpTo(hangul, index);
  const shapes = SHAPES[part.id];
  const steps: PartStep[] = [];
  const goal = (
    <div className="mb-4 rounded-[14px] bg-blue-soft px-3.5 py-2.5 text-blue-deep">
      <p className="text-[11px] font-bold uppercase tracking-wide">Xong phần này bạn làm được</p>
      <p className="mt-0.5 text-[13px] font-semibold leading-5">
        <Rich text={part.goal_vi} />
      </p>
    </div>
  );
  // the first part's warm-up and "how letters work" are a full-screen walk-through (PrepTour) that
  // runs once; here it is one link to see it again
  const prep = part.id === "p1";
  steps.push({
    key: "intro",
    title: prep ? "Chuẩn bị" : "Hiểu cách chữ chạy",
    node: (
      <>
        {goal}
        {prep && (
          <button
            type="button"
            onClick={onPrep}
            className="hit-area min-h-11 rounded-full border border-line bg-card px-4 text-[13px] font-semibold"
          >
            Xem lại phần chuẩn bị (1 phút)
          </button>
        )}
        {!prep && (part.explain.length > 0 || shapes) && (
          <div className="grid gap-3">
            {part.explain.map((e) => (
              <ExplainCard key={e.title} title={e.title} body={e.body} />
            ))}
            {shapes && <BlockShapes items={shapes} />}
          </div>
        )}
      </>
    ),
  });
  if (part.groups.length > 0)
    steps.push({
      key: "letters",
      title: "Chạm để nghe",
      hint: "Chạm một chữ: nghe, xem khẩu hình, luyện 3 tốc độ, tự thu giọng mình.",
      node: (
        <>
          <ViToggle />
          {part.groups.map((g) => (
            <LetterGroup key={g.title_vi} group={g} />
          ))}
        </>
      ),
    });
  if (part.id === "p1")
    steps.push({
      key: "strokes",
      title: "Tập viết nét",
      hint: "Xem nét ① ② tự vẽ, rồi chép vào vở.",
      node: <StrokeOrder />,
    });
  if (PAIRS[part.id])
    steps.push({
      key: "pairs",
      title: "Nghe cặp dễ nhầm",
      hint: "Nghe liền nhau để tai bắt được độ chênh: khẩu hình, hơi, cao độ.",
      node: <PairDrill sets={PAIRS[part.id]!} />,
    });
  if (part.build.length > 0)
    steps.push({
      key: "build",
      title: "Ghép khối chữ",
      hint: "Chọn chữ cái theo thứ tự: đầu, nguyên âm, rồi đáy.",
      node: <BlockBuilder targets={part.build} pool={pool} />,
    });
  if (part.rules.length > 0)
    steps.push({
      key: "rules",
      title: "Viết một đằng, đọc một nẻo",
      hint: "Chạm loa để nghe và xem chữ đổi chỗ.",
      node: (
        <>
          {part.rules.map((r) => (
            <SoundRule key={r.title_vi} rule={r} />
          ))}
        </>
      ),
    });
  if (part.sort.length > 0)
    steps.push({
      key: "sort",
      title: "Nhìn đáy, chọn đuôi",
      hint: "Có patchim: 이에요. Không có: 예요.",
      node: <PatchimSorter words={part.sort} />,
    });
  if (part.words.length > 0)
    steps.push({
      key: "words",
      title: "Đọc từ của Nền tảng 1",
      hint: "Tự đọc thành tiếng trước, rồi chạm để kiểm tra.",
      node: <ReadWords words={part.words} />,
    });
  if (part.picks.length > 0)
    steps.push({ key: "picks", title: "Nghe và chọn", node: <ListenPick picks={part.picks} /> });
  if (part.keyboard.length > 0)
    steps.push({
      key: "keyboard",
      title: "Gõ chữ Hàn",
      hint: "Bàn phím điện thoại xếp y hệt bàn phím dưới đây.",
      node: (
        <>
          <GuidedKeyboard targets={part.keyboard} />
          <h3 className="mt-5 text-[14px] font-bold">Cài bàn phím tiếng Hàn</h3>
          <div className="mt-2">
            <KeyboardSetup />
          </div>
        </>
      ),
    });
  return steps;
}

/** The steps of a part as a row of segments with the current step's name: where you are, how many
 * are left. Each segment opens its step. */
function StepBar({
  steps,
  at,
  whole,
  onPick,
  onWhole,
}: {
  steps: PartStep[];
  at: number;
  whole: boolean;
  onPick: (n: number) => void;
  onWhole: () => void;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-semibold text-ink-2">
          {whole ? `Cả phần · ${steps.length} bước` : `Bước ${at + 1}/${steps.length}`}
        </p>
        <button
          type="button"
          onClick={onWhole}
          aria-pressed={whole}
          className={cn(
            "min-h-9 rounded-full px-3 text-[12px] font-semibold",
            whole ? "bg-blue-soft text-blue-deep" : "text-ink-2",
          )}
        >
          {whole ? "Từng bước" : "Cả phần"}
        </button>
      </div>
      {!whole && (
        <div className="mt-1.5 flex gap-1" role="group" aria-label="Các bước của phần">
          {steps.map((st, n) => (
            <button
              key={st.key}
              type="button"
              onClick={() => onPick(n)}
              aria-label={`Bước ${n + 1}: ${st.title}`}
              aria-current={n === at ? "step" : undefined}
              className="hit-area flex h-6 flex-1 items-center"
            >
              <span
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  n < at ? "bg-blue/60" : n === at ? "bg-blue" : "bg-progress",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StepView({ step }: { step: PartStep }) {
  return (
    <section>
      <h2 className="text-[18px] font-bold leading-6">{step.title}</h2>
      {step.hint && <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{step.hint}</p>}
      <div className="mt-3">{step.node}</div>
    </section>
  );
}

export function HangulLessonView({ lesson }: { lesson: LessonOut }) {
  const id = lesson.id;
  const panelRef = useRef<HTMLDivElement>(null);
  const audio = useTextAudio();
  const practice = useQuery({
    queryKey: ["lesson-practice", id],
    queryFn: () => getLessonPractice(id),
    staleTime: 10 * 60_000,
  });
  const lessons = useQuery({ queryKey: ["lessons"], queryFn: listLessons, staleTime: 5 * 60_000 });
  const hangul = practice.data?.hangul ?? null;
  const parts = useMemo(() => hangul?.parts ?? [], [hangul]);

  const auth = useAuth();
  const qc = useQueryClient();
  const study = useQuery({
    queryKey: lessonStudyKey(id),
    queryFn: () => getLessonStudy(id),
    enabled: auth.isAuthenticated,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const progress = useQuery({
    queryKey: lessonProgressKey(id),
    queryFn: () => getLessonProgress(id),
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
  });

  const [tab, setTab] = useState<Tab>(() => readLocal<string>(`hstep:${id}`, "p1"));
  // a signed-out learner's parts, on this device (a signed-in one's come from the server)
  const [localDone, setLocalDone] = useState<string[]>(() => readLocal<string[]>(`hlit:${id}`, []));
  const [justDone, setJustDone] = useState<string | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);

  // six feathers: the server's, earned as the parts and the check are done here; signed out, the
  // same six drawn from the parts on this device
  const feathers = useMemo<FeatherOut[]>(() => {
    const answered = new Set((progress.data?.results ?? []).map((r) => r.question_id));
    const server = study.data?.feathers;
    if (server?.length) {
      return server.map((f) =>
        f.earned
          ? f
          : f.kind === "part"
            ? { ...f, earned: !!f.part && localDone.includes(f.part) && !auth.isAuthenticated }
            : {
                ...f,
                earned: f.question_ids.length > 0 && f.question_ids.every((q) => answered.has(q)),
              },
      );
    }
    return [
      ...parts.map((p, n) => ({
        id: `h${n + 1}`,
        kind: "part" as const,
        label: p.title_vi,
        part: p.id,
        item_ids: [],
        question_ids: [],
        earned: localDone.includes(p.id),
      })),
      {
        id: "check",
        kind: "practice" as const,
        label: "Kiểm tra cuối bài",
        item_ids: [],
        question_ids: [],
        earned: false,
      },
    ];
  }, [study.data, progress.data, parts, localDone, auth.isAuthenticated]);
  const partDone = (pid: string) => feathers.some((f) => f.part === pid && f.earned);
  const doneIds = parts.filter((p) => partDone(p.id)).map((p) => p.id);
  const allParts = parts.length > 0 && doneIds.length === parts.length;
  const allFeathers = feathers.length > 0 && feathers.every((f) => f.earned);
  const line = justDone
    ? (parts.find((p) => p.id === justDone)?.swan_vi ?? "")
    : allParts
      ? (hangul?.done_vi ?? "")
      : doneIds.length > 0
        ? `${doneIds.length}/${parts.length} phần đã xong. Mỗi phần một cọng lông.`
        : "Mỗi phần xong, một cọng lông trắng mọc lại.";

  // the lesson's last feather: the short scene, once
  const [doneScene, setDoneScene] = useState(false);
  const wasDone = useRef<boolean | null>(null);
  const ready = !auth.isAuthenticated || (study.isFetchedAfterMount && !progress.isLoading);
  // the walk-through opens once, for a learner with nothing done yet (decided after progress loads,
  // so a returning learner never sees it flash)
  const prepChecked = useRef(false);
  useEffect(() => {
    if (!ready || prepChecked.current) return;
    prepChecked.current = true;
    if (!readLocal<boolean>("hangul:prep", false) && doneIds.length === 0 && localDone.length === 0)
      setPrepOpen(true);
  }, [ready, doneIds.length, localDone.length]);
  useEffect(() => {
    if (!ready || !feathers.length) return;
    if (wasDone.current === false && allFeathers) setDoneScene(true);
    wasDone.current = allFeathers;
  }, [ready, allFeathers, feathers.length]);

  const { play, stop, activeText, state } = audio;
  const say: Say = useMemo(
    () => ({
      play: (ko: string) => void play(ko),
      active: activeText,
      loading: state === "loading",
    }),
    [play, activeText, state],
  );

  const goTo = useCallback(
    (next: Tab) => {
      tap();
      stop();
      setTab(next);
      writeLocal(`hstep:${id}`, next);
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    },
    [id, stop],
  );

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    panelRef.current?.focus({ preventScroll: true });
  }, [tab]);

  const index = parts.findIndex((p) => p.id === tab);
  const part = parts[index];
  const nextPart = parts[index + 1];
  const steps = useMemo(
    () => (part && hangul ? partSteps(part, hangul, index, () => setPrepOpen(true)) : []),
    [part, hangul, index],
  );
  // where the learner is inside the part (kept per part on this device); «Cả phần» shows all
  const [stepAt, setStepAt] = useState<Record<string, number>>(() =>
    readLocal<Record<string, number>>(`hsub:${id}`, {}),
  );
  const [whole, setWhole] = useState<boolean>(() => readLocal<boolean>("hangul:whole", false));
  const at = Math.min(stepAt[tab] ?? 0, Math.max(0, steps.length - 1));
  const lastStep = whole || at >= steps.length - 1;
  const goStep = (n: number) => {
    tap();
    stop();
    const next = { ...stepAt, [tab]: n };
    setStepAt(next);
    writeLocal(`hsub:${id}`, next);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };
  const toggleWhole = () => {
    tap();
    setWhole((w) => {
      writeLocal("hangul:whole", !w);
      return !w;
    });
  };

  const finishPart = () => {
    if (!part) return;
    const next = localDone.includes(part.id) ? localDone : [...localDone, part.id];
    setLocalDone(next);
    writeLocal(`hlit:${id}`, next);
    setJustDone(part.id);
    if (auth.isAuthenticated && !partDone(part.id)) {
      void finishLessonPart(id, part.id)
        .then((list) => {
          qc.setQueryData<LessonStudyOut>(lessonStudyKey(id), (old) =>
            old ? { ...old, feathers: list } : old,
          );
          void qc.invalidateQueries({ queryKey: ["me", "plan"], refetchType: "none" });
        })
        .catch(() => undefined);
    } else if (!auth.isAuthenticated) success();
    goTo(nextPart ? nextPart.id : CHECK);
  };

  const following = useMemo(() => {
    const sort = lesson.sort_order ?? 0;
    return (lessons.data ?? []).find((l) => (l.sort_order ?? -1) === sort + 1) ?? null;
  }, [lessons.data, lesson.sort_order]);

  const body = () => {
    if (practice.isLoading) {
      return (
        <LoadingBlocks label="Đang tải bài học" blocks={["h-10 rounded-full", "h-40", "h-40"]} />
      );
    }
    if (practice.isError) {
      return (
        <ErrorState
          title="Không tải được bài học."
          message={errorMessage(practice.error)}
          onRetry={() => void practice.refetch()}
          retrying={practice.isRefetching}
        />
      );
    }
    if (!hangul || parts.length === 0) {
      return <EmptyState title="Bài học chưa sẵn sàng." hint="Quay lại sau một chút nhé." />;
    }
    return (
      <div
        id={`hg-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`hg-tab-${tab}`}
        ref={panelRef}
        tabIndex={-1}
        className="outline-none"
      >
        {part ? (
          <>
            <StepBar steps={steps} at={at} whole={whole} onPick={goStep} onWhole={toggleWhole} />
            {whole ? (
              <div className="space-y-9">
                {steps.map((st) => (
                  <StepView key={st.key} step={st} />
                ))}
              </div>
            ) : (
              steps[at] && <StepView key={`${part.id}-${steps[at].key}`} step={steps[at]} />
            )}
          </>
        ) : (
          <>
            <p className="rounded-[14px] bg-blue-soft px-3.5 py-2.5 text-[13px] font-semibold leading-5 text-blue-deep">
              20 câu cuối bài: nghe, đọc và gõ. Làm xong là bài được tính đã học.
            </p>
            <div className="mt-4">
              <PracticePanel lessonId={id} />
            </div>
          </>
        )}
      </div>
    );
  };

  const [viOn, setViOn] = useState<boolean>(() => readLocal<boolean>("hangul:vi-hint", false));
  const viHint = useMemo(
    () => ({
      on: viOn,
      toggle: () =>
        setViOn((v) => {
          writeLocal("hangul:vi-hint", !v);
          return !v;
        }),
    }),
    [viOn],
  );
  return (
    <SayContext.Provider value={say}>
      <ViHintContext.Provider value={viHint}>
        {prepOpen && (
          <PrepTour
            onClose={(seen, finished) => {
              if (seen) writeLocal("hangul:prep", true);
              setPrepOpen(false);
              if (finished && tab === "p1" && at === 0 && steps.length > 1) goStep(1);
            }}
          />
        )}
        <Shell>
          <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <header>
                <BackToLessons
                  topic={lesson.topics[0]?.name ?? null}
                  track={lesson.track ?? null}
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-yellow-soft px-2.5 py-0.5 text-[12px] font-semibold">
                    Nhập môn
                  </span>
                  <span className="text-[13px] font-semibold text-ink-2">
                    5 phần · khoảng 50 phút
                  </span>
                </div>
                {lesson.title_en && (
                  <Ko className="mt-2 block text-[13px] font-semibold text-ink-2">
                    {lesson.title_en}
                  </Ko>
                )}
                <h1 className="mt-0.5 text-2xl font-bold leading-tight">{lesson.title}</h1>
              </header>

              <div className="mt-3">
                <SwanCard line={line} share={doneIds.length / Math.max(1, parts.length)} />
              </div>

              <div className="sticky top-0 z-30 -mx-5 mt-3 bg-paper/95 px-5 py-2 backdrop-blur-sm lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                <Tabs parts={parts} active={tab} lit={doneIds} onPick={goTo} />
                {parts.length > 0 && (
                  <FeatherStrip
                    className="mt-2"
                    feathers={feathers}
                    current={
                      feathers.find((f) => f.part === tab)?.id ?? (tab === CHECK ? "check" : null)
                    }
                    ready={ready}
                    onPick={(f) => goTo(f.part ?? CHECK)}
                  />
                )}
              </div>
            </aside>

            <div className="mt-3 lg:mt-0">{body()}</div>
          </div>

          {hangul && (
            <StepFooter>
              {part && !lastStep ? (
                <div className="flex gap-2">
                  {at > 0 && (
                    <button
                      type="button"
                      onClick={() => goStep(at - 1)}
                      className="min-h-[52px] shrink-0 rounded-[16px] border border-line bg-card px-4 text-[14px] font-semibold"
                    >
                      Lùi
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => goStep(at + 1)}
                    className={cn(endStepClass, "!bg-blue !text-primary-foreground flex-1")}
                  >
                    Tiếp: {steps[at + 1]?.title}
                    <ArrowRight size={16} strokeWidth={2.8} />
                  </button>
                </div>
              ) : part ? (
                <button
                  type="button"
                  onClick={finishPart}
                  className={cn(endStepClass, "!bg-blue !text-primary-foreground")}
                >
                  <FeatherGlyph look="earned" size={20} />
                  {nextPart
                    ? `Xong phần ${index + 1} · Tiếp: ${shortTitle(nextPart)}`
                    : "Xong phần 5 · Làm kiểm tra"}
                </button>
              ) : following ? (
                <Link
                  to="/lesson/$id"
                  params={{ id: String(following.id) }}
                  onClick={() => tap()}
                  className={endStepClass}
                >
                  Vào {following.title.split("·")[0]!.trim()}{" "}
                  <ArrowRight size={16} strokeWidth={2.8} />
                </Link>
              ) : null}
            </StepFooter>
          )}
          {doneScene && (
            <LessonFeathersDone
              count={feathers.length}
              chapter={1}
              onClose={() => setDoneScene(false)}
            />
          )}
        </Shell>
      </ViHintContext.Provider>
    </SayContext.Provider>
  );
}
