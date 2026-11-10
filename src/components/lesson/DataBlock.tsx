import { lazy, Suspense } from "react";

import type { PracticeChart, PracticeDataBlock } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { chartHeight } from "./chart-size";
import { Rich } from "./Rich";
import { TableView } from "./TableView";

// The charting library is large and only a few questions draw a chart: it is fetched when the
// first one appears, not with every lesson screen.
const LazyChart = lazy(() => import("./ChartView").then((m) => ({ default: m.ChartView })));

/** A bar, line or pie chart (see ChartView), loaded on demand; a box of the same height holds its
 * place meanwhile so the page does not jump. */
export function ChartView({
  chart,
  small = false,
  className,
}: {
  chart: PracticeChart;
  small?: boolean;
  className?: string;
}) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-label="Đang vẽ biểu đồ"
          style={{ height: chartHeight(chart, small) }}
          className={cn("w-full animate-pulse rounded-[14px] bg-progress/60", className)}
        />
      }
    >
      <LazyChart chart={chart} small={small} {...(className ? { className } : {})} />
    </Suspense>
  );
}

/** A chart or a table with its caption and note. */
export function DataBlockView({
  block,
  className,
}: {
  block: PracticeDataBlock;
  className?: string;
}) {
  return (
    <figure className={cn("rounded-[16px] border border-line bg-card p-3", className)}>
      {block.title_vi && (
        <figcaption className="mb-2 text-xs font-semibold leading-5">
          <Rich text={block.title_vi} />
        </figcaption>
      )}
      {block.chart && <ChartView chart={block.chart} />}
      {block.table && <TableView table={block.table} />}
      {block.note_vi && (
        <p className="mt-2 text-[12px] font-semibold leading-4 text-ink-2">
          <Rich text={block.note_vi} />
        </p>
      )}
    </figure>
  );
}
