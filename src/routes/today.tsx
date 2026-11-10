import { Link, createFileRoute } from "@tanstack/react-router";
import { TodaySession } from "@/components/today/TodaySession";
import { SESSION_KINDS } from "@/lib/today-session";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Flame,
  Headphones,
  Layers,
  LogIn,
  MessagesSquare,
  ClipboardCheck,
  Newspaper,
  Play,
  Target,
  Trophy,
} from "lucide-react";

import { CountUp, MascotTalk, Ring, Rise, Stage } from "@/components/haru/cinema";
import {
  CastleScene,
  CandleFlame,
  ChapterProgress,
  ChapterTitle,
  journeyLines,
  pickRelic,
  ShieldGlyph,
  SwanStage,
} from "@/components/journey/Journey";
import { PROP } from "@/components/journey/assets";
import { JourneyMoments } from "@/components/journey/JourneyMoments";
import { relicOf, wornRelic } from "@/components/journey/feather-data";
import { RelicMedallion } from "@/components/journey/Feathers";
import { HourglassRelic, RoseRelic, useDayLeft } from "@/components/journey/Relics";
import { Mascot, type MascotMood } from "@/components/mascot/Mascot";
import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { TabBar } from "@/components/haru/TabBar";
import { useAuth } from "@/hooks/use-auth";
import { getMyPlan } from "@/lib/api/content";
import type { JourneyOut, TodayPlanTask } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Hôm nay — Haru English" },
      { name: "description", content: "Kế hoạch học tiếng Anh IELTS hôm nay trên Haru." },
      { property: "og:title", content: "Hôm nay — Haru English" },
      { property: "og:description", content: "Kế hoạch học tiếng Anh IELTS hôm nay trên Haru." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TodayScreen,
});

function greetingFor(hour: number) {
  if (hour < 11) return "Chào buổi sáng!";
  if (hour < 18) return "Chào buổi chiều!";
  return "Chào buổi tối!";
}

/** The greeting depends on the hour on the learner's device, which the server that renders the
 * first HTML cannot know (it runs in another time zone). So the page is first drawn with a plain
 * "Xin chào!" — the same on both sides, no hydration mismatch (React error #418) — and takes the
 * time-of-day wording as soon as it is on the device. */
function useGreeting() {
  const [text, setText] = useState("Xin chào!");
  useEffect(() => setText(greetingFor(new Date().getHours())), []);
  return text;
}

function taskIcon(kind: TodayPlanTask["kind"]) {
  if (kind === "review") return Layers;
  if (kind === "vocab_review") return BookOpen;
  if (kind === "topic_review") return Trophy;
  if (kind === "listening") return Headphones;
  if (kind === "placement") return ClipboardCheck;
  if (kind === "daily_reading") return MessagesSquare;
  return Newspaper;
}

/** Wraps task children in the right typed <Link>, one branch per route
 * shape, so TanStack Router's per-route param types stay sound (no
 * generic "to: string" escape hatch). Falls back to a plain non-link
 * wrapper for a reading task with no confirmed article yet. */
