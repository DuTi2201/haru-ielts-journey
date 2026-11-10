import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Lock,
  LogIn,
  Play,
  Trophy,
} from "lucide-react";

import { CountUp, MascotTalk, Ring, Rise, Stage } from "@/components/haru/cinema";
import { Mascot } from "@/components/mascot/Mascot";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { TabBar } from "@/components/haru/TabBar";
import { HowToLearnCard } from "@/components/lesson/HowToLearnCard";
import { LessonImage } from "@/components/lesson/LessonImage";
import { Ko } from "@/components/lesson/Rich";
import { errorMessage } from "@/lib/api/client";
import { listLessons } from "@/lib/api/content";
import type { LessonSummaryOut, LessonTrack } from "@/lib/api/types";
import { isLocked, useCatalog } from "@/lib/billing";
import { examLabel, kiipLine, kiipStats } from "@/lib/exam";
import { tap } from "@/lib/feedback";
import {
  groupByTopic,
  isSupplementTopic,
  lessonMinutes,
  lessonTimeLine,
  TRACK_LABEL,
  TRACK_ORDER,
  TRACK_TONE,
  topicStats,
  topicTitle,
  type TopicGroup,
} from "@/lib/lesson-meta";
import { cn } from "@/lib/utils";
import { FeatherGlyph } from "@/components/feathers/Feather";

