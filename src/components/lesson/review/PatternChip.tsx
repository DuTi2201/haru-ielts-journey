import { Link } from "@tanstack/react-router";

import type { LinkedCardOut } from "@/lib/api/types";
import { writeLocal } from "@/lib/lesson-local";
import { cn } from "@/lib/utils";
import { Ko } from "../Rich";

/** A grammar pattern as a chip; when its card is known it opens the card in its own lesson. */
export function PatternChip({
  pattern,
  card,
  tone = "bg-card",
  className,
}: {
  pattern: string;
  card: LinkedCardOut | undefined;
  tone?: string;
  className?: string;
}) {
  const body = (
    <>
      <Ko className="text-[13px] font-semibold leading-5 [overflow-wrap:anywhere]">{pattern}</Ko>
      {card?.tier === "extension" && (
        <span aria-label="Kiến thức mở rộng" title="Kiến thức mở rộng" className="text-[12px]">
          🟣
        </span>
      )}
    </>
  );
  const chip = cn(
    "inline-flex max-w-full items-center gap-1 rounded-full border border-line px-2.5 py-0.5",
    tone,
    className,
  );
  if (!card || card.lesson_id == null) return <span className={chip}>{body}</span>;
  return (
    <Link
      to="/lesson/$id"
      params={{ id: String(card.lesson_id) }}
      onClick={() => writeLocal(`step:${card.lesson_id}`, "grammar")}
      title={`Mở thẻ trong bài “${card.lesson_title}”`}
      className={cn(chip, "active:scale-95 motion-reduce:transition-none")}
    >
      {body}
    </Link>
  );
}
