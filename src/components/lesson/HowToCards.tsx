import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Gem,
  Highlighter,
  Keyboard,
  Lightbulb,
  Link2,
  Scissors,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** "How to read a paragraph" and "how to learn a word" as pictures: tap a step and the example
 * beside it changes. A learner should see what to do with the pencil, not read about it. */

const STEPS: { icon: LucideIcon; label: string; tone: string }[] = [
  { icon: Highlighter, label: "Gạch từ khóa", tone: "bg-yellow-soft" },
  { icon: Scissors, label: "Bỏ chi tiết thừa", tone: "bg-purple-soft" },
  { icon: Link2, label: "Nối từ khóa", tone: "bg-blue-soft" },
  { icon: ArrowRight, label: "Viết chuỗi mũi tên", tone: "bg-green-soft" },
  { icon: Lightbulb, label: "Ý chính là gì?", tone: "bg-yellow-soft" },
  { icon: Gem, label: "Giá trị của đoạn", tone: "bg-purple-soft" },
];

const K = "rounded bg-yellow-soft px-0.5 font-semibold text-ink";
const X = "rounded px-0.5 text-ink-2 line-through decoration-2 decoration-purple";
const CHAIN = ["innate intelligence", "thinkers revolt", "intelligence can be developed"];

function Chain({ linked }: { linked?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={CHAIN.join(" → ")}>
      {CHAIN.map((c, i) => (
        <span key={c} className="flex items-center gap-1.5">
          <span className="rounded-full border border-line bg-card px-2.5 py-1 text-[12px] font-semibold shadow-elev-1">
            {c}
          </span>
          {i < CHAIN.length - 1 &&
            (linked ? (
              <span className="h-0.5 w-3 rounded bg-blue" aria-hidden="true" />
            ) : (
              <ArrowRight size={15} strokeWidth={3} className="text-green" aria-hidden="true" />
            ))}
        </span>
      ))}
    </div>
  );
}

function Example({ step }: { step: number }): ReactNode {
  const plain = (
    <p className="text-[13px] leading-6">
      Psychologist <span className={step === 1 ? X : ""}>Alfred Binet</span> held that{" "}
      <span className={K}>intelligence</span> is <span className={K}>innate</span>. Then, in{" "}
      <span className={step === 1 ? X : ""}>the early 20th century</span>, progressive{" "}
      <span className={K}>thinkers</span> <span className={K}>revolted</span>: every child's{" "}
      <span className={K}>intelligence</span> could be <span className={K}>developed</span>.
    </p>
  );
  if (step === 0) return plain;
  if (step === 1)
    return (
      <p className="text-[13px] leading-6">
        Psychologist <span className={X}>Alfred Binet</span> held that{" "}
        <span className={K}>intelligence</span> is <span className={K}>innate</span>. Then, in{" "}
        <span className={X}>the early 20th century</span>, progressive{" "}
        <span className={K}>thinkers</span> <span className={K}>revolted</span>: every child's{" "}
        <span className={K}>intelligence</span> could be <span className={K}>developed</span>.
      </p>
    );
  if (step === 2) return <Chain linked />;
  if (step === 3) return <Chain />;
  if (step === 4)
    return (
      <p className="text-[13px] font-semibold leading-6">
        Ý chính: trí thông minh <span className="text-blue-deep">không cố định</span>, có thể phát
        triển.
      </p>
    );
  return (
    <p className="text-[13px] font-semibold leading-6">
      Giá trị: cho thấy <span className="text-blue-deep">vì sao</span> nhà trường chuyển sang tư duy
      phát triển.
    </p>
  );
}

export function ReadingSteps({ text }: { text: string }) {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2600);
    return () => clearInterval(t);
  }, [auto]);
  const cur = STEPS[step]!;
  return (
    <section
      aria-label="Cách đọc từng đoạn"
      className="rounded-[14px] border border-line bg-card px-3.5 py-3"
    >
      <h3 className="text-xs font-semibold">Cách đọc từng đoạn: 6 bước</h3>
      <div className="mt-2.5 flex items-center justify-between gap-1" role="tablist">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`Bước ${i + 1}: ${s.label}`}
              onClick={() => {
                setAuto(false);
                setStep(i);
              }}
              className={cn(
                "hit-area flex size-11 shrink-0 flex-col items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-200 active:scale-95",
                i === step
                  ? cn("scale-110 border-blue", s.tone)
                  : i < step
                    ? "border-line bg-green-soft"
                    : "border-line bg-card",
              )}
            >
              <Icon size={17} strokeWidth={2.4} aria-hidden="true" />
              <span className="text-[10px] font-bold leading-3">{i + 1}</span>
            </button>
          );
        })}
      </div>
      <div className={cn("mt-3 rounded-[12px] px-3 py-2.5 transition-colors duration-200", cur.tone)}>
        <p className="text-[12px] font-bold">
          Bước {step + 1} · {cur.label}
        </p>
        <div key={step} className="mt-1.5 [animation:haru-fade_0.25s_ease-out_both]">
          <Example step={step} />
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-ink-2">
        Ví dụ: đoạn 1 của bài. Bấm số để xem từng bước.
      </p>
      <span className="sr-only">{text}</span>
    </section>
  );
}

export function VocabSteps({ text }: { text: string }) {
  const cards: { icon: LucideIcon; head: string; demo: ReactNode }[] = [
    {
      icon: Link2,
      head: "Gắn với từ dễ hơn",
      demo: (
        <span className="text-[12px]">
          <b>impediment</b> <span className="text-ink-2">=</span> obstacle
        </span>
      ),
    },
    {
      icon: Star,
      head: "Chọn 5 đến 10 từ bạn thích",
      demo: (
        <span className="flex gap-0.5 text-yellow-strong" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
          ))}
        </span>
      ),
    },
    {
      icon: Keyboard,
      head: "Gõ câu về chính bạn",
      demo: <span className="text-[12px] italic">My phone is an impediment to my study.</span>,
    },
  ];
  return (
    <section
      aria-label="Cách học từ vựng"
      className="rounded-[14px] border border-line bg-card px-3.5 py-3"
    >
      <h3 className="text-xs font-semibold">Cách học từ vựng: 3 việc</h3>
      <ol className="mt-2.5 grid gap-2 sm:grid-cols-3">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <li key={c.head} className="rounded-[12px] bg-blue-soft px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-card text-blue-deep shadow-elev-1">
                  <Icon size={15} strokeWidth={2.4} aria-hidden="true" />
                </span>
                <span className="text-[12px] font-bold leading-4">
                  {i + 1}. {c.head}
                </span>
              </div>
              <div className="mt-2 rounded-[10px] bg-card px-2.5 py-1.5">{c.demo}</div>
            </li>
          );
        })}
      </ol>
      <span className="sr-only">{text}</span>
    </section>
  );
}
