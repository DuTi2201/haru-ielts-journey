import type {
  ExamReadDiff,
  ExamSummaryPayload,
  ImportItemOut,
  ImportItemStatus,
} from "@/lib/api/types";

/* Pure helpers for reviewing an exam paper in Studio (components are in
 * components/haru/ExamReview.tsx). */

/** kind of the hidden item that records how the whole paper was read */
export const EXAM_SUMMARY = "exam_summary";

/** the extraction version the backend writes today (`prompt_version` of the summary) */
export const EXAM_READER_VERSION = "exam-v3";

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

/** 23,24,42,43 -> "23–24, 42–43" */
export function formatNumbers(numbers: number[]): string {
  const sorted = [...new Set(numbers)].sort((x, y) => x - y);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
    parts.push(j > i ? `${sorted[i]}–${sorted[j]}` : String(sorted[i]));
    i = j + 1;
  }
  return parts.join(", ");
}

export const splitExamItems = (all: ImportItemOut[]) => ({
  summary: all.find((i) => i.kind === EXAM_SUMMARY),
  items: all.filter((i) => i.kind !== EXAM_SUMMARY),
});

/** The key's source, as the last answers applied to the batch say. */
export function keySourceOf(summary: ImportItemOut | undefined): string | undefined {
  const key = (summary?.payload as Partial<ExamSummaryPayload> | undefined)?.key;
  return key?.source;
}

/** What "Duyệt nhanh" may confirm on an exam paper: only cards with nothing
 * flagged, and a question only together with a passage that is itself clean (a
 * question confirmed without its passage is written without one). Flagged cards
 * are the ones a reviewer has to look at — never confirmed in bulk. */
export function examBulkTargets(items: ImportItemOut[]): ImportItemOut[] {
  const passage = new Map<string, ImportItemStatus>();
  for (const i of items) {
    if (i.kind === "exam_passage") passage.set(asString(i.payload?.["local_ref"]), i.status);
  }
  return items.filter((i) => {
    if (i.kind !== "exam_passage" && i.kind !== "exam_item") return false;
    if (i.status !== "pending") return false;
    if (i.kind === "exam_item") {
      const ref = asString(i.payload?.["passage_ref"]);
      if (ref) {
        const s = passage.get(ref);
        if (s !== "pending" && s !== "confirmed") return false;
      }
    }
    return true;
  });
}

// ------------------------------------------------------- the two readings ----
type Payload = Record<string, unknown>;

export interface DiffGroup {
  /** "instruction" | "stem" | "option 2" | "options" | "passage" */
  field: string;
  diffs: ExamReadDiff[];
  /** the whole second reading of the field, when the backend kept it */
  full: string | null;
  /** all options of the second read (when the reads found a different number) */
  options: string[] | null;
}

/** The differences of one card, one group per field (a field can differ in several
 * places; its buttons act on the whole field). Order of first appearance. */
export function groupDiffs(diffs: ExamReadDiff[]): DiffGroup[] {
  const groups = new Map<string, DiffGroup>();
  for (const d of diffs) {
    let g = groups.get(d.field);
    if (!g) {
      g = { field: d.field, diffs: [], full: null, options: null };
      groups.set(d.field, g);
    }
    g.diffs.push(d);
    if (typeof d.b_full === "string") g.full = d.b_full;
    if (Array.isArray(d.b_options)) g.options = d.b_options.filter((o) => typeof o === "string");
  }
  return [...groups.values()];
}

const flagsOf = (payload: Payload): string[] =>
  Array.isArray(payload["flags"])
    ? payload["flags"].filter((f): f is string => typeof f === "string")
    : [];

function dropFlag(payload: Payload, flag: string): Payload {
  const next: Payload = { ...payload, flags: flagsOf(payload).filter((f) => f !== flag) };
  return next;
}

function altOf(payload: Payload): ExamReadDiff[] {
  const alt = payload["alt"];
  return Array.isArray(alt)
    ? alt.filter(
        (d): d is ExamReadDiff =>
          !!d && typeof d === "object" && typeof d.field === "string" && typeof d.a === "string",
      )
    : [];
}

