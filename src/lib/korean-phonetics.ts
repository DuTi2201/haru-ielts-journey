/** What the alphabet lesson needs to know about how a Korean sound is made: where the tongue and
 * lips go (drawn by MouthDiagram), a short mouth cue to say instead of a Vietnamese letter, the
 * pitch an initial consonant gives the syllable, and the pitch line of a short word in Seoul
 * speech. Standard Korean phonetics (표준 발음법; Seoul accentual phrase, Jun 1993/2000), fixed
 * tables — no lookup, no model. */

// ------------------------------------------------------------------ blocks --
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";

export interface Block {
  ch: string;
  initial: string;
  vowel: string;
  final: string | null;
}

export function splitBlock(ch: string): Block | null {
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  const finals = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";
  const f = code % 28;
  return {
    ch,
    initial: CHO[Math.floor(code / 588)]!,
    vowel: JUNG[Math.floor((code % 588) / 28)]!,
    final: f ? finals[f]! : null,
  };
}

export const syllables = (word: string) => [...word].filter((c) => splitBlock(c) !== null);

// ------------------------------------------------------------ the mouth --
/** Lips seen from the front, and the tongue seen from the side. */
export interface MouthShape {
  /** lip opening: 0 closed … 1 wide */
  open: number;
  /** lip width: 0 rounded/pushed out … 1 spread (smile) */
  spread: number;
  /** tongue body: front 0 … back 1, low 0 … high 1 */
  tongueX: number;
  tongueY: number;
  /** where something touches or nearly touches, for a consonant */
  contact?: "lips" | "ridge" | "palate" | "velum" | "throat" | null | undefined;
  /** the air: a puff (aspirated), held tight (tense), through the nose, or light */
  air?: "light" | "puff" | "tense" | "nose" | "hiss" | undefined;
}

const V = (open: number, spread: number, tongueX: number, tongueY: number): MouthShape => ({
  open,
  spread,
  tongueX,
  tongueY,
});

/** The vowel a (compound) vowel ends on: the mouth to hold. */
const VOWEL: Record<string, MouthShape> = {
  ㅏ: V(0.95, 0.55, 0.55, 0.1),
  ㅓ: V(0.7, 0.4, 0.75, 0.35),
  ㅗ: V(0.35, 0.05, 0.85, 0.65),
  ㅜ: V(0.2, 0.0, 0.9, 0.9),
  ㅡ: V(0.18, 0.95, 0.75, 0.85),
  ㅣ: V(0.2, 1.0, 0.1, 0.95),
  ㅐ: V(0.55, 0.75, 0.2, 0.5),
  ㅔ: V(0.5, 0.75, 0.2, 0.55),
};
const ENDS_ON: Record<string, string> = {
  ㅑ: "ㅏ",
  ㅕ: "ㅓ",
  ㅛ: "ㅗ",
  ㅠ: "ㅜ",
  ㅒ: "ㅐ",
  ㅖ: "ㅔ",
  ㅘ: "ㅏ",
  ㅙ: "ㅐ",
  ㅚ: "ㅔ",
  ㅝ: "ㅓ",
  ㅞ: "ㅔ",
  ㅟ: "ㅣ",
  ㅢ: "ㅣ",
};
/** Where a compound vowel starts (a quick glide into the vowel it ends on). */
const STARTS_ON: Record<string, string> = {
  ㅑ: "ㅣ",
  ㅕ: "ㅣ",
  ㅛ: "ㅣ",
  ㅠ: "ㅣ",
  ㅒ: "ㅣ",
  ㅖ: "ㅣ",
  ㅘ: "ㅗ",
  ㅙ: "ㅗ",
  ㅚ: "ㅗ",
  ㅝ: "ㅜ",
  ㅞ: "ㅜ",
  ㅟ: "ㅜ",
  ㅢ: "ㅡ",
};

const C = (
  contact: MouthShape["contact"],
  air: MouthShape["air"],
  base = VOWEL["ㅏ"]!,
): MouthShape => ({
  ...base,
  open: contact === "lips" ? 0.02 : 0.45,
  contact,
  air,
});

const CONSONANT: Record<string, MouthShape> = {
  ㄱ: C("velum", "light"),
  ㅋ: C("velum", "puff"),
  ㄲ: C("velum", "tense"),
  ㄷ: C("ridge", "light"),
  ㅌ: C("ridge", "puff"),
  ㄸ: C("ridge", "tense"),
  ㅂ: C("lips", "light"),
  ㅍ: C("lips", "puff"),
  ㅃ: C("lips", "tense"),
  ㅈ: C("palate", "light"),
  ㅊ: C("palate", "puff"),
  ㅉ: C("palate", "tense"),
  ㅅ: C("ridge", "hiss"),
  ㅆ: C("ridge", "tense"),
  ㄴ: C("ridge", "nose"),
  ㅁ: C("lips", "nose"),
  ㅇ: C("velum", "nose"),
  ㄹ: C("ridge", "light"),
  ㅎ: C("throat", "puff"),
};

export function mouthOf(jamo: string): MouthShape | null {
  if (VOWEL[jamo]) return VOWEL[jamo]!;
  if (ENDS_ON[jamo]) return VOWEL[ENDS_ON[jamo]!]!;
  return CONSONANT[jamo] ?? null;
}
export const glideFrom = (jamo: string): string | null => STARTS_ON[jamo] ?? null;
export const isVowel = (jamo: string) => JUNG.includes(jamo);

