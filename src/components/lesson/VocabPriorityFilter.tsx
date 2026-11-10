import { tap } from "@/lib/feedback";
import { priorityCounts, type PriorityView } from "@/lib/vocab";
import { cn } from "@/lib/utils";
import type { VocabItemOut } from "@/lib/api/types";

/** "Tất cả · Cần thuộc ngay · Chỉ nhận ra": which of the lesson's words to show. Shown only when
 * the lesson has both kinds; a lesson whose words are all of one kind has nothing to split. */
export function VocabPriorityFilter({
  vocab,
  view,
  onChange,
}: {
  vocab: Pick<VocabItemOut, "priority">[];
  view: PriorityView;
  onChange: (v: PriorityView) => void;
}) {
  const n = priorityCounts(vocab);
  if (n.core === 0 || n.recognize === 0) return null;
  const options: { id: PriorityView; label: string; count: number }[] = [
    { id: "all", label: "Tất cả", count: n.all },
    { id: "core", label: "Cần thuộc ngay", count: n.core },
    { id: "recognize", label: "Chỉ nhận ra", count: n.recognize },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Lọc từ theo mức độ cần nhớ"
      className="flex min-w-0 gap-1 overflow-x-auto"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={view === o.id}
          title={
            o.id === "core"
              ? "Các bài sau xây trên những từ này"
              : o.id === "recognize"
                ? "Hiểu khi gặp là đủ"
                : undefined
          }
          onClick={() => {
            tap();
            onChange(o.id);
          }}
          className={cn(
            "min-h-9 shrink-0 whitespace-nowrap rounded-full border border-line px-3 text-[12px] font-semibold",
            view === o.id ? "bg-blue text-primary-foreground" : "bg-card text-ink-2",
          )}
        >
          {o.id === "all" ? "Tất cả" : o.id === "core" ? "Cần thuộc" : "Nhận ra"}{" "}
          <span className="opacity-75">{o.count}</span>
        </button>
      ))}
    </div>
  );
}