/** "Giữ lượt 1": the saved reading stays; the field's differences are settled. The
 * "two reads differ" flag goes once no field differs any more. */
export function keepFirstRead(payload: Payload, field: string): Payload {
  const rest = altOf(payload).filter((d) => d.field !== field);
  const next: Payload = { ...payload };
  if (rest.length > 0) next["alt"] = rest;
  else delete next["alt"];
  return rest.length > 0 ? next : dropFlag(next, "text_mismatch");
}

/** "Lấy lượt 2": the second reading of the field replaces the saved one. null when the
 * backend did not keep the whole second reading (an older batch): edit it by hand. */
export function takeSecondRead(payload: Payload, group: DiffGroup): Payload | null {
  const next: Payload = { ...payload };
  const option = /^option (\d+)$/.exec(group.field);
  if (group.field === "options" && group.options && group.options.length > 0) {
    next["options"] = group.options;
  } else if (group.full === null) {
    return null;
  } else if (option) {
    const options = Array.isArray(payload["options"]) ? [...(payload["options"] as unknown[])] : [];
    const at = Number(option[1]) - 1;
    if (at < 0 || at >= options.length) return null;
    options[at] = group.full;
    next["options"] = options;
  } else if (group.field === "instruction") {
    next["instruction_ko"] = group.full;
  } else if (group.field === "stem") {
    next["stem_ko"] = group.full;
  } else if (group.field === "passage") {
    next["body_ko"] = group.full;
  } else {
    return null;
  }
  return keepFirstRead(next, group.field);
}

// -------------------------------------------------------- standard wording ----
/** "Dùng chỉ dẫn chuẩn": the standard wording replaces what was read. */
export function applySuggestion(payload: Payload): Payload {
  const suggest = (payload["instruction_suggest"] ?? {}) as {
    instruction_ko?: unknown;
    stem_ko?: unknown;
  };
  const next: Payload = { ...payload };
  if (typeof suggest.instruction_ko === "string") next["instruction_ko"] = suggest.instruction_ko;
  if (typeof suggest.stem_ko === "string") next["stem_ko"] = suggest.stem_ko;
  delete next["instruction_suggest"];
  return dropFlag(next, "instruction_variant");
}

/** "Giữ như đã đọc": the reviewer checked the page and the wording is right. */
export function dismissSuggestion(payload: Payload): Payload {
  const next: Payload = { ...payload };
  delete next["instruction_suggest"];
  return dropFlag(next, "instruction_variant");
}

/** "Đã đối chiếu": the narrowly re-read text was compared with the page. */
export const markRefinedChecked = (payload: Payload): Payload => dropFlag(payload, "refined");

export interface Marked {
  text: string;
  /** characters of the standard wording the reading does not have */
  missing: boolean;
}

/** The standard wording split into what the reading has and what it lacks, so the
 * dropped word can be pointed at ("가장"). Spaces never count. */
export function markMissing(read: string, standard: string): Marked[] {
  const fold = (c: string) => c.normalize("NFKC");
  const a = [...read].filter((c) => !/\s/.test(c)).map(fold);
  const chars = [...standard];
  const b = chars.map((c) => (/\s/.test(c) ? null : fold(c)));
  const kept = b.filter((c): c is string => c !== null);
  // longest common subsequence of the read and the standard
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(kept.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= kept.length; j++) {
      table[i]![j] =
        a[i - 1] === kept[j - 1]
          ? table[i - 1]![j - 1]! + 1
          : Math.max(table[i - 1]![j]!, table[i]![j - 1]!);
    }
  }
  const inCommon = new Array<boolean>(kept.length).fill(false);
  let i = a.length;
  let j = kept.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === kept[j - 1]) {
      inCommon[j - 1] = true;
      i--;
      j--;
    } else if (table[i - 1]![j]! >= table[i]![j - 1]!) i--;
    else j--;
  }
  const out: Marked[] = [];
  let k = 0;
  for (const c of chars) {
    const isSpace = /\s/.test(c);
    const missing = isSpace ? (out[out.length - 1]?.missing ?? false) : !inCommon[k++];
    const last = out[out.length - 1];
    if (last && last.missing === missing) last.text += c;
    else out.push({ text: c, missing });
  }
  return out;
}
