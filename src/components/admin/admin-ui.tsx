import type { ReactNode } from "react";

import { PILL, type PillTone } from "@/components/admin/admin-kit";
import { cn } from "@/lib/utils";

export function Pill({
  tone = "mute",
  children,
  className,
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        PILL[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A number with a label under it; with `onClick` it is a button that jumps to the list behind it. */
export function StatTile({
  label,
  value,
  hint,
  tone,
  onClick,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
  tone?: "alert" | undefined;
  onClick?: () => void;
  className?: string | undefined;
}) {
  const body = (
    <>
      <span
        className={cn(
          "block text-[22px] font-semibold leading-none tabular-nums",
          tone === "alert" && "text-danger",
        )}
      >
        {value}
      </span>
      <span className="mt-1.5 block text-[12px] font-semibold text-ink-2">{label}</span>
      {hint ? (
        <span className="mt-0.5 block text-[11px] font-medium text-ink-2">{hint}</span>
      ) : null}
    </>
  );
  const cls = cn("glass-row min-w-0 rounded-[16px] p-3 text-left", className);
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        cls,
        "hit-area outline-none transition-transform focus-visible:ring-2 focus-visible:ring-blue/50 active:scale-[0.98]",
      )}
    >
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
