import { Link } from "@tanstack/react-router";
import { Lock, Timer } from "lucide-react";

import { UnlockPanel } from "@/components/billing/UnlockPanel";
import { ApiError, errorMessage } from "@/lib/api/client";
import { gateKind } from "@/lib/billing";
import { cn } from "@/lib/utils";

/**
 * The answer to an error that means "not for you right now" rather than "something broke":
 * a purchase (402), a source kept private to the team (closed_source) or today's AI limit (429).
 * Renders nothing for any other error — `ErrorState` handles those.
 */
export function GateNotice({
  error,
  className,
}: {
  error: unknown;
  className?: string | undefined;
}) {
  const kind = gateKind(error);
  if (!kind) return null;
  const problem = error instanceof ApiError ? error.problem : null;
  if (kind === "payment") {
    return (
      <div className={cn("space-y-3", className)} role="alert">
        <p className="text-sm font-semibold leading-6">{errorMessage(error)}</p>
        <UnlockPanel unlockWith={problem?.unlock_with} needs={problem?.needs} />
      </div>
    );
  }
  const Icon = kind === "closed" ? Lock : Timer;
  return (
    <section
      role="alert"
      className={cn(
        "rounded-[20px] border border-line bg-card p-5 text-center shadow-elev-1",
        className,
      )}
    >
      <Icon size={22} strokeWidth={2.4} className="mx-auto text-blue" aria-hidden="true" />
      <p className="mt-2 text-sm font-semibold">{errorMessage(error)}</p>
      <Link
        to="/lesson"
        className="hit-area mt-3 inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 text-xs font-semibold shadow-elev-1"
      >
        Về danh sách bài học
      </Link>
    </section>
  );
}