export const Route = createFileRoute("/lesson/")({
  head: () => ({
    meta: [
      { title: "Chọn bài học — Haru English" },
      { name: "description", content: "Chọn bài học tiếng Anh IELTS theo trình độ và chủ đề." },
      { property: "og:title", content: "Chọn bài học — Haru English" },
      { property: "og:description", content: "Chọn bài học tiếng Anh IELTS theo trình độ và chủ đề." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // ?topic=…&track=…: the lessons of one topic (the main view lists the topics)
  validateSearch: (
    raw: Record<string, unknown>,
  ): { topic?: string | undefined; track?: LessonTrack | undefined } => {
    const topic = typeof raw["topic"] === "string" ? raw["topic"].trim().slice(0, 120) : "";
    const track = TRACK_ORDER.find((t) => t === raw["track"]);
    return { ...(topic ? { topic } : {}), ...(topic && track ? { track } : {}) };
  },
  component: LessonPickerScreen,
});

const itemCount = (l: LessonSummaryOut) => l.vocab_count + l.grammar_count;

function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className="h-1.5 overflow-hidden rounded-full bg-progress"
    >
      <div
        className="h-full rounded-full bg-blue transition-[width] duration-300 motion-reduce:transition-none"
        style={{ width: `${total > 0 ? Math.max((done / total) * 100, done > 0 ? 4 : 0) : 0}%` }}
      />
    </div>
  );
}

/** The one lesson to pick up where the learner left off (signed-in only). */
function ContinueCard({ lesson }: { lesson: LessonSummaryOut }) {
  const total = itemCount(lesson);
  const done = lesson.mastered ?? 0;
  const practiced = lesson.practice_answered ?? 0;
  const started = done > 0 || practiced > 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Link
      to="/lesson/$id"
      params={{ id: String(lesson.id) }}
      onClick={() => tap()}
      className="group mt-5 block rounded-[32px] transition-transform hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transition-none"
    >
      <Stage as="div" className="p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-75">
              {started ? "Học tiếp" : "Bài tiếp theo"}
            </p>
            {lesson.title_en && (
              <Ko className="mt-1.5 block text-[13px] font-semibold opacity-80">
                {lesson.title_en}
              </Ko>
            )}
            <p className="mt-0.5 text-[20px] font-extrabold leading-snug">{lesson.title}</p>
            <p className="mt-1.5 text-[12px] font-semibold opacity-80">
              {!started
                ? `Bài mới · ${lessonTimeLine(lesson)}`
                : `Đã nhớ ${done}/${total}${practiced > 0 ? ` · luyện ${practiced}/${lesson.practice?.questions ?? 0} câu` : ""}`}
            </p>
          </div>
          <Ring pct={pct} size={84} stroke={8} label={`Đã nhớ ${pct}% bài ${lesson.title}`}>
            <p className="text-[18px] font-extrabold leading-none">
              <CountUp value={pct} />
              <span className="text-[11px]">%</span>
            </p>
          </Ring>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <span className="inline-flex min-h-11 items-center gap-2 rounded-[14px] bg-card px-5 text-[14px] font-bold text-blue-deep shadow-elev-2 transition-transform group-hover:translate-x-0.5">
            <Play size={14} strokeWidth={2.8} /> {started ? "Tiếp tục học" : "Bắt đầu học"}
          </span>
          <Mascot mood="reading" className="-mb-2 h-20 w-20" />
        </div>
      </Stage>
    </Link>
  );
}

/** A lesson as the list shows it: its picture, its name, its level and how long it takes. The rest
 * (words, cards, KIIP, feathers, what the learner has done) is inside the lesson; here only a mark
 * for done, locked or next. */
function LessonCard({ lesson, number }: { lesson: LessonSummaryOut; number: number }) {
  const review = lesson.kind === "review";
  const total = itemCount(lesson);
  const tracked = review ? lesson.practice_answered != null : lesson.mastered !== null;
  const done = lesson.mastered ?? 0;
  const finished = !review && tracked && total > 0 && done >= total;
  const started = !finished && (done > 0 || (lesson.practice_answered ?? 0) > 0);
  const locked = isLocked(lesson.access);
  const minutes = review
    ? Math.max(10, (lesson.practice?.questions ?? 0) * 0.6)
    : lessonMinutes(lesson);
  return (
    <Link
      to="/lesson/$id"
      params={{ id: String(lesson.id) }}
      onClick={() => tap()}
      className="card-soft flex h-full items-center gap-3 rounded-[20px] bg-card p-2.5 pr-3.5 transition-transform active:scale-[0.98] motion-reduce:transition-none"
    >
      <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[14px] bg-progress">
        {!review && lesson.image_url ? (
          <LessonImage src={lesson.image_url} className="h-full w-full rounded-none border-0" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[15px] font-bold text-ink-2">
            {review ? <Trophy size={20} strokeWidth={2.4} /> : number}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[15px] font-semibold leading-snug">
          {lesson.title}
        </span>
        <span className="mt-1 flex items-center gap-3 text-[12px] font-semibold text-ink-2">
          <LevelBars track={lesson.track ?? null} />
          <span className="flex items-center gap-1">
            <Clock size={12} strokeWidth={2.4} aria-hidden="true" /> {roundMinutes(minutes)} phút
          </span>
        </span>
      </span>
      {locked ? (
        <Lock
          size={16}
          strokeWidth={2.4}
          className="shrink-0 text-ink-2"
          aria-label="Cần mở khoá"
        />
      ) : finished ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green text-white">
          <Check size={15} strokeWidth={3} aria-label="Đã thuộc" />
        </span>
      ) : lesson.is_next ? (
        <span className="shrink-0 rounded-full bg-blue px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
          Tiếp
        </span>
      ) : started ? (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue" aria-label="Đang học" />
      ) : (
        <ChevronRight size={18} strokeWidth={2.4} className="shrink-0 text-ink-2" />
      )}
    </Link>
  );
}

/** "Sơ cấp" with one bar of three lit, "Trung cấp" two, "Cao cấp" three. */
function LevelBars({ track }: { track: LessonTrack | null }) {
  if (!track) return null;
  const lit = TRACK_ORDER.indexOf(track) + 1;
  const tone =
    track === "beginner" ? "bg-green" : track === "intermediate" ? "bg-blue" : "bg-purple";
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn("h-3 w-1 rounded-full", n <= lit ? tone : "bg-line")} />
        ))}
      </span>
      {TRACK_LABEL[track]}
    </span>
  );
}

/** Minutes, by fives above a quarter hour (≈ 45 phút, not 43). */
const roundMinutes = (m: number) => (m < 15 ? Math.max(5, Math.round(m)) : Math.round(m / 5) * 5);

/** "15 bài + 1 bài ôn tập · đã xong 3/15": how big the topic is and how far in the learner is,
 * not the sum of its words and questions (those are on each lesson, and only ever overwhelmed). */
