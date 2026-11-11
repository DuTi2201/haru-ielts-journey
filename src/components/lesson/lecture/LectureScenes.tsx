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
              {pick === "quote" ? "Lời thầy Minh" : "Trong IELTS"}
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
          <p className={cn("mt-2 flex items-center justify-center gap-2 text-[13px] font-extrabold", enter)} style={{ color: MINT }}>
            <svg width="120" height="10" viewBox="0 0 120 10" aria-hidden="true">
              <path d="M2 2v4h116V2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Một câu, cả năm hộp đều nhận
          </p>
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

/** Where an answer sits on the time axis: past ··· now ··· future (x from 0 to 100). */
function Span({ at, on }: { at: Answer["at"]; on: boolean }) {
  const c = on ? "oklch(0.5 0.16 285)" : AMBER;
  return (
    <svg width="74" height="22" viewBox="0 0 74 22" aria-hidden="true" className="shrink-0">
      <path d="M3 11h68" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
      <path d="M37 5v12" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
      {at === "now" && <circle cx="37" cy="11" r="5" fill={c} />}
      {at === "span" && (
        <g>
          <path d="M10 11h27" stroke={c} strokeWidth="5" strokeLinecap="round" />
          <circle cx="37" cy="11" r="5" fill={c} />
        </g>
      )}
      {at === "past" && (
        <g>
          <path d="M8 11h14" stroke={c} strokeWidth="5" strokeLinecap="round" />
          <path d="m25 7 6 8m0-8-6 8" stroke={c} strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {at === "future" && (
        <g>
          <path d="M40 11h20" stroke={c} strokeWidth="3" strokeDasharray="4 4" strokeLinecap="round" />
          <path d="m60 6 7 5-7 5" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
}

function TenseTimeline({ data, has, latest, onReplay }: SceneProps) {
  const answers = (data["answers"] as Answer[]) ?? [];
  const ielts = has("ielts_q");
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
      {has("axis") && (
        <p className={cn("flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[0.12em] opacity-65", enter)}>
          <span>Quá khứ</span>
          <span>Bây giờ</span>
          <span>Tương lai</span>
        </p>
      )}
      <ol className="space-y-1.5">
        {answers.map((a) => {
          if (!has(a.key)) return <li key={a.key} className="h-[46px] rounded-[14px] border border-dashed border-white/15" aria-hidden="true" />;
          const now = latest === a.key;
          return (
            <li key={a.key} className={enter}>
              <Tap k={a.key} onReplay={onReplay} label={a.en}>
                <span className={cn("flex min-h-[46px] items-center gap-2.5 rounded-[14px] px-2.5 py-1.5 transition-colors duration-500", now ? "bg-white text-[oklch(0.25_0.05_285)] shadow-elev-2" : "bg-white/10")}>
                  <Span at={a.at} on={now} />
                  <span className="min-w-0 flex-1">
                    <En className="block text-[14.5px] font-extrabold leading-tight">{a.en}</En>
                    <span className="block text-[11px] font-semibold opacity-70">
                      {a.tense} · {a.vi}
                    </span>
                  </span>
                </span>
              </Tap>
            </li>
          );
        })}
      </ol>
      {ielts ? (
        <Tap k={has("ielts_a") ? "ielts_a" : "ielts_q"} onReplay={onReplay} className={cn("mt-auto", enter)}>
          <span className="block rounded-[16px] bg-white/12 px-3.5 py-2.5">
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">Speaking Part 1</span>
            <En className="block text-[13.5px] font-semibold opacity-90">{str(data["ielts_q"])}</En>
            {has("ielts_a") && <En className={cn("mt-0.5 block text-[15px] font-extrabold", enter)}>{str(data["ielts_a"])}</En>}
          </span>
        </Tap>
      ) : (
        <Foot data={data} has={has} latest={latest} onReplay={onReplay} />
      )}
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
