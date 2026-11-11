/** The lecture's slides, kept in step with the voice (GET /lessons/{id}/lecture-slides).
 *
 * The server gives, for every non-empty line of the lecture script, the slide it is on and what it
 * brings onto it (`show`). The recording gives `timeline`: when each language run of each line
 * starts ([line, run, ms]). From the playback time this finds the line and run being said, the
 * slide to show, and what is on it so far — a word's meaning only once the voice has said it.
 *
 * A recording made before timelines (or by the fallback voice) has none: the run starts are then
 * estimated from the script (Korean read slowly with a gap to repeat, Vietnamese at a normal pace,
 * the gaps of app/services/lecture_voice.py) and scaled to the real length. Pure functions. */

export type SlideKind =
  "title" | "section" | "word" | "review" | "grammar" | "note" | "recap" | "end" | "scene";

export interface LectureSlide {
  kind: SlideKind;
  [k: string]: unknown;
}

export interface LectureSlidesOut {
  script: string;
  lines: [number, string | null][];
  slides: LectureSlide[];
  /** [line, run] of every stretch said for the learner to repeat, as the voice cuts the script.
   * English has no script change to cut on, so the server says which they are. */
  shadow?: [number, number][];
}

const shadowSet = (data: { shadow?: [number, number][] | undefined }) =>
  data.shadow ? new Set(data.shadow.map(([l, r]) => `${l}:${r}`)) : null;

/** [line, run, ms] */
export type RunStart = [number, number, number];

// as app/services/lecture_voice._is_hangul: syllables and jamo
const HANGUL = /[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f\ua960-\ua97f]/;
const SHADOW = /(\.{2,}|…)\s*["'”’)\]]*\s*$/;

export const scriptLines = (script: string) => script.split("\n").filter((l) => l.trim());

/** A line cut where the language changes (Korean / the rest), as the voice plan cuts it. */
export function runsOf(line: string): { ko: boolean; text: string }[] {
  const out: { ko: boolean; text: string }[] = [];
  let lead = "";
  for (const ch of line) {
    const isKo = HANGUL.test(ch);
    const isLetter = /\p{L}/u.test(ch);
    if (!isLetter) {
      if (out.length) out[out.length - 1]!.text += ch;
      else lead += ch;
      continue;
    }
    const last = out[out.length - 1];
    if (last && last.ko === isKo) last.text += ch;
    else {
      out.push({ ko: isKo, text: (out.length ? "" : lead) + ch });
      lead = "";
    }
  }
  return out.map((r) => ({ ...r, text: r.text.trim() })).filter((r) => /\p{L}/u.test(r.text));
}

/** Seconds a run takes, roughly, including the silence after it. */
function runSeconds(r: { ko: boolean; text: string }, lastOfLine: boolean): number {
  if (r.ko) {
    const syl = [...r.text].filter((c) => /[\uac00-\ud7a3]/.test(c)).length;
    const say = syl * 0.3;
    return say + (SHADOW.test(r.text) ? Math.max(0.7, say) : lastOfLine ? 0.5 : 0.12);
  }
  const words = r.text.split(/\s+/).filter(Boolean).length;
  return words * 0.3 + (lastOfLine ? 0.5 : 0.12);
}

/** Run starts estimated from the script, scaled to `duration` seconds. */
export function estimateTimeline(script: string, duration: number): RunStart[] {
  const lines = scriptLines(script);
  const raw: RunStart[] = [];
  let t = 0;
  lines.forEach((line, li) => {
    const runs = runsOf(line);
    runs.forEach((r, ri) => {
      raw.push([li, ri, t]);
      t += runSeconds(r, ri === runs.length - 1);
    });
  });
  if (!(duration > 0) || t <= 0) return raw.map(([l, r, s]) => [l, r, Math.round(s * 1000)]);
  const k = duration / t;
  return raw.map(([l, r, s]) => [l, r, Math.round(s * k * 1000)]);
}

/** The run being said at `ms` (the last one started), or null before the first. */
export function locate(timeline: RunStart[], ms: number): { line: number; run: number } | null {
  let lo = 0;
  let hi = timeline.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timeline[mid]![2] <= ms) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return null;
  return { line: timeline[found]![0], run: timeline[found]![1] };
}

