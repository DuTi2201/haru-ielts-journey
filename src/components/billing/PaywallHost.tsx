import { useEffect, useState } from "react";

import { UnlockPanel } from "@/components/billing/UnlockPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PAYMENT_REQUIRED_EVENT } from "@/lib/api/client";
import type { ProblemDetail } from "@/lib/api/types";

/**
 * The one answer to a 402 from an action anywhere in the app (lib/api/client.ts announces it):
 * a sheet with what the server said and the products that open it, the checkout one tap away.
 * Mounted once in the root layout.
 */
export function PaywallHost() {
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  useEffect(() => {
    const on = (e: Event) => setProblem((e as CustomEvent<ProblemDetail>).detail);
    window.addEventListener(PAYMENT_REQUIRED_EVENT, on);
    return () => window.removeEventListener(PAYMENT_REQUIRED_EVENT, on);
  }, []);
  const title =
    problem?.needs === "feature_pass"
      ? "Mở Haru Nói để luyện tiếp"
      : problem?.needs === "exam_pass"
        ? "Phần này thuộc Pass Luyện thi"
        : "Phần này cần mở khoá";
  return (
    <Dialog open={problem !== null} onOpenChange={(o) => !o && setProblem(null)}>
      <DialogContent className="max-h-[92dvh] max-w-[400px] overflow-y-auto rounded-[20px] border border-line bg-paper p-5 text-ink shadow-elev-2">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="text-base font-semibold leading-snug">{title}</DialogTitle>
          <DialogDescription className="text-[13px] font-semibold leading-5 text-ink-2">
            {problem?.detail || problem?.title}
          </DialogDescription>
        </DialogHeader>
        {problem && <UnlockPanel unlockWith={problem.unlock_with} needs={problem.needs} />}
      </DialogContent>
    </Dialog>
  );
}
