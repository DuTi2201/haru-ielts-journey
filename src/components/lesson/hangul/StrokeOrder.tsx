import { useState } from "react";
import { Play } from "lucide-react";

import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { Ko } from "../Rich";

/** Where each stroke of the six basic vowels starts and ends (a 100 x 100 box), in writing order,
 * and where its number sits. Strokes go top to bottom and left to right. */
interface Stroke {
  from: [number, number];
  to: [number, number];
  badge: [number, number];
}
const VOWELS: { ch: string; name: string; strokes: Stroke[] }[] = [
  {
    ch: "ㅏ",
    name: "a",
    strokes: [
      { from: [40, 14], to: [40, 86], badge: [26, 14] },
      { from: [40, 50], to: [68, 50], badge: [56, 36] },
    ],
  },
  {
    ch: "ㅓ",
    name: "ơ",
    strokes: [
      { from: [32, 50], to: [60, 50], badge: [32, 36] },
      { from: [60, 14], to: [60, 86], badge: [76, 14] },
    ],
  },
  {
    ch: "ㅗ",
    name: "ô",
    strokes: [
      { from: [50, 22], to: [50, 56], badge: [36, 22] },
      { from: [16, 56], to: [84, 56], badge: [16, 72] },
    ],
  },
  {
    ch: "ㅜ",
    name: "u",
    strokes: [
      { from: [16, 44], to: [84, 44], badge: [16, 30] },
      { from: [50, 44], to: [50, 78], badge: [64, 66] },
    ],
  },
  { ch: "ㅡ", name: "ư", strokes: [{ from: [16, 50], to: [84, 50], badge: [16, 36] }] },
  { ch: "ㅣ", name: "i", strokes: [{ from: [50, 14], to: [50, 86], badge: [36, 14] }] },
];

const d = (s: Stroke) => `M${s.from[0]} ${s.from[1]} L${s.to[0]} ${s.to[1]}`;

/** A small chevron at the end of a stroke, so the direction reads on its own. */
function Chevron({ s }: { s: Stroke }) {
  const dx = s.to[0] - s.from[0];
  const dy = s.to[1] - s.from[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const [ex, ey] = s.to;
  const bx = ex - ux * 11;
  const by = ey - uy * 11;
  const px = -uy * 6;
  const py = ux * 6;
  return (
    <polyline
      points={`${bx + px},${by + py} ${ex - ux * 3},${ey - uy * 3} ${bx - px},${by - py}`}
      className="fill-none stroke-white"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Glyph({ strokes, className }: { strokes: Stroke[]; className?: string }) {
  return (
    <>
      {strokes.map((s, i) => (
        <path
          key={i}
          d={d(s)}
          className={cn("fill-none stroke-current", className)}
          strokeWidth="9"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

/** One line of the notebook: a model, a faint copy to trace, then two empty squares. */
function Cells({ strokes }: { strokes: Stroke[] }) {
  return (
    <div className="grid grid-cols-4 gap-2" aria-hidden="true">
      {[1, 0.16, 0, 0].map((o, n) => (
        <svg
          key={n}
          viewBox="0 0 100 100"
          className="aspect-square w-full rounded-[10px] border border-line bg-card text-ink"
        >
          <path
            d="M50 4 V96 M4 50 H96"
            className="fill-none stroke-line"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          {o > 0 && (
            <g opacity={o}>
              <Glyph strokes={strokes} />
            </g>
          )}
        </svg>
      ))}
    </div>
  );
}

export function StrokeOrder() {
  const [at, setAt] = useState(0);
  const [run, setRun] = useState(0);
  const v = VOWELS[at]!;
  return (
    <section
      aria-label="Tập viết nét"
      className="rounded-[20px] border border-line bg-card p-3.5 shadow-elev-1"
    >
      <div role="group" aria-label="Chọn nguyên âm" className="grid grid-cols-6 gap-1.5">
        {VOWELS.map((x, i) => (
          <button
            key={x.ch}
            type="button"
            aria-pressed={i === at}
            onClick={() => {
              tap();
              setAt(i);
              setRun((r) => r + 1);
            }}
            className={cn(
              "hit-area min-h-12 rounded-[12px] border border-line text-[24px] font-bold",
              i === at ? "bg-blue text-primary-foreground" : "bg-paper",
            )}
          >
            <Ko>{x.ch}</Ko>
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center">
        <svg
          key={`${at}-${run}`}
          viewBox="0 0 100 100"
          role="img"
          aria-label={`Cách viết ${v.ch} (${v.name}): ${v.strokes.length} nét, theo thứ tự đánh số`}
          className="h-44 w-44 rounded-[18px] bg-paper text-ink"
        >
          <Glyph strokes={v.strokes} className="opacity-[0.12]" />
          {v.strokes.map((s, i) => (
            <path
              key={i}
              d={d(s)}
              pathLength={1}
              className="hg-stroke fill-none stroke-current"
              style={{ animationDelay: `${i * 0.8}s` }}
              strokeWidth="9"
              strokeLinecap="round"
            />
          ))}
          {v.strokes.map((s, i) => (
            <g key={`c${i}`} className="hg-tip" style={{ animationDelay: `${i * 0.8 + 0.6}s` }}>
              <Chevron s={s} />
            </g>
          ))}
          {v.strokes.map((s, i) => (
            <g key={`b${i}`}>
              <circle cx={s.badge[0]} cy={s.badge[1]} r="8" className="fill-blue" />
              <text
                x={s.badge[0]}
                y={s.badge[1] + 4}
                textAnchor="middle"
                className="fill-white text-[11px] font-bold"
                fontFamily="inherit"
              >
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <button
        type="button"
        onClick={() => {
          tap();
          setRun((r) => r + 1);
        }}
        className="hit-area mx-auto mt-2 flex min-h-11 items-center gap-1.5 rounded-full bg-blue px-4 text-[13px] font-semibold text-primary-foreground"
      >
        <Play size={14} aria-hidden="true" /> Xem vẽ
      </button>

      <p className="mt-3 text-[12.5px] font-semibold leading-5">
        Ô ly: chép vào vở 1 dòng, đọc to «{v.name}» mỗi lần viết.
      </p>
      <div className="mt-1.5">
        <Cells strokes={v.strokes} />
      </div>
    </section>
  );
}
