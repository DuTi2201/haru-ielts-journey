import type { GrammarTier, GrammarUseLevel } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const LEVEL = {
  recognize: { icon: "👁", text: "Nhận ra", hint: "đọc/nghe hiểu" },
  produce: { icon: "✍", text: "Dùng được", hint: "viết/nói" },
} as const;

/** Marks a 🟣 "kiến thức mở rộng" card — grammar the exam sets use beyond the lesson's own
 * sources — and how far the learner has to take it: 👁 recognise it when reading or
 * listening, or ✍ be able to use it when writing or speaking. Core cards get no badge. */
export function GrammarBadge({
  tier,
  useLevel,
  className,
}: {
  tier: GrammarTier | undefined;
  useLevel?: GrammarUseLevel | null | undefined;
  className?: string | undefined;
}) {
  if (tier !== "extension") return null;
  const level = useLevel ? LEVEL[useLevel] : null;
  return (
    <span
      title={
        level
          ? `Kiến thức mở rộng · mức ${level.text.toLowerCase()} (${level.hint})`
          : "Kiến thức mở rộng"
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-purple-soft px-2 py-0.5 text-[12px] font-semibold leading-4 text-ink",
        className,
      )}
    >
      <span aria-hidden="true">🟣</span>
      Mở rộng
      {level && (
        <>
          <span aria-hidden="true">·</span>
          <span aria-hidden="true">{level.icon}</span>
          {level.text}
        </>
      )}
    </span>
  );
}
