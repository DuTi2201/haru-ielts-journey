/** Chép chính tả: comparing what the learner typed with the script, character by character.
 *
 * The aim of a dictation is a trained ear, not perfect spelling, so spaces and punctuation are
 * ignored (a learner cannot hear them) and the result is a similarity, not a pass/fail on every
 * syllable. Everything runs in the browser. */

/** What is compared: one Unicode form, no spaces, no punctuation. */
export function normalizeDictation(text: string): string[] {
  return [
    ...text
      .normalize("NFC")
      .replace(/[\s\u00a0]+/g, "")
      .replace(/[.。,，!?？！…·~"'“”‘’「」()（）\-–—:;]+/gu, ""),
  ];
}

export interface Mark {
  ch: string;
  /** false = a character of the script the learner missed (in the script row), or a character
   * that is not in the script (in the typed row). */
  ok: boolean;
}

export interface LineDiff {
  /** The script, each character marked missed or heard. */
  script: Mark[];
  /** What was typed, each character marked extra or right. */
  typed: Mark[];
  /** Characters both rows share, in order (the longest common subsequence). */
  common: number;
  /** 0–1: 2 × common / (script + typed length). 1 for two empty lines, 0 for an empty answer. */
  similarity: number;
}

/** The two rows of one line, marked by a longest-common-subsequence match. */
export function diffLine(typedText: string, scriptText: string): LineDiff {
  const a = normalizeDictation(typedText);
  const b = normalizeDictation(scriptText);
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  // table[i * w + j] = the common length of a[i..] and b[j..]
  const table = new Int32Array((n + 1) * w);
  const at = (i: number, j: number): number => table[i * w + j] ?? 0;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * w + j] =
        a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const typedOk = new Array<boolean>(n).fill(false);
  const scriptOk = new Array<boolean>(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      typedOk[i] = true;
      scriptOk[j] = true;
      i++;
      j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      i++;
    } else {
      j++;
    }
  }
  const common = at(0, 0);
  const total = n + m;
  return {
    script: b.map((ch, k) => ({ ch, ok: scriptOk[k] === true })),
    typed: a.map((ch, k) => ({ ch, ok: typedOk[k] === true })),
    common,
    similarity: total === 0 ? 1 : (2 * common) / total,
  };
}

/** A dictation counts as done from this similarity upwards. */
export const DICTATION_PASS = 0.85;

export interface DictationResult {
  lines: LineDiff[];
  /** 0–1 over the whole script (every line weighs by its length). */
  similarity: number;
  passed: boolean;
}

/** `typed[i]` is the answer to line i of the script. */
export function checkDictation(
  typed: readonly string[],
  script: readonly string[],
): DictationResult {
  const lines = script.map((s, i) => diffLine(typed[i] ?? "", s));
  const common = lines.reduce((n, l) => n + l.common, 0);
  const total = lines.reduce((n, l) => n + l.script.length + l.typed.length, 0);
  const similarity = total === 0 ? 0 : (2 * common) / total;
  return { lines, similarity, passed: similarity >= DICTATION_PASS };
}

/** The answer kept with the exercise result: the typed lines, one per row. */
export function packAnswer(typed: readonly string[]): string {
  return typed.join(" / ").slice(0, 500);
}
