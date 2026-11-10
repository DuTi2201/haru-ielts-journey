/** A lesson cut into sittings of about 15 minutes ("buổi"), each one a short guided path:
 *
 *   learn 10–16 words → learn 1–2 grammar cards → answer 3–6 questions on what was just learnt
 *
 * and, once every word and card has been met, the rest of the lesson's questions as practice
 * sittings by skill. Nothing in the lesson is added, removed or reworded: this only decides the
 * order and the size of the pieces it is shown in. Every word, card and question of the lesson is
 * in exactly one sitting.
 *
 * Why this shape (what the learning-science literature agrees on):
 * - working memory takes a handful of new items at once, so a sitting brings 10–16 words and
 *   at most two patterns (Sweller's cognitive load);
 * - recall right after study fixes more than re-reading (the testing effect, Roediger & Karpicke
 *   2006), so each sitting ends with questions on its own words and patterns;
 * - grammar is spread over the sittings, between the words, rather than all at the end
 *   (interleaving and spacing);
 * - a session people can finish is one they start: ~15 minutes on a phone.
 *
 * Pure functions only (no React, no fetch), so the plan can be tested on its own. */
import type {
  GrammarPointOut,
  LessonSessionOut,
  PracticeItem,
  SituationOut,
  VocabItemOut,
} from "@/lib/api/types";

/** New words in one sitting at most (a slice is usually 10–16). */
export const MAX_WORDS = 16;
export const MAX_PATTERNS_PER_SITTING = 2;
export const TARGET_MINUTES = 15;
/** A learning sitting shorter than this is merged with the next one. */
/** Minutes of new words and patterns a learning sitting aims at, before its check. */
const LEARN_MINUTES = 11;
/** Questions closing a learning sitting. */
const CHECK_MIN = 3;
const CHECK_MAX = 6;

/** One line of a sitting's situation or "Nói thử": Korean and its Vietnamese. */
export interface SayLine {
  ko: string;
  vi: string | null;
}

export type SittingStep =
  | { kind: "vocab"; ids: number[]; label: string }
  | { kind: "grammar"; ids: number[]; label: string }
  /** "Nói thử": say aloud the sentences this sitting's words and cards just showed. */
  | { kind: "say"; lines: SayLine[]; label: string }
  /** A short dialogue situation (SituationOut) closing the sitting. */
  | { kind: "situation"; situation: SituationOut; label: string }
  | { kind: "check"; itemIds: string[]; questionIds: string[]; label: string }
  | { kind: "practice"; skill: string; itemIds: string[]; questionIds: string[]; label: string };

/** What a hand-planned sitting promises, and where it is used (shown before and after it). */
export interface SittingPlan {
  canDo: string;
  use?: string | undefined;
  topik?: string | undefined;
}

export interface Sitting {
  /** 1-based, as shown ("Buổi 3"). */
  n: number;
  /** Present on a sitting the author planned (see LessonSessionOut); absent on an evenly cut one. */
  plan?: SittingPlan;
  kind: "learn" | "practice";
  title: string;
  steps: SittingStep[];
  minutes: number;
}

type V = Pick<VocabItemOut, "id" | "headword"> &
  Partial<Pick<VocabItemOut, "example_en" | "example_vi">>;
type G = Pick<GrammarPointOut, "id" | "pattern"> &
  Partial<Pick<GrammarPointOut, "example_en" | "example_vi">>;
type Plan = LessonSessionOut;
type Item = PracticeItem;

/** The ids answers to an item are filed under (mirrors app/services/lesson_seed._question_ids). */
export function questionIdsOf(item: Item): string[] {
  if (item.type === "write_fill" && "blanks" in item)
    return item.blanks.map((b) => `${item.id}:${b.id}`);
  if ("questions" in item && Array.isArray(item.questions)) return item.questions.map((q) => q.id);
  return [item.id];
}

/** Minutes an item takes, roughly: a closed question ~35 s, a blank ~1 min, a dictation ~2 min,
 * a spoken answer ~3 min, a written paragraph ~8 min. */
export function itemMinutes(item: Item): number {
  switch (item.type) {
    case "write_essay":
      return 8;
    case "speak":
      return 3;
    case "listen_dictation":
      return 2;
    case "write_fill":
      return questionIdsOf(item).length * 1;
    case "build_order":
      return 0.8;
    default:
      return questionIdsOf(item).length * 0.6;
  }
}

