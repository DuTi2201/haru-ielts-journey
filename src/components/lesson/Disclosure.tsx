import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import type { PracticeGuideBlock } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { TableView } from "./TableView";
import { Rich } from "./Rich";

/** A section the learner opens when they want it (native <details>: keyboard and
 * screen-reader behaviour for free). */
export function Disclosure({
  title,
  children,
  defaultOpen = false,
  tone = "bg-card",
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: string;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn("group rounded-[14px] border border-line", tone, className)}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{title}</span>
        <ChevronDown
          size={16}
          strokeWidth={2.6}
          className="shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="border-t border-line px-3 pb-3 pt-2.5">{children}</div>
    </details>
  );
}

/** A bullet list of Vietnamese lines (with the lessons' small inline markdown). */
export function BulletList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("space-y-1.5", className)}>
      {items.map((b, i) => (
        <li key={i} className="flex gap-2 text-xs leading-5 text-ink-2">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue" />
          <Rich text={b} className="min-w-0 [overflow-wrap:anywhere]" />
        </li>
      ))}
    </ul>
  );
}

/** Titled advice blocks: a paragraph, bullets and/or a table each. */
export function GuideBlocks({
  blocks,
  open = false,
}: {
  blocks: PracticeGuideBlock[];
  open?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {blocks.map((b) => (
        <Disclosure key={b.title_vi} title={<Rich text={b.title_vi} />} defaultOpen={open}>
          <div className="space-y-2.5">
            {b.body_vi && <Rich as="p" text={b.body_vi} className="text-xs leading-5 text-ink-2" />}
            {b.bullets_vi && b.bullets_vi.length > 0 && <BulletList items={b.bullets_vi} />}
            {b.table && <TableView table={b.table} />}
          </div>
        </Disclosure>
      ))}
    </div>
  );
}
