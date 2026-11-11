/** The pictures of a hand-written lecture ("scene" slides): each is a small diagram whose pieces
 * come in when the voice reaches them (the slide's `shown` keys), so the eye follows what the ear
 * hears instead of reading the narration again. Drawn here as plain SVG and boxes: no emoji, no
 * icon font, nothing to download.
 *
 * Design rules (docs/QUALITY_LESSON44.md in the backend repo):
 *  - a scene never prints the narration; it prints the English being studied and a label of at
 *    most a few words per piece (coherence, redundancy);
 *  - one piece is "current" (the last brought in) and is the only one in full contrast (signalling);
 *  - every piece can be tapped to hear its line again. */
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SceneProps {
  visual: string;
  data: Record<string, unknown>;
  has: (key: string) => boolean;
  latest: string | null;
  onReplay: (key: string) => void;
}

const AMBER = "oklch(0.88 0.13 90)";
const MINT = "oklch(0.84 0.12 165)";
const ROSE = "oklch(0.78 0.13 20)";
const INK = "oklch(0.25 0.05 285)";
const enter = "animate-in fade-in slide-in-from-bottom-1 duration-500 motion-reduce:animate-none";

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function Scene(p: SceneProps) {
  switch (p.visual) {
    case "five_boxes":
      return <FiveBoxes {...p} />;
    case "adverb_toggle":
      return <AdverbToggle {...p} />;
    case "truth_cards":
      return <TruthCards {...p} />;
    case "tense_timeline":
      return <TenseTimeline {...p} />;
    case "do_does":
      return <DoDoes {...p} />;
    case "sentence_forms":
      return <SentenceForms {...p} />;
    case "speaking_answer":
      return <SpeakingAnswer {...p} />;
    case "ref_table":
      return <RefTable {...p} />;
    case "fix_pairs":
      return <FixPairs {...p} />;
    default:
      return null;
  }
}

/** A piece that can be tapped to hear its line again. */
function Tap({
  k,
  onReplay,
  className,
  children,
  label,
}: {
  k: string;
  onReplay: (key: string) => void;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onReplay(k)}
      aria-label={label ? `${label}, nghe lại` : undefined}
      className={cn("block w-full text-left", className)}
    >
      {children}
    </button>
  );
}

function En({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span lang="en" className={className}>
      {children}
    </span>
  );
}

/** The closing line of a scene: the teacher's words, the rule, or where IELTS uses it. Only the
 * latest of them is up, so the foot of the slide is one line, not a stack. */
function Foot({ data, has, latest, onReplay }: Omit<SceneProps, "visual">) {
  const order = ["ielts", "rule", "quote"] as const;
  const pick = order.find((k) => latest === k) ?? order.find((k) => has(k) && str(data[k]));
  if (!pick || !str(data[pick])) return <div className="min-h-[52px]" aria-hidden="true" />;
  const text = str(data[pick]);
  return (
    <Tap k={pick} onReplay={onReplay} className={cn("mt-auto", enter)} key={pick}>
      <span
        className={cn(
          "flex min-h-[52px] items-center gap-3 rounded-[16px] px-3.5 py-2.5",
          pick === "rule" ? "bg-white text-[oklch(0.25_0.05_285)] shadow-elev-2" : "bg-white/12",
        )}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
          {pick === "quote" ? (
            <path
              d="M4 13c0-4 2-7 5-8l1 1.6C8.3 7.5 7.6 8.8 7.5 10H10v6H4v-3Zm8 0c0-4 2-7 5-8l1 1.6c-1.7.9-2.4 2.2-2.5 3.4H18v6h-6v-3Z"
              fill={AMBER}
            />
          ) : pick === "rule" ? (
            <path d="M4 11.5 9 16l9-10" fill="none" stroke="oklch(0.55 0.15 165)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M4 17V8l7-4 7 4v9h-5v-5H9v5H4Z" fill="none" stroke={AMBER} strokeWidth="1.8" strokeLinejoin="round" />
          )}
        </svg>
        <span className="min-w-0">
          {pick !== "rule" && (
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">
              {pick === "quote" ? "Trích dẫn" : "Trong IELTS"}
            </span>
          )}
          <span
            lang={pick === "ielts" ? "en" : undefined}
            className={cn("block leading-snug", pick === "rule" ? "text-[14px] font-bold" : "text-[13.5px] font-semibold")}
          >
            {text}
          </span>
        </span>
      </span>
    </Tap>
  );
}