const vocabMinutes = (n: number) => n * 0.42;
const grammarMinutes = (n: number) => n * 2.5;

/** The grammar patterns an item tests (on the item, or on its questions). */
function patternsOf(item: Item): string[] {
  const out = new Set<string>();
  if ("grammar" in item && Array.isArray(item.grammar)) item.grammar.forEach((p) => out.add(p));
  if ("questions" in item && Array.isArray(item.questions))
    for (const q of item.questions) (q.grammar ?? []).forEach((p) => out.add(p));
  return [...out];
}

/** A closed, quick item: fit to close a sitting (a paragraph or a spoken answer is not). */
const isQuick = (item: Item) =>
  item.type !== "write_essay" && item.type !== "speak" && questionIdsOf(item).length <= 4;

/** The part of a word to look for in a sentence: a verb or adjective without -다. */
function stemOf(headword: string): string | null {
  const w = headword.split(/[\s(/]/)[0]?.trim() ?? "";
  const stem = w.endsWith("다") && w.length > 2 ? w.slice(0, -1) : w;
  return stem.length >= 2 ? stem : null;
}

const SKILL_ORDER = ["listening", "reading", "build", "writing", "speaking"];
const SKILL_LABEL: Record<string, string> = {
  listening: "Nghe",
  reading: "Đọc",
  build: "Tạo câu",
  writing: "Viết",
  speaking: "Nói",
};

const span = (label: string, from: number, to: number) =>
  from === to ? `${label} ${from}` : `${label} ${from}–${to}`;

/** The sentences to say aloud for a sitting: the examples its own cards showed (two per card), then
 * the examples of its words (short ones first) up to MAX_SAY. Nothing is written for this step: it
 * only picks what the sitting already taught, so what is said is exactly what was learnt. */
export const MAX_SAY = 5;
export function sayLines(v: V[], g: G[]): SayLine[] {
  const out: SayLine[] = [];
  const seen = new Set<string>();
  const add = (ko: string | null | undefined, vi: string | null | undefined) => {
    const k = (ko ?? "").trim();
    if (!k || seen.has(k) || out.length >= MAX_SAY) return;
    seen.add(k);
    out.push({ ko: k, vi: (vi ?? "").trim() || null });
  };
  for (const card of g) {
    const ko = (card.example_en ?? "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const vi = (card.example_vi ?? "").split("\n").map((x) => x.trim());
    ko.slice(0, 2).forEach((line, i) => add(line, vi[i]));
  }
  const fromWords = v
    .filter((w) => (w.example_en ?? "").trim())
    .sort((a, b) => (a.example_en ?? "").length - (b.example_en ?? "").length);
  for (const w of fromWords) add(w.example_en, w.example_vi);
  return out;
}

/** The sittings of one lesson. */
export function planSittings(
  vocab: V[],
  grammar: G[],
  items: Item[],
  plans: Plan[] = [],
): Sitting[] {
  // -- 1. the learning sittings. The author's plan when the lesson has one: its words and cards in
  // the order they are taught, each sitting closed by the questions the author picked. Otherwise as
  // many as it takes for ~11 minutes of new words and patterns each (the check brings it to ~15),
  // never more than MAX_WORDS words or two patterns in one; words and patterns are then shared
  // out evenly, so no sitting is a leftover
  const pool = new Map(items.map((it) => [it.id, it]));
  type Draft = { v: V[]; vFrom: number; g: G[]; gFrom: number; plan?: Plan };
  const merged: Draft[] = [];
  const byHangul = new Map(vocab.map((x) => [x.headword, x]));
  const byPattern = new Map(grammar.map((x) => [x.pattern, x]));
  const planned =
    plans.length > 0 &&
    plans.some(
      (p) => p.vocab.some((w) => byHangul.has(w)) || p.grammar.some((q) => byPattern.has(q)),
    );
  if (planned) {
    const seenV = new Set<number>();
    const seenG = new Set<number>();
    let vAt = 1;
    let gAt = 1;
    for (const plan of plans) {
      const v = plan.vocab
        .map((w) => byHangul.get(w))
        .filter((x): x is V => !!x && !seenV.has(x.id));
      const g = plan.grammar
        .map((q) => byPattern.get(q))
        .filter((x): x is G => !!x && !seenG.has(x.id));
      v.forEach((x) => seenV.add(x.id));
      g.forEach((x) => seenG.add(x.id));
      merged.push({ v, vFrom: vAt, g, gFrom: gAt, plan });
      vAt += v.length;
      gAt += g.length;
    }
    // anything the plan did not name (a word added after it was written) rides with the last sitting
    const last = merged[merged.length - 1];
    if (last) {
      last.v = [...last.v, ...vocab.filter((x) => !seenV.has(x.id))];
      last.g = [...last.g, ...grammar.filter((x) => !seenG.has(x.id))];
    }
  } else {
    const learnMinutes = vocabMinutes(vocab.length) + grammarMinutes(grammar.length);
    const learnCount = Math.max(
      vocab.length || grammar.length ? 1 : 0,
      Math.ceil(vocab.length / MAX_WORDS),
      Math.ceil(grammar.length / MAX_PATTERNS_PER_SITTING),
      Math.round(learnMinutes / LEARN_MINUTES),
    );
    for (let k = 0; k < learnCount; k++) {
      const v0 = Math.floor((k * vocab.length) / learnCount);
      const v1 = Math.floor(((k + 1) * vocab.length) / learnCount);
      const g0 = Math.floor((k * grammar.length) / learnCount);
      const g1 = Math.floor(((k + 1) * grammar.length) / learnCount);
      merged.push({
        v: vocab.slice(v0, v1),
        vFrom: v0 + 1,
        g: grammar.slice(g0, g1),
        gFrom: g0 + 1,
      });
    }
  }

  const sittings: Sitting[] = [];
  for (const d of merged) {
    const steps: SittingStep[] = [];
    let minutes = 0;
    if (d.v.length) {
      steps.push({
        kind: "vocab",
        ids: d.v.map((x) => x.id),
        label: span("Từ", d.vFrom, d.vFrom + d.v.length - 1),
      });
      minutes += vocabMinutes(d.v.length);
    }
    if (d.g.length) {
      steps.push({
        kind: "grammar",
        ids: d.g.map((x) => x.id),
        label: span("Mẫu", d.gFrom, d.gFrom + d.g.length - 1),
      });
      minutes += grammarMinutes(d.g.length);
    }
    // the check: the author's picks when planned; else quick items on these patterns first, then
    // items that use these words
    const patterns = new Set(d.g.map((x) => x.pattern));
    const stems = d.v.map((x) => stemOf(x.headword)).filter((s): s is string => !!s);
    const picked: Item[] = [];
    let count = 0;
    const take = (pred: (it: Item) => boolean) => {
      for (const it of pool.values()) {
        if (count >= CHECK_MAX) return;
        if (!isQuick(it) || !pred(it)) continue;
        const n = questionIdsOf(it).length;
        if (count > 0 && count + n > CHECK_MAX) continue;
        picked.push(it);
        pool.delete(it.id);
        count += n;
      }
    };
    if (d.plan) {
      for (const id of d.plan.check) {
        const it = pool.get(id);
        if (!it) continue;
        picked.push(it);
        pool.delete(id);
        count += questionIdsOf(it).length;
      }
    } else if (patterns.size) take((it) => patternsOf(it).some((p) => patterns.has(p)));
    if (!d.plan && count < CHECK_MIN && stems.length) {
      take((it) => {
        const text = JSON.stringify(it);
        return stems.some((s) => text.includes(s));
      });
    }
    if (d.plan) {
      const lines = sayLines(d.v, d.g);
      if (lines.length >= 2) {
        steps.push({ kind: "say", lines, label: `Nói thử · ${lines.length} câu` });
        minutes += Math.ceil(lines.length * 0.4);
      }
    }
    if (picked.length) {
      steps.push({
        kind: "check",
        itemIds: picked.map((it) => it.id),
        questionIds: picked.flatMap(questionIdsOf),
        label: `Kiểm tra nhanh · ${count} câu`,
      });
      minutes += picked.reduce((m, it) => m + itemMinutes(it), 0);
    }
    if (d.plan?.situation) {
      steps.push({ kind: "situation", situation: d.plan.situation, label: "Hội thoại" });
      minutes += 3;
    }
    sittings.push({
      n: 0,
      kind: "learn",
      title: d.plan ? d.plan.title_vi : steps.map((s) => s.label.replace(/ · .*$/, "")).join(" + "),
      ...(d.plan
        ? {
            plan: {
              canDo: d.plan.can_do_vi,
              use: d.plan.use_vi ?? undefined,
              topik: d.plan.topik_vi ?? undefined,
            },
          }
        : {}),
      steps,
      minutes,
    });
  }

  // -- 2. what is left: practice sittings by skill, ~15 minutes each
  const rest = [...pool.values()];
  const skills = [
    ...SKILL_ORDER.filter((s) => rest.some((it) => it.skill === s)),
    ...[...new Set(rest.map((it) => it.skill))].filter((s) => !SKILL_ORDER.includes(s)),
  ];
  // each skill cut into ~15-minute steps, then neighbouring short steps share a sitting
  type PStep = Extract<SittingStep, { kind: "practice" }> & { minutes: number };
  const psteps: PStep[] = [];
  for (const skill of skills) {
    const its = rest.filter((it) => it.skill === skill);
    const groups: Item[][] = [];
    let mins = 0;
    for (const it of its) {
      const m = itemMinutes(it);
      const cur = groups[groups.length - 1];
      if (cur && mins + m <= TARGET_MINUTES + 3) {
        cur.push(it);
        mins += m;
      } else {
        groups.push([it]);
        mins = m;
      }
    }
    groups.forEach((g, i) => {
      const name = SKILL_LABEL[skill] ?? "Luyện thêm";
      psteps.push({
        kind: "practice",
        skill,
        itemIds: g.map((it) => it.id),
        questionIds: g.flatMap(questionIdsOf),
        label: groups.length > 1 ? `${name} ${i + 1}` : name,
        minutes: g.reduce((m, it) => m + itemMinutes(it), 0),
      });
    });
  }
  let packed: { steps: PStep[]; minutes: number } | null = null;
  const closePack = () => {
    if (!packed) return;
    const qs = packed.steps.reduce((n, st) => n + st.questionIds.length, 0);
    sittings.push({
      n: 0,
      kind: "practice",
      title: `Luyện ${packed.steps.map((st) => st.label.toLowerCase()).join(" + ")} · ${qs} câu`,
      steps: packed.steps.map(({ minutes: _m, ...st }) => st),
      minutes: packed.minutes,
    });
    packed = null;
  };
  for (const [k, st] of psteps.entries()) {
    // a short last piece (one paragraph, one spoken answer) goes with the sitting before it
    const tail = k === psteps.length - 1 && st.minutes < 6;
    if (packed && (packed.minutes + st.minutes <= TARGET_MINUTES + 3 || tail)) {
      packed.steps.push(st);
      packed.minutes += st.minutes;
    } else {
      closePack();
      packed = { steps: [st], minutes: st.minutes };
    }
  }
  closePack();

  sittings.forEach((s, i) => {
    s.n = i + 1;
    s.minutes = Math.max(3, Math.round(s.minutes));
  });
  return sittings;
}

/** How far a learner is in one step / sitting, from what the server has on record. */
export interface StudyMarks {
  vocabMet: ReadonlySet<number>;
  grammarMet: ReadonlySet<number>;
  answered: ReadonlySet<string>;
}

export function stepDone(step: SittingStep, m: StudyMarks): boolean {
  switch (step.kind) {
    case "vocab":
      return step.ids.every((id) => m.vocabMet.has(id));
    case "grammar":
      return step.ids.every((id) => m.grammarMet.has(id));
    case "say":
    case "situation":
      // never hold a sitting back: these are practice on what was learnt, with no mark on the server
      return true;
    default:
      return step.questionIds.every((q) => m.answered.has(q));
  }
}

export const sittingDone = (s: Sitting, m: StudyMarks) => s.steps.every((st) => stepDone(st, m));

/** The sitting to open: the first one not finished (the last one when all are). */
export function currentSitting(sittings: Sitting[], m: StudyMarks): number {
  const i = sittings.findIndex((s) => !sittingDone(s, m));
  return i === -1 ? Math.max(0, sittings.length - 1) : i;
}
