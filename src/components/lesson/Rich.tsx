import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Korean text inside a Vietnamese sentence: Noto Sans KR, flagged for readers. */
export function Ko({ children, className }: { children: ReactNode; className?: string }) {
  // Haru English: the target language is English. The name stays (it is used across the app),
  // but the text is tagged and set as English: a screen reader reads it with an English voice and
  // long words break as English does.
  return (
    <span lang="en" className={cn("[overflow-wrap:anywhere]", className)}>
      {children}
    </span>
  );
}

const HANGUL = "\\u1100-\\u11FF\\u3130-\\u318F\\uAC00-\\uD7AF";
// A run of Hangul with the small punctuation that sits inside grammar patterns
// ("-(으)면서", "-아/어 놓다", "N보다"); a lone hyphen or bracket stays Vietnamese.
const HANGUL_RUN = new RegExp(
  `([-~(]*[${HANGUL}][${HANGUL}\\-~/()·+]*(?:[ ][${HANGUL}][${HANGUL}\\-~/()·+]*)*)`,
);
const INLINE = /(~~[^~]+?~~|\*\*[^*]+?\*\*|`[^`]+?`|\*[^*\s][^*]*?\*)/;

/** Splits a plain string on Hangul runs so the Korean gets the Korean font. */
function withKorean(text: string, keyBase: string): ReactNode[] {
  return text
    .split(HANGUL_RUN)
    .map((part, i) =>
      i % 2 === 1 ? (
        <Ko key={`${keyBase}-k${i}`}>{part}</Ko>
      ) : (
        part && <span key={`${keyBase}-t${i}`}>{part}</span>
      ),
    );
}

/** The lessons' Vietnamese text keeps a little inline markdown — **bold**, *italic*,
 * `code` — and newlines. This renders exactly that, nothing else (no HTML, no links,
 * no headings), so seed text can never inject markup. Hangul runs get the Korean font. */
export function Rich({
  text,
  className,
  as: Tag = "span",
}: {
  text: string | null | undefined;
  className?: string | undefined;
  as?: "span" | "p" | "div";
}) {
  if (!text) return null;
  const parts = text.split(INLINE);
  return (
    <Tag className={cn("whitespace-pre-line", className)}>
      {parts.map((part, i) => {
        if (!part) return null;
        const key = `r${i}`;
        if (part.startsWith("~~") && part.endsWith("~~") && part.length > 4) {
          // the wrong form of a mistake: struck through, and said so for a screen reader
          return (
            <del key={key} className="text-ink-2 decoration-danger decoration-2">
              <span className="sr-only">Sai: </span>
              {withKorean(part.slice(2, -2), key)}
            </del>
          );
        }
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={key} className="font-semibold text-ink">
              {withKorean(part.slice(2, -2), key)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code
              key={key}
              className={cn(
                "rounded-[5px] bg-progress/55 px-[3px] py-px font-korean text-[0.94em] font-semibold text-ink [word-break:keep-all] [-webkit-box-decoration-break:clone] [box-decoration-break:clone]",
                // a short form such as -(으)면 is one unit: never split it across two lines
                part.length <= 18 && "whitespace-nowrap",
              )}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return <em key={key}>{withKorean(part.slice(1, -1), key)}</em>;
        }
        return <span key={key}>{withKorean(part, key)}</span>;
      })}
    </Tag>
  );
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

const isTableLine = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isRule = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
/** Length of a table cell without its markup: a short cell sits on one line with its label. */
const plainLength = (cell: string) => cell.replace(/[`*]/g, "").length;
const SHORT_CELL = 14;
const cells = (l: string) =>
  l
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());

