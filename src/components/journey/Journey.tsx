import { useEffect, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

import { useTyped } from "@/components/haru/cinema";
import type { JourneyOut } from "@/lib/api/types";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

import {
  asStage,
  CASTLE,
  CROW,
  PROP,
  STAGES,
  SWAN,
  SWAN_CURSED,
  VINES,
  type Stage,
} from "./assets";
import { currentChapter } from "./feather-data";
import { ChapterWing, SparkleDust } from "./Feathers";
import "./journey.css";

/* Hành trình Thiên Nga — the castle scene and the swan that lives in it.
 *
 * Two numbers from the server decide the picture (backend app/services/journey.py): the stage the
 * swan wears (`shown_stage`, one back while the curse holds) and the days away (`missed_days`).
 * The days away darken the castle, bring the crows and the thorns; the learner's own clock picks
 * night, dawn, day or dusk. */

export type TimeOfDay = "night" | "dawn" | "day" | "dusk";

export function timeOf(hour: number | null): TimeOfDay {
  if (hour === null) return "day";
  if (hour < 5 || hour >= 20) return "night";
  if (hour < 9) return "dawn";
  if (hour >= 17) return "dusk";
  return "day";
}

/** The hour on the learner's device (null until mounted: the server's clock is another one). */
export function useHour(): number | null {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    setH(new Date().getHours());
    const t = window.setInterval(() => setH(new Date().getHours()), 10 * 60_000);
    return () => window.clearInterval(t);
  }, []);
  return h;
}

/** How the swan moves at each stage, how fast its frames turn, and its light. */
const SWAN_MOTION: Record<Stage, { motion: string; beat: number }> = {
  1: { motion: "sway", beat: 1700 },
  2: { motion: "sway", beat: 1300 },
  3: { motion: "glide", beat: 1100 },
  4: { motion: "bob", beat: 700 },
  5: { motion: "hop", beat: 520 },
};

/** The swan of a stage: its drawings shown in turn, its own light and motion. Cursed: the swan the
 * crows are whispering to. A tap makes it react (`onTap`). */
export function SwanFigure({
  stage,
  cursed = false,
  className,
  onTap,
  label,
  still = false,
  sparkle = 0,
}: {
  stage: number;
  cursed?: boolean;
  className?: string;
  onTap?: () => void;
  label?: string;
  still?: boolean;
  /** 0–3: starlight from the support lessons */
  sparkle?: number;
}) {
  const s = asStage(stage);
  const frames = cursed ? SWAN_CURSED : SWAN[s];
  const { motion, beat } = cursed ? { motion: "sway", beat: 1500 } : SWAN_MOTION[s];
  const [i, setI] = useState(0);
  const [react, setReact] = useState(false);
  useEffect(() => {
    setI(0);
    if (still || prefersReducedMotion() || frames.length < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % frames.length), beat);
    return () => window.clearInterval(t);
  }, [frames, beat, still]);
  const tap = () => {
    setReact(false);
    requestAnimationFrame(() => setReact(true));
    onTap?.();
  };
  const name = cursed ? "Thiên nga bị bầy quạ dụ dỗ" : `Thiên nga · ${STAGES[s].name}`;
  return (
    <span
      role={onTap ? "button" : "img"}
      tabIndex={onTap ? 0 : undefined}
      aria-label={label ?? name}
      data-motion={still || react ? undefined : motion}
      data-react={react || undefined}
      data-tap={onTap ? true : undefined}
      onAnimationEnd={() => setReact(false)}
      onClick={onTap ? tap : undefined}
      onKeyDown={
        onTap
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                tap();
              }
            }
          : undefined
      }
      className={cn("jr-swan shrink-0", className)}
      style={{ "--glow": cursed ? "var(--purple)" : STAGES[s].glow } as CSSProperties}
    >
      <span className="jr-swan-glow" aria-hidden="true" />
      {!cursed && <SparkleDust level={sparkle} />}
      {s === 1 && !cursed && (
        // the drawing's own candle, lit: it sits at the same place in both frames
        <span className="jr-swan-fx" style={{ aspectRatio: "640 / 619" }} aria-hidden="true">
          <CandleFlame x={67} y={82} size={3.6} pool />
        </span>
      )}
      {s === 4 && !cursed && (
        // the sword's laurel catches the light in the second drawing (the one with the sparks)
        <span
          className="jr-swan-fx"
          data-fit="height"
          style={{ aspectRatio: "587 / 640" }}
          aria-hidden="true"
        >
          <SwordGleam x={83.5} y={13} on={i === 1 || still} />
        </span>
      )}
      {frames.map((src, n) => (
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          style={{ opacity: n === i ? 1 : 0 }}
        />
      ))}
    </span>
  );
}

