import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { TabBar } from "@/components/haru/TabBar";
import type { LessonTrack } from "@/lib/api/types";
import { tap } from "@/lib/feedback";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] overflow-hidden bg-paper px-5 pb-[calc(var(--tabbar-h)+2.5rem)] pt-[max(24px,env(safe-area-inset-top))] text-ink lg:max-w-[960px] lg:px-8">
      <div className="relative z-10">{children}</div>
      <TabBar wide />
    </main>
  );
}

/** The way back to the lesson's topic (the Học tab is the picker, but a learner deep in a
 * lesson should not have to reach for the tab bar, and the topic is where its sibling
 * lessons are). A lesson without a topic goes back to the whole picker. */
export function BackToLessons({
  topic,
  track,
  className = "text-blue-deep",
}: {
  topic: string | null;
  track: LessonTrack | null;
  className?: string;
}) {
  return (
    <Link
      to="/lesson"
      search={topic ? { topic, ...(track ? { track } : {}) } : {}}
      onClick={() => tap()}
      className={`hit-area -ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-semibold active:scale-95 ${className}`}
    >
      <ArrowLeft size={15} strokeWidth={2.6} className="shrink-0" />
      {topic ? `Chủ đề: ${topic}` : "Tất cả bài học"}
    </Link>
  );
}

const FOOTER_BUTTON =
  "flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line px-5 text-sm font-semibold shadow-elev-2 active:scale-[0.97] ";

/** The way on at the foot of a step's content ("Tiếp: Từ vựng"). It sits in the flow, not
 * over it: the step tabs stay pinned at the top of the screen, so nothing is out of reach,
 * and the last lines of a long list are never hidden under a floating button. */
export function StepFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 lg:ml-auto lg:max-w-[320px]">{children}</div>;
}

export function NextStepButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${FOOTER_BUTTON} bg-blue text-primary-foreground`}
    >
      {label} <ArrowRight size={16} strokeWidth={2.8} />
    </button>
  );
}

/** The footer's quiet variant, for the last step: a link out. */
export const endStepClass = `${FOOTER_BUTTON} bg-card`;