function topicLine(st: ReturnType<typeof topicStats>) {
  const parts = [st.review ? `${st.count} bài + 1 bài ôn tập` : `${st.count} bài`];
  if (st.lessonsDone !== null && st.lessonsDone > 0)
    parts.push(`đã xong ${st.lessonsDone}/${st.count}`);
  return parts.join(" · ");
}

const topicSearch = (g: TopicGroup) => ({ topic: g.topic, ...(g.track ? { track: g.track } : {}) });

/** Inside a topic: how much of it the KIIP course needs too, by stage, and how much of that the
 * learner has already got. */
function KiipCoverage({ lessons }: { lessons: LessonSummaryOut[] }) {
  const k = kiipStats(lessons);
  if (k.total + k.notes === 0) return null;
  const all = lessons.filter((l) => l.kind !== "review").length;
  const done = k.mastered ?? 0;
  return (
    <section
      aria-label="Độ phủ KIIP của chủ đề"
      className="mt-4 rounded-[16px] border border-transparent bg-blue-soft px-3.5 py-3 lg:max-w-[480px]"
    >
      <h2 className="text-xs font-semibold text-blue-deep">Độ phủ KIIP của chủ đề</h2>
      <p className="mt-1 text-xs font-medium leading-5 text-ink">
        {kiipLine(k)} gắn nhãn KIIP, trải trên {k.lessons}/{all} bài.
      </p>
      {k.stages.length > 0 && (
        <p className="mt-1.5 flex flex-wrap gap-1.5">
          {k.stages.map(({ tag, n }) => (
            <span
              key={tag}
              className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-blue-deep"
            >
              {examLabel(tag)} · {n}
            </span>
          ))}
        </p>
      )}
      {k.mastered !== null && k.total > 0 && (
        <div className="mt-2.5">
          <ProgressBar done={done} total={k.total} label="Từ và mẫu KIIP đã nhớ" />
          <p className="mt-1 text-[12px] font-semibold text-ink-2">
            Đã nhớ {done}/{k.total} từ & mẫu ngữ pháp KIIP
          </p>
        </div>
      )}
    </section>
  );
}

/** One topic of the picker: its pictures, what it holds and how far the learner is.
 * `showTrack` adds the level, for a list that mixes levels (the supplementary topics). */
/** A topic as the list shows it: a picture, its name, its level, how many lessons and how many
 * done. */
function TopicCard({ group, showTrack = false }: { group: TopicGroup; showTrack?: boolean }) {
  const st = topicStats(group.lessons);
  const lockedCount = group.lessons.filter((l) => isLocked(l.access)).length;
  const count = st.count + (st.review ? 1 : 0);
  const pic = st.pictures[0];
  return (
    <Link
      to="/lesson"
      search={topicSearch(group)}
      onClick={() => tap()}
      className="card-soft flex h-full items-center gap-3 rounded-[20px] bg-card p-2.5 pr-3.5 transition-transform active:scale-[0.98] motion-reduce:transition-none"
    >
      <span className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px] bg-progress">
        {pic && <LessonImage src={pic} className="h-full w-full rounded-none border-0" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[15px] font-semibold leading-snug">
          {group.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ink-2">
          <LevelBars track={group.track} />
          <span>{st.lessonsDone ? `${st.lessonsDone}/${count} bài` : `${count} bài`}</span>
          {st.feathers && (
            <span
              className="inline-flex items-center gap-0.5"
              aria-label={`${st.feathers.earned} trên ${st.feathers.total} lông thiên nga`}
            >
              <FeatherGlyph look={isSupplementTopic(group.topic) ? "star" : "earned"} size={14} />
              <span aria-hidden="true">
                {st.feathers.earned}/{st.feathers.total}
              </span>
            </span>
          )}
          {lockedCount > 0 && <Lock size={12} strokeWidth={2.4} aria-label="Có bài cần mở khoá" />}
        </span>
      </span>
      {st.finished ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green text-white">
          <Check size={15} strokeWidth={3} aria-label="Đã thuộc" />
        </span>
      ) : st.hasNext ? (
        <span className="shrink-0 rounded-full bg-blue px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
          Tiếp
        </span>
      ) : (
        <ChevronRight size={18} strokeWidth={2.4} className="shrink-0 text-ink-2" />
      )}
    </Link>
  );
}