/** A living flame over a drawn candle: a warm halo that breathes, a flame that sways and
 * flickers, a few embers rising, and (with `pool`) the light it throws on the ground. Placed by
 * the flame's centre (`x`, `y`, % of the drawing) and its width (`size`, % of the drawing). */
export function CandleFlame({
  x,
  y,
  size,
  pool = false,
  embers = 3,
}: {
  x: number;
  y: number;
  size: number;
  pool?: boolean;
  embers?: number;
}) {
  return (
    <span
      className="jr-flame"
      style={{ left: `${x}%`, top: `${y}%`, width: `${size}%` } as CSSProperties}
      aria-hidden="true"
    >
      {pool && <span className="jr-flame-pool" />}
      <span className="jr-flame-halo" />
      <span className="jr-flame-body">
        <span className="jr-flame-core" />
      </span>
      {Array.from({ length: embers }, (_, n) => (
        <span key={n} className="jr-ember" style={{ "--n": n } as CSSProperties} />
      ))}
    </span>
  );
}

/** Light bursting from a raised sword: a white-gold core, a slow four-pointed flare and a wide
 * halo, strongest when `on` (the drawing with the sparks), a glow when not. */
export function SwordGleam({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <span
      className="jr-gleam"
      data-on={on || undefined}
      style={{ left: `${x}%`, top: `${y}%` } as CSSProperties}
      aria-hidden="true"
    >
      <span className="jr-gleam-halo" />
      <span className="jr-gleam-flare" />
      <span className="jr-gleam-core" />
    </span>
  );
}

/** A crow crossing the sky. */
function Crow({
  top,
  dur,
  delay,
  scale,
}: {
  top: string;
  dur: number;
  delay: number;
  scale: number;
}) {
  return (
    <span
      className="jr-crow"
      aria-hidden="true"
      style={
        {
          top,
          aspectRatio: "256 / 228",
          "--dur": `${dur}s`,
          "--delay": `${delay}s`,
          "--s": scale,
        } as CSSProperties
      }
    >
      <img src={CROW.flyA} alt="" />
      <img src={CROW.flyB} alt="" />
    </span>
  );
}

const FLOCK = [
  { top: "8%", dur: 15, delay: 0, scale: 1 },
  { top: "14%", dur: 19, delay: -6, scale: 0.8 },
  { top: "5%", dur: 23, delay: -11, scale: 0.65 },
  { top: "20%", dur: 17, delay: -3, scale: 0.9 },
  { top: "11%", dur: 27, delay: -17, scale: 0.55 },
  { top: "17%", dur: 21, delay: -9, scale: 0.7 },
  { top: "3%", dur: 25, delay: -14, scale: 0.6 },
  { top: "24%", dur: 18, delay: -1, scale: 0.75 },
];

/** The castle of the learner's stage, its weather and the crows: the backdrop of /today and
 * /progress. Children sit on top (the text, the swan). */
