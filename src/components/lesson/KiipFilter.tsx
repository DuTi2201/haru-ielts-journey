import { ListFilter } from "lucide-react";

import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

/** "Chỉ học phần KIIP": one switch for the whole lesson. Shown only when the lesson has KIIP items;
 * it narrows the word list, the grammar cards and the notes to those. */
export function KiipFilter({
  vocab,
  grammar,
  notes,
  active,
  onChange,
}: {
  vocab: number;
  grammar: number;
  notes: number;
  active: boolean;
  onChange: (on: boolean) => void;
}) {
  if (vocab + grammar + notes === 0) return null;
  const parts = [
    vocab > 0 ? `${vocab} từ` : "",
    grammar > 0 ? `${grammar} ngữ pháp` : "",
    notes > 0 ? `${notes} ghi chú` : "",
  ].filter(Boolean);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={() => {
        tap();
        onChange(!active);
      }}
      className="hit-area flex min-h-[52px] w-full items-center gap-3 rounded-[14px] border border-line bg-card px-3.5 py-2 text-left text-[15px] font-semibold shadow-elev-1 transition-transform active:scale-[0.98]"
    >
      <ListFilter
        size={17}
        strokeWidth={2.4}
        aria-hidden="true"
        className="shrink-0 text-blue-deep"
      />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Chỉ học phần KIIP</span>
        <span className="block text-[13px] font-medium text-ink-2">
          {active ? "Đang lọc · " : ""}
          {parts.join(" · ")} thuộc chương trình Hội nhập xã hội Hàn Quốc (KIIP)
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300 motion-reduce:transition-none",
          active ? "bg-primary" : "bg-progress",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2),0_0_1px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-spring motion-reduce:transition-none",
            active ? "translate-x-[22px]" : "translate-x-[2px]",
          )}
        />
      </span>
    </button>
  );
}
