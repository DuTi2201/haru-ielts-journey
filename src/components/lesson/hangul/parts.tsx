import { useContext, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Check, Delete, Lightbulb, RotateCcw, Volume2, X } from "lucide-react";

import type {
  HangulChangeOut,
  HangulGroupOut,
  HangulPickOut,
  HangulRuleOut,
  HangulWordOut,
} from "@/lib/api/types";
import { miss, success, tap } from "@/lib/feedback";
import {
  compose,
  endsWithFinal,
  join,
  KEY_ROWS,
  keysOf,
  SHIFTED,
  split,
  vowelShape,
} from "@/lib/hangul";
import { cn } from "@/lib/utils";
import { Ko, Rich, RichBlock } from "../Rich";
import { SayContext, ViHintContext } from "./say";
import { SoundCoach, SpeedDrill } from "./coach";
import { cueOf } from "@/lib/korean-phonetics";

/* The pieces of the alphabet lesson (HangulLessonView): letters to tap and hear, blocks to put
 * together, words to sort by patchim, sound changes shown moving, listen-and-pick, and a guided
 * two-set keyboard. Every line on screen is short: the learner is reading a new script already. */

const useSay = () => useContext(SayContext);

export function SayButton({
  ko,
  label = "Nghe",
  className,
  big = false,
}: {
  ko: string;
  label?: string;
  className?: string;
  big?: boolean;
}) {
  const say = useSay();
  const on = say.active === ko;
  return (
    <button
      type="button"
      onClick={() => say.play(ko)}
      aria-label={`${label}: ${ko}`}
      className={cn(
        "hit-area inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-card text-blue-deep shadow-elev-1 active:scale-95",
        big ? "h-14 w-14" : "h-9 w-9",
        on && "bg-blue text-primary-foreground",
        className,
      )}
    >
      <Volume2
        size={big ? 24 : 16}
        strokeWidth={2.6}
        className={cn(on && say.loading && "animate-pulse")}
      />
    </button>
  );
}

