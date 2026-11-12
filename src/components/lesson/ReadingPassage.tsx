import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, ChevronDown, Eraser, Highlighter, Scissors } from "lucide-react";

import { cn } from "@/lib/utils";

/** An English reading passage the learner works on, not only reads: tap words to mark them as a
 * keyword (yellow) or as detail to leave out (struck through), and the paragraph's keywords come
 * out as an arrow chain below it. Marks are kept on this device, so the three question sets of
 * the same passage share them. Folded by default: the questions stay near the top of the card. */

type Pen = "keep" | "drop" | "erase";
type Marks = Record<string, "k" | "d">;

const PENS: { id: Pen; label: string; icon: typeof Highlighter; tone: string }[] = [
  { id: "keep", label: "Từ khóa", icon: Highlighter, tone: "bg-yellow-soft" },
  { id: "drop", label: "Bỏ chi tiết", icon: Scissors, tone: "bg-purple-soft" },
  { id: "erase", label: "Xóa", icon: Eraser, tone: "bg-card" },
];

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function load(key: string): { marks: Marks; notes: Record<string, string> } {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    /* private mode: marks stay in memory */
  }
  return { marks: {}, notes: {} };
}

export function isEnglishPassage(text: string): boolean {
  return !/[가-힣]/.test(text) && text.length > 1500 && text.split("\n").length >= 4;
}