export function CastleScene({
  journey,
  hour,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  journey: Pick<JourneyOut, "shown_stage" | "missed_days" | "cursed">;
  hour: number | null;
  className?: string;
  children?: ReactNode;
  "aria-label"?: string;
}) {
  const s = asStage(journey.shown_stage);
  const away = Math.min(3, Math.max(0, journey.cursed ? 3 : journey.missed_days));
  const time = timeOf(hour);
  const castle = CASTLE[s];
  const base = (time === "night" || time === "dusk") && castle.night ? castle.night : castle.day;
  const darkOpacity = journey.cursed ? 1 : ([0, 0.45, 0.78, 1][away] ?? 1);
  const crows = journey.cursed ? 8 : ([0, 2, 5, 8][away] ?? 0);
  const move = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty(
      "--px",
      (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3),
    );
    e.currentTarget.style.setProperty(
      "--py",
      (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3),
    );
  };

  return (
    <section
      aria-label={ariaLabel}
      data-away={away}
      data-time={time}
      onPointerMove={move}
      className={cn("jr-scene", className)}
      style={{ "--away": away } as CSSProperties}
    >
      <img src={base} alt="" className="jr-layer jr-castle" decoding="async" />
      {darkOpacity > 0 && (
        <img
          src={castle.dark}
          alt=""
          className="jr-layer jr-castle-dark"
          decoding="async"
          style={{ opacity: darkOpacity }}
        />
      )}
      <span className="jr-tint" data-time={time} aria-hidden="true" />
      {s >= 4 && away === 0 && (time === "day" || time === "dawn") && (
        <span className="jr-rays" aria-hidden="true" />
      )}
      <span className="jr-fog" aria-hidden="true" />
      {FLOCK.slice(0, crows).map((c) => (
        <Crow key={c.top + c.dur} {...c} />
      ))}
      <img src={VINES} alt="" className="jr-vines" aria-hidden="true" decoding="async" />
      <span className="jr-vignette" aria-hidden="true" />
      <span className="jr-scrim" aria-hidden="true" />
      <span className="jr-grain" aria-hidden="true" />
      <div className="relative z-[2] h-full">{children}</div>
    </section>
  );
}

/** Perched crows beside the swan, whispering (2 days away or more). */
export function PerchedCrows({ away }: { away: number }) {
  if (away < 2) return null;
  return (
    <>
      <img
        src={CROW.perch}
        alt=""
        aria-hidden="true"
        className="jr-perch"
        style={{ left: "-30%", scale: "-1 1" }}
      />
      {away >= 3 && (
        <img
          src={CROW.perch}
          alt=""
          aria-hidden="true"
          className="jr-perch"
          style={{ right: "-26%", animationDelay: "-1.4s" }}
        />
      )}
    </>
  );
}

export const ROMAN = ["", "I", "II", "III", "IV", "V"] as const;

/** Yesterday, Vietnam time, as an ISO date (the server's days are Vietnam days). */
export function yesterdayVN(now = Date.now()): string {
  return new Date(now + 7 * 3_600_000 - 86_400_000).toISOString().slice(0, 10);
}

/** The shield took yesterday off for the learner (and today is not studied yet). */
export function shieldedYesterday(j: Pick<JourneyOut, "shield_day">): boolean {
  return !!j.shield_day && j.shield_day === yesterdayVN();
}

/** Which relic stands beside the swan, if any: an object enters the scene only when it carries
 * the stakes. The rose while petals are falling (days away, the curse), the hourglass in the last
 * hours of a day that would break the streak. Otherwise the swan is alone. */
export type SceneRelic = "rose" | "hourglass" | "treasure" | null;
export function pickRelic(
  j: Pick<JourneyOut, "missed_days" | "cursed" | "studied_today">,
  streak: number,
  msLeft: number | null,
): SceneRelic {
  if (j.cursed || j.missed_days >= 1) return "rose";
  if (!j.studied_today && streak > 0 && msLeft !== null && msLeft < 4 * 3_600_000)
    return "hourglass";
  return null;
}

