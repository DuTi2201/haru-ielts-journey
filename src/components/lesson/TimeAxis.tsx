import { useEffect, useRef, useState } from "react";
import { Play, Square, Volume2 } from "lucide-react";

import { speakKorean } from "@/lib/audio-playback";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { Ko } from "./Rich";

/** The "time axis" grammar card as a picture: five things a speaker may mean, each drawn on the
 * same axis (past on the left, now at the dashed line, future on the right) with its tense and a
 * sample sentence. Tap a row to light it up and hear the sentence; "Xem lần lượt" walks through
 * all five. The sentences are the card's own examples, in this order. */

type Shape = "repeat" | "window" | "span" | "done" | "point";

const ROWS: { shape: Shape; ask: string; tense: string }[] = [
  { shape: "repeat", ask: "Lặp lại quanh bây giờ?", tense: "Hiện tại đơn" },
  { shape: "window", ask: "Chỉ lúc này, tạm thời?", tense: "Hiện tại tiếp diễn" },
  { shape: "span", ask: "Bắt đầu từ trước, kéo tới bây giờ?", tense: "Hiện tại hoàn thành" },
  { shape: "done", ask: "Đã xong, không nói lúc nào?", tense: "Hiện tại hoàn thành" },
  { shape: "point", ask: "Đã xong, nói được lúc nào?", tense: "Quá khứ đơn" },
];

export const TIME_AXIS_ROWS = ROWS.length;
const NOW = 180; // x of "now" on a 300-wide axis

function Lane({ shape, on }: { shape: Shape; on: boolean }) {
  const c = "currentColor";
  return (
    <svg
      viewBox="0 0 300 30"
      className={cn("block h-[30px] w-full transition-colors duration-300", on ? "text-blue-deep" : "text-ink-2/60")}
      aria-hidden="true"
    >
      <line x1="6" y1="15" x2="286" y2="15" stroke={c} strokeWidth="1.5" opacity="0.35" />
      <path d="m286 10 8 5-8 5" fill="none" stroke={c} strokeWidth="1.5" opacity="0.35" />
      <line x1={NOW} y1="1" x2={NOW} y2="29" stroke={c} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
      {shape === "repeat" &&
        [NOW - 72, NOW - 36, NOW, NOW + 36, NOW + 72].map((x) => <circle key={x} cx={x} cy="15" r="6" fill={c} />)}
      {shape === "window" && (
        <>
          <rect x={NOW - 34} y="11" width="68" height="8" rx="4" fill={c} />
          <rect x={NOW - 36} y="5" width="4" height="20" rx="2" fill={c} />
          <rect x={NOW + 32} y="5" width="4" height="20" rx="2" fill={c} />
        </>
      )}
      {shape === "span" && (
        <>
          <rect x="46" y="11" width={NOW - 46} height="8" rx="4" fill={c} />
          <rect x="44" y="5" width="4" height="20" rx="2" fill={c} />
          <circle cx={NOW} cy="15" r="7" fill={c} />
          <line x1={NOW + 10} y1="15" x2={NOW + 44} y2="15" stroke={c} strokeWidth="3" strokeDasharray="5 5" />
        </>
      )}
      {shape === "done" && (
        <>
          <rect x="30" y="11" width="112" height="8" rx="4" fill={c} opacity="0.22" />
          <circle cx="86" cy="15" r="10" fill={c} />
          <text x="86" y="20" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">
            ?
          </text>
          <path d={`m${NOW - 26} 15 5 5 9-10`} fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {shape === "point" && (
        <>
          <rect x="84" y="3" width="4" height="24" rx="2" fill={c} />
          <circle cx="86" cy="15" r="7" fill={c} />
          <path d="M88 3h20l-5 5 5 5H88Z" fill={c} opacity="0.7" />
        </>
      )}
    </svg>
  );
}

export function TimeAxis({ examples }: { examples: { ko: string; vi: string | null }[] }) {
  const [active, setActive] = useState(2);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPlaying(false);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const show = (i: number, speak: boolean) => {
    setActive(i);
    const ex = examples[i];
    if (speak && ex) speakKorean(ex.ko);
  };
  const run = (i: number) => {
    if (i >= ROWS.length) return stop();
    show(i, true);
    timer.current = setTimeout(() => run(i + 1), 4200);
  };

  return (
    <div className="mt-3 rounded-[14px] bg-card px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">Năm câu hỏi trên một trục</p>
        <button
          type="button"
          onClick={() => {
            tap();
            if (playing) return stop();
            setPlaying(true);
            run(0);
          }}
          className="hit-area flex min-h-9 items-center gap-1.5 rounded-full bg-blue-soft px-3 text-[12.5px] font-bold text-blue-deep active:scale-95"
        >
          {playing ? <Square size={13} strokeWidth={3} /> : <Play size={13} strokeWidth={3} />}
          {playing ? "Dừng" : "Xem lần lượt"}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-[60%_1fr] text-[10.5px] font-bold uppercase tracking-wide text-ink-2" aria-hidden="true">
        <span>Quá khứ</span>
        <span className="flex justify-between">
          <span className="-translate-x-1/2 text-blue-deep">Bây giờ</span>
          <span>Tương lai</span>
        </span>
      </div>

      <ol className="mt-1 space-y-1.5">
        {ROWS.map((r, i) => {
          const ex = examples[i];
          const on = active === i;
          return (
            <li key={r.shape}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  stop();
                  tap();
                  show(i, true);
                }}
                className={cn(
                  "block w-full rounded-[12px] border px-2.5 py-2 text-left transition-colors duration-300",
                  on ? "border-blue bg-blue-soft" : "border-line bg-paper",
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-bold leading-5">{r.ask}</span>
                  <span className={cn("shrink-0 text-[11px] font-bold", on ? "text-blue-deep" : "text-ink-2")}>{r.tense}</span>
                </span>
                <Lane shape={r.shape} on={on} />
                {ex && (
                  <span className={cn("grid transition-[grid-template-rows] duration-300", on ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                    <span className="overflow-hidden">
                      <span className="mt-1 flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <Ko className="block text-[14px] font-semibold leading-6">{ex.ko}</Ko>
                          {ex.vi && <span className="block text-[12.5px] leading-5 text-ink-2">{ex.vi}</span>}
                        </span>
                        <Volume2 size={16} strokeWidth={2.4} className="mt-1 shrink-0 text-blue-deep" aria-hidden="true" />
                      </span>
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[12px] text-ink-2">Chạm vào một dòng để xem hình và nghe câu mẫu.</p>
    </div>
  );
}
