import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, X } from "lucide-react";

import { Mascot } from "@/components/mascot/Mascot";
import { LoadingBlocks } from "@/components/haru/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BTN, BTN_SM, FIELD } from "@/components/haru/studio-kit";
import { cn } from "@/lib/utils";

/* Building blocks of the Studio (editor console). Everything here is styled
 * from the Hanji Pop / "Liquid Hanji glass" tokens in styles.css — panels are
 * translucent but never blurred (glass-card), buttons lift with an inner light
 * (btn-lift), and only floating layers carry backdrop-filter. */

// ------------------------------------------------------------------ controls --
export function Field({ label, className, ...rest }: { label: string } & ComponentProps<"input">) {
  return <input aria-label={label} {...rest} className={cn(FIELD, className)} />;
}

// -------------------------------------------------------------------- panels --
export function GlassPanel({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("glass-card scroll-mt-28 rounded-[24px] p-4", className)}>
      {children}
    </section>
  );
}

export function PanelTitle({
  icon,
  children,
  aside,
}: {
  icon?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
        {icon}
        <span className="min-w-0">{children}</span>
      </h2>
      {aside}
    </div>
  );
}

/** Nothing here yet — the mascot says what to do next (a blank panel reads as broken). */
export function PanelEmpty({
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
    <div
      className={cn(
        "flex flex-col items-center rounded-[18px] border border-glass-edge bg-glass-row px-4 py-5 text-center",
        className,
      )}
    >
      <Mascot mood="thinking" className="h-12 w-12" />
      <p className="mt-2 text-sm font-semibold">{title}</p>
      {hint ? (
        <p className="mt-1 max-w-[34ch] text-xs font-medium leading-5 text-ink-2">{hint}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** A panel's own load failure, with retry — the rest of the page stays usable. */
export function PanelError({
  message,
  onRetry,
  retrying = false,
  className,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-[16px] border border-danger/40 bg-danger-soft/70 p-3 text-xs",
        className,
      )}
    >
      <AlertTriangle size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-danger" />
      <p className="min-w-0 flex-1 font-semibold leading-5">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className={cn(BTN.soft, BTN_SM, "shrink-0")}
        >
          <RefreshCw size={13} strokeWidth={2.4} className={retrying ? "animate-spin" : ""} />
          Thử lại
        </button>
      ) : null}
    </div>
  );
}

/** Shimmer placeholder rows for a list that is still loading. */
export function PanelLoading({ rows = 2, label }: { rows?: number; label?: string }) {
  return (
    <LoadingBlocks
      className="mt-3"
      label={label ?? "Đang tải…"}
      blocks={Array.from({ length: rows }, () => "h-[68px] rounded-[16px]")}
    />
  );
}

// ------------------------------------------------------------------ progress --
/** The bar itself. `pct === null` means "no percentage yet" → a blob sliding
 * across the track. `animated={false}` keeps the liquid look without the drift
 * (for a bar that is always on screen, like review progress). */
export function LiquidBar({
  pct,
  label,
  tone = "busy",
  animated = true,
  className,
}: {
  pct: number | null;
  label: string;
  tone?: "busy" | "done" | "failed";
  animated?: boolean;
  className?: string;
}) {
  const colour =
    tone === "done"
      ? "[--liquid-color:var(--green)]"
      : tone === "failed"
        ? "[--liquid-color:var(--danger)]"
        : "";
  const still = animated ? "" : "[animation:none]";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct === null ? undefined : pct}
      className={cn(
        "h-2.5 overflow-hidden rounded-full bg-progress/80 shadow-[inset_0_1px_2px_0_var(--glass-shadow)]",
        className,
      )}
    >
      {pct === null ? (
        <div className={cn("liquid-fill liquid-slide h-full rounded-full", colour)} />
      ) : (
        <div
          className={cn(
            "liquid-fill h-full rounded-full transition-[width] duration-500 ease-out",
            colour,
            still,
          )}
          style={{ width: `${Math.min(100, Math.max(pct, 4))}%` }}
        />
      )}
    </div>
  );
}

const PROGRESS_TONE = {
  busy: "border-glass-edge bg-glass-row",
  done: "border-green/50 bg-green-soft/70",
  failed: "border-danger/50 bg-danger-soft/70",
} as const;

/** A running (or just-finished) background task: title, percentage, what the
 * server is doing right now. Fed by useJobEvents (SSE, 2s polling fallback). */
export function ProgressCard({
  title,
  pct,
  message,
  tone = "busy",
  onDismiss,
  className,
}: {
  title: string;
  pct: number | null;
  message?: ReactNode;
  tone?: "busy" | "done" | "failed";
  onDismiss?: (() => void) | undefined;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-[18px] border p-3 shadow-[inset_0_1px_0_0_var(--glass-shine)]",
        PROGRESS_TONE[tone],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs font-semibold">
        <span className="flex min-w-0 items-center gap-1.5">
          {tone === "failed" ? (
            <AlertTriangle size={14} strokeWidth={2.4} className="shrink-0 text-danger" />
          ) : tone === "done" ? (
            <CheckCircle2 size={14} strokeWidth={2.4} className="shrink-0" />
          ) : null}
          <span className="truncate">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {pct !== null && <span className="tabular-nums text-ink-2">{pct}%</span>}
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Đóng"
              className="hit-area -mr-1 flex h-6 w-6 items-center justify-center rounded-full text-ink-2"
            >
              <X size={14} strokeWidth={2.6} />
            </button>
          ) : null}
        </span>
      </div>
      <LiquidBar pct={pct} label={title} tone={tone} className="mt-2" />
      {message ? (
        <p className="mt-2 break-words text-[12px] font-semibold leading-4 text-ink-2">{message}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------- leave animation --
/** A row that has just been handled glides away — fades, shrinks a touch and
 * folds its height to zero — instead of vanishing. Heights animate through
 * `grid-template-rows` (1fr → 0fr), so nothing is measured in JavaScript. The
 * negative bottom margin eats the list gap so neighbours close up smoothly. */
export function LeaveTransition({
  leaving,
  className,
  children,
}: {
  leaving: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li
      aria-hidden={leaving || undefined}
      className={cn(
        "grid transition-[grid-template-rows,opacity,scale,margin] duration-[260ms] ease-out",
        leaving
          ? "pointer-events-none -mb-2 scale-[0.97] grid-rows-[0fr] opacity-0"
          : "grid-rows-[1fr] opacity-100",
        className,
      )}
    >
      <div className={cn("min-h-0", leaving && "overflow-hidden")}>{children}</div>
    </li>
  );
}

// -------------------------------------------------------------------- dialog --
/** "Are you sure?" for actions that write to (or undo) the live data. The
 * overlay and the glass card come from styles.css / ui/alert-dialog. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "primary",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "danger" | "warn";
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="!glass-panel-strong w-[calc(100%-2.5rem)] max-w-[360px] gap-3 rounded-[24px] p-5 sm:rounded-[24px]">
        <AlertDialogHeader className="text-left sm:text-left">
          <AlertDialogTitle className="text-base font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-xs font-medium leading-5 text-ink-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:space-x-0">
          <AlertDialogCancel className={cn(BTN.soft, "mt-0 flex-1")}>Để sau</AlertDialogCancel>
          <AlertDialogAction className={cn(BTN[tone], "flex-1")} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