/** Shown while some lessons are locked: how many, and the way to the price list. */
function UnlockBanner({ count }: { count: number }) {
  const { selling, catalog } = useCatalog();
  if (!selling || !catalog) return null;
  return (
    <Link
      to="/pricing"
      onClick={() => tap()}
      className="hit-area card-soft mt-3 flex items-center gap-2.5 rounded-[18px] bg-yellow-soft px-4 py-3 text-xs font-semibold leading-5 active:scale-[0.98] motion-reduce:transition-none lg:max-w-[480px]"
    >
      <Lock size={16} strokeWidth={2.4} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 flex-1">
        {count} bài còn khoá. Bài 1–{catalog.free_lesson_max} học miễn phí; xem các gói để mở thêm.
      </span>
      <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" className="shrink-0" />
    </Link>
  );
}

/** Inside a topic: its lessons. */
function TopicLessons({ group }: { group: TopicGroup }) {
  const st = topicStats(group.lessons);
  const done = st.mastered ?? 0;
  const supplement = isSupplementTopic(group.topic);
  return (
    <>
      <header>
        <Link
          to="/lesson"
          onClick={() => tap()}
          className="hit-area -ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-semibold text-blue-deep active:scale-95"
        >
          <ArrowLeft size={15} strokeWidth={2.6} /> Tất cả chủ đề
        </Link>
        {(group.track || supplement) && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            {group.track && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                  TRACK_TONE[group.track],
                )}
              >
                {TRACK_LABEL[group.track]}
              </span>
            )}
            {supplement && (
              <span className="rounded-full bg-yellow-soft px-2.5 py-0.5 text-[12px] font-semibold">
                Bổ trợ
              </span>
            )}
          </p>
        )}
        <h1 className="mt-1.5 flex items-start gap-2 text-2xl font-bold leading-tight">
          <BookOpen size={22} strokeWidth={2.2} className="mt-1 shrink-0 text-blue" />
          <span className="min-w-0 break-words">{group.title}</span>
        </h1>
        <p className="mt-1 text-xs font-medium text-ink-2">{topicLine(st)}</p>
        {st.mastered !== null && done > 0 && (
          <div className="mt-3 lg:max-w-[480px]">
            <ProgressBar done={done} total={st.total} label={`Tiến độ chủ đề ${group.title}`} />
            <p className="mt-1 text-[12px] font-semibold text-ink-2">
              Đã nhớ {done}/{st.total} từ & mẫu ngữ pháp
            </p>
          </div>
        )}
        <KiipCoverage lessons={group.lessons} />
      </header>
      <ul className="mt-5 grid gap-3 lg:grid-cols-2">
        {group.lessons.map((lesson, i) => (
          <li key={lesson.id}>
            <LessonCard lesson={lesson} number={i + 1} />
          </li>
        ))}
      </ul>
    </>
  );
}

