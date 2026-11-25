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

export type Shape = "repeat" | "window" | "span" | "done" | "point" | "trace" | "ended" | "always" | "pwin" | "cut" | "pair" | "before" | "upto" | "ptrace";

const ROWS: { shape: Shape; ask: string; tense: string }[] = [
  { shape: "repeat", ask: "Lặp lại quanh bây giờ?", tense: "Hiện tại đơn" },
  { shape: "window", ask: "Chỉ lúc này, tạm thời?", tense: "Hiện tại tiếp diễn" },
  { shape: "span", ask: "Bắt đầu từ trước, kéo tới bây giờ?", tense: "Hiện tại hoàn thành" },
  { shape: "done", ask: "Đã xong, không nói lúc nào?", tense: "Hiện tại hoàn thành" },
  { shape: "point", ask: "Đã xong, nói được lúc nào?", tense: "Quá khứ đơn" },
];

export const TIME_AXIS_ROWS = ROWS.length;
const NOW = 180; // x of "now" on a 300-wide axis

export function Lane({ shape, on }: { shape: Shape; on: boolean }) {
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
      {shape === "trace" && (
        <>
          <rect x="60" y="11" width={NOW - 78} height="8" rx="4" fill={c} />
          <circle cx={NOW} cy="15" r="8" fill="none" stroke={c} strokeWidth="3" />
          <circle cx={NOW} cy="15" r="2.5" fill={c} />
        </>
      )}
      {shape === "always" && (
        <>
          <rect x="20" y="11" width="248" height="8" rx="4" fill={c} />
          <path d="m266 7 10 8-10 8" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {shape === "ended" && (
        <>
          <rect x="40" y="11" width="80" height="8" rx="4" fill={c} />
          <path d="m126 9 12 12m0-12-12 12" stroke={c} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {/* pwin: a temporary stretch in the past, around one moment (the past continuous) */}
      {shape === "pwin" && (
        <>
          <rect x="52" y="11" width="68" height="8" rx="4" fill={c} opacity="0.85" />
          <rect x="50" y="5" width="4" height="20" rx="2" fill={c} />
          <rect x="118" y="5" width="4" height="20" rx="2" fill={c} />
          <circle cx="86" cy="15" r="6" fill="none" stroke={c} strokeWidth="3" />
        </>
      )}
      {/* cut: an action in progress, cut into by a short one */}
      {shape === "cut" && (
        <>
          <rect x="34" y="11" width="70" height="8" rx="4" fill={c} />
          <line x1="112" y1="15" x2="146" y2="15" stroke={c} strokeWidth="3" strokeDasharray="4 4" opacity="0.45" />
          <path d="m110 2-8 12h7l-6 14 13-17h-7l6-9Z" fill={c} />
        </>
      )}
      {/* pair: two actions in progress at the same time */}
      {shape === "pair" && (
        <>
          <rect x="44" y="5" width="96" height="7" rx="3.5" fill={c} />
          <rect x="44" y="18" width="96" height="7" rx="3.5" fill={c} opacity="0.6" />
        </>
      )}
      {/* before: one action finished before a past moment (the marked tick): the past perfect */}
      {shape === "before" && (
        <>
          <circle cx="58" cy="15" r="7" fill={c} />
          <line x1="68" y1="15" x2="122" y2="15" stroke={c} strokeWidth="3" strokeDasharray="2 5" strokeLinecap="round" />
          <g>
            <rect x="128" y="3" width="4" height="24" rx="2" fill={c} />
            <path d="m124 3 6 6 6-6Z" fill={c} />
          </g>
        </>
      )}
      {/* upto: an action going on up to a past moment: the past perfect continuous */}
      {shape === "upto" && (
        <>
          <rect x="36" y="11" width="90" height="8" rx="4" fill={c} />
          <g>
            <rect x="128" y="3" width="4" height="24" rx="2" fill={c} />
            <path d="m124 3 6 6 6-6Z" fill={c} />
          </g>
        </>
      )}
      {/* ptrace: it went on, stopped just before a past moment, and left a trace at that moment */}
      {shape === "ptrace" && (
        <>
          <rect x="36" y="11" width="62" height="8" rx="4" fill={c} />
          <path d="m124 0 6 5 6-5Z" fill={c} />
          <circle cx="130" cy="15" r="8" fill="none" stroke={c} strokeWidth="3" />
          <circle cx="130" cy="15" r="2.5" fill={c} />
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

/** The picture that goes with an example sentence of the Day 3 cards, by the sentence itself. */
const EXAMPLE_LANES: Record<string, Shape> = {
  "I have lived here for six years.": "span",
  "She has known him since she was a child.": "span",
  "I studied the piano for two years.": "ended",
  "I have often seen him at the library.": "span",
  "Yes, I have bought some vegetables.": "done",
  "Have you ever been to Italy?": "done",
  "I went there two years ago.": "point",
  "My parents have gone to Hue.": "span",
  "I have been to Hue twice.": "done",
  "I have been playing football for the last three hours.": "span",
  "I'm out of breath because I have been running.": "trace",
  "Have you been watching TV for the last four hours? Turn it off!": "span",
  "I have been trying to call Lan all morning.": "span",
  "I have read that book.": "done",
  "I have been reading that book.": "span",
  "I have written three essays this week.": "done",
  // Day 4: the review of the four present tenses
  "I get up at six every morning.": "repeat",
  "Water boils at 100 degrees.": "always",
  "He is always leaving his clothes on the floor!": "repeat",
  "I have studied the piano since 2003.": "span",
  "I have been playing football for three hours.": "span",
  "I am very tired. I have been running for three hours.": "trace",
  "My brother plays football almost every weekend.": "repeat",
  "Mr Connors owns two houses and a villa.": "always",
  "I'm studying harder this month.": "window",
  "I work as an accountant in a small company.": "always",
  "This month I'm also studying for an IELTS test.": "window",
  "I have worked there since 2022, and my colleagues are very friendly.": "span",
  "Recently I have been doing a lot of extra tasks, so I'm quite tired.": "trace",
  // Week 2 · Day 1: the past simple and its line with the present perfect
  "My grandfather bought his first phone in 1998.": "point",
  "The first mobile phones appeared in the 1980s.": "point",
  "Yes, I have bought some.": "done",
  "Yes, I went there with my family two years ago.": "point",
  "I studied the piano in 2003.": "point",
  "I have studied the piano for two years.": "span",
  "I studied the piano for two years, then I stopped.": "ended",
  // Week 2 · Day 2: the past continuous
  "Yesterday I was playing football at seven.": "pwin",
  "At five o'clock, I was reading a book.": "pwin",
  "In 2019, my brother was living in Da Nang.": "pwin",
  "I was watching TV at eight o'clock.": "pwin",
  "Richard was watching TV when the phone rang.": "cut",
  "My cousin and I were playing on the computer when there was a power cut.": "cut",
  "I was playing football while my friends were playing badminton.": "pair",
  "I charged my phone as soon as I got home.": "point",
  // Week 2 · Day 3: the past perfect and the past perfect continuous
  "When I got to the station, the train had left.": "before",
  "I had already bought the phone when I saw it was cheaper online.": "before",
  "When I got home, my brother had eaten all the pizza.": "before",
  "I was late because I had left my judo suit at home.": "before",
  "We had been waiting for over an hour when the bus finally came.": "upto",
  "Her eyes were red because she had been crying.": "ptrace",
  "The engineers had been testing the app for six months before they launched it.": "upto",
  "Before I met Anna, I had been running for two hours.": "upto",
  "By 2020, the company had sold a million phones.": "before",
  "I had known Lan for ten years when we started the company.": "upto",
};
export const laneForExample = (en: string): Shape | null => EXAMPLE_LANES[en.trim()] ?? null;

/** The four answers of a "choose the timeline" question, as they are written in the exercise bank. */
const OPTION_LANES: Record<string, { shape: Shape; label: string }> = {
  "quá khứ ●━━━━━━▶ bây giờ (còn tiếp)": { shape: "span", label: "Bắt đầu từ trước, kéo tới bây giờ" },
  "quá khứ ● (xong, không rõ lúc nào) ┄┄ bây giờ": { shape: "done", label: "Đã xong, không rõ lúc nào" },
  "├─ bây giờ ─┤ (tạm thời, rồi hết)": { shape: "window", label: "Tạm thời quanh lúc này" },
  "● ● ● ● lặp lại quanh bây giờ": { shape: "repeat", label: "Lặp lại quanh bây giờ" },
  "quá khứ ━━━━● vừa dừng, còn dấu vết": { shape: "trace", label: "Vừa dừng, còn dấu vết ở bây giờ" },
  "quá khứ ● (một mốc nói được) ┄┄ bây giờ": { shape: "point", label: "Một mốc đã qua, nói được lúc nào" },
  "quá khứ ●━━━● (đã dừng) ┄┄ bây giờ": { shape: "ended", label: "Kéo dài một thời gian, rồi đã dừng" },
  "quá khứ ├●┤ (đang diễn ra quanh một mốc) ┄┄ bây giờ": { shape: "pwin", label: "Đang diễn ra quanh một mốc đã qua" },
  "quá khứ ━━ϟ┄┄ (đang diễn ra thì bị cắt ngang) ┄┄ bây giờ": { shape: "cut", label: "Đang diễn ra thì bị một việc ngắn cắt ngang" },
  "quá khứ ══ (hai việc cùng diễn ra) ┄┄ bây giờ": { shape: "pair", label: "Hai việc cùng diễn ra một lúc" },
  "quá khứ ●┄▲ (xong trước một mốc quá khứ) ┄┄ bây giờ": { shape: "before", label: "Xong trước một mốc trong quá khứ" },
  "quá khứ ━━▲ (kéo dài tới một mốc quá khứ) ┄┄ bây giờ": { shape: "upto", label: "Kéo dài tới một mốc trong quá khứ" },
  "quá khứ ━━◯ (vừa dừng trước mốc, còn dấu vết) ┄┄ bây giờ": { shape: "ptrace", label: "Vừa dừng trước mốc, còn dấu vết lúc đó" },
};
export const laneForOption = (text: string) => OPTION_LANES[text.trim()] ?? null;

/** A small axis under one sentence: past, the dashed "now" line, future. */
export function MiniLane({ shape, label }: { shape: Shape; label?: string }) {
  return (
    <span className="block">
      {label && <span className="block text-[13.5px] font-semibold leading-5">{label}</span>}
      <Lane shape={shape} on />
      <span className="grid grid-cols-[60%_1fr] text-[9.5px] font-bold uppercase tracking-wide text-ink-2" aria-hidden="true">
        <span>Quá khứ</span>
        <span className="-translate-x-[18px]">Bây giờ</span>
      </span>
    </span>
  );
}

/** The map of the four present tenses (Day 4, first card) as a picture: two questions, four cells.
 * Rows: linked to the past or not. Columns: temporary / ongoing or not. Each cell holds its tense,
 * its form, its shape on the axis and the card's own sample sentence (the four examples, in the
 * order simple, continuous, perfect, perfect continuous). Tap a cell to hear its sentence. */
const MAP: { tense: string; form: string; shape: Shape }[] = [
  { tense: "Hiện tại đơn", form: "V / V-s", shape: "always" },
  { tense: "Hiện tại tiếp diễn", form: "am / is / are + V-ing", shape: "window" },
  { tense: "Hiện tại hoàn thành", form: "have / has + V3", shape: "span" },
  { tense: "Hoàn thành tiếp diễn", form: "have / has been + V-ing", shape: "span" },
];
export const TENSE_MAP_CELLS = MAP.length;

export function TenseMap({ examples }: { examples: { ko: string; vi: string | null }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const cell = (i: number) => {
    const m = MAP[i];
    const ex = examples[i];
    const on = active === i;
    if (!m) return null;
    return (
      <button
        key={i}
        type="button"
        aria-pressed={on}
        onClick={() => {
          tap();
          setActive(i);
          if (ex) speakKorean(ex.ko);
        }}
        className={cn(
          "flex min-w-0 flex-col gap-0.5 rounded-[12px] border px-2.5 py-2 text-left transition-colors duration-300",
          on ? "border-blue bg-blue-soft" : "border-line bg-paper",
          i % 2 === 1 && !on && "bg-[oklch(0.97_0.03_165)]",
        )}
      >
        <span className="text-[12.5px] font-extrabold leading-tight">{m.tense}</span>
        <span lang="en" className="text-[11px] font-semibold leading-tight text-ink-2">{m.form}</span>
        <Lane shape={m.shape} on={on} />
        {ex && <Ko className="block text-[13px] font-semibold leading-5">{ex.ko}</Ko>}
        {ex?.vi && <span className="block text-[11.5px] leading-4 text-ink-2">{ex.vi.replace(/\s*\(.*\)\s*$/, "")}</span>}
      </button>
    );
  };
  const rowHead = (text: string, strong: boolean) => (
    <p className="mt-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wide text-ink-2">
      <span className={cn("h-px flex-1", strong ? "bg-blue" : "bg-line")} />
      <span className={strong ? "text-blue-deep" : undefined}>{text}</span>
      <span className={cn("h-px flex-1", strong ? "bg-blue" : "bg-line")} />
    </p>
  );
  return (
    <div className="mt-3 rounded-[14px] bg-card px-3 py-3">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">Hai câu hỏi, bốn ô</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center text-[10.5px] font-bold uppercase leading-tight tracking-wide">
        <span className="rounded-full bg-paper px-2 py-1 text-ink-2">Không nhấn tạm thời</span>
        <span className="rounded-full bg-[oklch(0.95_0.05_165)] px-2 py-1 text-[oklch(0.42_0.1_165)]">Nhấn tạm thời, quá trình</span>
      </div>
      {rowHead("Chưa nối với quá khứ", false)}
      <div className="mt-1 grid grid-cols-2 gap-2">{[0, 1].map(cell)}</div>
      {rowHead("Nối từ quá khứ tới bây giờ · thêm have", true)}
      <div className="mt-1 grid grid-cols-2 gap-2">{[2, 3].map(cell)}</div>
      <p className="mt-2 text-[12px] text-ink-2">Cột phải thêm be + V-ing. Chạm vào một ô để nghe câu mẫu.</p>
    </div>
  );
}

/** The map of eight tenses (Week 2 · Day 4, first card): the Week 1 map of four cells, plus the third question,
 * "seen from now or from a past moment?", as a two-way switch. The same four cells show the present tense or its
 * past pair; the card's eight examples are in the order simple, continuous, perfect, perfect continuous for the
 * present, then the same for the past. Tap a cell to hear its sentence. */
const PAST_MAP: { tense: string; form: string; shape: Shape }[] = [
  { tense: "Quá khứ đơn", form: "V2 / V-ed", shape: "point" },
  { tense: "Quá khứ tiếp diễn", form: "was / were + V-ing", shape: "pwin" },
  { tense: "Quá khứ hoàn thành", form: "had + V3", shape: "before" },
  { tense: "QK hoàn thành tiếp diễn", form: "had been + V-ing", shape: "upto" },
];
export const EIGHT_MAP_CELLS = MAP.length + PAST_MAP.length;

export function EightMap({ examples }: { examples: { ko: string; vi: string | null }[] }) {
  const [past, setPast] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const map = past ? PAST_MAP : MAP;
  const cell = (i: number) => {
    const m = map[i];
    const ex = examples[i + (past ? 4 : 0)];
    const on = active === i;
    if (!m) return null;
    return (
      <button
        key={`${past ? "p" : "n"}${i}`}
        type="button"
        aria-pressed={on}
        onClick={() => {
          tap();
          setActive(i);
          if (ex) speakKorean(ex.ko);
        }}
        className={cn(
          "flex min-w-0 flex-col gap-0.5 rounded-[12px] border px-2.5 py-2 text-left transition-colors duration-300",
          on ? "border-blue bg-blue-soft" : "border-line bg-paper",
          i % 2 === 1 && !on && "bg-[oklch(0.97_0.03_165)]",
        )}
      >
        <span className="text-[12.5px] font-extrabold leading-tight">{m.tense}</span>
        <span lang="en" className="text-[11px] font-semibold leading-tight text-ink-2">{m.form}</span>
        <Lane shape={m.shape} on={on} />
        {ex && <Ko className="block text-[13px] font-semibold leading-5">{ex.ko}</Ko>}
        {ex?.vi && <span className="block text-[11.5px] leading-4 text-ink-2">{ex.vi.replace(/\s*\(.*\)\s*$/, "")}</span>}
      </button>
    );
  };
  const rowHead = (text: string, strong: boolean) => (
    <p className="mt-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wide text-ink-2">
      <span className={cn("h-px flex-1", strong ? "bg-blue" : "bg-line")} />
      <span className={strong ? "text-blue-deep" : undefined}>{text}</span>
      <span className={cn("h-px flex-1", strong ? "bg-blue" : "bg-line")} />
    </p>
  );
  const seg = (label: string, value: boolean) => (
    <button
      type="button"
      aria-pressed={past === value}
      onClick={() => {
        tap();
        setPast(value);
        setActive(null);
      }}
      className={cn(
        "hit-area min-h-9 flex-1 rounded-full px-3 text-[12.5px] font-bold transition-colors duration-200",
        past === value ? "bg-blue text-primary-foreground shadow-elev-1" : "text-ink-2",
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="mt-3 rounded-[14px] bg-card px-3 py-3">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">Ba câu hỏi, tám thì</p>
      <div className="mt-2 flex gap-1 rounded-full bg-paper p-1" role="group" aria-label="Nhìn từ bây giờ hay từ một mốc quá khứ">
        {seg("Nhìn từ bây giờ", false)}
        {seg("Từ một mốc quá khứ", true)}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center text-[10.5px] font-bold uppercase leading-tight tracking-wide">
        <span className="rounded-full bg-paper px-2 py-1 text-ink-2">Không nhấn tạm thời</span>
        <span className="rounded-full bg-[oklch(0.95_0.05_165)] px-2 py-1 text-[oklch(0.42_0.1_165)]">Nhấn tạm thời, quá trình</span>
      </div>
      {rowHead("Chưa nối với việc trước", false)}
      <div className="mt-1 grid grid-cols-2 gap-2">{[0, 1].map(cell)}</div>
      {rowHead(past ? "Nối với việc trước · thêm had" : "Nối với việc trước · thêm have", true)}
      <div className="mt-1 grid grid-cols-2 gap-2">{[2, 3].map(cell)}</div>
      <p className="mt-2 text-[12px] text-ink-2">
        {past ? "Từ một mốc quá khứ: lùi trợ động từ đầu tiên (am → was, have → had)." : "Cột phải thêm be + V-ing. Chạm vào một ô để nghe câu mẫu."}
      </p>
    </div>
  );
}
