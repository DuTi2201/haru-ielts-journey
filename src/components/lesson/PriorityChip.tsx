import { PRIORITY_LABEL, PRIORITY_TITLE } from "@/lib/vocab";
import type { VocabPriority } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** "Cần thuộc" (learn it now) or "Nhận ra" (understanding it is enough). Nothing for a word with
 * no label. Core is the louder of the two: it is the one the learner has to act on. */
export function PriorityChip({
  priority,
  className,
}: {
  priority: VocabPriority | null | undefined;
  className?: string | undefined;
}) {
  if (!priority) return null;
  return (
    <span
      title={PRIORITY_TITLE[priority]}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4",
        priority === "core" ? "bg-yellow-soft text-ink" : "bg-progress text-ink-2",
        className,
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