function LessonPickerScreen() {
  const query = useQuery({ queryKey: ["lessons"], queryFn: listLessons });
  const search = Route.useSearch();
  // the level chosen in the filter row, or the supplementary group; null = everything
  const [filter, setFilter] = useState<LessonTrack | "supplement" | null>(null);

  const lessons = query.data ?? [];
  const groups = groupByTopic(lessons);
  const open =
    search.topic !== undefined
      ? groups.find((g) => g.topic === search.topic && (g.track ?? undefined) === search.track)
      : undefined;
  // a topic page starts at its top, not wherever the topic list was scrolled to
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [search.topic, search.track]);

  // The topics named "Bổ trợ · …" are extra study beside the main sequence: they are listed
  // together in a group of their own, after the levels, instead of among the main topics.
  const isSupplement = (l: LessonSummaryOut) => isSupplementTopic(l.topics[0] ?? "");
  const mainLessons = lessons.filter((l) => !isSupplement(l));
  const supplementLessons = lessons.filter(isSupplement);
  const mainGroups = groups.filter((g) => !isSupplementTopic(g.topic));
  const supplementGroups = groups.filter((g) => isSupplementTopic(g.topic));
  const byTrack = (t: LessonTrack | null) => mainLessons.filter((l) => (l.track ?? null) === t);
  const sections: { track: LessonTrack | null; items: LessonSummaryOut[] }[] = [
    ...TRACK_ORDER.map((t) => ({ track: t as LessonTrack | null, items: byTrack(t) })),
    { track: null, items: byTrack(null) }, // lessons from before tracks existed
  ].filter((s) => s.items.length > 0);
  // A choice that has disappeared from the data (rare) must not leave an empty list.
  const activeFilter =
    filter === "supplement"
      ? supplementLessons.length > 0
        ? filter
        : null
      : filter !== null && sections.some((s) => s.track === filter)
        ? filter
        : null;
  const activeTrack = activeFilter === "supplement" ? null : activeFilter;
  const shown =
    activeFilter === null
      ? sections
      : activeFilter === "supplement"
        ? []
        : sections.filter((s) => s.track === activeTrack);
  const showSupplement =
    supplementLessons.length > 0 && (activeFilter === null || activeFilter === "supplement");
  const signedIn = lessons.some((l) => l.mastered !== null);
  const next = lessons.find((l) => l.is_next && !isLocked(l.access));
  const lockedLessons = lessons.filter((l) => isLocked(l.access)).length;
  const topicView = search.topic !== undefined && query.isSuccess;

  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] overflow-hidden bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink lg:max-w-[960px] lg:px-8">
      <div className="relative z-10">
        {!topicView && (
          <Rise as="header">
            <p className="text-[13px] font-semibold text-ink-2">Học từ vựng, ngữ pháp & luyện đề</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold leading-tight">
              <BookOpen size={22} strokeWidth={2.2} className="text-blue" /> Chọn bài học
            </h1>
            {query.isSuccess && lessons.length > 0 && (
              <p className="mt-1 text-xs font-medium text-ink-2">
                {mainLessons.length + supplementLessons.length} bài trong{" "}
                {mainGroups.length + supplementGroups.length} chủ đề, xếp theo trình độ
                {supplementLessons.length > 0
                  ? ` (${supplementLessons.length} bài bổ trợ ở cuối danh sách).`
                  : "."}
              </p>
            )}
          </Rise>
        )}

        {query.isLoading && (
          <LoadingBlocks
            className="mt-6"
            label="Đang tải danh sách bài học"
            blocks={["h-28 rounded-[24px]", "h-24", "h-24", "h-24"]}
          />
        )}

        {query.isError && (
          <ErrorState
            className="mt-6"
            title="Không tải được danh sách bài học."
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isRefetching}
          />
        )}

        {query.isSuccess && lessons.length === 0 && (
          <EmptyState
            title="Chưa có bài học nào."
            hint="Bài học đang được chuẩn bị — quay lại sau nhé."
          />
        )}

        {topicView && open && <TopicLessons group={open} />}

        {topicView && !open && lessons.length > 0 && (
          <div className="mt-2">
            <Link
              to="/lesson"
              className="hit-area -ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-semibold text-blue-deep"
            >
              <ArrowLeft size={15} strokeWidth={2.6} /> Tất cả chủ đề
            </Link>
            <EmptyState
              title="Không tìm thấy chủ đề này."
              hint="Chủ đề có thể đã được đổi tên — chọn lại trong danh sách chủ đề nhé."
            />
          </div>
        )}

        {lessons.length > 0 && !topicView && (
          <>
            {next && activeFilter === null && (
              <Rise i={1} className="lg:max-w-[560px]">
                <ContinueCard lesson={next} />
              </Rise>
            )}

            {!signedIn && (
              <Link
                to="/support-language"
                className="hit-area card-soft mt-4 flex items-center gap-2.5 rounded-[18px] bg-yellow-soft px-4 py-3 text-xs font-semibold leading-5 active:scale-[0.98] motion-reduce:transition-none lg:max-w-[480px]"
              >
                <LogIn size={16} strokeWidth={2.4} className="shrink-0" />
                <span>
                  Đăng nhập để lưu tiến độ, kết quả luyện tập và được gợi ý bài tiếp theo.
                </span>
              </Link>
            )}

            {lockedLessons > 0 && <UnlockBanner count={lockedLessons} />}

            <HowToLearnCard className="mt-3 lg:max-w-[480px]" />

            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Lọc theo trình độ">
              <button
                type="button"
                onClick={() => setFilter(null)}
                aria-pressed={activeFilter === null}
                className={cn(
                  "hit-area rounded-full border border-line px-3 py-1.5 text-xs font-semibold",
                  activeFilter === null ? "bg-blue text-primary-foreground" : "bg-card text-ink-2",
                )}
              >
                Tất cả
              </button>
              {TRACK_ORDER.map((t) => {
                const count = byTrack(t).length;
                // a level with no lesson yet is not offered: "Sơ cấp · sắp có" read as "nothing
                // for beginners", while the first lessons are for them
                if (count === 0) return null;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilter(t)}
                    disabled={count === 0}
                    aria-pressed={activeFilter === t}
                    className={cn(
                      "hit-area rounded-full border border-line px-3 py-1.5 text-xs font-semibold disabled:border-dashed disabled:opacity-60",
                      activeFilter === t ? "bg-blue text-primary-foreground" : "bg-card text-ink-2",
                    )}
                  >
                    {TRACK_LABEL[t]}
                    {` · ${count}`}
                  </button>
                );
              })}
              {supplementLessons.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter("supplement")}
                  aria-pressed={activeFilter === "supplement"}
                  className={cn(
                    "hit-area rounded-full border border-line px-3 py-1.5 text-xs font-semibold",
                    activeFilter === "supplement"
                      ? "bg-blue text-primary-foreground"
                      : "bg-card text-ink-2",
                  )}
                >
                  Bổ trợ · {supplementLessons.length}
                </button>
              )}
            </div>

            <div className="mt-5 space-y-7">
              {shown.map((s) => (
                <section
                  key={s.track ?? "other"}
                  aria-label={s.track ? TRACK_LABEL[s.track] : "Bài khác"}
                >
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <span
                      className={cn(
                        "rounded-full px-3 py-0.5 text-xs font-semibold",
                        s.track ? TRACK_TONE[s.track] : "bg-progress text-ink-2",
                      )}
                    >
                      {s.track ? TRACK_LABEL[s.track] : "Khác"}
                    </span>
                    <span className="text-xs font-semibold text-ink-2">
                      {mainGroups.filter((g) => g.track === s.track).length} chủ đề ·{" "}
                      {s.items.length} bài
                    </span>
                  </h2>
                  <ul className="mt-3 grid gap-3 lg:grid-cols-2">
                    {mainGroups.length <= 1
                      ? s.items.map((lesson, n) => (
                          <Rise as="li" key={lesson.id} i={Math.min(n + 2, 10)}>
                            <LessonCard lesson={lesson} number={n + 1} />
                          </Rise>
                        ))
                      : mainGroups
                          .filter((g) => g.track === s.track)
                          .map((g, n) => (
                            <Rise as="li" key={g.topic} i={Math.min(n + 2, 10)}>
                              <TopicCard group={g} />
                            </Rise>
                          ))}
                  </ul>
                </section>
              ))}

              {showSupplement && (
                <section aria-label="Bổ trợ">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <span className="rounded-full bg-yellow-soft px-3 py-0.5 text-xs font-semibold">
                      Bổ trợ
                    </span>
                    <span className="text-xs font-semibold text-ink-2">
                      {supplementGroups.length} chủ đề · {supplementLessons.length} bài
                    </span>
                  </h2>
                  <p className="mt-1 text-xs font-medium leading-5 text-ink-2">
                    Học thêm khi cần, nằm ngoài chuỗi bài chính ở trên.
                  </p>
                  <ul className="mt-3 grid gap-3 lg:grid-cols-2">
                    {supplementGroups.map((g) => (
                      <li key={`${g.track ?? "other"}-${g.topic}`}>
                        <TopicCard group={g} showTrack />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <MascotTalk
              className="mt-8"
              mood="reading"
              lines={[
                "Mỗi ngày một bài nhỏ, đều đặn sẽ nhớ lâu hơn học dồn nhé!",
                "Học xong bài nào, nhớ ghé phần Ôn tập để giữ từ lâu hơn.",
                "Chọn chủ đề bạn cần dùng nhất, học sẽ vào nhanh hơn đó!",
              ]}
            />
          </>
        )}
      </div>
      <TabBar wide />
    </main>
  );
}
