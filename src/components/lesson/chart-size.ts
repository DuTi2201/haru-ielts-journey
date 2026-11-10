import type { PracticeChart } from "@/lib/api/types";

/** How tall a chart is drawn (px); `small` is for the four choices of a "pick the chart" question. */
export const chartHeight = (chart: Pick<PracticeChart, "type">, small: boolean) =>
  small ? 150 : chart.type === "pie" ? 230 : 210;
