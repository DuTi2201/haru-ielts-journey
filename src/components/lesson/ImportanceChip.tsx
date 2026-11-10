import type { GrammarImportance } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const TEXT: Record<GrammarImportance, { label: string; title: string }> = {
  must: {
    label: "Bắt buộc",
    title:
      "Phải nhớ chắc: các mẫu sau xây trên mẫu này, hoặc chương trình KIIP và TOPIK 1–3 dùng nó hằng ngày.",
  },
  normal: {
    label: "Bổ trợ",
    title: "Nên biết nhưng chưa vội: hiểu khi gặp là được, có thể quay lại sau.",
  },
};

/** "Bắt buộc" or "Bổ trợ" on a core grammar card. Nothing for a card with no label (an extension
 * card has its own 🟣 badge). */
export function ImportanceChip({
  importance,
  className,
}: {
  importance: GrammarImportance | null | undefined;
  className?: string | undefined;
}) {
  if (!importance) return null;
  const t = TEXT[importance];
  return (
    <span
      title={t.title}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[12px] font-semibold leading-4",
        importance === "must" ? "bg-yellow-soft text-ink" : "bg-card text-ink-2",
        className,
      )}
    >
      {t.label}
    </span>
  );
}