export function ReadingPassage({ text }: { text: string }) {
  const lines = useMemo(() => text.split("\n").filter((l) => l.trim()), [text]);
  const hasTitle = lines.length > 1 && lines[0]!.length < 60 && !/[.!?]$/.test(lines[0]!);
  const title = hasTitle ? lines[0]! : null;
  const paras = hasTitle ? lines.slice(1) : lines;
  const key = useMemo(() => `haru:read:${hash(text)}`, [text]);

  const [open, setOpen] = useState(false);
  const [pen, setPen] = useState<Pen>("keep");
  const [focus, setFocus] = useState<number | null>(null);
  const [state, setState] = useState(() => ({ marks: {} as Marks, notes: {} as Record<string, string> }));
  useEffect(() => setState(load(key)), [key]);
  const save = (next: typeof state) => {
    setState(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const apply = (p: number, w: number) => {
    const id = `${p}:${w}`;
    const marks = { ...state.marks };
    const want = pen === "keep" ? "k" : pen === "drop" ? "d" : null;
    if (!want || marks[id] === want) delete marks[id];
    else marks[id] = want;
    save({ ...state, marks });
  };

  const shown = focus === null ? paras.map((_, i) => i) : [focus];
  const count = Object.keys(state.marks).length;

  return (
    <section aria-label="Bài đọc" className="rounded-[16px] border border-line bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 w-full items-center gap-2.5 px-3.5 text-left"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-soft text-blue-deep">
          <BookOpen size={16} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold leading-4">Bài đọc · {paras.length} đoạn</span>
          <span className="block text-[12px] text-ink-2">
            {open ? "Bấm để thu gọn" : count ? `Bạn đã đánh dấu ${count} từ` : "Bấm để đọc và đánh dấu"}
          </span>
        </span>
        <ChevronDown size={18} className={cn("shrink-0 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div className="border-t border-line px-3.5 pb-3.5 pt-3">
          {title && <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-2">{title}</p>}

          <div className="sticky top-0 z-10 -mx-1 mb-3 space-y-2 rounded-[14px] bg-card/95 px-1 py-1.5 backdrop-blur">
            <div className="flex gap-1.5" role="radiogroup" aria-label="Bút đánh dấu">
              {PENS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={pen === p.id}
                    onClick={() => setPen(p.id)}
                    className={cn(
                      "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border px-2 text-[12.5px] font-semibold active:scale-[0.97]",
                      pen === p.id ? cn("border-blue shadow-elev-1", p.tone) : "border-line bg-card text-ink-2",
                    )}
                  >
                    <Icon size={15} strokeWidth={2.4} aria-hidden="true" />
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1 overflow-x-auto pb-0.5" role="tablist" aria-label="Chọn đoạn">
              {[null, ...paras.map((_, i) => i)].map((i) => (
                <button
                  key={i ?? "all"}
                  type="button"
                  role="tab"
                  aria-selected={focus === i}
                  onClick={() => setFocus(i)}
                  className={cn(
                    "min-h-9 shrink-0 rounded-full border px-3 text-[12.5px] font-bold tabular-nums",
                    focus === i ? "border-blue bg-blue-soft text-blue-deep" : "border-line bg-card text-ink-2",
                  )}
                >
                  {i === null ? "Tất cả" : i + 1}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-ink-2">Chọn bút, rồi chạm vào từng từ trong bài. Chạm lần nữa để bỏ đánh dấu.</p>
          </div>

          <div className="space-y-3">
            {shown.map((pi) => {
              const words = paras[pi]!.split(/\s+/);
              // keyword chain: runs of adjacent keywords become one phrase
              const chain: string[] = [];
              let run: string[] = [];
              words.forEach((w, wi) => {
                if (state.marks[`${pi}:${wi}`] === "k") run.push(w.replace(/^[‘'"(]+|[.,;:!?’'")]+$/g, ""));
                else if (run.length) {
                  chain.push(run.join(" "));
                  run = [];
                }
              });
              if (run.length) chain.push(run.join(" "));
              return (
                <div key={pi} className="rounded-[14px] border border-line bg-paper p-3">
                  <div className="flex gap-2.5">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-blue-soft text-[12px] font-bold text-blue-deep">
                      {pi + 1}
                    </span>
                    <p lang="en" className="min-w-0 text-[15px] leading-8">
                      {words.map((w, wi) => {
                        const m = state.marks[`${pi}:${wi}`];
                        return (
                          <span key={wi}>
                            <button
                              type="button"
                              onClick={() => apply(pi, wi)}
                              className={cn(
                                "rounded px-0.5 text-left transition-colors",
                                m === "k" && "bg-yellow-soft font-bold",
                                m === "d" && "text-ink-2 line-through decoration-2 decoration-purple opacity-60",
                              )}
                            >
                              {w}
                            </button>{" "}
                          </span>
                        );
                      })}
                    </p>
                  </div>
                  {focus !== null && (
                    <div className="mt-3 space-y-2 border-t border-line pt-3">
                      <p className="text-[12px] font-bold uppercase tracking-wide text-ink-2">Chuỗi từ khóa của bạn</p>
                      {chain.length === 0 ? (
                        <p className="text-[13px] text-ink-2">Chưa có. Chọn bút Từ khóa rồi chạm vào các từ chính.</p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {chain.map((c, ci) => (
                            <span key={ci} className="flex items-center gap-1.5">
                              <span lang="en" className="rounded-full bg-green-soft px-2.5 py-1 text-[13px] font-bold">
                                {c}
                              </span>
                              {ci < chain.length - 1 && <ArrowRight size={15} strokeWidth={3} className="text-green" aria-hidden="true" />}
                            </span>
                          ))}
                        </div>
                      )}
                      <label className="block">
                        <span className="text-[12px] font-bold uppercase tracking-wide text-ink-2">Ý chính của đoạn</span>
                        <input
                          value={state.notes[String(pi)] ?? ""}
                          onChange={(e) => save({ ...state, notes: { ...state.notes, [String(pi)]: e.target.value } })}
                          placeholder="Một câu ngắn, tiếng Việt hay tiếng Anh đều được"
                          className="mt-1 min-h-11 w-full rounded-[12px] border border-line bg-card px-3 text-[14px]"
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {count > 0 && (
            <button
              type="button"
              onClick={() => save({ marks: {}, notes: state.notes })}
              className="mt-3 text-[12.5px] font-semibold text-ink-2 underline underline-offset-2"
            >
              Xóa mọi đánh dấu
            </button>
          )}
        </div>
      )}
    </section>
  );
}
