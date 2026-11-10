import { Award, Target } from "lucide-react";
import { useState } from "react";

import type { PresentInsights } from "@/lib/api/presentation";
import { cn } from "@/lib/utils";

/** "Hồ sơ trình bày": the learner's presentation band and what a good answer means at it, the
 * focus, the trend of first tries, and the studied items they now use correctly when speaking. */
export function PresentInsightsCard({
  data,
  gentle = false,
  compact = false,
}: {
  data: PresentInsights;
  gentle?: boolean;
  compact?: boolean;
}) {
  const [showRubric, setShowRubric] = useState(false);
  const pts = data.points.filter((p) => p.overall != null).slice(-12);
  return (
    <div className="rounded-[22px] border border-line bg-card p-4 shadow-elev-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-ink-2">Mức trình bày của bạn</p>
          <p className="mt-0.5 text-[22px] font-bold leading-7">
            {data.present_band}/5 · {data.band_label_vi}
          </p>
          <p className="text-[12px] font-semibold text-ink-2">
            {data.rounds} lượt
            {!gentle &&
              data.best_overall != null &&
              ` · cao nhất ${data.best_overall.toFixed(1)}/5`}
            {!gentle && data.answer_avg != null && ` · hỏi vặn ${data.answer_avg.toFixed(1)}/5`}
          </p>
        </div>
        {!gentle && pts.length > 1 && (
          <svg
            viewBox={`0 0 ${(pts.length - 1) * 12 + 4} 44`}
            className="h-11 w-28 shrink-0"
            aria-hidden="true"
          >
            <polyline
              fill="none"
              stroke="var(--color-blue)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pts
                .map((p, i) => `${i * 12 + 2},${42 - ((p.overall - 1) / 4) * 40}`)
                .join(" ")}
            />
          </svg>
        )}
      </div>

      {data.focus_label_vi && (
        <p className="mt-3 flex items-center gap-1.5 rounded-[12px] bg-blue-soft px-3 py-2 text-[12px] font-bold text-blue-deep">
          <Target size={14} strokeWidth={2.4} /> Đang tập trung: {data.focus_label_vi} (yếu nhất ở
          các lượt gần đây)
        </p>
      )}

      {!compact && (
        <>
          <button
            type="button"
            onClick={() => setShowRubric((v) => !v)}
            className="mt-3 text-[12px] font-semibold text-blue-deep"
          >
            {showRubric ? "Ẩn" : "Xem"} Haru chấm bạn theo tiêu chuẩn nào
          </button>
          {showRubric && (
            <ul className="mt-2 space-y-1.5">
              {Object.entries(data.band_rubric_vi).map(([k, v]) => (
                <li key={k} className="text-[12px] font-semibold leading-4">
                  <span className="font-bold">{k}:</span> <span className="text-ink-2">{v}</span>
                </li>
              ))}
              <li className="text-[11px] font-semibold text-ink-2">
                Đạt đúng mô tả này = 4/5. Lên mức thì tiêu chuẩn cao hơn.
              </li>
            </ul>
          )}
        </>
      )}

      {(data.mastered.length > 0 || data.practicing.length > 0) && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold">
            <Award size={14} strokeWidth={2.4} className="text-green" /> Dùng thành thạo khi nói:{" "}
            {data.mastered.length}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {data.mastered.slice(0, compact ? 6 : 12).map((m) => (
              <span
                key={m.key}
                className="font-korean rounded-full bg-green-soft px-2 py-0.5 text-[11px] font-semibold text-green"
              >
                {m.ko}
              </span>
            ))}
            {data.practicing.slice(0, compact ? 4 : 8).map((m) => (
              <span
                key={m.key}
                className={cn(
                  "font-korean rounded-full bg-fill px-2 py-0.5 text-[11px] font-semibold",
                )}
                title={`${m.ok}/3`}
              >
                {m.ko} · {m.ok}/3
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