/** What the swan says, by the days away and the stage (a tap gives the next line). Each line is a
 * film subtitle: two short lines at most, so the swan never moves. The first names what the scene
 * shows. */
export function journeyLines(
  j: JourneyOut,
  opts: { nextTitle?: string | undefined; relic?: SceneRelic; placement?: boolean } = {},
): string[] {
  const st = STAGES[asStage(j.shown_stage)];
  if (j.cursed && j.studied_today)
    return ["Lời nguyền đang rạn! Học thêm ngày mai nữa nhé.", "Bầy quạ sợ rồi, đừng dừng lại!"];
  if (j.cursed)
    return [
      "Cánh hoa cuối đã rơi… Học 2 ngày liền để phá nguyền.",
      "Đừng nghe bầy quạ. Chặng của bạn vẫn còn nguyên.",
    ];
  if (j.missed_days >= 3)
    return ["Chỉ còn một cánh hoa… Hôm nay học để giữ lấy nó!", "Một bài thôi là quạ phải bay đi."];
  if (j.missed_days >= 1)
    return [
      `${j.missed_days + 1} cánh hoa đã rơi. Học một bài để hoa thôi rơi.`,
      j.missed_days === 2
        ? "Bầy quạ bảo mình bỏ cuộc… đừng nghe chúng!"
        : "Quạ đã đậu trên mái, lâu đài tối dần.",
    ];
  const out: string[] = [];
  if (!j.studied_today && shieldedYesterday(j))
    out.push("Hôm qua khiên chuỗi đã đỡ cho bạn. Hôm nay học tiếp nhé!");
  else if (opts.relic === "hourglass") out.push("Đồng hồ cát sắp cạn: học trước nửa đêm nhé!");
  else if (!j.studied_today && opts.placement)
    out.push("Mình tìm bài bắt đầu hợp với bạn nhé? Chỉ 2 phút.");
  else if (!j.studied_today)
    out.push(
      opts.nextTitle
        ? `Mình bắt đầu với “${opts.nextTitle}” nhé?`
        : "Học một chút để lâu đài sáng thêm nhé?",
    );
  else out.push("Hôm nay bạn đã học, lâu đài sáng thêm rồi!");
  out.push(st.say);
  out.push("Mỗi phần bài học xong là một lông trắng mọc lại.");
  if (j.shield_ready) out.push("Tuần này còn khiên: bận một ngày cũng không sao.");
  return out;
}

/** The title card of a scene: the chapter numeral, its name, a line under it. */
export function ChapterTitle({
  stage,
  eyebrow,
  aside,
  children,
  headingId,
  srPrefix,
}: {
  stage: number;
  eyebrow?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  headingId?: string;
  srPrefix?: string;
}) {
  const s = asStage(stage);
  return (
    <header className="jr-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="jr-eyebrow">{eyebrow}</p>}
          <p className="jr-chapter mt-3">Chương {ROMAN[s]}</p>
          <h1 id={headingId} className="jr-display mt-0.5">
            {srPrefix && <span className="sr-only">{srPrefix} · </span>}
            {STAGES[s].name}
          </h1>
        </div>
        {aside}
      </div>
      {children}
    </header>
  );
}

/** How far to the next chapter: both bars of the server (memory and items studied) as one share. */
export function chapterShare(j: JourneyOut, readiness: number | null): number | null {
  if (j.next_readiness == null || j.next_items == null) return null;
  const a = Math.min(1, (readiness ?? 0) / Math.max(1, j.next_readiness));
  const b = Math.min(1, j.items / Math.max(1, j.next_items));
  return Math.min(a, b);
}