function TaskLinkWrapper({
  task,
  className,
  children,
}: {
  task: TodayPlanTask;
  className: string;
  children: ReactNode;
}) {
  if (task.kind === "review") {
    return (
      <Link to="/review" className={className}>
        {children}
      </Link>
    );
  }
  // the topic review is a lesson of its own (lesson_id), opened like a vocabulary review
  if (task.kind === "vocab_review" || task.kind === "topic_review") {
    const id = task.lesson_id != null ? String(task.lesson_id) : "today";
    return (
      <Link to="/lesson/$id" params={{ id }} className={className}>
        {children}
      </Link>
    );
  }
  if (task.kind === "placement") {
    return (
      <Link to="/placement" className={className}>
        {children}
      </Link>
    );
  }
  if (task.kind === "daily_reading") {
    return (
      <Link to="/daily" className={className}>
        {children}
      </Link>
    );
  }
  if (task.kind === "listening") {
    return (
      <Link to="/listening" className={className}>
        {children}
      </Link>
    );
  }
  if (task.article_id) {
    return (
      <Link to="/reading/$id" params={{ id: task.article_id }} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/reading" className={className}>
      {children}
    </Link>
  );
}

/** Kinds offered beside the plan rather than in it: an open library with no "done". */
const EXTRA_KINDS = new Set<TodayPlanTask["kind"]>(["listening"]);

function TaskCard({
  task,
  index,
  isNext,
  last,
}: {
  task: TodayPlanTask;
  index: number;
  isNext: boolean;
  last: boolean;
}) {
  const Icon = taskIcon(task.kind);
  const isDone = task.status === "done";
  const isInProgress = task.status === "in_progress";

  const cardClass = cn(
    "relative block rounded-[22px] border p-4 transition-[transform,box-shadow] duration-300",
    isDone
      ? "border-transparent bg-green-soft"
      : isNext
        ? "cine-glow border-transparent bg-card"
        : "border-line bg-card shadow-elev-1",
  );

  const content = (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]",
          isDone
            ? "bg-green text-primary-foreground"
            : isNext || isInProgress
              ? "bg-blue text-primary-foreground"
              : "bg-progress text-ink-2",
        )}
      >
        {isDone ? <Check size={22} strokeWidth={2.6} /> : <Icon size={20} strokeWidth={2.2} />}
      </span>
      <div className="min-w-0 flex-1">
        {isNext && (
          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-blue-deep">
            {isInProgress ? "Đang làm dở" : "Làm tiếp theo"}
          </p>
        )}
        <h3
          className={cn(
            "text-[15px] font-semibold leading-5",
            isDone && "text-ink-2 line-through decoration-2",
          )}
        >
          {task.title}
        </h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-ink-2">{task.subtitle}</p>
      </div>
      {!isDone && (
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full transition-transform group-hover:translate-x-0.5",
            isNext ? "text-blue-deep" : "text-ink-2",
          )}
        >
          <ChevronRight size={20} strokeWidth={2.4} />
        </span>
      )}
    </div>
  );

  return (
    <Rise i={index + 3} as="li" className="relative pl-9">
      {/* the day as a path: a dot per task, joined by a line */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-[11px] top-6 grid h-[14px] w-[14px] place-items-center rounded-full border-2",
          isDone ? "border-green bg-green" : isNext ? "border-blue bg-card" : "border-line bg-card",
        )}
      />
      {!last && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-[17px] top-[38px] -bottom-4 w-[2px] rounded-full",
            isDone ? "bg-green/50" : "bg-line",
          )}
        />
      )}
      {isDone ? (
        <article className={cardClass}>{content}</article>
      ) : (
        <TaskLinkWrapper
          task={task}
          className={cn(cardClass, "group hover:-translate-y-0.5 active:scale-[0.98]")}
        >
          {content}
        </TaskLinkWrapper>
      )}
    </Rise>
  );
}

function TodaySkeleton() {
  return (
    <LoadingBlocks
      className="relative z-10 mt-2 space-y-5"
      label="Đang tải kế hoạch hôm nay"
      blocks={["h-72 rounded-[32px]", "h-20", "h-20", "h-20"]}
    />
  );
}

function AnonymousNudge() {
  return (
    <Stage className="mt-6 p-6 text-center">
      <Mascot mood="wave" interactive className="mx-auto h-24 w-24" />
      <h2 className="mt-3 text-xl font-bold leading-snug">Đăng nhập để xem kế hoạch hôm nay</h2>
      <p className="mt-1.5 text-[13px] font-medium leading-5 opacity-85">
        Haru cần biết bạn là ai để tính chuỗi ngày học và gợi ý bài tiếp theo dựa trên tiến độ thật
        của bạn.
      </p>
      <Link
        to="/support-language"
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-[16px] bg-card text-sm font-bold text-blue-deep shadow-elev-2 active:scale-[0.97]"
      >
        <LogIn size={16} strokeWidth={2.4} /> Đăng nhập / Tạo tài khoản
      </Link>
    </Stage>
  );
}