/** When a line starts (its first run), in ms; null when the recording does not reach it. */
export function lineStart(timeline: RunStart[], line: number): number | null {
  const hit = timeline.find((t) => t[0] === line);
  return hit ? hit[2] : null;
}

export interface SlideState {
  slide: number;
  /** what the slide shows so far */
  shown: Set<string>;
  /** the piece brought in last (the one to put forward) */
  latest: string | null;
  /** a word's meaning: only after the voice has said it (the learner tries first) */
  meaningOut: boolean;
  /** the voice is saying a Korean line the learner repeats in the gap after it */
  sayAlong: boolean;
}

/** What is on screen at a given line and run. */
export function stateAt(
  data: LectureSlidesOut,
  at: { line: number; run: number } | null,
  lines: string[],
): SlideState {
  if (!at) return { slide: 0, shown: new Set(), latest: null, meaningOut: false, sayAlong: false };
  const slide = data.lines[at.line]?.[0] ?? 0;
  const shown = new Set<string>();
  let latest: string | null = null;
  let wordLine = -1;
  for (let i = 0; i <= at.line && i < data.lines.length; i++) {
    const [s, show] = data.lines[i]!;
    if (s !== slide || !show) continue;
    shown.add(show);
    latest = show;
    if (show === "word") wordLine = i;
  }
  const meaningOut = wordLine >= 0 && (at.line > wordLine || at.run >= 1);
  const marked = shadowSet(data);
  const runs = runsOf(lines[at.line] ?? "");
  const run = runs[at.run];
  const sayAlong = marked
    ? marked.has(`${at.line}:${at.run}`)
    : !!run && run.ko && SHADOW.test(run.text);
  return { slide, shown, latest, meaningOut, sayAlong };
}

/** The ms where each "say it back" gap ends (the start of the run after a Korean line said for
 * repeating): where «Tự dừng để nói theo» pauses. */
export function sayAlongEnds(
  timeline: RunStart[],
  lines: string[],
  shadow?: [number, number][],
): number[] {
  const out: number[] = [];
  const marked = shadowSet({ shadow });
  for (let i = 0; i < timeline.length - 1; i++) {
    const [l, r] = timeline[i]!;
    const run = runsOf(lines[l] ?? "")[r];
    const say = marked ? marked.has(`${l}:${r}`) : !!run && run.ko && SHADOW.test(run.text);
    if (say) out.push(timeline[i + 1]![2]);
  }
  return out;
}

/** The parts of the lecture to jump to: its sections, the review and the recap, with their start. */
export function slideChapters(
  data: LectureSlidesOut,
  timeline: RunStart[],
): { label: string; at: number }[] {
  const out: { label: string; at: number }[] = [];
  data.slides.forEach((s, i) => {
    const label =
      s.kind === "section"
        ? String(s["title"] ?? "")
        : s.kind === "review"
          ? "Ôn từ"
          : s.kind === "recap"
            ? "Nói lại"
            : s.kind === "scene"
              ? String(s["eyebrow"] ?? s["title"] ?? "")
              : null;
    if (!label) return;
    const line = data.lines.findIndex(([slide]) => slide === i);
    const ms = line >= 0 ? lineStart(timeline, line) : null;
    if (ms !== null) out.push({ label, at: ms / 1000 });
  });
  return out;
}

/** The line where a slide's piece comes in (to jump the voice there when it is tapped). */
export function lineOf(data: LectureSlidesOut, slide: number, show: string): number {
  return data.lines.findIndex(([s, sh]) => s === slide && sh === show);
}