// ------------------------------------------------------------------ small layout --
export function Section({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-7", className)}>
      <h2 className="text-[16px] font-bold leading-6">{title}</h2>
      {hint && <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ExplainCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-card p-4 shadow-elev-1">
      <h3 className="flex items-center gap-1.5 text-[14px] font-bold">
        <Lightbulb size={15} strokeWidth={2.6} className="text-yellow" aria-hidden="true" />
        {title}
      </h3>
      <RichBlock text={body} className="mt-1.5 text-[14px] leading-6 text-ink-2" />
    </div>
  );
}

// ------------------------------------------------------------------ a block, taken apart --
type Slot = "initial" | "vowel" | "final";
const SLOT_TONE: Record<Slot, string> = {
  initial: "bg-blue-soft text-blue-deep",
  vowel: "bg-green-soft text-ink",
  final: "bg-yellow-soft text-ink",
};
const SLOT_LABEL: Record<Slot, string> = {
  initial: "Đầu",
  vowel: "Nguyên âm",
  final: "Patchim",
};

/** A block drawn as its letters in their places: the first consonant, the vowel beside or under
 * it, the patchim at the bottom. `glow` marks the letters a sound change moves or changes. */
export function BlockParts({
  ch,
  glow = [],
  size = 76,
  className,
}: {
  ch: string;
  glow?: Slot[];
  size?: number;
  className?: string;
}) {
  const b = split(ch);
  if (!b) return <Ko className="text-3xl font-bold">{ch}</Ko>;
  const shape = vowelShape(b.vowel);
  const cell = (slot: Slot, text: string, area: string) => (
    <span
      key={slot}
      style={{ gridArea: area }}
      className={cn(
        "flex items-center justify-center rounded-[8px] font-korean font-bold leading-none transition-transform",
        SLOT_TONE[slot],
        glow.includes(slot) && "hg-glow ring-2 ring-ink",
      )}
    >
      {text}
    </span>
  );
  const areas =
    shape === "under" ? (b.final ? '"i" "v" "f"' : '"i" "v"') : b.final ? '"i v" "f f"' : '"i v"';
  return (
    <span
      role="img"
      aria-label={`${ch}: ${b.initial} + ${b.vowel}${b.final ? ` + ${b.final}` : ""}`}
      className={cn(
        "inline-grid shrink-0 gap-1 rounded-[12px] border border-line bg-card p-1",
        className,
      )}
      style={{
        width: size,
        height: size,
        gridTemplateAreas: areas,
        fontSize: Math.round(size * (b.final ? 0.24 : 0.3)),
      }}
    >
      {cell("initial", b.initial, "i")}
      {cell("vowel", b.vowel, "v")}
      {b.final && cell("final", b.final, "f")}
    </span>
  );
}

/** Blocks shown taken apart, with what each shows (p1: 아 / 오, p4: 학). */
export function BlockShapes({ items }: { items: { ch: string; caption: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((it) => (
        <figure
          key={it.ch}
          className="flex flex-1 basis-[140px] items-center gap-3 rounded-[16px] border border-line bg-card p-3"
        >
          <BlockParts ch={it.ch} />
          <figcaption className="min-w-0 text-[13px] leading-5">
            <Ko className="block text-2xl font-bold">{it.ch}</Ko>
            <span className="text-ink-2">{it.caption}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ letters --
export function LetterGroup({ group }: { group: HangulGroupOut }) {
  const say = useSay();
  const vi = useContext(ViHintContext);
  const [open, setOpen] = useState<string | null>(null);
  const notes = group.letters.filter((l) => l.note_vi);
  const opened = group.letters.find((l) => l.jamo === open);
  return (
    <div className="mt-4 first:mt-0">
      <h3 className="text-[14px] font-bold">{group.title_vi}</h3>
      {group.note_vi && <p className="text-[13px] leading-5 text-ink-2">{group.note_vi}</p>}
      <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-7">
        {group.letters.map((l) => {
          const on = say.active === l.example || open === l.jamo;
          const cue = cueOf(l.jamo);
          return (
            <button
              key={l.jamo}
              type="button"
              onClick={() => {
                say.play(l.example);
                setOpen((o) => (o === l.jamo ? null : l.jamo));
              }}
              aria-expanded={open === l.jamo}
              aria-label={`${l.jamo}, nghe ${l.example}${cue ? `. ${cue}` : ""}`}
              className={cn(
                "hit-area flex min-h-[92px] flex-col items-center justify-center rounded-[16px] border border-line bg-card px-1 py-2 text-center shadow-elev-1 transition-colors active:scale-95",
                on && "border-blue bg-blue-soft",
              )}
            >
              <Ko className="text-[30px] font-bold leading-9">{l.jamo}</Ko>
              {vi.on && (
                <span className="mt-0.5 text-[12px] font-semibold leading-4 text-ink-2">
                  {l.sound_vi}
                </span>
              )}
              <span className="mt-1 inline-flex items-center gap-0.5 text-[12px] text-blue-deep">
                <Volume2 size={11} strokeWidth={2.8} aria-hidden="true" />
                <Ko>{l.example}</Ko>
              </span>
            </button>
          );
        })}
      </div>
      {opened && (
        <SoundCoach
          key={opened.jamo}
          jamo={opened.jamo}
          example={opened.example}
          showVi={vi.on}
          vi={opened.sound_vi}
        />
      )}
      {notes.map((l) => (
        <Rich
          key={l.jamo}
          as="p"
          text={`**${l.jamo}**: ${l.note_vi}`}
          className="mt-2 text-[13px] leading-5 text-ink-2"
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ putting blocks together --
/** A fixed shuffle (the same order on every render of one round). */
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed * 9301 + 49297;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function BlockBuilder({ targets, pool }: { targets: string[]; pool: string[] }) {
  const say = useSay();
  const [round, setRound] = useState(0);
  const [placed, setPlaced] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const target = targets[round % targets.length] ?? "";
  const b = split(target);
  const need = b ? [b.initial, b.vowel, ...(b.final ? [b.final] : [])] : [];
  const done = placed.length === need.length;
  const tray = useMemo(() => {
    const extra = shuffled(
      pool.filter((p) => !need.includes(p)),
      round + 3,
    ).slice(0, 7 - need.length);
    return shuffled([...new Set([...need, ...extra])], round + 11);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, target, pool]);

  const pick = (p: string) => {
    if (done) return;
    if (p === need[placed.length]) {
      const next = [...placed, p];
      setPlaced(next);
      if (next.length === need.length) {
        success();
        say.play(target);
      } else tap();
    } else {
      miss();
      setWrong(p);
      window.setTimeout(() => setWrong(null), 420);
    }
  };
  const nextRound = () => {
    tap();
    setPlaced([]);
    setRound((r) => r + 1);
  };
  const built = b
    ? placed.length >= 2
      ? join({ initial: placed[0]!, vowel: placed[1]!, final: placed[2] ?? "" })
      : (placed[0] ?? "")
    : "";
  const slots: Slot[] = b?.final ? ["initial", "vowel", "final"] : ["initial", "vowel"];

  return (
    <div className="rounded-[20px] border border-line bg-card p-4 shadow-elev-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-semibold">
          Ghép khối <Ko className="text-xl font-bold">{target}</Ko>
        </p>
        <span className="text-[12px] font-semibold tabular-nums text-ink-2">
          {(round % targets.length) + 1}/{targets.length}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex gap-1.5">
          {slots.map((s, i) => (
            <span
              key={s}
              className={cn(
                "flex h-14 w-12 flex-col items-center justify-center rounded-[12px] border-2 border-dashed border-line-strong text-center",
                placed[i] && cn("border-solid border-transparent", SLOT_TONE[s]),
              )}
            >
              <Ko className="text-xl font-bold leading-6">{placed[i] ?? ""}</Ko>
              <span className="text-[10px] font-semibold leading-3 text-ink-2">
                {SLOT_LABEL[s]}
              </span>
            </span>
          ))}
        </div>
        <ArrowRight size={18} className="shrink-0 text-ink-2" aria-hidden="true" />
        <Ko
          className={cn(
            "flex h-14 min-w-14 items-center justify-center rounded-[12px] bg-paper px-2 text-[34px] font-bold",
            done && "hg-pop text-blue-deep",
          )}
        >
          {built}
        </Ko>
        {done && <SayButton ko={target} />}
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Các chữ cái">
        {tray.map((p) => {
          const used = placed.includes(p) && !need.slice(placed.length).includes(p);
          return (
            <button
              key={p}
              type="button"
              disabled={done || used}
              onClick={() => pick(p)}
              className={cn(
                "hit-area flex h-11 items-center justify-center rounded-[12px] border border-line bg-paper font-korean text-xl font-bold active:scale-95 disabled:opacity-35",
                wrong === p && "hg-shake border-danger bg-danger-soft",
              )}
            >
              {p}
            </button>
          );
        })}
      </div>
      {done && (
        <button
          type="button"
          onClick={nextRound}
          className="hit-area mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-blue px-4 text-[13px] font-semibold text-primary-foreground active:scale-95"
        >
          {round % targets.length === targets.length - 1 ? "Ghép lại từ đầu" : "Khối tiếp"}
          <ArrowRight size={14} strokeWidth={2.8} />
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ patchim sorting --
export function PatchimSorter({ words }: { words: string[] }) {
  const say = useSay();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [right, setRight] = useState(0);
  const finished = i >= words.length;
  const word = words[i] ?? "";
  const has = endsWithFinal(word);

  const choose = (v: boolean) => {
    if (picked !== null) return;
    setPicked(v);
    if (v === has) {
      success();
      setRight((r) => r + 1);
    } else miss();
    say.play(word + (has ? "이에요" : "예요"));
  };
  const next = () => {
    tap();
    setPicked(null);
    setI((n) => n + 1);
  };

  if (finished) {
    return (
      <div className="rounded-[20px] border border-line bg-card p-4 text-center shadow-elev-1">
        <p className="text-[15px] font-bold">
          Đúng {right}/{words.length} từ
        </p>
        <p className="mt-1 text-[13px] text-ink-2">
          {right === words.length ? "Nhìn là biết ngay rồi!" : "Làm lại một lượt cho chắc nhé."}
        </p>
        <button
          type="button"
          onClick={() => {
            tap();
            setI(0);
            setRight(0);
            setPicked(null);
          }}
          className="hit-area mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-semibold active:scale-95"
        >
          <RotateCcw size={14} strokeWidth={2.6} /> Làm lại
        </button>
      </div>
    );
  }

  const last = [...word].pop() ?? "";
  return (
    <div className="rounded-[20px] border border-line bg-card p-4 shadow-elev-1">
      <div className="flex items-center justify-between text-[12px] font-semibold text-ink-2">
        <span>Khối cuối có patchim không?</span>
        <span className="tabular-nums">
          {i + 1}/{words.length}
        </span>
      </div>
      <Ko className="mt-3 block text-center text-[40px] font-bold leading-[48px]">{word}</Ko>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { v: false, top: "Không patchim", end: "예요" },
          { v: true, top: "Có patchim", end: "이에요" },
        ].map((o) => (
          <button
            key={o.end}
            type="button"
            disabled={picked !== null}
            onClick={() => choose(o.v)}
            className={cn(
              "hit-area flex min-h-16 flex-col items-center justify-center rounded-[16px] border border-line bg-paper px-2 active:scale-[0.97]",
              picked !== null && o.v === has && "border-green bg-green-soft",
              picked === o.v && o.v !== has && "border-danger bg-danger-soft",
            )}
          >
            <span className="text-[13px] font-semibold">{o.top}</span>
            <Ko className="text-[17px] font-bold text-blue-deep">+ {o.end}</Ko>
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="hg-pop mt-4 flex items-center gap-3 rounded-[16px] bg-paper p-3">
          <BlockParts ch={last} glow={has ? ["final"] : []} size={60} />
          <div className="min-w-0 flex-1">
            <Ko className="block text-[22px] font-bold">
              {word}
              <span className="text-blue-deep">{has ? "이에요" : "예요"}</span>
            </Ko>
            <span className="text-[12px] text-ink-2">
              {has ? `Đáy có ${split(last)?.final}` : "Đáy trống"}
            </span>
          </div>
          <button
            type="button"
            onClick={next}
            aria-label="Từ tiếp"
            className="hit-area flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue text-primary-foreground active:scale-95"
          >
            <ArrowRight size={18} strokeWidth={2.8} />
          </button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ sound changes --
/** The two blocks a change happens across: the block whose patchim moves or changes, and the
 * next one (사람이 → 람이 / 라미); a change made only to a block's first sound is shown with the
 * block before it, which causes it (학생 → 학생 / 학쌩). */
function changePair(written: string, said: string): [number, number] | null {
  const w = [...written];
  const s = [...said];
  const i = w.findIndex((c, n) => c !== s[n]);
  if (i < 0) return null;
  const a = split(w[i]!);
  const b = split(s[i] ?? "");
  const onlyStart = a && b && a.final === b.final && a.vowel === b.vowel;
  if (onlyStart && i > 0) return [i - 1, i];
  return i + 1 < w.length ? [i, i + 1] : [i - 1 < 0 ? 0 : i - 1, i];
}

function slotsDiff(x: string, y: string): Slot[] {
  const a = split(x);
  const b = split(y);
  if (!a || !b) return [];
  const out: Slot[] = [];
  if (a.initial !== b.initial) out.push("initial");
  if (a.vowel !== b.vowel) out.push("vowel");
  if (a.final !== b.final) out.push("final");
  return out;
}

function ChangeRow({ c }: { c: HangulChangeOut }) {
  const say = useSay();
  const [run, setRun] = useState(0);
  const same = c.written === c.said;
  const pair = changePair(c.written, c.said);
  const w = [...c.written];
  const s = [...c.said];
  const marked = (text: string[], other: string[]) =>
    text.map((ch, n) => (
      <span
        key={n}
        className={cn(
          ch !== other[n] && "text-blue-deep underline decoration-2 underline-offset-4",
        )}
      >
        {ch}
      </span>
    ));
  return (
    <li className="rounded-[16px] border border-line bg-card p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setRun((r) => r + 1);
            say.play(c.written);
          }}
          aria-label={`Nghe ${c.written}`}
          className={cn(
            "hit-area flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-blue-deep active:scale-95",
            say.active === c.written && "bg-blue text-primary-foreground",
          )}
        >
          <Volume2 size={16} strokeWidth={2.6} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 font-korean text-[20px] font-bold leading-7">
            <span>{c.written}</span>
            <span className="text-[13px] font-semibold text-ink-2" aria-hidden="true">
              đọc
            </span>
            <span>[{same ? c.said : marked(s, w)}]</span>
          </p>
          <p className="text-[12px] leading-4 text-ink-2">{c.vi}</p>
        </div>
      </div>
      {pair && !same && (
        <div key={run} className="mt-2.5 flex items-center justify-center gap-2" aria-hidden="true">
          <BlockParts ch={w[pair[0]]!} size={52} glow={slotsDiff(w[pair[0]]!, s[pair[0]]!)} />
          <BlockParts ch={w[pair[1]]!} size={52} glow={slotsDiff(w[pair[1]]!, s[pair[1]]!)} />
          <ArrowRight size={16} className="hg-nudge text-ink-2" />
          <BlockParts
            ch={s[pair[0]]!}
            size={52}
            glow={slotsDiff(w[pair[0]]!, s[pair[0]]!)}
            className="hg-pop"
          />
          <BlockParts
            ch={s[pair[1]]!}
            size={52}
            glow={slotsDiff(w[pair[1]]!, s[pair[1]]!)}
            className="hg-pop"
          />
        </div>
      )}
    </li>
  );
}

export function SoundRule({ rule }: { rule: HangulRuleOut }) {
  return (
    <div className="mt-5 first:mt-0">
      <h3 className="text-[15px] font-bold">{rule.title_vi}</h3>
      <Rich as="p" text={rule.body_vi} className="mt-0.5 text-[13px] leading-5 text-ink-2" />
      <ul className="mt-2.5 grid gap-2 lg:grid-cols-2">
        {rule.changes.map((c) => (
          <ChangeRow key={c.written} c={c} />
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ reading words --
export function ReadWords({ words }: { words: HangulWordOut[] }) {
  const say = useSay();
  const [open, setOpen] = useState<string[]>([]);
  const [drill, setDrill] = useState<string | null>(null);
  const drilled = words.find((w) => w.ko === drill);
  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {words.map((w) => {
          const shown = open.includes(w.ko);
          return (
            <li key={w.ko}>
              <button
                type="button"
                onClick={() => {
                  setOpen((o) => (o.includes(w.ko) ? o : [...o, w.ko]));
                  setDrill(w.ko);
                  say.play(w.ko);
                }}
                className={cn(
                  "hit-area flex min-h-[84px] w-full flex-col items-center justify-center rounded-[16px] border border-line bg-card px-2 py-2 text-center shadow-elev-1 active:scale-[0.97]",
                  (say.active === w.ko || drill === w.ko) && "border-blue",
                )}
              >
                <Ko className="text-[24px] font-bold leading-8">{w.ko}</Ko>
                {shown ? (
                  <span className="hg-pop text-[12px] leading-4 text-ink-2">
                    {w.say && <Ko className="mr-1 font-semibold text-blue-deep">[{w.say}]</Ko>}
                    {w.vi}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-ink-2/70">Chạm để nghe</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {drilled && (
        <div className="mt-2 rounded-[18px] border border-blue/30 bg-blue-soft/50 p-3">
          <p className="text-[13px] font-bold">
            Luyện 3 tốc độ: <Ko>{drilled.ko}</Ko>
            {drilled.say && <Ko className="ml-1 text-blue-deep">[{drilled.say}]</Ko>}
          </p>
          <p className="text-[12px] leading-4 text-ink-2">
            Chậm để đặt khẩu hình, vừa để nối âm, rồi tự nhiên. Đường kẻ là cao độ: chữ ở trên đọc
            cao hơn.
          </p>
          <SpeedDrill key={drilled.ko} text={drilled.ko} say={drilled.say} />
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ listen and pick --
export function ListenPick({ picks }: { picks: HangulPickOut[] }) {
  const say = useSay();
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const q = picks[i];

  if (!q) {
    return (
      <div className="rounded-[20px] border border-line bg-card p-4 text-center shadow-elev-1">
        <p className="text-[15px] font-bold">
          Nghe đúng {right}/{picks.length}
        </p>
        <button
          type="button"
          onClick={() => {
            tap();
            setI(0);
            setRight(0);
            setChosen(null);
          }}
          className="hit-area mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-semibold active:scale-95"
        >
          <RotateCcw size={14} strokeWidth={2.6} /> Nghe lại
        </button>
      </div>
    );
  }
  const choose = (o: string) => {
    if (chosen) return;
    setChosen(o);
    if (o === q.answer) {
      success();
      setRight((r) => r + 1);
    } else miss();
  };
  return (
    <div className="rounded-[20px] border border-line bg-card p-4 shadow-elev-1">
      <div className="flex items-center gap-3">
        <SayButton ko={q.hear} big />
        <p className="flex-1 text-[14px] font-semibold">Nghe rồi chọn chữ đúng</p>
        <span className="text-[12px] font-semibold tabular-nums text-ink-2">
          {i + 1}/{picks.length}
        </span>
      </div>
      <div
        className={cn("mt-4 grid gap-2", q.options.length === 3 ? "grid-cols-3" : "grid-cols-2")}
      >
        {q.options.map((o) => (
          <button
            key={o}
            type="button"
            disabled={!!chosen}
            onClick={() => choose(o)}
            className={cn(
              "hit-area flex min-h-14 items-center justify-center gap-1 rounded-[14px] border border-line bg-paper px-2 font-korean text-[22px] font-bold active:scale-[0.97]",
              chosen && o === q.answer && "border-green bg-green-soft",
              chosen === o && o !== q.answer && "border-danger bg-danger-soft",
            )}
          >
            {chosen && o === q.answer && <Check size={16} strokeWidth={3} className="text-green" />}
            {chosen === o && o !== q.answer && (
              <X size={16} strokeWidth={3} className="text-danger" />
            )}
            {o}
          </button>
        ))}
      </div>
      {chosen && (
        <button
          type="button"
          onClick={() => {
            tap();
            setChosen(null);
            setI((n) => n + 1);
          }}
          className="hit-area mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-blue px-4 text-[13px] font-semibold text-primary-foreground active:scale-95"
        >
          {i + 1 < picks.length ? "Câu tiếp" : "Xem kết quả"}{" "}
          <ArrowRight size={14} strokeWidth={2.8} />
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the keyboard --
export function KeyboardSetup() {
  const rows: { who: string; how: string }[] = [
    {
      who: "iPhone",
      how: "Cài đặt → Cài đặt chung → Bàn phím → Thêm bàn phím mới → Tiếng Hàn → chọn kiểu chuẩn (Standard), không chọn 10 phím.",
    },
    {
      who: "Android",
      how: "Mở cài đặt Gboard → Ngôn ngữ → Thêm bàn phím → Tiếng Hàn → chọn 2 bộ (두벌식).",
    },
    {
      who: "Máy tính",
      how: "Thêm bàn phím tiếng Hàn kiểu 2-Set. Windows: phím Alt bên phải đổi Hàn/Anh.",
    },
  ];
  return (
    <ul className="grid gap-2 lg:grid-cols-3">
      {rows.map((r) => (
        <li key={r.who} className="rounded-[16px] border border-line bg-card p-3">
          <p className="text-[13px] font-bold">{r.who}</p>
          <Rich as="p" text={r.how} className="mt-0.5 text-[13px] leading-5 text-ink-2" />
        </li>
      ))}
    </ul>
  );
}

/** A two-set keyboard on screen that lights the next key to press for a word, and puts letters
 * together into blocks as a phone does. */
export function GuidedKeyboard({ targets }: { targets: string[] }) {
  const say = useSay();
  const [round, setRound] = useState(0);
  const [keys, setKeys] = useState<string[]>([]);
  const [shift, setShift] = useState(false);
  const target = targets[round % targets.length] ?? "";
  const want = useMemo(() => keysOf(target), [target]);
  const typed = compose(keys);
  const done = typed === target;
  const onTrack = keys.every((k, n) => k === want[n]);
  const next = onTrack ? want[keys.length] : undefined;
  const lightShift = !!next && SHIFTED.has(next) && !shift;

  const press = (k: string) => {
    if (done) return;
    const nextKeys = [...keys, k];
    setKeys(nextKeys);
    setShift(false);
    if (compose(nextKeys) === target) {
      success();
      say.play(target);
    } else if (k !== want[keys.length]) miss();
    else tap();
  };
  const back = () => {
    tap();
    setKeys((k) => k.slice(0, -1));
  };
  const key = (label: string, onClick: () => void, lit: boolean, wide = false, aria?: string) => (
    <button
      key={aria ?? label}
      type="button"
      onClick={onClick}
      aria-label={aria ?? label}
      className={cn(
        "flex h-11 items-center justify-center rounded-[8px] border border-line bg-card font-korean text-[18px] font-semibold shadow-elev-1 active:scale-95",
        wide ? "flex-[1.5]" : "flex-1",
        lit && "hg-lit border-blue bg-blue text-primary-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-[20px] border border-line bg-card p-3 shadow-elev-1 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold">
          Gõ <Ko className="text-xl font-bold">{target}</Ko>
        </p>
        <span className="text-[12px] font-semibold tabular-nums text-ink-2">
          {(round % targets.length) + 1}/{targets.length}
        </span>
      </div>
      <div
        className={cn(
          "mt-2 flex min-h-14 items-center rounded-[12px] border border-line bg-paper px-3 font-korean text-[28px] font-bold",
          done && "border-green bg-green-soft",
          !onTrack && "border-danger",
        )}
        aria-live="polite"
      >
        {typed}
        {!done && <span className="ml-0.5 h-7 w-0.5 animate-pulse bg-ink" aria-hidden="true" />}
        {done && <Check size={20} strokeWidth={3} className="ml-auto text-green" />}
      </div>
      <p className="mt-1.5 min-h-4 text-[12px] text-ink-2">
        {done
          ? "Chuẩn rồi!"
          : !onTrack
            ? "Lệch rồi: bấm ⌫ để xoá."
            : lightShift
              ? "Chữ này cần giữ Shift (⇧) trước."
              : "Bấm phím đang sáng."}
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {KEY_ROWS.map((row, r) => (
          <div key={r} className={cn("flex gap-1", r === 1 && "px-[4%]")}>
            {r === 2 && key("⇧", () => setShift((s) => !s), lightShift || shift, true, "Shift")}
            {row.map((k) => {
              const out = shift && k.shift ? k.shift : k.key;
              const lit = !!next && !lightShift && out === next;
              return key(
                out,
                () => press(out),
                lit,
                false,
                `${k.key}${k.shift ? `/${k.shift}` : ""}`,
              );
            })}
            {r === 2 && key("⌫", back, !onTrack, true, "Xoá")}
          </div>
        ))}
      </div>
      {done && (
        <button
          type="button"
          onClick={() => {
            tap();
            setKeys([]);
            setRound((x) => x + 1);
          }}
          className="hit-area mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-blue px-4 text-[13px] font-semibold text-primary-foreground active:scale-95"
        >
          Từ tiếp <ArrowRight size={14} strokeWidth={2.8} />
        </button>
      )}
      {!done && keys.length > 0 && (
        <button
          type="button"
          onClick={() => {
            tap();
            setKeys([]);
          }}
          className="hit-area mt-3 inline-flex min-h-9 items-center gap-1 text-[12px] font-semibold text-ink-2"
        >
          <Delete size={13} /> Xoá hết
        </button>
      )}
    </div>
  );
}
