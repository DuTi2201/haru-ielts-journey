import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import type { JourneyOut } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { PROP } from "./assets";

/* The two enchanted relics of the castle, after the rose under glass of the old fairy tale.
 *
 *   the rose       a petal falls for each day the learner stays away; studied today, it is in full
 *                  bloom again. When the curse falls (journey.cursed) the last petal is down and the
 *                  rose has gone grey.
 *   the hourglass  the sand left in today, Vietnam time (the day the server counts studying in).
 *                  Studied today, the sand stops and the glass turns gold: the streak is safe. */

export const PETALS = 5;

/** Petals already down: one at risk as soon as today has not been studied yet, one more per day away. */
export function fallenPetals(
  j: Pick<JourneyOut, "missed_days" | "cursed" | "studied_today">,
): number {
  if (j.cursed) return PETALS;
  if (j.studied_today) return 0;
  return Math.min(PETALS - 1, j.missed_days + 1);
}

const DAY = 86_400_000;
const VN_OFFSET = 7 * 3_600_000;

/** Milliseconds left in today, Vietnam time (null until mounted: the server renders no clock). */
export function useDayLeft(): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(DAY - ((Date.now() + VN_OFFSET) % DAY));
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, []);
  return left;
}

function hoursLeft(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} giờ ${String(m % 60).padStart(2, "0")}` : `${m % 60} phút`;
}

/** Where the fallen petals rest on the base (left %, turn), in the order they fall. */
const RESTING = [
  { x: 30, r: -24 },
  { x: 62, r: 32 },
  { x: 46, r: -70 },
  { x: 20, r: 55 },
  { x: 74, r: -12 },
];

const SPARKS = [
  { x: 22, y: 26, d: 0 },
  { x: 76, y: 18, d: -1.1 },
  { x: 70, y: 48, d: -2.3 },
  { x: 28, y: 56, d: -0.6 },
  { x: 52, y: 10, d: -1.7 },
];

export type RoseState = "bloom" | "wilt" | "last" | "dead";

export function roseState(fallen: number, cursed: boolean): RoseState {
  if (cursed || fallen >= PETALS) return "dead";
  if (fallen === 0) return "bloom";
  return fallen >= PETALS - 1 ? "last" : "wilt";
}

/** The rose under its glass. `fallen` and `state` can be given directly (the moments play the last
 * petal falling, or the petals flying back); `children` are drawn inside the glass. */
export function EnchantedRose({
  journey,
  fallen: givenFallen,
  className,
  children,
  falling = true,
}: {
  journey?: Pick<JourneyOut, "missed_days" | "cursed" | "studied_today">;
  fallen?: number;
  className?: string;
  children?: ReactNode;
  falling?: boolean;
}) {
  const fallen = givenFallen ?? (journey ? fallenPetals(journey) : 0);
  const state = roseState(fallen, givenFallen === undefined && !!journey?.cursed);
  return (
    <span
      role="img"
      aria-label={
        state === "dead"
          ? "Hoa hồng phép: cánh cuối cùng đã rơi"
          : `Hoa hồng phép: còn ${PETALS - fallen}/${PETALS} cánh`
      }
      data-state={state}
      className={cn("jr-rose", className)}
      style={{ "--wilt": Math.min(fallen, PETALS) / PETALS } as CSSProperties}
    >
      <span className="jr-rose-glow" aria-hidden="true" />
      {/* everything under the glass stays under the glass */}
      <span className="jr-jar-inside">
        <img
          src={state === "bloom" ? PROP.rose : PROP.roseWilted}
          alt=""
          data-wilted={state !== "bloom" || undefined}
          className="jr-rose-flower"
          draggable={false}
          decoding="async"
        />
        {state !== "dead" &&
          SPARKS.map((s) => (
            <span
              key={s.x}
              className="jr-spark"
              aria-hidden="true"
              style={{ left: `${s.x}%`, top: `${s.y}%`, "--d": `${s.d}s` } as CSSProperties}
            />
          ))}
        {falling && (state === "wilt" || state === "last") && (
          <span className="jr-petal jr-petal-falling" aria-hidden="true" />
        )}
        {children}
      </span>
      <span className="jr-jar" aria-hidden="true" />
      <span className="jr-jar-base" aria-hidden="true" />
    </span>
  );
}

/** Where the n-th petal (0-based) comes to rest, for the moments. */
export function restingSpot(n: number) {
  return RESTING[Math.min(n, RESTING.length - 1)] ?? { x: 50, r: 0 };
}

/* The drawing's glass, in its own 228 × 384 pixels: the sand in the top bulb, the sand heaped in
 * the bottom one, and the neck between them. The sand that has run is painted over with the glass. */
const TOP_SAND =
  "M64 127 L166 127 L161 145 L147 161 L128 180 L120 193 L108 193 L100 180 L84 161 L68 145 Z";
const BOTTOM_SAND =
  "M114 254 L136 257 L160 265 L172 278 L176 300 L160 307 L130 305 L114 299 L98 305 L68 307 L52 300 L56 278 L68 265 L92 257 Z";
const TOP = { from: 125, to: 194 };
const BOTTOM = { full: 256, empty: 298 };

export function EnchantedHourglass({
  journey,
  className,
}: {
  journey: Pick<JourneyOut, "studied_today" | "cursed">;
  className?: string;
}) {
  const left = useDayLeft();
  const ran = journey.cursed ? 1 : left === null ? 0.5 : 1 - left / DAY; // share of today already run
  const state = journey.cursed
    ? "out"
    : journey.studied_today
      ? "safe"
      : ran > 0.75
        ? "urgent"
        : "run";
  const topCut = TOP.from + ran * (TOP.to - TOP.from);
  const level = BOTTOM.empty - ran * (BOTTOM.empty - BOTTOM.full);
  return (
    <span
      role="img"
      aria-label={
        state === "safe"
          ? "Đồng hồ cát: hôm nay đã học, chuỗi được giữ"
          : state === "out"
            ? "Đồng hồ cát: cát đã cạn"
            : `Đồng hồ cát: còn ${left === null ? "…" : hoursLeft(left)} để giữ chuỗi hôm nay`
      }
      data-state={state}
      className={cn("jr-hourglass", className)}
    >
      <span className="jr-hourglass-glow" aria-hidden="true" />
      <img src={PROP.hourglass} alt="" draggable={false} decoding="async" />
      <svg viewBox="0 0 228 384" aria-hidden="true" className="jr-hourglass-sand">
        <defs>
          <clipPath id="jr-top-sand">
            <path d={TOP_SAND} />
          </clipPath>
          <clipPath id="jr-bottom-sand">
            <path d={BOTTOM_SAND} />
          </clipPath>
          <linearGradient id="jr-glass" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="rgb(196 182 176)" />
            <stop offset="0.35" stopColor="rgb(162 145 136)" />
            <stop offset="1" stopColor="rgb(148 132 127)" />
          </linearGradient>
          <filter id="jr-soft" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>
        {/* what has run out of the top bulb, and what has not yet heaped in the bottom one */}
        <rect
          x="40"
          y={TOP.from - 4}
          width="150"
          height={Math.max(0, topCut - TOP.from + 4)}
          fill="url(#jr-glass)"
          clipPath="url(#jr-top-sand)"
          filter="url(#jr-soft)"
        />
        <rect
          x="40"
          y={BOTTOM.full - 4}
          width="150"
          height={Math.max(0, level - BOTTOM.full + 4)}
          fill="url(#jr-glass)"
          clipPath="url(#jr-bottom-sand)"
          filter="url(#jr-soft)"
        />
        {state !== "safe" && state !== "out" && (
          <g className="jr-stream">
            <line x1="114" x2="114" y1="190" y2={level} />
            <line x1="114" x2="114" y1="190" y2={level} className="jr-grains" />
          </g>
        )}
      </svg>
      {state === "safe" && <span className="jr-seal" aria-hidden="true" />}
    </span>
  );
}

type Away = Pick<JourneyOut, "missed_days" | "cursed" | "studied_today">;

/** What the swan says when the rose is tapped (a subtitle: short). */
export function roseLine(j: Away): string {
  const fallen = fallenPetals(j);
  if (j.cursed) return "Hoa đã tàn… Học 2 ngày liền để hoa sống lại.";
  if (fallen === 0) return "Hôm nay bạn đã học, hoa nở trọn rồi!";
  if (fallen >= PETALS - 1) return "Chỉ còn một cánh! Hết hôm nay là lời nguyền đến.";
  return `Mỗi ngày vắng, một cánh rơi. Học hôm nay để hoa nở lại.`;
}

/** What the swan says when the hourglass is tapped. */
export function hourglassLine(j: Away, left: number | null): string {
  if (j.cursed) return "Cát đã cạn. Học một bài để lật lại đồng hồ.";
  if (j.studied_today) return "Hôm nay xong rồi, chuỗi của bạn an toàn.";
  return `Còn ${left === null ? "ít thời gian" : hoursLeft(left)} là hết ngày. Học ngay nhé!`;
}

/** A relic standing in the scene, on its own shadow: a tap makes the swan tell its story. */
function RelicButton({
  label,
  onTap,
  children,
}: {
  label: string;
  onTap?: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-label={label} onClick={onTap} className="jr-relic">
      <span className="jr-ground" aria-hidden="true" />
      {children}
    </button>
  );
}

export function RoseRelic({
  journey,
  onTap,
  className = "h-[112px] w-[70px]",
}: {
  journey: Away;
  onTap?: (line: string) => void;
  className?: string;
}) {
  const fallen = fallenPetals(journey);
  return (
    <RelicButton
      label={`Hoa hồng phép: ${journey.cursed ? "đã tàn" : `còn ${PETALS - fallen}/${PETALS} cánh`}. Chạm để nghe thiên nga kể`}
      onTap={() => onTap?.(roseLine(journey))}
    >
      <EnchantedRose journey={journey} className={className} />
    </RelicButton>
  );
}

export function HourglassRelic({
  journey,
  onTap,
  className = "h-[100px] w-[60px]",
}: {
  journey: Away;
  onTap?: (line: string) => void;
  className?: string;
}) {
  const left = useDayLeft();
  return (
    <RelicButton
      label={`Đồng hồ cát: ${hourglassLine(journey, left)} Chạm để nghe thiên nga kể`}
      onTap={() => onTap?.(hourglassLine(journey, left))}
    >
      <EnchantedHourglass journey={journey} className={className} />
    </RelicButton>
  );
}
