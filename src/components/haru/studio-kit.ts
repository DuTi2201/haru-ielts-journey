import { useCallback, useEffect, useRef, useState } from "react";

import { prefersReducedMotion } from "@/lib/motion";

/* Class strings and hooks shared by the Studio screens (components live in
 * studio-ui.tsx). Everything is built from the Hanji Pop / "Liquid Hanji glass"
 * tokens in styles.css. */

/** Text field. 16px on phones (iOS Safari zooms the page on focus when a field
 * is smaller), 14px from `md` up. The 40% ink edge keeps the field findable on
 * a light, translucent panel (non-text contrast), and focus adds a blue ring. */
export const FIELD =
  "w-full rounded-[14px] border border-line bg-card/70 px-3.5 py-2.5 text-base text-ink outline-none transition-colors placeholder:text-ink-2/70 focus:border-blue focus:bg-card focus:ring-2 focus:ring-blue/30 md:text-sm";

const BTN_BASE =
  "btn-lift inline-flex min-h-10 select-none items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-50";

export const BTN = {
  primary: `${BTN_BASE} bg-blue text-primary-foreground`,
  soft: `${BTN_BASE} border border-line bg-card/70 text-ink`,
  ok: `${BTN_BASE} border border-green/40 bg-green-soft text-ink`,
  warn: `${BTN_BASE} bg-yellow-strong text-ink`,
  danger: `${BTN_BASE} bg-danger text-primary-foreground`,
} as const;

/** Smaller variant for buttons that sit inside a row. */
export const BTN_SM = "min-h-9 px-3";

export const EXIT_MS = 260;

/** Tracks which rows are animating out (`exiting`) and which have finished
 * (`gone`). `startExit(id)` flips a row to "leaving" and, once the animation is
 * done, moves it to `gone`. Timers are cleared on unmount. */
export function useExiting(): {
  exiting: ReadonlySet<string>;
  gone: ReadonlySet<string>;
  startExit: (id: string, after?: () => void) => void;
} {
  const [exiting, setExiting] = useState<ReadonlySet<string>>(() => new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const startExit = useCallback((id: string, after?: () => void) => {
    setExiting((prev) => new Set(prev).add(id));
    const timer = setTimeout(
      () => {
        timers.current.delete(timer);
        setExiting((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setGone((prev) => new Set(prev).add(id));
        after?.();
      },
      prefersReducedMotion() ? 0 : EXIT_MS,
    );
    timers.current.add(timer);
  }, []);

  return { exiting, gone, startExit };
}
