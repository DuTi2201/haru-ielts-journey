import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useState } from "react";
import { ArrowRight, X } from "lucide-react";

import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { Ko } from "../Rich";
import { BlockParts } from "./parts";

/** The preparation before the very first sound, as a short full-screen walk-through: one picture,
 * one line and one button per screen. It runs once; afterwards it folds into a single link. */

const ART = "mx-auto h-44 w-full max-w-[320px]";
const LINE = "fill-none stroke-current";

function Shoulders() {
  return (
    <svg
      viewBox="0 0 240 160"
      className={cn(ART, "text-ink")}
      role="img"
      aria-label="Vai nhún lên rồi thả xuống"
    >
      <circle cx="120" cy="52" r="24" className={LINE} strokeWidth="4" />
      <path
        d="M40 150 C40 108 80 96 120 96 C160 96 200 108 200 150"
        className={LINE}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g className="text-blue" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M50 96 V68 M42 76 L50 66 L58 76" className={LINE} />
        <path d="M68 70 V98 M60 90 L68 100 L76 90" className={LINE} opacity="0.55" />
        <path d="M190 96 V68 M182 76 L190 66 L198 76" className={LINE} />
        <path d="M172 70 V98 M164 90 L172 100 L180 90" className={LINE} opacity="0.55" />
      </g>
    </svg>
  );
}

function Belly() {
  return (
    <svg
      viewBox="0 0 240 160"
      className={cn(ART, "text-ink")}
      role="img"
      aria-label="Bụng phồng lên khi hít vào"
    >
      <circle cx="120" cy="30" r="18" className={LINE} strokeWidth="4" />
      <path
        d="M92 56 C84 96 90 128 100 150 M148 56 C156 96 150 128 140 150"
        className={LINE}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <ellipse
        cx="120"
        cy="108"
        rx="26"
        ry="22"
        className="fill-blue-soft stroke-current text-blue"
        strokeWidth="4"
      />
      <g className="text-blue" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 108 H84 M76 100 L86 108 L76 116" className={LINE} />
        <path d="M180 108 H156 M164 100 L154 108 L164 116" className={LINE} />
      </g>
    </svg>
  );
}

function Jaw() {
  return (
    <svg
      viewBox="0 0 240 160"
      className={cn(ART, "text-ink")}
      role="img"
      aria-label="Miệng mở theo chiều dọc như ngáp"
    >
      <circle cx="104" cy="80" r="62" className={LINE} strokeWidth="4" />
      <circle cx="84" cy="58" r="5" className="fill-current stroke-none" />
      <circle cx="124" cy="58" r="5" className="fill-current stroke-none" />
      <ellipse
        cx="104"
        cy="106"
        rx="15"
        ry="22"
        className="fill-blue-soft stroke-current text-blue"
        strokeWidth="4"
      />
      <g className="text-blue" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M104 146 V158 M96 150 L104 158 L112 150" className={LINE} />
      </g>
    </svg>
  );
}

function Flat() {
  return (
    <svg
      viewBox="0 0 240 160"
      className={cn(ART, "text-ink")}
      role="img"
      aria-label="Giọng Hàn đi thẳng, giọng Việt lên xuống"
    >
      <path
        d="M20 66 C40 42 60 68 80 44 S120 42 140 78 S190 46 220 72"
        className={LINE}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="2 8"
        opacity="0.85"
      />
      <path
        d="M20 110 H220"
        className="fill-none stroke-current text-blue"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <text x="20" y="28" className="fill-current text-[13px]" fontFamily="inherit">
        tiếng Việt: lên xuống
      </text>
      <text x="20" y="144" className="fill-current text-[13px] font-bold" fontFamily="inherit">
        tiếng Hàn: 아— đều
      </text>
    </svg>
  );
}

function ThreeStrokes() {
  const col = (x: number, label: string, shape: ReactNode) => (
    <g key={label}>
      <rect x={x} y="14" width="64" height="96" rx="14" className="fill-blue-soft stroke-none" />
      {shape}
      <text
        x={x + 32}
        y="140"
        textAnchor="middle"
        className="fill-current text-[15px] font-bold"
        fontFamily="inherit"
      >
        {label}
      </text>
    </g>
  );
  return (
    <svg
      viewBox="0 0 240 160"
      className={cn(ART, "text-ink")}
      role="img"
      aria-label="Ba nét: chấm là Trời, gạch ngang là Đất, gạch đứng là Người"
    >
      {col(16, "Trời", <circle cx="48" cy="62" r="9" className="fill-current stroke-none" />)}
      {col(
        88,
        "Đất",
        <path d="M94 62 H146" className={LINE} strokeWidth="9" strokeLinecap="round" />,
      )}
      {col(
        160,
        "Người",
        <path d="M192 34 V90" className={LINE} strokeWidth="9" strokeLinecap="round" />,
      )}
    </svg>
  );
}

function Blocks() {
  return (
    <div
      className="mx-auto flex h-44 items-center justify-center gap-6"
      role="img"
      aria-label="아: nguyên âm đứng bên phải. 오: nguyên âm nằm bên dưới"
    >
      {["아", "오"].map((ch) => (
        <figure key={ch} className="flex flex-col items-center gap-1">
          <BlockParts ch={ch} size={92} />
          <Ko className="text-2xl font-bold">{ch}</Ko>
        </figure>
      ))}
    </div>
  );
}

