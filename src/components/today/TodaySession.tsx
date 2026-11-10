/** «Buổi hôm nay»: the day as one short session of up to three steps — the next part of a lesson,
 * the cards due, and one dialogue — with one button that opens the first step not done. Shown on
 * the hero of /today, where the single «Bắt đầu» used to be. */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Check, ClipboardCheck, Layers, MessagesSquare, Play } from "lucide-react";
import type { ReactNode } from "react";

import { CHATS_KEY, listChats } from "@/lib/api/chats";
import type { TodayPlanTask } from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { CHAT_DONE_DAY, localDay } from "@/lib/today-session";
import { cn } from "@/lib/utils";

type Step =
  | {
      key: string;
      kind: "task";
      task: TodayPlanTask;
      label: string;
      sub: string;
      minutes: number;
      done: boolean;
      icon: typeof Play;
    }
  | {
      key: string;
      kind: "chat";
      id: string | null;
      label: string;
      sub: string;
      minutes: number;
      done: boolean;
      icon: typeof Play;
    };

function chatDoneToday(): boolean {
  try {
    return localStorage.getItem(CHAT_DONE_DAY) === localDay();
  } catch {
    return false;
  }
}

export function TodaySession({ tasks, signedIn }: { tasks: TodayPlanTask[]; signedIn: boolean }) {
  const chats = useQuery({
    queryKey: CHATS_KEY,
    queryFn: listChats,
    enabled: signedIn,
    staleTime: 60_000,
  });
  const steps: Step[] = [];
  const placement = tasks.find((t) => t.kind === "placement" && t.status !== "done");
  if (placement)
    steps.push({
      key: "placement",
      kind: "task",
      task: placement,
      label: "Tìm bài bắt đầu",
      sub: "Kiểm tra đầu vào",
      minutes: 2,
      done: false,
      icon: ClipboardCheck,
    });
  const lesson = tasks.find((t) => t.kind === "vocab_review");
  if (lesson)
    steps.push({
      key: "lesson",
      kind: "task",
      task: lesson,
      label: lesson.title,
      sub: "Bài học · 1 buổi",
      minutes: 15,
      done: lesson.status === "done",
      icon: BookOpen,
    });
  const review = tasks.find((t) => t.kind === "review");
  if (review)
    steps.push({
      key: "review",
      kind: "task",
      task: review,
      label: "Ôn thẻ",
      sub: review.subtitle,
      minutes: 5,
      done: review.status === "done",
      icon: Layers,
    });
  const doneToday = chatDoneToday();
  const nextChat = chats.data?.find((c) => c.open && !c.done);
  if (doneToday || nextChat)
    steps.push({
      key: "chat",
      kind: "chat",
      id: nextChat?.id ?? null,
      label: doneToday ? "Hội thoại" : `Hội thoại: ${nextChat!.title_vi}`,
      sub: doneToday ? "Đã luyện hôm nay" : `Với ${nextChat!.partner}`,
      minutes: 3,
      done: doneToday,
      icon: MessagesSquare,
    });
  const shown = steps.slice(0, 3);
  if (shown.length === 0) return null;
  const next = shown.find((s) => !s.done);
  const minutes = shown.filter((s) => !s.done).reduce((n, s) => n + s.minutes, 0);

  return (
    <section
      aria-labelledby="session-title"
      className="rounded-[22px] border border-white/15 bg-[oklch(0.18_0.03_285/0.72)] p-4 text-[oklch(0.97_0.01_285)] shadow-elev-2 backdrop-blur-md"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="session-title" className="text-[17px] font-bold">
          Buổi hôm nay
        </h2>
        <span className="text-[12px] font-semibold opacity-75">
          {next ? `~${minutes} phút` : "Xong rồi!"}
        </span>
      </div>
      <ol className="mt-3">
        {shown.map((s, i) => {
          const Icon = s.done ? Check : s.icon;
          const isNext = s === next;
          return (
            <li key={s.key} className="relative flex items-center gap-3 py-1.5">
              {i < shown.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[15px] top-[38px] h-3 border-l-2 border-dotted border-white/25"
                />
              )}
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  s.done
                    ? "bg-green text-white"
                    : isNext
                      ? "bg-white text-[oklch(0.3_0.08_285)]"
                      : "bg-white/12",
                )}
              >
                <Icon size={16} strokeWidth={2.6} aria-hidden="true" />
              </span>
              <span className={cn("min-w-0 flex-1", s.done && "opacity-60")}>
                <span
                  className={cn(
                    "block truncate text-[14.5px] font-semibold",
                    s.done && "line-through decoration-2",
                  )}
                >
                  {s.label}
                </span>
                <span className="block truncate text-[12px] font-medium opacity-70">{s.sub}</span>
              </span>
              <span className="shrink-0 text-[12px] font-semibold tabular-nums opacity-75">
                {s.minutes} phút
              </span>
            </li>
          );
        })}
      </ol>
      {next ? (
        <StepLink
          step={next}
          className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-blue text-[15px] font-bold text-primary-foreground shadow-elev-2 active:scale-[0.98]"
        >
          <Play size={16} strokeWidth={2.6} aria-hidden="true" />
          {shown.indexOf(next) === 0 ? "Bắt đầu" : "Làm tiếp"}
        </StepLink>
      ) : (
        <p className="mt-3 rounded-[14px] bg-green/25 px-3 py-2.5 text-center text-[13px] font-semibold">
          Xong buổi hôm nay. Chuỗi ngày học đã được giữ!
        </p>
      )}
    </section>
  );
}

function StepLink({
  step,
  className,
  children,
}: {
  step: Step;
  className: string;
  children: ReactNode;
}) {
  const onClick = () => tap();
  if (step.kind === "chat")
    return step.id ? (
      <Link to="/chat/$id" params={{ id: step.id }} onClick={onClick} className={className}>
        {children}
      </Link>
    ) : (
      <Link to="/chat" onClick={onClick} className={className}>
        {children}
      </Link>
    );
  const t = step.task;
  if (t.kind === "review")
    return (
      <Link to="/review" onClick={onClick} className={className}>
        {children}
      </Link>
    );
  if (t.kind === "placement")
    return (
      <Link to="/placement" onClick={onClick} className={className}>
        {children}
      </Link>
    );
  return (
    <Link
      to="/lesson/$id"
      params={{ id: String(t.lesson_id) }}
      onClick={onClick}
      className={className}
    >
      {children}
    </Link>
  );
}