// ------------------------------------------------------------------ experiment 1: five boxes --
type Box = { key: string; en: string; vi: string };

function FiveBoxes({ data, has, latest, onReplay }: SceneProps) {
  const boxes = (data["boxes"] as Box[]) ?? [];
  const sentence = str(data["sentence"]);
  const merged = has("merge");
  const filled = boxes.filter((b) => has(b.key)).length;
  return (
    <div className="flex flex-1 flex-col gap-3">
      {sentence ? (
        <div className="min-h-[58px]">
          {has("sentence") && (
            <Tap k="sentence" onReplay={onReplay} className={enter} label={sentence}>
              <span className="flex items-center justify-between gap-3 rounded-[16px] bg-[oklch(0.88_0.13_90)] px-3.5 py-2.5 text-[oklch(0.25_0.05_285)] shadow-elev-2">
                <span className="min-w-0">
                  <En className="block text-[18px] font-extrabold leading-tight">{sentence}</En>
                  <span className="block text-[12.5px] font-semibold opacity-75">{str(data["sentence_vi"])}</span>
                </span>
                <span className="shrink-0 rounded-full bg-[oklch(0.25_0.05_285)] px-2.5 py-1 text-[12px] font-extrabold tabular-nums text-[oklch(0.88_0.13_90)]">
                  {filled}/5 hộp
                </span>
              </span>
            </Tap>
          )}
        </div>
      ) : null}
      <div className="relative">
        <ol className="grid grid-cols-5 gap-1.5">
          {boxes.map((b, i) => {
            const on = has(b.key);
            const now = latest === b.key;
            return (
              <li key={b.key}>
                <Tap k={on ? b.key : "boxes"} onReplay={onReplay} label={b.vi}>
                  <svg viewBox="0 0 64 70" className="block w-full" aria-hidden="true">
                    {/* the sentence, as a token dropping into the box */}
                    {on && (
                      <g className="animate-in fade-in slide-in-from-top-3 duration-500 motion-reduce:animate-none">
                        <rect x="14" y="10" width="36" height="14" rx="7" fill={AMBER} />
                        <rect x="20" y="15" width="24" height="3.5" rx="1.75" fill={INK} opacity="0.55" />
                      </g>
                    )}
                    {/* an open box: back flaps, body, front lip */}
                    <path d="M8 30 18 22h28l10 8" fill="none" stroke="white" strokeOpacity={on ? 0.9 : 0.35} strokeWidth="2" strokeLinejoin="round" />
                    <rect
                      x="8"
                      y="30"
                      width="48"
                      height="34"
                      rx="6"
                      fill={on ? (now || merged ? MINT : "white") : "white"}
                      fillOpacity={on ? (now || merged ? 0.95 : 0.85) : 0.1}
                      stroke="white"
                      strokeOpacity={on ? 0 : 0.35}
                      strokeWidth="2"
                    />
                    <text x="32" y="52" textAnchor="middle" fontSize="17" fontWeight="800" fill={on ? INK : "white"} fillOpacity={on ? 1 : 0.6}>
                      {i + 1}
                    </text>
                    {on && (
                      <path d="m43 38 4 4 7-8" fill="none" stroke="oklch(0.42 0.14 165)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </svg>
                  <span className={cn("mt-1 block text-center text-[11.5px] font-bold leading-tight", on ? "" : "opacity-80")}>{b.vi}</span>
                  <En className="block text-center text-[9.5px] font-medium leading-tight opacity-65">{b.en}</En>
                </Tap>
              </li>
            );
          })}
        </ol>
        {merged && (
          <div className={cn("mt-1.5 text-center", enter)} style={{ color: MINT }}>
            <svg viewBox="0 0 300 10" preserveAspectRatio="none" className="block h-2.5 w-full" aria-hidden="true">
              <path d="M4 1v5h292V1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <p className="mt-1 text-[13px] font-extrabold">Một câu, cả năm hộp đều nhận</p>
          </div>
        )}
      </div>
      <Foot data={data} has={has} latest={latest} onReplay={onReplay} />
    </div>
  );
}

// ------------------------------------------------------- experiment 2: take the adverb away --
function AdverbToggle({ data, has, latest, onReplay }: SceneProps) {
  const core = (data["core"] as string[]) ?? [];
  const verb = str(data["verb"]);
  const dropped = has("drop");
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="min-h-[30px]">
        {has("signals") && (
          <p className={cn("flex flex-wrap items-center gap-1.5", enter)}>
            <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.12em] opacity-70">Từ “dấu hiệu”</span>
            {((data["signals"] as string[]) ?? []).map((s) => (
              <En key={s} className="rounded-full border border-dashed border-white/50 px-2.5 py-0.5 text-[12.5px] font-semibold opacity-85">
                {s}
              </En>
            ))}
          </p>
        )}
      </div>
      <div className="min-h-[112px]">
        {has("full") && (
          <Tap k={dropped ? "drop" : "full"} onReplay={onReplay} className={enter}>
            <span className="block rounded-[18px] bg-white/10 px-4 py-4">
              <span lang="en" className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[22px] font-extrabold leading-none">
                {core.map((w) =>
                  w === verb ? (
                    <span key={w} className="relative rounded-[10px] bg-[oklch(0.84_0.12_165)] px-2 py-1.5 text-[oklch(0.25_0.05_285)]">
                      {w}
                    </span>
                  ) : (
                    <span key={w}>{w}</span>
                  ),
                )}
                <span
                  className={cn(
                    "rounded-[10px] border-2 border-dashed px-2 py-1 text-[19px] transition-all duration-700 motion-reduce:transition-none",
                    dropped ? "translate-y-2 rotate-2 border-white/30 text-white/35 line-through" : "border-[oklch(0.88_0.13_90)] text-[oklch(0.88_0.13_90)]",
                  )}
                >
                  {str(data["adverb"])}
                </span>
              </span>
              <span className="mt-3 flex items-center gap-2 text-[12.5px] font-bold" style={{ color: MINT }}>
                <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true">
                  <path d="M3 9a8 5 0 0 1 16-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="m16 2 4 4-5 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {dropped ? "Bỏ trạng từ: việc vẫn lặp lại" : "Động từ mang nghĩa lặp lại"}
              </span>
            </span>
          </Tap>
        )}
      </div>
      <div className="min-h-[50px]">
        {has("proof") && (
          <Tap k="proof" onReplay={onReplay} className={enter}>
            <span className={cn("flex items-center justify-between gap-3 rounded-[14px] px-3.5 py-2.5", latest === "proof" ? "bg-white text-[oklch(0.25_0.05_285)] shadow-elev-2" : "bg-white/10")}>
              <En className="text-[16px] font-extrabold">{str(data["proof"])}</En>
              <span className="text-right text-[11.5px] font-semibold leading-tight opacity-75">{str(data["proof_vi"])}</span>
            </span>
          </Tap>
        )}
      </div>
      <Foot data={data} has={has} latest={latest} onReplay={onReplay} />
    </div>
  );
}