function PlusY() {
  const pairs = [
    ["ㅏ", "ㅑ", "ya"],
    ["ㅓ", "ㅕ", "yơ"],
    ["ㅗ", "ㅛ", "yô"],
    ["ㅜ", "ㅠ", "yu"],
  ];
  return (
    <div
      className="mx-auto grid h-44 max-w-[320px] grid-cols-2 content-center gap-3"
      role="img"
      aria-label="Thêm một nét thì thêm âm y"
    >
      {pairs.map(([a, b, say]) => (
        <p
          key={a}
          className="flex items-center justify-center gap-1.5 rounded-[14px] bg-paper py-3 text-[30px] font-bold leading-[1.3]"
        >
          <Ko>{a}</Ko>
          <ArrowRight size={16} className="text-blue" aria-hidden="true" />
          <Ko>{b}</Ko>
          <span className="text-[12px] font-semibold text-ink-2">{say}</span>
        </p>
      ))}
    </div>
  );
}

const SLIDES: { group: string; title: string; line: string; art: ReactNode }[] = [
  {
    group: "Khởi động",
    title: "Thả lỏng vai",
    line: "Nhún vai thật cao, thả rơi. 3 lần. Xoay cổ một vòng.",
    art: <Shoulders />,
  },
  {
    group: "Khởi động",
    title: "Thở bằng bụng",
    line: "Hít bằng mũi cho bụng phồng, thở ra chậm «sss».",
    art: <Belly />,
  },
  {
    group: "Khởi động",
    title: "Thả rơi cằm",
    line: "Với ㅏ, há miệng dọc như ngáp, hàm thả lỏng.",
    art: <Jaw />,
  },
  {
    group: "Khởi động",
    title: "Không có dấu thanh",
    line: "Mỗi chữ không có sắc, huyền. Nói «아—» một hơi đều.",
    art: <Flat />,
  },
  {
    group: "Cách chữ chạy",
    title: "Ba nét",
    line: "Chấm là Trời, ngang là Đất, đứng là Người. Mọi nguyên âm từ đây.",
    art: <ThreeStrokes />,
  },
  {
    group: "Cách chữ chạy",
    title: "Không có phụ âm đầu?",
    line: "Đặt ㅇ câm ở đầu khối: 아 đọc là «a».",
    art: <Blocks />,
  },
  {
    group: "Cách chữ chạy",
    title: "Thêm nét = thêm «y»",
    line: "ㅏ thêm nét thành ㅑ (ya). Cả bốn nguyên âm đều thế.",
    art: <PlusY />,
  },
];

/** Full screen, one step at a time; leaving it (finish or skip) hands control back. */
export function PrepTour({ onClose }: { onClose: (seen: boolean, finished?: boolean) => void }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const seenRef = useRef(false);
  seenRef.current = i >= 2;
  const s = SLIDES[i]!;
  const last = i === SLIDES.length - 1;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // the page behind (and the tab bar) cannot be reached while the walk-through is open
    const self = ref.current;
    const locked = [...document.body.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el !== self && !el.inert,
    );
    locked.forEach((el) => (el.inert = true));
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current(seenRef.current);
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
      if (f.length === 0) return;
      const first = f[0]!;
      const end = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = body;
      locked.forEach((el) => (el.inert = false));
      before?.focus?.();
    };
  }, []);
  return createPortal(
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Chuẩn bị trước khi học"
      className="fixed inset-0 z-[60] flex flex-col bg-background px-5 pb-6 pt-4 outline-none"
    >
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-wide text-blue">
          {s.group} · {i + 1}/{SLIDES.length}
        </p>
        <button
          type="button"
          onClick={() => onClose(i >= 2)}
          className="hit-area inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-ink-2"
        >
          Bỏ qua <X size={15} aria-hidden="true" />
        </button>
      </div>
      <div
        aria-live="polite"
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center text-center"
      >
        {s.art}
        <h2 className="mt-5 text-2xl font-bold">{s.title}</h2>
        <p className="mx-auto mt-2 max-w-[28ch] text-[15px] font-medium leading-6 text-ink-2">
          {s.line}
        </p>
      </div>
      <div className="mx-auto w-full max-w-md">
        <div className="mb-4 flex justify-center gap-1.5" aria-hidden="true">
          {SLIDES.map((_, n) => (
            <span
              key={n}
              className={cn(
                "h-1.5 rounded-full transition-all",
                n === i ? "w-6 bg-blue" : "w-1.5 bg-progress",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            tap();
            if (last) onClose(true, true);
            else setI(i + 1);
          }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-blue px-4 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] motion-reduce:active:scale-100"
        >
          {last ? "Bắt đầu học" : "Tiếp"}{" "}
          <ArrowRight size={16} strokeWidth={2.6} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setI(i - 1)}
          disabled={i === 0}
          aria-hidden={i === 0}
          tabIndex={i === 0 ? -1 : 0}
          className="hit-area mx-auto mt-1 block min-h-11 text-[13px] font-semibold text-ink-2 disabled:invisible"
        >
          Quay lại
        </button>
      </div>
    </div>,
    document.body,
  );
}
