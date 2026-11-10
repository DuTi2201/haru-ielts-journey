import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FeatherOut } from "@/lib/api/types";
import { success, tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import { FeatherFlight, FeatherGlyph, type FeatherLook } from "./Feather";
import { useNewlyEarned } from "./use-newly-earned";

/* The lesson's feathers in a row, under the step tabs: one per small part (about five minutes),
 * the part being learned ringed. Earning one sends a feather flying into its place. A tap on a
 * feather opens its part. */

const TILT = [-7, 4, -3, 6, -5, 3, -6, 5];

export function FeatherStrip({
  feathers,
  current,
  star = false,
  ready,
  onPick,
  className,
}: {
  feathers: FeatherOut[];
  /** the feather of the part on screen */
  current: string | null;
  /** starlight feathers (a support lesson) */
  star?: boolean;
  /** the earned flags come from the server (not a first guess): newly earned ones may fly */
  ready: boolean;
  onPick: (f: FeatherOut) => void;
  className?: string;
}) {
  const slots = useRef(new Map<string, HTMLButtonElement>());
  const earnedIds = useMemo(() => feathers.filter((f) => f.earned).map((f) => f.id), [feathers]);
  const fresh = useNewlyEarned(earnedIds, ready);
  const [flying, setFlying] = useState<{ id: string; to: DOMRect } | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const queue = useRef<string[]>([]);

  const launch = useCallback(() => {
    const id = queue.current.shift();
    if (!id) return;
    const el = slots.current.get(id);
    if (!el) return launch();
    el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    setFlying({ id, to: el.getBoundingClientRect() });
  }, []);

  useEffect(() => {
    if (!fresh.length) return;
    queue.current.push(...fresh);
    if (!flying) launch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh]);

  const land = useCallback(() => {
    if (flying) {
      setLanded(flying.id);
      success();
      window.setTimeout(() => setLanded((x) => (x === flying.id ? null : x)), 900);
    }
    setFlying(null);
    window.setTimeout(launch, 60);
  }, [flying, launch]);

  if (!feathers.length) return null;
  const got = earnedIds.length;
  const firstOpen = feathers.find((f) => !f.earned)?.id ?? null;
  const shown =
    feathers.find((f) => f.id === current) ?? feathers.find((f) => f.id === firstOpen) ?? null;

  return (
    <div className={cn("fx-strip", className)}>
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <p className="min-w-0 truncate text-[12px] font-semibold text-ink-2">
          {shown ? (
            <>
              <span className="text-ink">Lông {feathers.indexOf(shown) + 1}</span> · {shown.label}
            </>
          ) : null}
        </p>
        <p className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-2">
          {got}/{feathers.length} lông
        </p>
      </div>
      <div
        className="fx-row"
        role="list"
        aria-label={`Các lông của bài: đã có ${got}/${feathers.length}`}
      >
        {feathers.map((f, n) => {
          const look: FeatherLook = f.earned
            ? star
              ? "star"
              : "earned"
            : f.id === (current ?? firstOpen)
              ? "next"
              : star
                ? "star-empty"
                : "empty";
          return (
            <button
              key={f.id}
              ref={(el) => {
                if (el) slots.current.set(f.id, el);
                else slots.current.delete(f.id);
              }}
              type="button"
              role="listitem"
              onClick={() => {
                tap();
                onPick(f);
              }}
              aria-label={`Lông ${n + 1}: ${f.label}${f.earned ? " (đã có)" : ""}`}
              aria-current={f.id === current ? "step" : undefined}
              className="fx-slot"
              data-landed={landed === f.id || undefined}
              data-earned={f.earned || undefined}
              data-hidden={flying?.id === f.id || undefined}
            >
              <FeatherGlyph look={look} size={32} tilt={TILT[n % TILT.length] ?? 0} />
            </button>
          );
        })}
      </div>
      {flying && <FeatherFlight from={null} to={flying.to} star={star} onDone={land} />}
    </div>
  );
}

/** The lesson's parts of one kind as chips over the content ("Từ 1–12 · Từ 13–24 · Tất cả"). */
export function ChunkChips({
  feathers,
  value,
  onChange,
  allLabel = "Tất cả",
}: {
  feathers: FeatherOut[];
  value: string;
  onChange: (id: string) => void;
  allLabel?: string;
}) {
  if (feathers.length < 2) return null;
  const options = [
    ...feathers.map((f) => ({ id: f.id, label: f.label, earned: f.earned })),
    { id: "all", label: allLabel, earned: false },
  ];
  return (
    <div role="radiogroup" aria-label="Chọn phần nhỏ" className="fx-chips">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => {
            tap();
            onChange(o.id);
          }}
          className={cn(
            "hit-area inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-line px-3 text-[12px] font-semibold",
            value === o.id ? "bg-blue text-primary-foreground shadow-elev-1" : "bg-card text-ink-2",
          )}
        >
          {o.id !== "all" && <FeatherGlyph look={o.earned ? "earned" : "empty"} size={16} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