function toBlocks(text: string): Block[] {
  const out: Block[] = [];
  const lines = text.split("\n").filter((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const last = out[out.length - 1];
    if (isTableLine(line)) {
      if (isRule(line)) continue;
      if (last?.kind === "table") last.rows.push(cells(line));
      else out.push({ kind: "table", head: cells(line), rows: [] });
    } else if (/^\s*[-•]\s+/.test(line)) {
      const item = line.replace(/^\s*[-•]\s+/, "");
      if (last?.kind === "ul") last.items.push(item);
      else out.push({ kind: "ul", items: [item] });
    } else if (last?.kind === "p") last.lines.push(line);
    else out.push({ kind: "p", lines: [line] });
  }
  return out;
}

/** A section body of a lesson card. Plain text stays one paragraph (exactly what `Rich`
 * showed before); on top of it a body may use `- ` bullet lines and a small `| a | b |`
 * table. On a phone every table row becomes a stacked card (its first cell is the title,
 * the other cells are labelled by the header), on a wide screen it is a real table. */
export function RichBlock({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text) return null;
  const blocks = toBlocks(text);
  if (blocks.every((b) => b.kind === "p")) {
    return <Rich as="p" text={text} className={className} />;
  }
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.kind === "p") {
          return <Rich key={i} as="p" text={b.lines.join("\n")} className={className} />;
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="space-y-1">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-[0.7em] h-1 w-1 shrink-0 rounded-full bg-blue"
                  />
                  <Rich text={item} className={cn("min-w-0 flex-1", className)} />
                </li>
              ))}
            </ul>
          );
        }
        if (b.head[0] === "Sai" && b.head[1] === "Đúng") {
          return <MistakeRows key={i} head={b.head} rows={b.rows} className={className} />;
        }
        if (b.head.length === 2) {
          // two columns: one compact list instead of a card per row
          return (
            <dl
              key={i}
              className="divide-y divide-line overflow-hidden rounded-[12px] border border-line bg-card"
            >
              {b.rows.map((row, r) => (
                <div key={r} className="grid grid-cols-[minmax(0,36%)_minmax(0,1fr)] gap-x-3 px-3 py-1.5">
                  <dt className="text-[13px] font-semibold leading-5 text-blue-deep">
                    <Rich text={row[0]} />
                  </dt>
                  <dd className="min-w-0">
                    <Rich text={row[1]} className={className} />
                  </dd>
                </div>
              ))}
            </dl>
          );
        }
        return (
          <div key={i}>
            <div className="space-y-2 lg:hidden">
              {b.rows.map((row, r) => (
                <div key={r} className="rounded-[14px] border border-line bg-card px-3 py-2.5">
                  <Rich
                    text={row[0]}
                    className="block text-[13px] font-semibold leading-5 text-blue-deep"
                  />
                  <dl className="mt-1.5 space-y-1.5">
                    {row.slice(1).map((cell, c) => (
                      <div
                        key={c}
                        className={cn(
                          plainLength(cell) <= SHORT_CELL && "flex items-baseline gap-2",
                        )}
                      >
                        <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                          <Rich text={b.head[c + 1]} />
                        </dt>
                        <dd className="min-w-0">
                          <Rich text={cell} className={className} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            <table className="hidden w-full border-separate border-spacing-y-1.5 text-left lg:table">
              <thead>
                <tr>
                  {b.head.map((h, c) => (
                    <th
                      key={c}
                      className="px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-2"
                    >
                      <Rich text={h} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r} className="align-top">
                    {row.map((cell, c) => (
                      <td
                        key={c}
                        className={cn(
                          "border-y border-line bg-card px-3 py-2 first:rounded-l-[12px] first:border-l last:rounded-r-[12px] last:border-r",
                          c === 0 && "font-semibold text-blue-deep",
                        )}
                      >
                        <Rich text={cell} className={className} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

const MISTAKES_SHOWN = 6;

/** A «Sai | Đúng | Vì sao» table: each mistake is its own pair, the wrong form marked ✗ and the
 * right one ✓ in words as well as colour; the first six show, the rest open on demand. */
function MistakeRows({
  head,
  rows,
  className,
}: {
  head: string[];
  rows: string[][];
  className?: string | undefined;
}) {
  const one = (row: string[], r: number) => (
    <li key={r} className="rounded-[12px] border border-line bg-card px-3 py-2">
      <p className="flex gap-2 text-[13.5px] leading-5">
        <span className="shrink-0 font-semibold text-danger" aria-hidden="true">
          ✗
        </span>
        <span className="min-w-0">
          <span className="sr-only">{head[0]}: </span>
          <del className="decoration-danger decoration-2 text-ink-2">
            <Rich text={row[0]} />
          </del>
        </span>
      </p>
      <p className="mt-0.5 flex gap-2 text-[13.5px] font-semibold leading-5">
        <span className="shrink-0 text-green" aria-hidden="true">
          ✓
        </span>
        <span className="min-w-0">
          <span className="sr-only">{head[1]}: </span>
          <Rich text={row[1]} />
        </span>
      </p>
      {row[2] && <Rich as="p" text={row[2]} className={cn("mt-1 pl-5 text-xs leading-5 text-ink-2", className)} />}
    </li>
  );
  const first = rows.slice(0, MISTAKES_SHOWN);
  const more = rows.slice(MISTAKES_SHOWN);
  return (
    <div>
      <ul className="space-y-2">{first.map(one)}</ul>
      {more.length > 0 && (
        <details className="group mt-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-blue-deep [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Xem thêm {more.length} lỗi</span>
            <span className="hidden group-open:inline">Ẩn bớt</span>
          </summary>
          <ul className="space-y-2">{more.map((row, r) => one(row, r + MISTAKES_SHOWN))}</ul>
        </details>
      )}
    </div>
  );
}