/** "Thứ Năm, 29 tháng 10" on the learner's device (the server would say another day near midnight). */
function useToday() {
  const [text, setText] = useState("");
  useEffect(() => {
    const t = new Intl.DateTimeFormat("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());
    setText(t.charAt(0).toUpperCase() + t.slice(1));
  }, []);
  return text;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const n = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  return n >= 0 ? n : null;
}

function mascotFor(hour: number | null, allDone: boolean, fresh: boolean): MascotMood {
  if (allDone) return "celebrate";
  if (fresh) return "wave";
  if (hour === null) return "wave";
  if (hour < 11) return "morning";
  if (hour >= 21) return "reading";
  return "cheer";
}

function linesFor(done: number, total: number, streak: number, next: TodayPlanTask | undefined) {
  if (total > 0 && done >= total)
    return [
      "Xong hết nhiệm vụ hôm nay rồi! Tuyệt vời!",
      "Mai quay lại giữ chuỗi nhé, mình chờ đó!",
      "Muốn luyện thêm? Thử trò chuyện với Haru ở tab Luyện.",
    ];
  const out: string[] = [];
  if (next) out.push(`Bắt đầu với “${next.title}” nhé, chỉ vài phút thôi!`);
  if (streak > 0) out.push(`Chuỗi ${streak} ngày rồi, đừng để đứt nha!`);
  else out.push("Học xong một nhiệm vụ là bắt đầu chuỗi ngày học đó!");
  out.push("Học ít mỗi ngày sẽ nhớ lâu hơn học dồn.");
  out.push("Chạm vào mình để nghe thêm mẹo nhé!");
  return out;
}

function TodayScreen() {
  const auth = useAuth();
  const greeting = useGreeting();
  const today = useToday();
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []);

  const planQuery = useQuery({
    queryKey: ["me", "plan"],
    queryFn: getMyPlan,
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
  });

  const showAnonymous = !auth.isLoading && !auth.isAuthenticated;
  const showLoading = auth.isLoading || (auth.isAuthenticated && planQuery.isLoading);
  const showError = auth.isAuthenticated && planQuery.isError;
  const plan = planQuery.data;

  const streakDays = plan?.streak_days ?? 0;
  const readiness = plan?.readiness_pct ?? null;
  // the day's plan is what can be finished; the open library (listening) never is, so it sits
  // apart as an extra and does not hold back "done for today"
  const allTasks = plan?.tasks ?? [];
  const tasks = allTasks.filter((t) => !EXTRA_KINDS.has(t.kind));
  const extras = allTasks.filter((t) => EXTRA_KINDS.has(t.kind));
  // the session card holds the lesson, the review and the entry check; the rest is listed under it
  const more = tasks.filter((t) => !SESSION_KINDS.has(t.kind));
  const done = tasks.filter((t) => t.status === "done").length;
  const nextIndex = tasks.findIndex((t) => t.status !== "done");
  const next = nextIndex >= 0 ? tasks[nextIndex] : undefined;
  const allDone = tasks.length > 0 && done === tasks.length;
  const examIn = daysUntil(plan?.exam_date ?? null);
  const mood = mascotFor(hour, allDone, readiness === null && streakDays === 0);

  return (
    <main className="relative mx-auto min-h-dvh max-w-[440px] overflow-hidden bg-paper px-5 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(20px,env(safe-area-inset-top))] text-ink lg:max-w-[1120px] lg:px-8 lg:pt-8">
      {showAnonymous && (
        <>
          <Rise as="header" className="flex items-end justify-between">
            <div>
              <p className="text-[13px] font-semibold text-ink-2">{today || "Hôm nay"}</p>
              <h1 className="mt-1 text-[30px] font-extrabold leading-tight">{greeting}</h1>
            </div>
          </Rise>
          <Rise i={1}>
            <AnonymousNudge />
          </Rise>
        </>
      )}

      {showLoading && <TodaySkeleton />}

      {showError && (
        <ErrorState
          className="relative z-10 mt-8"
          title="Không tải được kế hoạch hôm nay."
          message="Kiểm tra kết nối mạng rồi thử lại nhé."
          onRetry={() => void planQuery.refetch()}
          retrying={planQuery.isRefetching}
          error={planQuery.error}
        />
      )}

      {!showAnonymous && !showLoading && !showError && plan && (
        <div className="lg:grid lg:grid-cols-[440px_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div className="lg:sticky lg:top-8">
            <Rise>
              {plan.journey ? (
                <CastleScene
                  journey={plan.journey}
                  hour={hour}
                  aria-label="Lâu đài của bạn hôm nay"
                  className="min-h-[520px] rounded-[32px] shadow-elev-2 lg:min-h-[720px]"
                >
                  <TodayCastle
                    journey={plan.journey}
                    today={today}
                    streak={streakDays}
                    readiness={readiness}
                    examIn={examIn}
                    next={next}
                    tasks={tasks}
                  />
                </CastleScene>
              ) : (
                <Stage aria-labelledby="today-title" className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] opacity-75">
                        {today || "Hôm nay"}
                      </p>
                      <h1
                        id="today-title"
                        className="mt-1 text-[30px] font-extrabold leading-[1.1]"
                      >
                        {greeting}
                      </h1>
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-current/10 px-2.5 py-1 text-[12px] font-semibold">
                        <Target size={13} strokeWidth={2.4} aria-hidden="true" />
                        {plan.goal ? `Mục tiêu · ${plan.goal}` : "Chưa đặt mục tiêu"}
                      </p>
                    </div>
                    <div
                      aria-label={`Chuỗi ${streakDays} ngày học`}
                      className={cn(
                        "flex shrink-0 flex-col items-center rounded-[18px] px-3 py-2",
                        streakDays > 0 ? "bg-yellow-strong text-ink" : "bg-current/10",
                      )}
                    >
                      <Flame
                        size={24}
                        strokeWidth={2.2}
                        className={cn(streakDays > 0 && "cine-flame fill-danger text-danger")}
                        aria-hidden="true"
                      />
                      <span className="text-lg font-extrabold leading-none">
                        <CountUp value={streakDays} />
                      </span>
                      <span className="text-[10px] font-bold uppercase">ngày</span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-5">
                    <Ring
                      pct={readiness}
                      label={
                        readiness !== null
                          ? `Mức độ sẵn sàng ${readiness}%`
                          : "Chưa có dữ liệu mức độ sẵn sàng"
                      }
                    >
                      <div>
                        <p className="text-[30px] font-extrabold leading-none">
                          {readiness !== null ? (
                            <>
                              <CountUp value={Math.round(readiness)} />
                              <span className="text-base">%</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-75">
                          sẵn sàng
                        </p>
                      </div>
                    </Ring>
                    <dl className="min-w-0 flex-1 space-y-2.5 text-[13px]">
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                          Hôm nay
                        </dt>
                        <dd className="font-bold">
                          {tasks.length ? `${done}/${tasks.length} nhiệm vụ` : "Chưa có nhiệm vụ"}
                        </dd>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-current/15">
                          <div
                            className="h-full rounded-full bg-green transition-[width] duration-700"
                            style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      {examIn !== null && (
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                            Kỳ thi
                          </dt>
                          <dd className="font-bold">còn {examIn} ngày</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                          Độ nhớ
                        </dt>
                        <dd className="font-medium leading-5 opacity-90">
                          {readiness !== null
                            ? "Trung bình các từ và ngữ pháp bạn đã ôn."
                            : "Làm nhiệm vụ đầu tiên để bắt đầu đo."}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="mt-5">
                    <TodaySession tasks={tasks} signedIn />
                  </div>

                  <MascotTalk
                    className="mt-4"
                    tone="stage"
                    mood={mood}
                    size="h-24 w-24"
                    lines={linesFor(done, tasks.length, streakDays, next)}
                  />
                </Stage>
              )}
            </Rise>
          </div>

          <section aria-labelledby="plan-title" className="mt-8 lg:mt-0">
            {more.length > 0 && (
              <Rise i={2}>
                <h2 id="plan-title" className="text-[17px] font-bold">
                  Thêm nếu còn thời gian
                </h2>
              </Rise>
            )}

            <ol aria-label="Danh sách nhiệm vụ hôm nay" className="mt-5 space-y-4">
              {more.map((task, i) => (
                <TaskCard
                  key={`${task.kind}-${i}`}
                  task={task}
                  index={i}
                  isNext={false}
                  last={i === more.length - 1}
                />
              ))}
            </ol>

            {extras.length > 0 && (
              <div className="mt-7">
                {more.length === 0 && (
                  <h3 className="text-[13px] font-semibold text-ink-2">Thêm nếu còn thời gian</h3>
                )}
                <ul className="mt-2 space-y-2">
                  {extras.map((task, i) => {
                    const Icon = taskIcon(task.kind);
                    return (
                      <li key={`${task.kind}-x${i}`}>
                        <TaskLinkWrapper
                          task={task}
                          className="flex items-center gap-3 rounded-[16px] border border-line bg-card px-3.5 py-2.5 transition-transform active:scale-[0.98]"
                        >
                          <Icon size={18} strokeWidth={2.2} className="shrink-0 text-ink-2" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold leading-5">
                              {task.title}
                            </span>
                            <span className="block text-[12px] font-medium leading-4 text-ink-2">
                              {task.subtitle}
                            </span>
                          </span>
                          <ChevronRight
                            size={18}
                            strokeWidth={2.2}
                            className="shrink-0 text-ink-2"
                          />
                        </TaskLinkWrapper>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}

      {plan?.journey && <JourneyMoments journey={plan.journey} />}

      {showAnonymous && (
        <MascotTalk
          className="mt-7"
          mood="morning"
          lines={[
            "Đăng nhập một lần thôi, mình sẽ nhớ giúp bạn học tới đâu rồi!",
            "Mỗi ngày 15 phút là đủ để tiến bộ đó!",
          ]}
        />
      )}
      <TabBar wide />
    </main>
  );
}

/** The castle scene of /today, composed as one shot: the chapter's title card at the top, the swan
 * alone on its ground (a relic beside it only when something is at stake), its words as a
 * subtitle, and the one thing to do. */
function TodayCastle({
  journey,
  today,
  streak,
  readiness,
  examIn,
  next,
  tasks,
}: {
  journey: JourneyOut;
  today: string;
  streak: number;
  readiness: number | null;
  examIn: number | null;
  next: TodayPlanTask | undefined;
  tasks: TodayPlanTask[];
}) {
  const left = useDayLeft();
  const stakes = pickRelic(journey, streak, left);
  // nothing at stake: the relic the learner keeps (a support topic finished) stands beside the swan
  const [worn, setWorn] = useState<string | null>(null);
  useEffect(() => setWorn(wornRelic(journey.relics)), [journey.relics]);
  const relic = stakes ?? (worn ? "treasure" : null);
  const eyebrow = [today || "Hôm nay", examIn !== null ? `thi sau ${examIn} ngày` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex min-h-[520px] flex-col p-5 sm:p-6 lg:min-h-[720px]">
      <ChapterTitle
        stage={journey.shown_stage}
        eyebrow={eyebrow}
        headingId="today-title"
        srPrefix="Hôm nay"
        aside={
          streak > 0 ? (
            <div
              className="jr-vigil"
              aria-label={`Chuỗi ${streak} ngày học. ${
                journey.shield_ready
                  ? "Tuần này còn khiên chuỗi: nghỉ 1 ngày vẫn giữ chuỗi"
                  : "Đã dùng khiên chuỗi tuần này · thứ Hai có khiên mới"
              }`}
            >
              <span className="jr-candle">
                <img src={PROP.candle} alt="" aria-hidden="true" />
                <CandleFlame x={50} y={13} size={22} embers={2} />
              </span>
              <b>
                <CountUp value={streak} />
              </b>
              <small>ngày</small>
              <ShieldGlyph ready={!!journey.shield_ready} />
            </div>
          ) : null
        }
      >
        <ChapterProgress journey={journey} readiness={readiness} className="mt-4" />
      </ChapterTitle>
      <div className="flex-1" />
      <SwanStage
        journey={journey}
        size="h-32 w-32 lg:h-52 lg:w-52"
        lines={journeyLines(journey, {
          nextTitle: next?.title,
          relic,
          placement: next?.kind === "placement",
        })}
        relic={
          relic === "rose"
            ? { kind: relic, node: (say) => <RoseRelic journey={journey} onTap={say} /> }
            : relic === "hourglass"
              ? { kind: relic, node: (say) => <HourglassRelic journey={journey} onTap={say} /> }
              : relic === "treasure" && worn
                ? {
                    kind: relic,
                    node: (say) => (
                      <button
                        type="button"
                        onClick={() => say(relicOf(worn).line)}
                        aria-label={relicOf(worn).name}
                        className="jr-relic-float"
                      >
                        <RelicMedallion code={worn} size={46} />
                      </button>
                    ),
                  }
                : null
        }
      />
      <div className="mt-4">
        <TodaySession tasks={tasks} signedIn />
      </div>
    </div>
  );
}