/** A mouth cue to say instead of a Vietnamese letter (the Vietnamese «mốc» is kept behind a toggle). */
const CUE: Record<string, string> = {
  ㅏ: "Hạ cằm, mở miệng to, lưỡi nằm thấp",
  ㅓ: "Hạ cằm dọc, môi KHÔNG tròn, âm lùi vào trong",
  ㅗ: "Chu môi tròn nhỏ, căng, lưỡi lùi sau",
  ㅜ: "Chu môi tròn, đẩy môi ra trước hơn ㅗ",
  ㅡ: "Kéo ngang khóe miệng, răng khép hờ, môi không tròn",
  ㅣ: "Cười mỉm, lưỡi chạm răng dưới",
  ㅐ: "Mở miệng vừa, khóe môi hơi kéo ngang",
  ㅔ: "Như ㅐ — ngày nay người Seoul đọc gần như giống nhau",
  ㄱ: "Cuống lưỡi chạm vòm mềm, hơi rất nhẹ, giọng trầm",
  ㅋ: "Như ㄱ nhưng bật mạnh một luồng hơi, giọng cao",
  ㄲ: "Như ㄱ nhưng nén cổ họng, không bật hơi, giọng cao",
  ㄷ: "Đầu lưỡi chạm lợi trên, hơi nhẹ, giọng trầm",
  ㅌ: "Như ㄷ nhưng bật mạnh hơi, giọng cao",
  ㄸ: "Như ㄷ nhưng nén, không bật hơi, giọng cao",
  ㅂ: "Hai môi khép rồi mở nhẹ, hơi nhẹ, giọng trầm",
  ㅍ: "Hai môi bật mạnh một luồng hơi, giọng cao",
  ㅃ: "Hai môi mím chặt rồi mở, không bật hơi, giọng cao",
  ㅈ: "Mặt lưỡi áp sát vòm cứng, hơi nhẹ, giọng trầm",
  ㅊ: "Như ㅈ nhưng bật mạnh hơi, giọng cao",
  ㅉ: "Như ㅈ nhưng nén, không bật hơi, giọng cao",
  ㅅ: "Đầu lưỡi gần lợi trên, xì nhẹ (trước ㅣ thành «shi»)",
  ㅆ: "Như ㅅ nhưng căng và mạnh, giọng cao",
  ㄴ: "Đầu lưỡi chạm lợi trên, hơi ra mũi",
  ㅁ: "Hai môi khép, hơi ra mũi",
  ㅇ: "Đầu khối: câm. Cuối khối: «ng», cuống lưỡi chặn, hơi ra mũi",
  ㄹ: "Đầu lưỡi búng nhẹ một lần vào lợi trên; ở cuối: giữ lưỡi trên lợi",
  ㅎ: "Hơi thoát từ cổ họng, như thở ra nhẹ",
};
export function cueOf(jamo: string): string | null {
  if (CUE[jamo]) return CUE[jamo]!;
  const from = STARTS_ON[jamo];
  const to = ENDS_ON[jamo];
  if (from && to) return `Lướt nhanh ${from} → ${to}, dừng lại ở khẩu hình ${to}`;
  return null;
}

// ------------------------------------------------------------ pitch --
/** Initial consonants that raise the pitch of the syllable they start (aspirated, tense, ㅅ, ㅎ). */
const HIGH_ONSET = new Set([..."ㅋㅌㅍㅊㄲㄸㅃㅆㅉㅅㅎ"]);
export type Pitch = "low" | "high";

/** The pitch a consonant gives a syllable at the start of a word. */
export function onsetPitch(jamo: string): Pitch | null {
  if (!CONSONANT[jamo]) return null;
  return HIGH_ONSET.has(jamo) ? "high" : "low";
}

/** The pitch line of a short word said on its own (one Seoul accentual phrase, T H … L H): the
 * first syllable is High after an aspirated/tense consonant, ㅅ or ㅎ, otherwise Low; the second is
 * High; in a phrase of four or more the second-last falls Low; the last rises High. */
export function contourOf(word: string): Pitch[] {
  const syl = syllables(word);
  const n = syl.length;
  if (n === 0) return [];
  const first: Pitch = HIGH_ONSET.has(splitBlock(syl[0]!)!.initial) ? "high" : "low";
  if (n === 1) return [first];
  return syl.map((_, i) => {
    if (i === 0) return first;
    if (i === n - 1) return "high";
    if (i === 1) return "high";
    if (n >= 4 && i === n - 2) return "low";
    return i < n - 2 ? "high" : "low";
  });
}

// --------------------------------------------------------- the 3 speeds --
export type Speed = 1 | 2 | 3;
export const SPEEDS: { id: Speed; label: string; hint: string; rate: number }[] = [
  { id: 1, label: "Chậm", hint: "Từng khối, đặt đúng khẩu hình", rate: 0.7 },
  { id: 2, label: "Vừa", hint: "Nối liền, rõ từng âm", rate: 0.85 },
  { id: 3, label: "Tự nhiên", hint: "Như người Seoul nói", rate: 1 },
];
