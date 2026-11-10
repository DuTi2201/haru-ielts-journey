import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";

import { Shimmer } from "@/components/haru/states";
import type { StudyPackOut, StudyStatus } from "@/lib/api/types";

/** "Hiểu nhanh" — the Vietnamese summary, key points and key terms shown
 * BEFORE the article, so a beginner knows what it is about and which few
 * concepts carry it before facing the Korean. Also explains, while the
 * (one-off) study pack is still being generated, that the translated/easy
 * versions are on their way instead of silently showing nothing. */
export function StudyOverview({
  study,
  status,
  levelEstimate,
}: {
  study: StudyPackOut | null;
  status: StudyStatus;
  levelEstimate?: number | null | undefined;
}) {
  const [open, setOpen] = useState(true);
  const hasOverview =
    !!study &&
    (study.summary_vi.length > 0 || study.key_points_vi.length > 0 || study.key_terms.length > 0);

  return (
    <section className="mt-4 rounded-[18px] border border-transparent bg-yellow-soft p-4 shadow-elev-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={16} strokeWidth={2.4} /> Hiểu nhanh — đọc trước khi vào bài
        </span>
        {open ? (
          <ChevronUp size={16} strokeWidth={2.6} />
        ) : (
          <ChevronDown size={16} strokeWidth={2.6} />
        )}
      </button>

      {open && (
        <div className="mt-2.5">
          {hasOverview && study ? (
            <>
              {study.summary_vi && (
                <p className="text-sm font-medium leading-6 text-ink">{study.summary_vi}</p>
              )}
              {study.key_points_vi.length > 0 && (
                <ul className="mt-2.5 space-y-1.5">
                  {study.key_points_vi.map((p) => (
                    <li key={p} className="flex gap-2 text-[13px] font-semibold leading-5">
                      <span
                        aria-hidden="true"
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink"
                      />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
              {study.key_terms.length > 0 && (
                <div className="mt-3 border-t border-line pt-2.5">
                  <p className="text-[12px] font-semibold text-ink-2">Từ khoá cần biết</p>
                  <dl className="mt-1.5 space-y-1.5">
                    {study.key_terms.map((t) => (
                      <div key={t.ko} className="flex items-baseline gap-2 text-xs leading-5">
                        <dt className="font-korean shrink-0 text-[13px] font-semibold">{t.ko}</dt>
                        <dd className="min-w-0 flex-1 font-semibold text-ink">{t.vi}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </>
          ) : status === "failed" ? (
            <p className="text-xs font-semibold leading-5 text-ink-2">
              Chưa tạo được phần tóm tắt và bản dịch cho bài này. Hệ thống sẽ tự thử lại sau ít phút
              — bạn vẫn có thể đọc bản gốc ở bên dưới.
            </p>
          ) : (
            <div>
              <p className="flex items-start gap-2 text-xs font-semibold leading-5 text-ink-2">
                <Loader2 size={14} strokeWidth={2.6} className="mt-0.5 shrink-0 animate-spin" />
                <span>
                  Đang soạn tóm tắt tiếng Việt, bản dịch từng câu và bản tiếng Hàn đơn giản cho bài
                  này. Chỉ lần đầu, thường 1–3 phút (bài dài có thể lâu hơn) — bạn có thể đọc bản
                  gốc trong lúc chờ.
                </span>
              </p>
              <div className="mt-3 space-y-2" aria-hidden="true">
                <Shimmer className="h-3 w-full rounded-full" />
                <Shimmer className="h-3 w-5/6 rounded-full" />
                <Shimmer className="h-3 w-2/3 rounded-full" />
              </div>
            </div>
          )}

          {levelEstimate && levelEstimate >= 4 && (
            <p className="mt-3 rounded-[10px] bg-card px-2.5 py-2 text-[12px] font-semibold leading-5">
              Bài này khoảng <b>cấp {levelEstimate}</b>. Nếu bạn mới học: đọc phần này → đọc{" "}
              <b>Bản dễ</b> → đọc <b>Song ngữ</b> (chạm từng câu để xem từ và ngữ pháp) → cuối cùng
              thử <b>Bản gốc</b> và nghe lại.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
