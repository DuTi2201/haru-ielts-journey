import type { ReactNode } from "react";
import { Lightbulb, X } from "lucide-react";

import { useNudge } from "@/lib/guided-mode";

/** One line of study advice at the top of a step. It never blocks anything: the learner can read
 * it, ignore it, or close it for good (and it is gone for everyone who chose "Tự do"). */
export function StepNudge({ id, children }: { id: string; children: ReactNode }) {
  const { visible, dismiss } = useNudge(id);
  if (!visible) return null;
  return (
    <div
      role="note"
      className="mt-3 flex items-start gap-2.5 rounded-[14px] border border-transparent bg-yellow-soft py-2.5 pl-3 pr-1.5"
    >
      <Lightbulb size={16} strokeWidth={2.4} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1 text-xs font-semibold leading-5 [overflow-wrap:anywhere]">
        {children}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ẩn gợi ý này"
        className="hit-area flex h-8 w-8 shrink-0 items-center justify-center rounded-full active:scale-95"
      >
        <X size={15} strokeWidth={2.6} aria-hidden="true" />
      </button>
    </div>
  );
}
