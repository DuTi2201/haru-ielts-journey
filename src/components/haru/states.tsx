import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { GateNotice } from "@/components/billing/GateNotice";
import { Mascot, type MascotMood } from "@/components/mascot/Mascot";
import { ApiError } from "@/lib/api/client";
import { gateKind } from "@/lib/billing";
import { cn } from "@/lib/utils";

/** One loading placeholder block. The size/shape comes from `className`
 * (e.g. "h-24", "h-4 w-1/2 rounded-full"); the sweep animation lives in the
 * `shimmer` utility (styles.css) and is frozen by prefers-reduced-motion. */
export function Shimmer({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("shimmer rounded-[18px]", className)} />;
}

/** A stack of Shimmer blocks that also tells assistive tech the area is
 * loading. `blocks` are the className of each block, top to bottom. */
export function LoadingBlocks({
  blocks = ["h-24", "h-24"],
  label = "Đang tải…",
  className,
}: {
  blocks?: string[];
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn("space-y-3", className)}>
      <span className="sr-only">{label}</span>
      {blocks.map((block, i) => (
        <Shimmer key={i} className={block} />
      ))}
    </div>
  );
}

/** Something failed and the learner can try again right here. Keeps the
 * message human ("Kiểm tra kết nối rồi thử lại") and always offers the retry
 * when the caller can provide one. */
/** Which mascot answers an error: asleep for "come back tomorrow" (a daily limit), resting when
 * the server cannot be reached, comforting otherwise. */
function errorMood(error: unknown): MascotMood {
  if (error instanceof ApiError) {
    if (error.status === 429 || error.problem.code === "daily_limit") return "sleep";
    if (error.status === 0 || error.status >= 500) return "sleep";
  }
  return "comfort";
}

export function ErrorState({
  title = "Không tải được nội dung.",
  message,
  onRetry,
  retrying = false,
  className,
  error,
}: {
  title?: string;
  message?: string | null | undefined;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
  /** The error behind this state: when it means "needs a purchase / not open to learners / daily
   * limit" the learner is told so (and offered the purchase) instead of a retry button. */
  error?: unknown;
}) {
  if (error !== undefined && gateKind(error)) {
    return <GateNotice error={error} className={className} />;
  }
  return (
    <section
      role="alert"
      className={cn(
        "rounded-[20px] border border-line bg-card p-6 text-center shadow-elev-2",
        className,
      )}
    >
      <Mascot mood={errorMood(error)} className="mx-auto h-14 w-14" />
      <p className="mt-2 text-sm font-semibold">{title}</p>
      {message ? (
        <p className="mt-1 text-xs font-semibold leading-5 text-ink-2">{message}</p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="hit-area mt-4 inline-flex items-center justify-center gap-1.5 rounded-[14px] border border-line bg-card px-4 py-2 text-xs font-semibold shadow-elev-1 active:scale-[0.97] disabled:opacity-60"
        >
          <RefreshCw size={14} strokeWidth={2.4} className={retrying ? "animate-spin" : ""} />
          {retrying ? "Đang thử lại…" : "Thử lại"}
        </button>
      ) : null}
    </section>
  );
}

/** Nothing to show yet — the mascot says what to do next instead of a blank
 * screen. */
export function EmptyState({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-8 flex flex-col items-center text-center", className)}>
      <Mascot mood="thinking" className="mb-3 h-16 w-16" />
      <p className="text-sm font-semibold">{title}</p>
      {hint ? <p className="mt-1 text-xs font-medium leading-5 text-ink-2">{hint}</p> : null}
      {action}
    </div>
  );
}
