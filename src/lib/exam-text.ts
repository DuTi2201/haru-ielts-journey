/** A piece of an exam text: plain, underlined (the paper prints "밑줄" under it)
 * or unreadable (the extraction could not read the character and wrote "[?]"). */
export type TextSegment =
  | { kind: "plain"; text: string }
  | { kind: "underline"; text: string }
  | { kind: "unreadable"; text: string };

const MARKUP = /<u>([\s\S]*?)<\/u>|\[\?\]/g;

/** Splits an exam text on its `<u>…</u>` and `[?]` marks. An opening `<u>` with no
 * closing tag stays plain text — a half-typed mark must never swallow the rest. */
export function splitUnderline(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(MARKUP)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ kind: "plain", text: text.slice(last, at) });
    if (match[1] !== undefined) out.push({ kind: "underline", text: match[1] });
    else out.push({ kind: "unreadable", text: match[0] });
    last = at + match[0].length;
  }
  if (last < text.length) out.push({ kind: "plain", text: text.slice(last) });
  return out;
}

/** The text without its marks, e.g. for a one-line summary or an aria-label. */
export function stripUnderline(text: string): string {
  return splitUnderline(text)
    .map((s) => s.text)
    .join("");
}
