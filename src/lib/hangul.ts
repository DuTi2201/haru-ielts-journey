/* Hangul by hand: a syllable block taken apart into its letters and put back together, and the
 * two-set (두벌식) keyboard every phone uses, so the alphabet lesson can build blocks, sort
 * patchim and let a learner type Korean without a Korean keyboard installed.
 *
 * Unicode: a block is 0xAC00 + (initial × 21 + vowel) × 28 + final. */

export const INITIALS = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
export const VOWELS = [..."ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"];
/** index 0 = no final */
export const FINALS = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];

const BASE = 0xac00;
const LAST = 0xd7a3;

export interface Block {
  initial: string;
  vowel: string;
  final: string; // "" when there is none
}

export function isBlock(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c >= BASE && c <= LAST;
}

export function split(ch: string): Block | null {
  if (!isBlock(ch)) return null;
  const n = (ch.codePointAt(0) ?? 0) - BASE;
  return {
    initial: INITIALS[Math.floor(n / 588)] ?? "",
    vowel: VOWELS[Math.floor((n % 588) / 28)] ?? "",
    final: FINALS[n % 28] ?? "",
  };
}

export function join(b: Block): string {
  const i = INITIALS.indexOf(b.initial);
  const v = VOWELS.indexOf(b.vowel);
  const f = FINALS.indexOf(b.final);
  if (i < 0 || v < 0 || f < 0) return b.initial + b.vowel + b.final;
  return String.fromCodePoint(BASE + (i * 21 + v) * 28 + f);
}

/** Whether the last block of a word has a patchim (학생 yes, 의사 no). */
export function endsWithFinal(word: string): boolean {
  const chars = [...word.trim()];
  const last = chars[chars.length - 1];
  return !!last && !!split(last)?.final;
}

/** Vowels written beside the initial (ㅏ) rather than under it (ㅗ). */
const SIDE = new Set([..."ㅏㅐㅑㅒㅓㅔㅕㅖㅣ"]);
const UNDER = new Set([..."ㅗㅛㅜㅠㅡ"]);
export function vowelShape(v: string): "side" | "under" | "both" {
  return SIDE.has(v) ? "side" : UNDER.has(v) ? "under" : "both";
}

// ------------------------------------------------------------------ the keyboard --
const VOWEL_PAIRS: Record<string, string> = {
  ㅗㅏ: "ㅘ",
  ㅗㅐ: "ㅙ",
  ㅗㅣ: "ㅚ",
  ㅜㅓ: "ㅝ",
  ㅜㅔ: "ㅞ",
  ㅜㅣ: "ㅟ",
  ㅡㅣ: "ㅢ",
};
const FINAL_PAIRS: Record<string, string> = {
  ㄱㅅ: "ㄳ",
  ㄴㅈ: "ㄵ",
  ㄴㅎ: "ㄶ",
  ㄹㄱ: "ㄺ",
  ㄹㅁ: "ㄻ",
  ㄹㅂ: "ㄼ",
  ㄹㅅ: "ㄽ",
  ㄹㅌ: "ㄾ",
  ㄹㅍ: "ㄿ",
  ㄹㅎ: "ㅀ",
  ㅂㅅ: "ㅄ",
};
const unpair = (table: Record<string, string>) =>
  Object.fromEntries(Object.entries(table).map(([k, v]) => [v, [...k]]));
const VOWEL_KEYS: Record<string, string[]> = unpair(VOWEL_PAIRS);
const FINAL_KEYS: Record<string, string[]> = unpair(FINAL_PAIRS);

const VOWEL_SET = new Set(VOWELS);
export const isVowelKey = (k: string) => VOWEL_SET.has(k);

/** The two-set layout, as on a phone: the shifted key in brackets where there is one. */
export const KEY_ROWS: { key: string; shift?: string }[][] = [
  [
    { key: "ㅂ", shift: "ㅃ" },
    { key: "ㅈ", shift: "ㅉ" },
    { key: "ㄷ", shift: "ㄸ" },
    { key: "ㄱ", shift: "ㄲ" },
    { key: "ㅅ", shift: "ㅆ" },
    { key: "ㅛ" },
    { key: "ㅕ" },
    { key: "ㅑ" },
    { key: "ㅐ", shift: "ㅒ" },
    { key: "ㅔ", shift: "ㅖ" },
  ],
  [
    { key: "ㅁ" },
    { key: "ㄴ" },
    { key: "ㅇ" },
    { key: "ㄹ" },
    { key: "ㅎ" },
    { key: "ㅗ" },
    { key: "ㅓ" },
    { key: "ㅏ" },
    { key: "ㅣ" },
  ],
  [
    { key: "ㅋ" },
    { key: "ㅌ" },
    { key: "ㅊ" },
    { key: "ㅍ" },
    { key: "ㅠ" },
    { key: "ㅜ" },
    { key: "ㅡ" },
  ],
];
/** Letters typed with Shift held. */
export const SHIFTED = new Set(
  KEY_ROWS.flat()
    .map((k) => k.shift)
    .filter((k): k is string => !!k),
);

/** The keys a word is typed with: 예요 → ㅇ ㅖ ㅇ ㅛ, 왜 → ㅇ ㅗ ㅐ, 값 → ㄱ ㅏ ㅂ ㅅ. */
export function keysOf(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) {
    const b = split(ch);
    if (!b) {
      if (ch.trim()) out.push(ch);
      continue;
    }
    out.push(b.initial, ...(VOWEL_KEYS[b.vowel] ?? [b.vowel]));
    if (b.final) out.push(...(FINAL_KEYS[b.final] ?? [b.final]));
  }
  return out;
}

/** Types keys the way a phone's Korean keyboard does: letters gather into blocks, a final
 * moves on to the next block when a vowel follows (ㅅㅏㄹㅏ → 살 → 사라). */
export function compose(keys: readonly string[]): string {
  let done = "";
  let initial = "";
  let vowel = "";
  let final = "";
  const flush = () => {
    if (initial && vowel) done += join({ initial, vowel, final });
    else done += initial + vowel + final;
    initial = vowel = final = "";
  };
  for (const k of keys) {
    if (isVowelKey(k)) {
      if (final) {
        // the final (or its second half) starts the next block
        const parts = FINAL_KEYS[final];
        const moved = parts ? parts[1]! : final;
        final = parts ? parts[0]! : "";
        flush();
        initial = moved;
        vowel = k;
      } else if (initial && !vowel) {
        vowel = k;
      } else if (vowel && VOWEL_PAIRS[vowel + k]) {
        vowel = VOWEL_PAIRS[vowel + k]!;
      } else {
        flush();
        vowel = k;
      }
      continue;
    }
    if (!INITIALS.includes(k)) {
      flush();
      done += k;
      continue;
    }
    if (initial && vowel && !final && FINALS.includes(k)) {
      final = k;
    } else if (final && FINAL_PAIRS[final + k]) {
      final = FINAL_PAIRS[final + k]!;
    } else {
      flush();
      initial = k;
    }
  }
  flush();
  return done;
}
