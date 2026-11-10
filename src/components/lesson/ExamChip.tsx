import { examLabel, examTitle } from "@/lib/exam";
import { cn } from "@/lib/utils";

/** "KIIP 3": this word, card or note is part of the KIIP course too. Nothing for an untagged
 * item. Calm on purpose — it labels, it does not compete with the content. */
export function ExamChip({
  tag,
  className,
}: {
  tag: string | null | undefined;
  className?: string | undefined;
}) {
  const label = examLabel(tag);
  if (!label) return null;
  return (
    <span
      title={examTitle(tag) ?? undefined}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-blue-soft px-2 py-0.5 text-[11px] font-semibold leading-4 text-blue-deep",
        className,
      )}
    >
      {label}
    </span>
  );
}
