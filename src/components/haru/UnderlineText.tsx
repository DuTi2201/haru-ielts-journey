import type { ReactNode } from "react";

import { splitUnderline } from "@/lib/exam-text";
import { cn } from "@/lib/utils";

/** An exam text with its underlining drawn. Built from React nodes — the stored
 * text is never put into the page as HTML. `showUnreadable` marks the "[?]" a
 * reader could not make out (for editors; learners never see them). */
export function UnderlineText({
  text,
  showUnreadable = false,
  className,
}: {
  text: string;
  showUnreadable?: boolean;
  className?: string;
}): ReactNode {
  const parts = splitUnderline(text);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.kind === "underline") {
          return (
            <u key={i} className="underline decoration-2 underline-offset-4">
              {part.text}
            </u>
          );
        }
        if (part.kind === "unreadable" && showUnreadable) {
          return (
            <mark key={i} className={cn("rounded bg-danger-soft px-0.5 font-semibold text-danger")}>
              {part.text}
            </mark>
          );
        }
        return part.text;
      })}
    </span>
  );
}
