import { useContext, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookMarked } from "lucide-react";

import type { LinkedCardOut } from "@/lib/api/types";
import { writeLocal } from "@/lib/lesson-local";
import { GrammarBadge } from "./GrammarBadge";
import { ImportanceChip } from "./ImportanceChip";
import { LinkedGrammarContext } from "./linked-grammar-context";
import { Ko, Rich } from "./Rich";

/** Under an answer: the grammar this sentence is built on (the cards the question is
 * linked to in the lesson's grammar_links.json), what it means, how it differs from its
 * nearest look-alike, and a way into the card. A wrong answer says the card has gone back
 * to the review queue — only when answers are being saved, so it never promises more. */
export function GrammarLinkBox({
  patterns,
  correct,
}: {
  patterns: string[] | undefined;
  correct: boolean;
}) {
  const ctx = useContext(LinkedGrammarContext);
  const cards = (patterns ?? []).flatMap((p) => (ctx.cards[p] ? [ctx.cards[p]] : []));
  if (cards.length === 0) return null;
  return (
    <aside
      aria-label="Kiến thức trong câu này"
      className="mt-2.5 rounded-[14px] border border-transparent bg-purple-soft p-2.5"
    >
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-2">
        <BookMarked size={13} strokeWidth={2.6} aria-hidden="true" /> Kiến thức trong câu này
      </p>
      <ul className="mt-1.5 space-y-2.5">
        {cards.map((c) => (
          <li key={c.pattern} className="text-xs leading-5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Ko className="text-[13.5px] font-semibold">{c.pattern}</Ko>
              <GrammarBadge tier={c.tier} useLevel={c.use_level} />
              <ImportanceChip importance={c.importance} />
            </div>
            <Rich as="p" text={c.meaning_vi} className="font-semibold text-ink" />
            {c.builds_on && c.builds_on.length > 0 && (
              <p className="mt-0.5 text-[11.5px] font-medium text-ink-2">
                Ghép từ: <Ko className="font-semibold text-ink">{c.builds_on.join(" + ")}</Ko>
              </p>
            )}
            {c.contrast && <Contrast contrast={c.contrast} />}
            <OpenCard card={c} />
          </li>
        ))}
      </ul>
      {!correct && ctx.signedIn && (
        <p className="mt-2 text-[12px] font-semibold leading-4 text-ink-2">
          Thẻ này đã được đưa vào hàng ôn tập — bạn sẽ gặp lại trong “Ôn tập hôm nay”.
        </p>
      )}
    </aside>
  );
}

function OpenCard({ card }: { card: LinkedCardOut }) {
  const ctx = useContext(LinkedGrammarContext);
  if (card.lesson_id == null) return null;
  const className =
    "hit-area mt-1 inline-flex min-h-8 items-center text-[11.5px] font-semibold text-blue-deep underline";
  if (card.lesson_id === ctx.lessonId) {
    if (!ctx.openGrammar) return null;
    return (
      <button type="button" onClick={ctx.openGrammar} className={className}>
        Mở thẻ ở tab Ngữ pháp của bài này
      </button>
    );
  }
  return (
    <Link
      to="/lesson/$id"
      params={{ id: String(card.lesson_id) }}
      onClick={() => writeLocal(`step:${card.lesson_id}`, "grammar")}
      className={className}
    >
      Mở thẻ ở bài “{card.lesson_title}”
    </Link>
  );
}

/** The nearest look-alike and how it differs: the first sentence, the rest on demand. */
function Contrast({ contrast }: { contrast: NonNullable<LinkedCardOut["contrast"]> }) {
  const [open, setOpen] = useState(false);
  const first = contrast.diff_vi.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ỹ`])/u)[0] ?? contrast.diff_vi;
  const more = first.length < contrast.diff_vi.length;
  return (
    <p className="mt-0.5 text-ink-2">
      <span className="font-semibold">Phân biệt: </span>
      <Ko className="font-semibold">{contrast.pattern}</Ko> —{" "}
      <Rich text={open || !more ? contrast.diff_vi : first} />
      {more && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="hit-area ml-1 text-[12px] font-semibold text-blue-deep underline"
        >
          {open ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
    </p>
  );
}