/** One hairline toward the next chapter. */
export function ChapterProgress({
  journey,
  readiness,
  className,
}: {
  journey: JourneyOut;
  readiness: number | null;
  className?: string;
}) {
  if (journey.chapters?.length) {
    const ch = currentChapter(journey);
    if (!ch)
      return (
        <p className={cn("jr-eyebrow", className)}>Vương miện đã đội · giữ lâu đài luôn sáng</p>
      );
    return <ChapterWing chapter={ch} station={!!journey.station} className={className} />;
  }
  const share = chapterShare(journey, readiness);
  const next = asStage(journey.stage + 1);
  if (share === null)
    return <p className={cn("jr-eyebrow", className)}>Vương miện đã đội · giữ lâu đài luôn sáng</p>;
  const pct = Math.round(share * 100);
  return (
    <div className={cn("max-w-[260px]", className)}>
      <div className="jr-eyebrow flex justify-between gap-3">
        <span>Tới chương {ROMAN[next]}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={`Tới chương ${ROMAN[next]}: ${pct}%`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="jr-hairline mt-1.5"
      >
        <span style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

/** The swan on its ground, under its light, with at most one relic beside it, and its words as a
 * film's subtitle under them. A tap on the swan gives the next line, a tap on the relic its story. */
export function SwanStage({
  journey,
  lines,
  relic = null,
  size = "h-44 w-44",
  className,
}: {
  journey: JourneyOut;
  lines: string[];
  relic?: { kind: SceneRelic; node: (say: (line: string) => void) => ReactNode } | null;
  size?: string;
  className?: string;
}) {
  const [k, setK] = useState(0);
  const [said, setSaid] = useState<string | null>(null);
  const line = said ?? (lines.length ? (lines[k % lines.length] ?? "") : "");
  const typed = useTyped(line);
  const cursedLook = journey.cursed || journey.missed_days >= 3;
  // the drawing of the cursed swan has its own crows
  const away = cursedLook ? 0 : Math.min(3, journey.missed_days);
  const next = () => {
    if (said !== null) setSaid(null);
    else setK((x) => x + 1);
  };
  const lightOf = cursedLook ? "cursed" : journey.missed_days > 0 ? "dim" : "warm";
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="jr-stage" data-light={lightOf}>
        <span className="jr-key" aria-hidden="true" />
        {relic?.kind && <div className="jr-stage-relic">{relic.node((l) => setSaid(l))}</div>}
        <span className="jr-stage-swan">
          <span className="jr-ground" aria-hidden="true" />
          <SwanFigure
            stage={journey.shown_stage}
            cursed={cursedLook}
            sparkle={journey.sparkle ?? 0}
            className={size}
            onTap={next}
            label="Chạm vào thiên nga để nghe thêm"
          />
          <PerchedCrows away={away} />
        </span>
      </div>
      <p aria-live="polite" className="jr-subtitle mt-3">
        <span className={cn(!typed.done && "cine-caret")}>{typed.shown}</span>
      </p>
    </div>
  );
}

/** The weekly streak shield, small: bright while it is still there this week, faded once spent. */
export function ShieldGlyph({ ready, className }: { ready: boolean; className?: string }) {
  return (
    <span className={cn("jr-shield", className)} data-ready={ready || undefined} aria-hidden="true">
      <img src={PROP.shield} alt="" draggable={false} />
    </span>
  );
}

/** The five chapters as a line of numerals: the reached ones in gold, the current one ringed. */
export function JourneyPath({ stage, className }: { stage: number; className?: string }) {
  const cur = asStage(stage);
  return (
    <ol className={cn("jr-path", className)} aria-label="Năm chương">
      {([1, 2, 3, 4, 5] as Stage[]).map((n) => (
        <li
          key={n}
          data-state={n < cur ? "past" : n === cur ? "now" : "ahead"}
          aria-current={n === cur ? "step" : undefined}
        >
          <span className="jr-path-dot">{ROMAN[n]}</span>
          <span className="sr-only">
            Chương {ROMAN[n]} · {STAGES[n].name}
            {n < cur ? " (đã qua)" : n === cur ? " (đang ở đây)" : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
