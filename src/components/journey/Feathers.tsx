import type { CSSProperties } from "react";

import { FeatherGlyph } from "@/components/feathers/Feather";
import type { ConstellationOut, JourneyChapterOut, JourneyOut } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { RELIC_ART } from "./assets";
import { relicOf, ROMAN_CH } from "./feather-data";

/* The feathers on the journey side (app/services/feathers.py): the chapter's wing filling up, the
 * starlight that makes the swan sparkle, the relics of the support topics and their constellations.
 * The relics are drawn as medallions until their pictures arrive. */

const WING = 12;

/** The chapter's wing: twelve primaries that whiten as its feathers are earned. */
export function ChapterWing({
  chapter,
  station = false,
  className,
}: {
  chapter: JourneyChapterOut;
  station?: boolean;
  className?: string | undefined;
}) {
  const have = chapter.earned + chapter.credited;
  const share = chapter.total ? have / chapter.total : 0;
  const lit = Math.min(WING, Math.floor(share * WING + 1e-9));
  const pct = Math.round(share * 100);
  return (
    <div className={cn("max-w-[300px]", className)}>
      <div className="jr-eyebrow flex justify-between gap-3">
        <span>
          Chương {ROMAN_CH[chapter.n]} · {chapter.level}
        </span>
        <span className="tabular-nums">
          {have}/{chapter.total} lông
        </span>
      </div>
      <div
        className="jr-wing mt-1"
        role="progressbar"
        aria-label={`Chương ${ROMAN_CH[chapter.n]}: ${have}/${chapter.total} lông`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {Array.from({ length: WING }, (_, i) => (
          <span
            key={i}
            style={
              {
                "--i": i,
                // along the arc of a wing: the first primaries low and long, the last high and short
                left: `${4 + i * 18}px`,
                bottom: `${Math.round(16 * Math.sin((i / (WING - 1)) * Math.PI * 0.85))}px`,
                rotate: `${-40 + i * 6.5}deg`,
              } as CSSProperties
            }
            data-on={i < lit || undefined}
          >
            <FeatherGlyph look={i < lit ? "earned" : "empty"} size={40 - i * 1.4} />
          </span>
        ))}
      </div>
      <p className="jr-eyebrow mt-1 !normal-case !tracking-normal opacity-90">
        {chapter.n === 3 && station ? "Đã thấy bờ xa · " : ""}Đủ lông:{" "}
        {chapter.becomes.toLowerCase()}
      </p>
    </div>
  );
}

/** Starlight caught in the feathers: a few motes at sparkle 1, a shower at 3. */
export function SparkleDust({ level }: { level: number }) {
  if (level <= 0) return null;
  const n = [0, 7, 14, 24][Math.min(3, level)]!;
  return (
    <span className="jr-sparkle" data-level={level} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          style={
            {
              left: `${12 + ((i * 37) % 76)}%`,
              top: `${18 + ((i * 53) % 64)}%`,
              "--d": `${(i % 7) * 0.37}s`,
              "--s": `${0.6 + (i % 3) * 0.3}`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

export function RelicMedallion({
  code,
  name,
  earned = true,
  size = 44,
  className,
}: {
  code: string;
  name?: string | null | undefined;
  earned?: boolean;
  size?: number;
  className?: string | undefined;
}) {
  const r = relicOf(code, name);
  const art = RELIC_ART[code];
  if (art)
    return (
      <img
        src={art}
        alt={earned ? r.name : `${r.name} (chưa có)`}
        draggable={false}
        decoding="async"
        className={cn("jr-relic-art", className)}
        data-earned={earned || undefined}
        style={{ height: size, width: "auto", "--tone": r.tone } as CSSProperties}
      />
    );
  return (
    <span
      className={cn("jr-relic-medal", className)}
      data-earned={earned || undefined}
      style={{ width: size, height: size, "--tone": r.tone } as CSSProperties}
      role="img"
      aria-label={earned ? r.name : `${r.name} (chưa có)`}
    >
      <r.Icon size={size * 0.48} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

/** Where the stars of a constellation sit: the same shape every time for one topic. */
function starPoints(code: string, n: number): [number, number][] {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = 14 + t * 132 + ((h % 17) - 8);
    const y = 50 + Math.sin(t * Math.PI * 1.6 + (h % 5)) * 26 + ((h >> 5) % 13) - 6;
    pts.push([Math.round(x), Math.round(Math.max(10, Math.min(90, y)))]);
  }
  return pts;
}

/** A support topic in the sky: its lessons as stars, joined in order; a lit star is a lesson with
 * all its starlight feathers. */
export function Constellation({ c }: { c: ConstellationOut }) {
  const pts = starPoints(c.code, c.stars.length);
  const lit = c.stars.filter((s) => s.lit).length;
  return (
    <figure className="jr-constellation flex items-center gap-3">
      <svg viewBox="0 0 160 100" className="w-[112px] shrink-0" aria-hidden="true">
        <polyline
          points={pts.map((p) => p.join(",")).join(" ")}
          fill="none"
          className="jr-constellation-line"
        />
        {pts.map(([x, y], i) => {
          const s = c.stars[i]!;
          return (
            <g key={s.lesson_id} data-lit={s.lit || undefined} className="jr-star">
              {s.lit && <circle cx={x} cy={y} r={7} className="jr-star-halo" />}
              <circle cx={x} cy={y} r={s.lit ? 3.4 : 2.2} />
            </g>
          );
        })}
      </svg>
      <figcaption className="flex min-w-0 flex-1 items-center gap-2.5">
        <RelicMedallion code={c.code} name={c.relic} earned={c.relic_earned} size={36} />
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold leading-5">{c.name}</span>
          <span className="jr-ink-soft block text-[12px] leading-4">
            {lit}/{c.stars.length} sao ·{" "}
            {c.relic_earned ? relicOf(c.code, c.relic).name : c.topic.replace(/^Bổ trợ\s*·\s*/, "")}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/** How bright the swan is: three steps of starlight, fixed counts. */
export function SparkleMeter({ j, className }: { j: JourneyOut; className?: string }) {
  const level = j.sparkle ?? 0;
  const have = j.starlight ?? 0;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="flex gap-1" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <FeatherGlyph key={n} look={n <= level ? "star" : "star-empty"} size={26} />
        ))}
      </span>
      <p className="min-w-0 text-[13px] leading-5">
        <b>Lấp lánh {level}/3</b>
        <span className="jr-ink-soft block text-[12px]">
          {j.next_sparkle_at
            ? `${have}/${j.next_sparkle_at} lông ánh sao tới bậc ${level + 1}`
            : `${have} lông ánh sao · sáng nhất rồi`}
        </span>
      </p>
    </div>
  );
}
