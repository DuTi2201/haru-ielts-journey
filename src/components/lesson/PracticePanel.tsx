import { Fragment, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Ear, Info, LogIn, Mic, PenLine, BookOpenText, Puzzle } from "lucide-react";

import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { getLessonPractice, getLessonProgress } from "@/lib/api/content";
import type {
  ExerciseResultOut,
  LessonPracticeOut,
  LessonProgressOut,
  PracticeItem,
  PracticeSkill,
} from "@/lib/api/types";
import {
  isChallenge,
  mix,
  replan,
  START,
  step,
  type Level,
  type LevelChoice,
  type Run,
} from "@/lib/adaptive-practice";
import { readLocal, writeLocal } from "@/lib/lesson-local";
import { lessonProgressKey as progressKey } from "@/lib/lesson-meta";
import { cn } from "@/lib/utils";
import { BulletList, Disclosure, GuideBlocks } from "./Disclosure";
import { ExerciseView } from "./ExerciseView";
import { ChallengeTag, ItemSupport, LevelPicker, TypeIntro } from "./ItemSupport";
import { useAnswerSaver } from "./use-answer-saver";
import { LinkedGrammarContext } from "./linked-grammar-context";
import { MixReview } from "./MixReview";
import { Rich } from "./Rich";
import { SceneImagesContext } from "./scene-images-context";
import { Topik2Section } from "./Topik2Section";

/** Always shown in this order, whatever order the server's JSON happened to list them. */
const SKILLS: { id: PracticeSkill; label: string; icon: typeof Ear }[] = [
  { id: "listening", label: "Nghe", icon: Ear },
  { id: "reading", label: "Đọc", icon: BookOpenText },
  { id: "build", label: "Tạo câu", icon: Puzzle },
  { id: "writing", label: "Viết", icon: PenLine },
  { id: "speaking", label: "Nói", icon: Mic },
];

/** "Tạo câu" is a ladder; each rung gets a heading. Rung 5 is the learner's own text, the lesson's output. */
const RUNG_TITLE: Record<number, string> = {
  1: "Bước 1 · Xếp từ thành câu",
  2: "Bước 2 · Điền vào khung",
  3: "Bước 3 · Nối hai câu",
  4: "Bước 4 · Viết đoạn ngắn",
  5: "Bước 5 · Viết đoạn văn của bạn",
};
/** How many answers an item files (app.services.lesson_seed._question_ids). */
function questionCount(item: PracticeItem): number {
  if ("blanks" in item) return item.blanks.length;
  if ("questions" in item) return item.questions.length;
  return 1;
}

const rungOf = (item: PracticeItem): number | null => ("rung" in item ? (item.rung ?? null) : null);

/** One lesson's practice set — nghe, đọc, tạo câu, viết, nói — marked as the learner goes.
 * The set (answers included) comes from the server in one piece and is graded here;
 * each answer is then saved for signed-in learners, which is what feeds the lesson's
 * progress and the error log. */
