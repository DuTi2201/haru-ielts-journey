import { TrendingDown, TrendingUp } from "lucide-react";

import type { TalkInsights } from "@/lib/api/conversation";
import { cn } from "@/lib/utils";

/** Pronunciation average per session as a small line (sessions without a check are skipped). */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 280;
  const h = 56;
  const pad = 6;
  const min = Math.min(...values, 40);
  const max = Math.max(...values, 100);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (values.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-2 h-14 w-full"
      role="img"
      aria-label="Điểm phát âm qua các buổi"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--blue)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(v)}
          r="3"
          fill="var(--card)"
          stroke="var(--blue)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

/** The trend over the talks: how clear, what keeps going wrong, which words keep coming up. */
export function TalkInsightsCard({
  data,
  compact = false,
}: {
  data: TalkInsights;
  compact?: boolean;
}) {
  const scores = data.points.map((p) => p.pron_avg).filter((v): v is number => v != null);
  const delta =
    data.pron_first != null && data.pron_last != null ? data.pron_last - data.pron_first : null;
  const lastBand = [...data.points].reverse().find((p) => p.band != null)?.band ?? null;
  return (
    <section className="rounded-[18px] border border-line bg-card p-4 shadow-elev-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold">
            {data.sessions} buổi · {data.minutes} phút nói
          </p>
          {lastBand != null && (
            <p className="text-[12px] font-medium text-ink-2">
              Mức trò chuyện hiện tại {lastBand}/5
            </p>
          )}
        </div>
        {data.pron_last != null && (
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums text-blue-deep">
              {Math.round(data.pron_last)}
            </p>
            <p className="text-[11px] font-semibold text-ink-2">phát âm buổi gần nhất</p>
          </div>
        )}
      </div>

      {scores.length >= 2 && (
        <>
          <Sparkline values={scores} />
          {delta != null && (
            <p
              className={cn(
                "flex items-center gap-1 text-[12px] font-semibold",
                delta >= 0 ? "text-green" : "text-danger",
              )}
            >
              {delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {delta >= 0 ? "Tăng" : "Giảm"} {Math.abs(Math.round(delta))} điểm so với buổi đầu được
              chấm
            </p>
          )}
        </>
      )}
      {scores.length < 2 && (
        <p className="mt-2 text-[12px] font-medium leading-5 text-ink-2">
          Cần ít nhất 2 buổi có chấm phát âm để thấy điểm lên xuống thế nào.
        </p>
      )}

      {data.issue_kinds.length > 0 && (
        <div className="mt-3">
          <p className="text-[12px] font-semibold text-ink-2">
            Lỗi phát âm hay lặp lại ({data.checked_sessions} buổi gần nhất có chấm)
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {data.issue_kinds.slice(0, compact ? 3 : 5).map((k) => (
              <li key={k.kind} className="rounded-[12px] bg-danger-soft px-3 py-2">
                <p className="text-[13px] font-semibold">
                  {k.label_vi} <span className="font-medium text-ink-2">· {k.sessions} buổi</span>
                </p>
                {k.words.length > 0 && (
                  <p lang="ko" className="text-[12px] leading-5 text-ink-2">
                    {k.words.join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && data.repeat_words.length > 0 && (
        <div className="mt-3">
          <p className="text-[12px] font-semibold text-ink-2">Từ Haru gợi ý nhiều lần</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {data.repeat_words.map((w) => (
              <span
                key={w.ko}
                className="rounded-full bg-blue-soft px-2.5 py-1 text-[12px] font-semibold"
              >
                <span lang="ko">{w.ko}</span> <span className="font-medium text-ink-2">{w.vi}</span>{" "}
                ×{w.times}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
