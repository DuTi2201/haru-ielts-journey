/** Chapters of a lesson's lecture ("Từ vựng", "Ôn từ", "Ngữ pháp", …) and where each starts.
 *
 * The recording has no time marks, but its script does say where each part begins (the fixed
 * lines of app/services/lesson_audio.build_template_script). Each line's length is estimated —
 * Korean read slowly with a gap to repeat after "...", Vietnamese at a normal pace, the gaps of
 * app/services/lecture_voice.py — and the estimates are scaled to the real duration. A jump lands
 * within a few seconds of the heading; "−10 giây" covers the rest. */

export interface Chapter {
  label: string;
  /** seconds from the start */
  at: number;
}

const MARKS: [RegExp, string][] = [
  [/^Phần một\b/i, "Từ vựng"],
  [/^Bây giờ mình ôn lại/i, "Ôn từ"],
  [/^Phần hai\b/i, "Ngữ pháp"],
  [/^Phần ba\b/i, "Lưu ý"],
  [/^Cuối bài, mình nghe lại/i, "Nghe lại ví dụ"],
];

const HANGUL = /[가-힣]/g;

function lineSeconds(line: string): number {
  const ko = (line.match(HANGUL) ?? []).length;
  const shadow = /(\.\.\.|…)\s*$/.test(line);
  if (ko > 0 && ko >= line.replace(/\s/g, "").length / 3) {
    // a Korean line: ~0.3 s a syllable at the slow lecture rate, then the gap to repeat it
    const say = ko * 0.3;
    return say + (shadow ? Math.max(0.7, say) : 0.12) + 0.5;
  }
  const words = line.split(/\s+/).filter(Boolean).length;
  return words * 0.3 + 0.35 + 0.5;
}

export function lectureChapters(script: string | null, duration: number): Chapter[] {
  if (!script || !(duration > 0)) return [];
  const lines = script
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let t = 0;
  const raw: Chapter[] = [{ label: "Mở đầu", at: 0 }];
  for (const line of lines) {
    const mark = MARKS.find(([re]) => re.test(line));
    if (mark && !raw.some((c) => c.label === mark[1])) raw.push({ label: mark[1], at: t });
    t += lineSeconds(line);
  }
  if (raw.length < 2 || t <= 0) return [];
  const k = duration / t;
  return raw.map((c) => ({ label: c.label, at: Math.round(c.at * k) }));
}

export const clock = (s: number) => {
  const sec = Math.max(0, Math.floor(s));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};