// ---------------------------------------------------------- what the speaker presents as true --
type Card = { key: string; tag: string; art: string; en: string; vi: string };

function Art({ id }: { id: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true" className="shrink-0">
      {id === "kettle" ? (
        <g {...s}>
          <path d="M9 33h17l2-13H7l2 13Z" />
          <path d="M28 23c4-1 5 5 0 6M12 20c0-3 3-4 5.5-4s5.500 1 5.500 4" />
          <path d="M13 11c-2-2 2-3 0-6M19 11c-2-2 2-3 0-6" strokeOpacity="0.7" />
        </g>
      ) : id === "mother" ? (
        <g {...s}>
          <path d="M5 7h28v17H19l-7 7v-7H5V7Z" />
          <path d="M19 11v7" strokeWidth="3" />
          <circle cx="19" cy="21.500" r="0.8" fill="currentColor" />
        </g>
      ) : (
        <g {...s}>
          <path d="M6 9c8-4 18-4 26 0 0 12-5 20-13 22C11 29 6 21 6 9Z" />
          <path d="M11 16c2-2 4-2 6 0M21 16c2-2 4-2 6 0M14 24c3-2 7-2 10 0" />
        </g>
      )}
    </svg>
  );
}

function TruthCards({ data, has, latest, onReplay }: SceneProps) {
  const cards = (data["cards"] as Card[]) ?? [];
  const groups = (data["groups"] as string[]) ?? [];
  const lastCard = [...cards].reverse().find((c) => has(c.key))?.key;
  return (
    <div className="flex flex-1 flex-col gap-2.5">
      <div className="min-h-[30px]">
        {has("groups") && (
          <p className={cn("flex flex-wrap items-center gap-1.5", enter)}>
            {groups.map((g, i) => (
              <span
                key={g}
                className={cn(
                  "rounded-full px-3 py-1 text-[12.5px] font-bold",
                  i === groups.length - 1 ? "bg-[oklch(0.88_0.13_90)] text-[oklch(0.25_0.05_285)]" : "bg-white/14",
                )}
              >
                {g}
              </span>
            ))}
          </p>
        )}
      </div>
      <ol className="space-y-2">
        {cards.map((c) => {
          if (!has(c.key)) return <li key={c.key} className="h-[60px] rounded-[16px] border border-dashed border-white/15" aria-hidden="true" />;
          const now = (latest === c.key || lastCard === c.key) && !["rule", "ielts"].includes(latest ?? "");
          return (
            <li key={c.key} className={enter}>
              <Tap k={c.key} onReplay={onReplay} label={c.en}>
                <span
                  className={cn(
                    "flex min-h-[60px] items-center gap-3 rounded-[16px] px-3 py-2 transition-colors duration-500",
                    now ? "bg-white text-[oklch(0.25_0.05_285)] shadow-elev-2" : "bg-white/10",
                  )}
                >
                  <span style={{ color: now ? "oklch(0.45 0.14 285)" : AMBER }}>
                    <Art id={c.art} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] opacity-65">{c.tag}</span>
                    <En className="block text-[15.5px] font-extrabold leading-snug">{c.en}</En>
                    <span className="block text-[12px] font-medium opacity-75">{c.vi}</span>
                  </span>
                </span>
              </Tap>
            </li>
          );
        })}
      </ol>
      <Foot data={data} has={has} latest={latest} onReplay={onReplay} />
    </div>
  );
}

