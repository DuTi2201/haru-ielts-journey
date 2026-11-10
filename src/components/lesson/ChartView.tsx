import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type { PracticeChart } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { chartHeight } from "./chart-size";

// Hanji Pop tokens (src/styles.css); a chart never invents a colour of its own.
const SERIES_COLORS = [
  "var(--blue)",
  "var(--yellow-strong)",
  "var(--green)",
  "var(--purple)",
  "var(--teal)",
];
const AXIS = {
  fill: "var(--ink-2)",
  fontSize: 11,
  fontFamily: "var(--font-korean), var(--font-sans)",
};

const fmt = (v: number, unit?: string | null) => `${v}${unit ?? ""}`;

/** A category label that wraps on spaces instead of running into its neighbour. */
function WrapTick(props: { x?: number; y?: number; payload?: { value: string } }) {
  const { x = 0, y = 0, payload } = props;
  const lines = (payload?.value ?? "").split(" ");
  return (
    <text x={x} y={y + 12} textAnchor="middle" {...AXIS}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 12}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** What a screen reader gets instead of the picture: the same numbers as a table. */
function ChartTextAlternative({ chart }: { chart: PracticeChart }) {
  return (
    <table className="sr-only">
      <caption>{chart.title_vi ?? "Biểu đồ"}</caption>
      <thead>
        <tr>
          <th scope="col">Mục</th>
          {chart.series.map((s) => (
            <th key={s.name} scope="col">
              {s.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {chart.categories.map((c, i) => (
          <tr key={c}>
            <th scope="row">{c}</th>
            {chart.series.map((s) => (
              <td key={s.name}>{fmt(s.values[i] ?? 0, chart.unit)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A bar, line or pie chart drawn from the lesson's own numbers. `small` is for the
 * four choices of a "pick the chart" question, where only the shape matters. */
export function ChartView({
  chart,
  small = false,
  className,
}: {
  chart: PracticeChart;
  small?: boolean;
  className?: string;
}) {
  const rows = chart.categories.map((name, i) => {
    const row: Record<string, string | number> = { name };
    for (const s of chart.series) row[s.name] = s.values[i] ?? 0;
    return row;
  });
  const height = chartHeight(chart, small);
  const multi = chart.series.length > 1;
  const label = chart.title_vi ?? `Biểu đồ ${chart.type}`;

  return (
    <figure className={cn("w-full", className)} aria-label={label}>
      <div aria-hidden="true" style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "bar" ? (
            <BarChart data={rows} margin={{ top: 16, right: 6, bottom: 4, left: -18 }}>
              <CartesianGrid vertical={false} stroke="var(--progress)" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={<WrapTick />}
                height={small ? 34 : 40}
              />
              <YAxis tickLine={false} axisLine={false} tick={AXIS} width={small ? 28 : 34} />
              {multi && !small && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {chart.series.map((s, i) => (
                <Bar
                  key={s.name}
                  dataKey={s.name}
                  fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                  stroke="var(--ink)"
                  strokeWidth={1}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey={s.name}
                    position="top"
                    formatter={(v: number) => fmt(v)}
                    style={AXIS}
                  />
                </Bar>
              ))}
            </BarChart>
          ) : chart.type === "line" ? (
            <LineChart data={rows} margin={{ top: 16, right: 12, bottom: 4, left: -18 }}>
              <CartesianGrid vertical={false} stroke="var(--progress)" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={<WrapTick />}
                height={small ? 34 : 40}
              />
              <YAxis tickLine={false} axisLine={false} tick={AXIS} width={small ? 28 : 34} />
              {multi && !small && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {chart.series.map((s, i) => (
                <Line
                  key={s.name}
                  dataKey={s.name}
                  type="monotone"
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--card)", strokeWidth: 2 }}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey={s.name}
                    position="top"
                    formatter={(v: number) => fmt(v)}
                    style={AXIS}
                  />
                </Line>
              ))}
            </LineChart>
          ) : (
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Pie
                data={rows.map((r) => ({
                  name: r["name"] as string,
                  value: r[chart.series[0]!.name] as number,
                }))}
                dataKey="value"
                nameKey="name"
                innerRadius={small ? 22 : 36}
                outerRadius={small ? 52 : 78}
                stroke="var(--ink)"
                strokeWidth={1}
                isAnimationActive={false}
                label={!small ? ({ value }: { value: number }) => fmt(value, chart.unit) : false}
                labelLine={false}
              >
                {chart.categories.map((c, i) => (
                  <Cell key={c} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                ))}
              </Pie>
              {!small && <Legend wrapperStyle={{ fontSize: 11 }} />}
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
      {chart.unit && !small && chart.type !== "pie" && (
        <figcaption className="mt-0.5 text-right text-[11px] font-semibold text-ink-2">
          Đơn vị: {chart.unit}
        </figcaption>
      )}
      <ChartTextAlternative chart={chart} />
    </figure>
  );
}