export function PracticePanel({
  lessonId,
  onOpenGrammar,
}: {
  lessonId: number;
  /** Opens the lesson's own grammar tab (the "Kiến thức trong câu này" box links to it). */
  onOpenGrammar?: (() => void) | undefined;
}) {
  const auth = useAuth();
  const [skill, setSkill] = useState<PracticeSkill>(() => {
    const saved = readLocal<string>(`skill:${lessonId}`, "listening");
    return SKILLS.some((s) => s.id === saved) ? (saved as PracticeSkill) : "listening";
  });
  const [once, setOnce] = useState<boolean>(() => readLocal<boolean>("once", false));

  const practice = useQuery({
    queryKey: ["lesson-practice", lessonId],
    queryFn: () => getLessonPractice(lessonId),
    staleTime: 10 * 60_000,
  });
  const progress = useQuery({
    queryKey: progressKey(lessonId),
    queryFn: () => getLessonProgress(lessonId),
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
  });

  const linked = useMemo(
    () => ({
      cards: practice.data?.grammar ?? {},
      lessonId,
      signedIn: auth.isAuthenticated,
      openGrammar: onOpenGrammar,
    }),
    [practice.data?.grammar, lessonId, auth.isAuthenticated, onOpenGrammar],
  );

  const previous = useMemo(() => {
    const map: Record<string, ExerciseResultOut> = {};
    for (const r of progress.data?.results ?? []) map[r.question_id] = r;
    return map;
  }, [progress.data]);

  const { onAnswer: saveAnswer } = useAnswerSaver(lessonId);

  // Practice that follows the learner: warm items with a challenge now and then, the pace set by
  // runs of answers (src/lib/adaptive-practice.ts). `orders` keeps what each skill shows so that
  // answered items never move; `done` is what was answered in this sitting of the panel.
  const [choice, setChoice] = useState<LevelChoice>(() => {
    const saved = readLocal<string>("level", "auto");
    return saved === "support" || saved === "steady" || saved === "stretch" ? saved : "auto";
  });
  const [run, setRun] = useState<Run>(START);
  const [orders, setOrders] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());

  if (practice.isLoading) {
    return (
      <LoadingBlocks
        className="mt-4"
        label="Đang tải bài luyện tập"
        blocks={["h-10 rounded-full", "h-48", "h-48"]}
      />
    );
  }
  if (practice.isError) {
    return (
      <ErrorState
        className="mt-4"
        title="Không tải được bài luyện tập."
        message={errorMessage(practice.error)}
        onRetry={() => void practice.refetch()}
        retrying={practice.isRefetching}
      />
    );
  }
  const data: LessonPracticeOut = practice.data!;
  if (data.items.length === 0) {
    return (
      <EmptyState
        title="Bài này chưa có bài luyện tập."
        hint="Học từ vựng và ngữ pháp trước nhé."
      />
    );
  }

  const bySkill = (s: PracticeSkill) => data.items.filter((i) => i.skill === s);
  // the tabs count QUESTIONS, like the lesson's "Luyện tập x/y câu" (an item with ㉠ ㉡ or two
  // questions is two), so the numbers add up to the lesson's total
  const questionsIn = (s: PracticeSkill) => bySkill(s).reduce((n, it) => n + questionCount(it), 0);
  const available = SKILLS.filter((s) => bySkill(s.id).length > 0);
  const active = available.some((s) => s.id === skill) ? skill : (available[0]?.id ?? "listening");
  const baseItems = bySkill(active);
  const level: Level = choice === "auto" ? run.level : choice;
  // "Tạo câu" is a ladder of its own and keeps its order; so does a skill without a challenge
  const mixable =
    active !== "build" && baseItems.some(isChallenge) && baseItems.some((i) => !isChallenge(i));
  const answeredIds = (it: PracticeItem): boolean => {
    const ids = "questions" in it ? it.questions.map((q) => q.id) : [it.id];
    return done.has(it.id) || ids.some((q) => q in previous);
  };
  const orderKey = `${active}`;
  const items: PracticeItem[] = (() => {
    if (!mixable) return baseItems;
    const byId = new Map(baseItems.map((i) => [i.id, i]));
    const saved = orders[orderKey]?.map((id) => byId.get(id)).filter((x): x is PracticeItem => !!x);
    if (saved && saved.length === baseItems.length) return saved;
    // first time on this skill: answered items stay where the server put them, the rest is mixed
    const first = baseItems.filter(answeredIds);
    const rest = baseItems.filter((i) => !answeredIds(i));
    return [
      ...first,
      ...mix(
        rest.filter((i) => !isChallenge(i)),
        rest.filter(isChallenge),
        level,
      ),
    ];
  })();
  const reorder = (nextLevel: Level, answered: ReadonlySet<string>) => {
    if (!mixable) return;
    setOrders((o) => ({
      ...o,
      [orderKey]: replan(
        items,
        new Set(items.filter((i) => answered.has(i.id) || answeredIds(i)).map((i) => i.id)),
        nextLevel,
      ).map((i) => i.id),
    }));
  };
  const onAnswer: typeof saveAnswer = (a) => {
    saveAnswer(a);
    const nextDone = new Set(done).add(a.exerciseId);
    setDone(nextDone);
    const nextRun = step(run, a.correct);
    setRun(nextRun);
    if (choice === "auto" && nextRun.level !== run.level) reorder(nextRun.level, nextDone);
  };
  const pickLevel = (c: LevelChoice) => {
    setChoice(c);
    writeLocal("level", c);
    reorder(c === "auto" ? run.level : c, done);
  };
  const guide = data.guides[active] ?? [];
  const disclaimers = data.overview?.disclaimer_vi ?? [];
  // five tabs are too narrow for "label · count" on one line, so the count drops below the label
  const compactTabs = available.length > 4;

  return (
    <SceneImagesContext.Provider value={data.scene_images}>
      <LinkedGrammarContext.Provider value={linked}>
        <div className="mt-4 space-y-4">
          <ProgressLine
            progress={progress.data}
            signedIn={auth.isAuthenticated}
            anonymous={auth.isAnonymous}
          />

          {disclaimers.length > 0 && (
            <aside className="rounded-[14px] border border-transparent bg-yellow-soft px-3 py-2.5">
              <p className="flex gap-2 text-xs font-semibold leading-5">
                <Info size={15} strokeWidth={2.4} className="mt-0.5 shrink-0" />
                <Rich text={disclaimers[0]} />
              </p>
              {disclaimers.length > 1 && (
                <Disclosure title="Đọc thêm về bộ đề này" className="mt-2" tone="bg-card">
                  <BulletList items={disclaimers.slice(1)} />
                </Disclosure>
              )}
            </aside>
          )}

          <div
            role="tablist"
            aria-label="Kỹ năng luyện tập"
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${available.length}, minmax(0, 1fr))` }}
          >
            {available.map((s) => {
              const Icon = s.icon;
              const selected = s.id === active;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  id={`practice-tab-${s.id}`}
                  aria-selected={selected}
                  aria-controls="practice-panel"
                  onClick={() => {
                    setSkill(s.id);
                    writeLocal(`skill:${lessonId}`, s.id);
                  }}
                  className={cn(
                    "hit-area flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[14px] border border-line px-1 py-1.5 text-[12px] font-semibold transition-colors",
                    selected
                      ? "bg-blue text-primary-foreground shadow-elev-1"
                      : "bg-card text-ink-2",
                  )}
                >
                  <Icon size={16} strokeWidth={2.4} aria-hidden="true" />
                  {compactTabs ? (
                    <span className="flex flex-col items-center leading-tight">
                      <span>{s.label}</span>
                      <span className={cn("font-semibold", !selected && "text-ink-2")}>
                        {questionsIn(s.id)}
                      </span>
                    </span>
                  ) : (
                    <>
                      {s.label} · {questionsIn(s.id)}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div
            id="practice-panel"
            role="tabpanel"
            aria-labelledby={`practice-tab-${active}`}
            className="space-y-4"
          >
            {(active === "listening" || active === "speaking") && (
              <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[14px] bg-blue-soft px-3 py-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={once}
                  onChange={(e) => {
                    setOnce(e.target.checked);
                    writeLocal("once", e.target.checked);
                  }}
                  className="h-4 w-4 accent-blue"
                />
                <span>
                  Nghe một lần như thi thật{" "}
                  <span className="font-semibold text-ink-2">
                    (không nghe lại được khi đang làm)
                  </span>
                </span>
              </label>
            )}

            {guide.length > 0 && <GuideBlocks blocks={guide} />}

            {mixable && <LevelPicker choice={choice} level={level} onPick={pickLevel} />}

            {items.map((item, i) => {
              const rung = active === "build" ? rungOf(item) : null;
              const heading =
                rung !== null && rung !== (i > 0 ? rungOf(items[i - 1]!) : null)
                  ? RUNG_TITLE[rung]
                  : undefined;
              const intro =
                items.findIndex((x) => x.type === item.type) === i
                  ? data.type_intro?.[item.type]
                  : undefined;
              return (
                <Fragment key={item.id}>
                  {isChallenge(item) && <ChallengeTag />}
                  {intro && <TypeIntro name={intro.name_vi} how={intro.how_vi} />}
                  {item.support && (
                    <ItemSupport
                      support={item.support}
                      questionIds={
                        "questions" in item ? item.questions.map((q) => q.id) : [item.id]
                      }
                    />
                  )}
                  {heading && (
                    <h3 className="pt-1 text-sm font-semibold">
                      {heading}{" "}
                      <span className="text-xs font-semibold text-ink-2">
                        · {items.filter((x) => rungOf(x) === rung).length} câu
                      </span>
                    </h3>
                  )}
                  <ExerciseView
                    lessonId={lessonId}
                    item={item}
                    once={once}
                    previous={previous}
                    onAnswer={onAnswer}
                  />
                </Fragment>
              );
            })}
          </div>

          <Topik2Section lessonId={lessonId} />

          <MixReview lessonId={lessonId} onOpenGrammar={onOpenGrammar} />

          {data.overview && (data.overview.blocks?.length ?? 0) > 0 && (
            <Disclosure title="Cấu trúc đề TOPIK II & cách tính điểm" tone="bg-card">
              <GuideBlocks blocks={data.overview.blocks ?? []} open />
            </Disclosure>
          )}
        </div>
      </LinkedGrammarContext.Provider>
    </SceneImagesContext.Provider>
  );
}

function ProgressLine({
  progress,
  signedIn,
  anonymous,
}: {
  progress: LessonProgressOut | undefined;
  signedIn: boolean;
  anonymous: boolean;
}) {
  if (anonymous) {
    return (
      <Link
        to="/support-language"
        className="hit-area flex items-center gap-2.5 rounded-[14px] border border-transparent bg-yellow-soft px-3 py-2.5 text-xs font-semibold leading-5 active:scale-[0.98] motion-reduce:transition-none"
      >
        <LogIn size={15} strokeWidth={2.4} className="shrink-0" />
        <span>Đăng nhập để lưu kết quả từng câu và đưa câu sai vào sổ lỗi.</span>
      </Link>
    );
  }
  if (!signedIn || !progress) return null;
  const pct = progress.total > 0 ? Math.round((progress.answered / progress.total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold text-ink-2">
        <span>
          Đã làm {progress.answered}/{progress.total} câu
        </span>
        <span>Đúng {progress.correct}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Tiến độ luyện tập của bài"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.answered}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-progress"
      >
        <div
          className="h-full rounded-full bg-blue transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${Math.max(pct, progress.answered > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  );
}

/** A few of a lesson's items, in the lesson's order, marked and saved as in the full panel: the
 * questions that close a sitting, or one sitting's practice (lesson-sessions.ts). */
export function PracticeSubset({
  lessonId,
  itemIds,
  onOpenGrammar,
}: {
  lessonId: number;
  itemIds: readonly string[];
  onOpenGrammar?: (() => void) | undefined;
}) {
  const auth = useAuth();
  const practice = useQuery({
    queryKey: ["lesson-practice", lessonId],
    queryFn: () => getLessonPractice(lessonId),
    staleTime: 10 * 60_000,
  });
  const progress = useQuery({
    queryKey: progressKey(lessonId),
    queryFn: () => getLessonProgress(lessonId),
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
  });
  const linked = useMemo(
    () => ({
      cards: practice.data?.grammar ?? {},
      lessonId,
      signedIn: auth.isAuthenticated,
      openGrammar: onOpenGrammar,
    }),
    [practice.data?.grammar, lessonId, auth.isAuthenticated, onOpenGrammar],
  );
  const previous = useMemo(() => {
    const map: Record<string, ExerciseResultOut> = {};
    for (const r of progress.data?.results ?? []) map[r.question_id] = r;
    return map;
  }, [progress.data]);
  const { onAnswer } = useAnswerSaver(lessonId);

  if (practice.isLoading)
    return <LoadingBlocks className="mt-4" label="Đang tải câu hỏi" blocks={["h-48", "h-48"]} />;
  if (practice.isError)
    return (
      <ErrorState
        className="mt-4"
        title="Không tải được câu hỏi."
        message={errorMessage(practice.error)}
        onRetry={() => void practice.refetch()}
        retrying={practice.isRefetching}
      />
    );
  const data = practice.data!;
  const wanted = new Set(itemIds);
  const items = data.items.filter((i) => wanted.has(i.id));
  return (
    <SceneImagesContext.Provider value={data.scene_images}>
      <LinkedGrammarContext.Provider value={linked}>
        <div className="mt-3 space-y-4">
          {items.map((item, i) => {
            const intro =
              items.findIndex((x) => x.type === item.type) === i
                ? data.type_intro?.[item.type]
                : undefined;
            return (
              <Fragment key={item.id}>
                {intro && <TypeIntro name={intro.name_vi} how={intro.how_vi} />}
                {item.support && (
                  <ItemSupport
                    support={item.support}
                    questionIds={"questions" in item ? item.questions.map((q) => q.id) : [item.id]}
                  />
                )}
                <ExerciseView
                  lessonId={lessonId}
                  item={item}
                  once={false}
                  previous={previous}
                  onAnswer={onAnswer}
                />
              </Fragment>
            );
          })}
        </div>
      </LinkedGrammarContext.Provider>
    </SceneImagesContext.Provider>
  );
}