// ------------------------------------------------------------- one question, four tenses --
type Answer = { key: string; at: "now" | "span" | "past" | "future"; tense: string; en: string; vi: string };

/** One answer on the shared time axis: the same left-to-right scale in every lane (past on the
 * left, the present at the dashed line in the middle, the future on the right), so the four
 * answers can be compared by where they sit. */
function Lane({ at, color }: { at: Answer["at"]; color: string }) {
  const bar = "absolute top-1/2 h-[7px] -translate-y-1/2 rounded-full";
  const dot = "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full";
  return (
    <span className="relative block h-5 w-full" style={{ color }} aria-hidden="true">
      <span className="absolute inset-x-0 top-1/2 h-px bg-current opacity-25" />
      {at === "now" && <span className={dot} style={{ left: "50%", background: "currentColor" }} />}
      {at === "span" && (
        <>
          <span className={bar} style={{ left: "14%", width: "36%", background: "currentColor" }} />
          <span className={dot} style={{ left: "50%", background: "currentColor" }} />
        </>
      )}
      {at === "past" && (
        <>
          <span className={bar} style={{ left: "8%", width: "24%", background: "currentColor" }} />
          <svg className="absolute top-1/2 -translate-y-1/2" style={{ left: "33%" }} width="14" height="14" viewBox="0 0 14 14">
            <path d="m2 2 10 10m0-10L2 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </>
      )}
      {at === "future" && (
        <>
          <span className="absolute top-1/2 -translate-y-1/2 border-t-[3px] border-dashed" style={{ left: "54%", width: "30%", borderColor: "currentColor" }} />
          <svg className="absolute top-1/2 -translate-y-1/2" style={{ left: "83%" }} width="14" height="14" viewBox="0 0 14 14">
            <path d="m3 2 6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </>
      )}
    </span>
  );
}

