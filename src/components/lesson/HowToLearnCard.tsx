import { Link } from "@tanstack/react-router";
import { ChevronRight, Lightbulb, X } from "lucide-react";
import { useState } from "react";

import { tap } from "@/lib/feedback";
import { useGuidedMode } from "@/lib/guided-mode";
import { readLocal, writeLocal } from "@/lib/lesson-local";

/** Offered once in the lesson picker: three short screens on how to study a lesson. It goes away
 * for good when the learner opens the page, closes the card, or chose "Tự do". */
export function HowToLearnCard({ className }: { className?: string }) {
  const [guided] = useGuidedMode();
  const [hidden, setHidden] = useState<boolean>(() => readLocal<boolean>("howto-seen", false));
  if (!guided || hidden) return null;
  return (
    <div className={className}>
      <div className="card-soft flex items-stretch rounded-[18px] bg-card">
        <Link
          to="/how-to-learn"
          onClick={() => tap()}
          className="hit-area flex min-w-0 flex-1 items-center gap-2.5 py-3 pl-4 pr-2 active:scale-[0.98] motion-reduce:transition-none"
        >
          <Lightbulb size={16} strokeWidth={2.4} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 flex-1 text-xs leading-5">
            <span className="block font-semibold">Học thế nào cho nhớ lâu?</span>
            <span className="block font-medium text-ink-2">3 màn ngắn, đọc chưa tới 1 phút.</span>
          </span>
          <ChevronRight size={16} strokeWidth={2.6} aria-hidden="true" className="shrink-0" />
        </Link>
        <button
          type="button"
          aria-label="Ẩn gợi ý này"
          onClick={() => {
            writeLocal("howto-seen", true);
            setHidden(true);
          }}
          className="hit-area flex w-10 shrink-0 items-center justify-center rounded-r-[18px] active:scale-95"
        >
          <X size={15} strokeWidth={2.6} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
