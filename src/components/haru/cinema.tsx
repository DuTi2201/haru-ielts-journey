import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

import { Mascot, type MascotMood } from "@/components/mascot/Mascot";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

import "./cinema.css";

/** The hero "stage" of a learning screen: deep indigo, lit by slow-moving colour, with a light that
 * sweeps across now and then. Its text is light; children lay themselves out. */
export function Stage({
  children,
  className,
  as: Tag = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <Tag className={cn("cine-stage rounded-[32px]", className)} {...rest}>
      <span
        className="cine-blob -right-10 -top-16 h-48 w-48"
        style={{ background: "var(--purple)" }}
        aria-hidden="true"
      />
      <span
        className="cine-blob -bottom-20 -left-10 h-56 w-56"
        style={{ background: "var(--blue)" }}
        aria-hidden="true"
      />
      <span
        className="cine-blob right-1/4 top-1/3 h-28 w-28"
        style={{ background: "var(--yellow-strong)", opacity: 0.22 }}
        aria-hidden="true"
      />
      <span className="cine-grain" aria-hidden="true" />
      <span className="cine-sheen" aria-hidden="true" />
      <div className="relative z-[1]">{children}</div>
    </Tag>
  );
}

/** Content that rises into place when the page opens; `i` staggers it after its neighbours. */
export function Rise({
  i = 0,
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  i?: number;
  as?: ElementType;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <Tag className={cn("cine-rise", className)} style={{ "--i": i } as CSSProperties} {...rest}>
      {children}
    </Tag>
  );
}

/** A number that counts up to its value the first time it is shown. */
export function CountUp({ value, duration = 1100 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame === "undefined") {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown}</>;
}

/** A ring that draws itself up to `pct` (0–100); the label sits in its middle. */
export function Ring({
  pct,
  size = 132,
  stroke = 11,
  children,
  className,
  label,
}: {
  pct: number | null;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  className?: string;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setDrawn(Math.max(0, Math.min(100, pct ?? 0))), 60);
    return () => window.clearTimeout(t);
  }, [pct]);
  const id = `ring-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--yellow-strong)" />
            <stop offset="100%" stopColor="var(--green)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="cine-ring-track"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - drawn / 100)}
          className="cine-ring-value"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Types a line out, letter by letter (at once for someone who asked for less motion). */
export function useTyped(text: string, speed = 22) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) window.clearInterval(t);
    }, speed);
    return () => window.clearInterval(t);
  }, [text, speed]);
  return { shown: text.slice(0, n), done: n >= text.length };
}

/** The mascot with a speech bubble. A tap makes it react and say the next line. */
export function MascotTalk({
  mood,
  lines,
  className,
  size = "h-20 w-20",
  tone = "card",
}: {
  mood: MascotMood;
  lines: string[];
  className?: string;
  size?: string;
  /** "card": a light bubble on the page; "stage": a glassy bubble on a Stage */
  tone?: "card" | "stage";
}) {
  const [k, setK] = useState(0);
  const line = lines.length ? (lines[k % lines.length] ?? "") : "";
  const typed = useTyped(line);
  return (
    <div className={cn("flex items-end gap-2.5", className)}>
      <span
        onClick={() => setK((x) => x + 1)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setK((x) => x + 1);
        }}
      >
        <Mascot
          mood={mood}
          interactive
          className={size}
          label="Chạm vào Haru để nghe thêm lời nhắn"
        />
      </span>
      <p
        aria-live="polite"
        className={cn(
          "cine-bubble mb-2 min-h-[2.75rem] rounded-[18px_18px_18px_4px] px-4 py-2.5 text-[13px] font-semibold leading-5",
          tone === "card"
            ? "border border-line bg-card text-ink shadow-elev-1"
            : "border border-current/20 bg-current/10 text-current backdrop-blur",
        )}
      >
        <span className={cn(!typed.done && "cine-caret")}>{typed.shown}</span>
      </p>
    </div>
  );
}