function TenseTimeline({ data, has, latest, onReplay }: SceneProps) {
  const answers = (data["answers"] as Answer[]) ?? [];
  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="min-h-[52px]">
        {has("q") && (
          <Tap k="q" onReplay={onReplay} className={enter}>
            <span className="flex items-center justify-between gap-3 rounded-[16px] bg-[oklch(0.88_0.13_90)] px-3.5 py-2 text-[oklch(0.25_0.05_285)] shadow-elev-2">
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">Câu hỏi · hiện tại đơn</span>
                <En className="block text-[17px] font-extrabold leading-tight">{str(data["question"])}</En>
              </span>
              <span className="shrink-0 text-right text-[11.5px] font-semibold leading-tight opacity-75">{str(data["question_vi"])}</span>
            </span>
          </Tap>
        )}
      </div>
      <div className="min-h-[18px]">
        {has("axis") && (
          <p className={cn("grid grid-cols-3 px-1 text-[10px] font-bold uppercase tracking-[0.12em] opacity-70", enter)}>
            <span className="text-left">Quá khứ</span>
            <span className="text-center">Hiện tại</span>
            <span className="text-right">Tương lai</span>
          </p>
        )}
      </div>
      <div className="relative">
        {has("axis") && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-1/2 border-l-2 border-dashed border-white/35"
          />
        )}
        <ol className="space-y-1.5">
          {answers.map((a) => {
            if (!has(a.key)) return <li key={a.key} className="h-[58px] rounded-[14px] border border-dashed border-white/15" aria-hidden="true" />;
            const now = latest === a.key;
            return (
              <li key={a.key} className={enter}>
                <Tap k={a.key} onReplay={onReplay} label={a.en}>
                  <span className={cn("block rounded-[14px] px-3 py-1.5 transition-colors duration-500", now ? "bg-white text-[oklch(0.25_0.05_285)] shadow-elev-2" : "bg-[oklch(0.3_0.06_285/0.7)]")}>
                    <span className="flex items-baseline justify-between gap-2">
                      <En className="text-[14.5px] font-extrabold leading-tight">{a.en}</En>
                      <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.08em] opacity-70">{a.tense}</span>
                    </span>
                    <Lane at={a.at} color={now ? "oklch(0.5 0.16 285)" : AMBER} />
                    <span className="block text-[11px] font-semibold opacity-70">{a.vi}</span>
                  </span>
                </Tap>
              </li>
            );
          })}
        </ol>
      </div>
      <Foot data={data} has={has} latest={latest} onReplay={onReplay} />
    </div>
  );
}

// ------------------------------------------------- how to build the three kinds of sentence --
type FormRow = { key: string; label: string; parts: string[]; hi: number[]; vi: string };

