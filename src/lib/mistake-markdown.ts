import type { MistakeBookOut, MistakeOut } from "@/lib/api/types";

const SPEAKER: Record<string, string> = { F: "Nữ", M: "Nam", N: "Dẫn" };
const CIRCLED = ["①", "②", "③", "④", "⑤"];

/** "1" -> "①" (what the lessons print on the options), anything else as it is. */
export const optionMark = (id: string): string => CIRCLED[Number(id) - 1] ?? id;

const oneLine = (s: string): string => s.replace(/\s+/g, " ").trim();

function section(m: MistakeOut, n: number): string[] {
  const out: string[] = [`### ${n}. ${m.title}`, ""];
  if (m.prompt) out.push(`- **Đề:** ${oneLine(m.prompt)}`);
  if (m.context.length > 0) {
    out.push(m.type.startsWith("listen_") ? "- **Lời thoại:**" : "- **Bài:**");
    for (const c of m.context) {
      const who = c.speaker ? `${SPEAKER[c.speaker] ?? c.speaker}: ` : "";
      out.push(`  - ${who}${oneLine(c.text)}${c.vi ? ` — ${oneLine(c.vi)}` : ""}`);
    }
  }
  if (m.options.length > 0) {
    out.push(
      `- **Các lựa chọn:** ${m.options.map((o) => `${optionMark(o.id)} ${oneLine(o.text)}`).join("  ")}`,
    );
  }
  const picked = m.chosen_id ? `${optionMark(m.chosen_id)} ` : "";
  if (m.chosen) out.push(`- **Bạn đã chọn/viết:** ${picked}${oneLine(m.chosen)}`);
  const right = m.correct_id ? `${optionMark(m.correct_id)} ` : "";
  if (m.correct.length > 0) {
    out.push(`- **Đáp án:** ${right}${m.correct.map(oneLine).join(" / ")}`);
  }
  if (m.translation.length > 0) out.push(`- **Nghĩa:** ${m.translation.map(oneLine).join(" ")}`);
  if (m.explanation_vi) out.push(`- **Giải thích:** ${oneLine(m.explanation_vi)}`);
  for (const note of m.notes_vi) out.push(`- **Ghi chú:** ${oneLine(note)}`);
  if (m.focus.length > 0) {
    out.push(`- **Từ cần nhớ:** ${m.focus.map((f) => `${f.ko} (${f.vi})`).join(" · ")}`);
  }
  if (m.grammar.length > 0) {
    out.push(
      `- **Ngữ pháp:** ${m.grammar
        .map((g) => `\`${g.pattern}\`${g.meaning_vi ? ` — ${oneLine(g.meaning_vi)}` : ""}`)
        .join("; ")}`,
    );
  }
  out.push("- **Chép lại câu đúng (tự làm):** ", "");
  return out;
}

/** The mistakes still to read, as a study note: one section per lesson, one block per question. */
export function mistakesToMarkdown(book: MistakeBookOut, today: string): string {
  const lessons = book.lessons
    .map((l) => ({ ...l, mistakes: l.mistakes.filter((m) => !m.understood) }))
    .filter((l) => l.mistakes.length > 0);
  const total = lessons.reduce((n, l) => n + l.mistakes.length, 0);
  const out: string[] = [
    "# Sổ lỗi sai — Haru",
    "",
    `Xuất ngày ${today} · ${total} câu cần đọc lại`,
    "",
    "Cách dùng: đọc đáp án và giải thích, chép lại câu đúng vào dòng cuối của mỗi câu, rồi làm lại bài luyện tập.",
    "",
  ];
  for (const l of lessons) {
    out.push(`## ${l.title}`, "");
    l.mistakes.forEach((m, i) => out.push(...section(m, i + 1)));
  }
  return (
    out
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

/** Local date as YYYY-MM-DD (the file name and the note's date). */
export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Hands a text file to the browser as a download. */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