function FormParts({ parts, hi, on }: { parts: string[]; hi: number[]; on: boolean }) {
  return (
    <span lang="en" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[16px] font-extrabold leading-snug">
      {parts.map((p, i) =>
        hi.includes(i) ? (
          <span
            key={i}
            className={cn(
              "rounded-[8px] px-1.5 py-0.5 text-[oklch(0.25_0.05_285)]",
              on ? "bg-[oklch(0.84_0.12_165)]" : "bg-[oklch(0.88_0.13_90)]",
            )}
          >
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

function SentenceForms({ data, has, latest, onReplay }: SceneProps) {
  const rows = (data["rows"] as FormRow[]) ?? [];
  const persons = (data["persons"] as { who: string; verb: string }[]) ?? [];
  const spelling = (data["spelling"] as [string, string][]) ?? [];
  const short = (data["short"] as string[]) ?? [];
  const spell = has("spelling");
  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="min-h-[64px]">
        {spell ? (
          <Tap k="spelling" onReplay={onReplay} className={enter} key="spelling">
            <span className="block rounded-[14px] bg-white/10 px-3 py-2">
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">Thêm s không đơn giản</span>
              <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {spelling.map(([b, e]) => (
                  <span key={b} lang="en" className="text-[14px] font-bold">
                    <span className="opacity-70">{b}</span>
                    <span className="mx-1" style={{ color: AMBER }}>→</span>
                    {e}
                  </span>
                ))}
              </span>
            </span>
          </Tap>
        ) : has("persons") ? (
          <Tap k="persons" onReplay={onReplay} className={enter} key="persons">
            <span className="grid grid-cols-2 gap-2">
              {persons.map((p, i) => (
                <span key={p.who} className="block rounded-[14px] bg-white/10 px-3 py-2">
                  <span className="block text-[10.5px] font-bold uppercase tracking-[0.08em] opacity-70">{p.who}</span>
                  <En className="block text-[17px] font-extrabold">
                    {p.verb.replace(/s$/, "")}
                    {i > 0 && <span className="rounded-[6px] bg-[oklch(0.88_0.13_90)] px-1 text-[oklch(0.25_0.05_285)]">s</span>}
                  </En>
                </span>
              ))}
            </span>
          </Tap>
        ) : null}
      </div>
      <ol className="space-y-1.5">
        {rows.map((r) => {
          if (!has(r.key)) {
            return (
              <li key={r.key} className="flex h-[58px] items-center rounded-[14px] border border-dashed border-white/15 px-3 text-[11px] font-bold uppercase tracking-[0.1em] opacity-60">
                {r.label}
              </li>
            );
          }
          const now = latest === r.key;
          return (
            <li key={r.key} className={enter}>
              <Tap k={r.key} onReplay={onReplay} label={parts(r)}>
                <span className={cn("flex items-center gap-3 rounded-[14px] px-3 py-2 transition-colors duration-500", now ? "bg-white text-[oklch(0.25_0.05_285)] shadow-elev-2" : "bg-white/10")}>
                  <span className="w-[74px] shrink-0 text-[10.5px] font-bold uppercase leading-tight tracking-[0.08em] opacity-70">{r.label}</span>
                  <span className="min-w-0 flex-1">
                    <FormParts parts={r.parts} hi={r.hi} on={now} />
                    <span className="block text-[11.5px] font-medium opacity-75">{r.vi}</span>
                  </span>
                </span>
              </Tap>
            </li>
          );
        })}
      </ol>
      <div className="min-h-[20px]">
        {has("short") && (
          <Tap k="short" onReplay={onReplay} className={enter}>
            <span lang="en" className="block px-1 text-[12.5px] font-semibold opacity-85">
              <span lang="vi" className="mr-2 text-[10px] font-bold uppercase tracking-[0.1em] opacity-70">Đáp ngắn</span>
              {short.join(" · ")}
            </span>
          </Tap>
        )}
      </div>
      <Foot data={data} has={has} latest={latest} onReplay={onReplay} />
    </div>
  );
}

function parts(r: FormRow) {
  return r.parts.join(" ");
}

// ---------------------------------------------------- a full answer in IELTS Speaking Part 1 --
type Part = { key: string; role: string; tense: string; en: string; vi: string };

function SpeakingAnswer({ data, has, latest, onReplay }: SceneProps) {
  const items = (data["parts"] as Part[]) ?? [];
  const started = has("p1");
  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="min-h-[58px]">
        {has("q") && (
          <Tap k="q" onReplay={onReplay} className={enter}>
            <span className="block rounded-[16px] bg-white/12 px-3.5 py-2">
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">Giám khảo hỏi</span>
              <span className="flex items-baseline justify-between gap-3">
                <En className="text-[16px] font-extrabold">{str(data["question"])}</En>
                <span className="shrink-0 text-[11.5px] font-semibold opacity-70">{str(data["question_vi"])}</span>
              </span>
            </span>
          </Tap>
        )}
      </div>
      {has("short") && !started && (
        <Tap k="short" onReplay={onReplay} className={enter}>
          <span className="flex items-center justify-between gap-3 rounded-[14px] border border-[oklch(0.78_0.13_20/0.6)] bg-[oklch(0.78_0.13_20/0.16)] px-3.5 py-2.5">
            <En className="text-[17px] font-extrabold">{str(data["short"])}</En>
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: ROSE }}>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="m2 2 8 8m0-8-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              Chỉ một câu: quá cụt
            </span>
          </span>
        </Tap>
      )}
      <ol className="space-y-1.5">
        {items.map((it, i) => {
          if (!has(it.key)) return started ? <li key={it.key} className="h-[60px] rounded-[14px] border border-dashed border-white/15" aria-hidden="true" /> : null;
          const now = latest === it.key;
          return (
            <li key={it.key} className={enter}>
              <Tap k={it.key} onReplay={onReplay} label={it.en}>
                <span className={cn("flex items-center gap-3 rounded-[14px] px-3 py-2 transition-colors duration-500", now ? "bg-white text-[oklch(0.25_0.05_285)] shadow-elev-2" : "bg-white/10")}>
                  <span
                    className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold tabular-nums", now ? "bg-[oklch(0.45_0.14_285)] text-white" : "bg-white/20")}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.1em] opacity-70">
                      {it.role} · {it.tense}
                    </span>
                    <En className="block text-[15px] font-extrabold leading-snug">{it.en}</En>
                    <span className="block text-[11.5px] font-medium opacity-75">{it.vi}</span>
                  </span>
                </span>
              </Tap>
            </li>
          );
        })}
      </ol>
      <Foot data={data} has={has} latest={latest} onReplay={onReplay} />
    </div>
  );
}

// ------------------------------------------------------------------ emphasis with do / does --
function Parts({ parts, strong }: { parts: string[]; strong: string }) {
  return (
    <span lang="en" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[17px] font-extrabold leading-snug">
      {parts.map((p, i) =>
        p === strong ? (
          <span key={i} className="rounded-[9px] bg-[oklch(0.88_0.13_90)] px-2 py-0.5 text-[oklch(0.25_0.05_285)] animate-in zoom-in-75 duration-500 motion-reduce:animate-none">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

function DoDoes({ data, has, latest, onReplay }: SceneProps) {
  const emph = (data["emph"] as string[]) ?? [];
  const ex2 = (data["ex2"] as string[]) ?? [];
  const pair = has("wrong");
  return (
    <div className="flex flex-1 flex-col gap-2.5">
      <div className="min-h-[92px] space-y-2">
        {has("plain") && (
          <Tap k="plain" onReplay={onReplay} className={enter}>
            <span className={cn("flex items-center justify-between rounded-[14px] px-3.5 py-2", has("emph") ? "bg-white/8 opacity-70" : "bg-white/12")}>
              <En className="text-[16px] font-bold">{str(data["plain"])}</En>
              <span className="text-[11px] font-semibold opacity-70">câu thường</span>
            </span>
          </Tap>
        )}
        {has("emph") && (
          <Tap k="emph" onReplay={onReplay} className={enter}>
            <span className={cn("flex items-center justify-between gap-3 rounded-[14px] px-3.5 py-2", latest === "emph" ? "bg-white text-[oklch(0.25_0.05_285)] shadow-elev-2" : "bg-white/12")}>
              <Parts parts={emph} strong="do" />
              <span className="text-right text-[11.5px] font-semibold leading-tight opacity-75">{str(data["emph_vi"])}</span>
            </span>
          </Tap>
        )}
      </div>
      <div className="min-h-[64px]">
        {has("ex2") && !pair && (
          <Tap k="ex2" onReplay={onReplay} className={enter}>
            <span className={cn("block rounded-[14px] px-3.5 py-2", latest === "ex2" ? "bg-white text-[oklch(0.25_0.05_285)] shadow-elev-2" : "bg-white/12")}>
              <Parts parts={ex2} strong="does" />
              <span className="mt-0.5 block text-[11.5px] font-semibold opacity-75">{str(data["ex2_vi"])}</span>
            </span>
          </Tap>
        )}
        {pair && (
          <div className={cn("grid grid-cols-2 gap-2", enter)}>
            <Tap k="wrong" onReplay={onReplay}>
              <span className="block rounded-[14px] border border-[oklch(0.78_0.13_20/0.6)] bg-[oklch(0.78_0.13_20/0.16)] px-3 py-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: ROSE }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="m2 2 8 8m0-8-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                  Chia hai lần
                </span>
                <En className="mt-0.5 block text-[14.5px] font-extrabold line-through decoration-2 opacity-90">{str(data["wrong"])}</En>
              </span>
            </Tap>
            {has("right") ? (
              <Tap k="right" onReplay={onReplay} className={enter}>
                <span className="block rounded-[14px] bg-white px-3 py-2 text-[oklch(0.25_0.05_285)] shadow-elev-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[oklch(0.45_0.14_165)]">
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="m1.500 6.500 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Đúng
                  </span>
                  <En className="mt-0.5 block text-[14.5px] font-extrabold">{str(data["right"])}</En>
                </span>
              </Tap>
            ) : (
              <span className="rounded-[14px] border border-dashed border-white/20" aria-hidden="true" />
            )}
          </div>
        )}
      </div>
      <Foot data={data} has={has} latest={latest} onReplay={onReplay} />
    </div>
  );
}

// ------------------------------------------------------------------ reference table, one row at a time --
type RefRow = { key: string; head: string; en: string; vi?: string; note?: string };

/** A table of the book (uses, adverbs, time phrases): a label cell and the English example, one row
 * brought in as the voice reaches it. */
function RefTable({ data, has, latest, onReplay }: SceneProps) {
  const rows = (data["rows"] as RefRow[]) ?? [];
  const cols = (data["cols"] as string[]) ?? [];
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      {cols.length === 2 && (
        <div className="grid grid-cols-[38%_1fr] gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">
          <span>{cols[0]}</span>
          <span>{cols[1]}</span>
        </div>
      )}
      <ol className="space-y-1">
        {rows.map((r) => {
          if (!has(r.key)) return <li key={r.key} className="h-[44px] rounded-[12px] border border-dashed border-white/12" aria-hidden="true" />;
          const now = latest === r.key;
          return (
            <li key={r.key} className={enter}>
              <Tap k={r.key} onReplay={onReplay} label={r.en}>
                <span
                  className={cn(
                    "grid min-h-[44px] grid-cols-[38%_1fr] items-center gap-2 rounded-[12px] px-2.5 py-1.5 transition-colors duration-500",
                    now ? "bg-white text-[oklch(0.25_0.05_285)] shadow-elev-2" : "bg-white/10",
                  )}
                >
                  <span className="text-[12px] font-bold leading-tight">{r.head}</span>
                  <span className="min-w-0">
                    <En className="block text-[14px] font-extrabold leading-snug">{r.en}</En>
                    {r.vi && <span className="block text-[11px] font-medium opacity-75">{r.vi}</span>}
                  </span>
                </span>
              </Tap>
            </li>
          );
        })}
      </ol>
      <Foot data={data} has={has} latest={latest} onReplay={onReplay} />
    </div>
  );
}

type FixRow = { key: string; wrong: string; right: string; why: string };

/** Common mistakes: the wrong sentence struck through, the right one under it, and the reason. */
function FixPairs({ data, has, latest, onReplay }: SceneProps) {
  const rows = (data["rows"] as FixRow[]) ?? [];
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <ol className="space-y-1">
        {rows.map((r) => {
          if (!has(r.key)) return <li key={r.key} className="h-[52px] rounded-[12px] border border-dashed border-white/12" aria-hidden="true" />;
          const now = latest === r.key;
          return (
            <li key={r.key} className={enter}>
              <Tap k={r.key} onReplay={onReplay} label={r.right}>
                <span className={cn("block rounded-[12px] px-2.5 py-1.5 transition-colors duration-500", now ? "bg-white text-[oklch(0.25_0.05_285)] shadow-elev-2" : "bg-white/10")}>
                  <span className="flex flex-wrap items-baseline gap-x-3">
                    <En className="text-[13px] font-semibold line-through decoration-2 opacity-70" >{r.wrong}</En>
                    <span aria-hidden="true">→</span>
                    <En className="text-[14px] font-extrabold" >{r.right}</En>
                  </span>
                  <span className="block text-[11px] font-medium opacity-75">{r.why}</span>
                </span>
              </Tap>
            </li>
          );
        })}
      </ol>
      <Foot data={data} has={has} latest={latest} onReplay={onReplay} />
    </div>
  );
}
