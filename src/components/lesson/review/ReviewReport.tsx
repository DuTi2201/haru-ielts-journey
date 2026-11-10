import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { BarChart3, Check, PenLine, RotateCcw } from "lucide-react";

import type { ExerciseResultOut, McqExerciseOut, ReviewOut } from "@/lib/api/types";
import { readLocal } from "@/lib/lesson-local";
import {
  detect,
  essayDraftKey,
  functionStats,
  mockQuestions,
  patternStats,
  speakTickKey,
  summarize,
  type MockRecord,
} from "@/lib/review";
import { cn } from "@/lib/utils";
import { PatternChip } from "./PatternChip";

function Bar({ right, total }: { right: number; total: number }) {
  const pct = total > 0 ? Math.round((right / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={right}
      aria-label={`${right}/${total}`}
      className="h-2 flex-1 overflow-hidden rounded-full bg-progress"
    >
      <div
        className={cn(
          "h-full rounded-full",
          pct >= 100 ? "bg-green" : pct >= 50 ? "bg-blue" : "bg-danger",
        )}
        style={{ width: `${Math.max(pct, right > 0 ? 6 : 0)}%` }}
      />
    </div>
  );
}

/** Step 4 of the topic review: what the mock exam says about each group of patterns and each
 * pattern, and where the capstone stands. Built on the device from the answers already given;
 * with no attempt yet it simply points to the mock. */
export function ReviewReport({
  lessonId,
  review,
  exercises,
  record,
  previous,
  onGoMock,
  onGoCapstone,
}: {
  lessonId: number;
  review: ReviewOut;
  exercises: McqExerciseOut[];
  record: MockRecord | null;
  previous: Record<string, ExerciseResultOut>;
  onGoMock: () => void;
  onGoCapstone: () => void;
}) {
  const total = mockQuestions(exercises).length;
  const stats = useMemo(
    () => (record ? patternStats(exercises, record.picked) : null),
    [exercises, record],
  );
  const fns = useMemo(
    () => (stats ? functionStats(review.functions, stats) : []),
    [stats, review.functions],
  );

  const cap = review.capstone;
  const draft = readLocal<string>(essayDraftKey(lessonId, cap.essay_id), "");
  const essayUsed = detect(draft, cap.required).filter(Boolean).length;
  const speakUsed = readLocal<number[]>(speakTickKey(lessonId), []).length;
  const essayDone = previous[cap.essay_id];
  const speakDone = previous[cap.speak_id];

  const summary = record ? summarize(exercises, record.picked, review.mock) : null;
  const untested = review.functions.filter((f) => !fns.some((x) => x.fn.id === f.id));

  return (
    <section aria-label="Báo cáo" className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BarChart3 size={20} strokeWidth={2.4} aria-hidden="true" className="text-blue" />
          Báo cáo theo mẫu ngữ pháp
        </h2>
        <p className="mt-0.5 text-xs font-medium leading-5 text-ink-2">
          Tính từ lần thi thử gần nhất: mỗi câu được tính cho mọi mẫu mà nó kiểm tra.
        </p>
      </div>

      {!record || !stats ? (
        <div className="rounded-[18px] border border-transparent bg-yellow-soft p-4">
          <p className="text-sm font-semibold">Chưa có kết quả thi thử.</p>
          <p className="mt-0.5 text-xs font-medium leading-5 text-ink-2">
            Làm bài thi thử trước, báo cáo sẽ chỉ ra nhóm và mẫu nào còn yếu.
          </p>
          <button
            type="button"
            onClick={onGoMock}
            className="hit-area mt-2.5 flex min-h-10 items-center justify-center rounded-full border border-transparent bg-blue px-4 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] "
          >
            Đến Thi thử
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-[18px] border border-transparent bg-blue-soft p-3.5">
            <p className="text-sm font-semibold">
              {summary?.points
                ? `≈ ${summary.figure}/200 điểm (nghe ${summary.points.listening} · đọc ${summary.points.reading})`
                : `${summary?.correct}/${total} câu đúng`}{" "}
              · {summary?.label}
            </p>
            <p className="mt-0.5 text-[12px] font-medium leading-4 text-ink-2">
              {summary?.points
                ? `${summary.correct}/${total} câu đúng. ${review.mock.score?.note_vi ?? ""}`
                : "Tỉ lệ ước chừng so với ngưỡng đậu của TOPIK II, không phải điểm thật."}
            </p>
          </div>

          <ul className="space-y-2.5" aria-label="Kết quả theo nhóm chức năng">
            {fns.map(({ fn, right, total: n, patterns }) => (
              <li key={fn.id}>
                <details
                  open={right < n}
                  className="group rounded-[16px] border border-line bg-paper shadow-elev-1"
                >
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-5">
                        {fn.title_vi}
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <Bar right={right} total={n} />
                        <span className="text-[12px] font-semibold tabular-nums">
                          {right}/{n}
                        </span>
                      </span>
                    </span>
                  </summary>
                  <ul className="space-y-1.5 border-t border-line px-3 pb-3 pt-2.5">
                    {patterns.map((p) => (
                      <li key={p.pattern} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <PatternChip
                          pattern={p.pattern}
                          card={review.cards[p.pattern]}
                          tone={p.right < p.total ? "bg-yellow-soft" : "bg-green-soft"}
                        />
                        <span className="text-[12px] font-semibold tabular-nums text-ink-2">
                          {p.right}/{p.total}
                          {p.right === p.total && (
                            <Check
                              size={12}
                              strokeWidth={3}
                              aria-label="vững"
                              className="ml-1 inline text-green"
                            />
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>

          {untested.length > 0 && (
            <p className="rounded-[14px] border border-dashed border-line px-3 py-2.5 text-[12px] font-medium leading-4 text-ink-2">
              Chưa có câu thi nào đo: {untested.map((f) => f.title_vi).join(" · ")}. Các mẫu này chỉ
              có trong Bản đồ — tự ôn bằng thẻ trong từng bài.
            </p>
          )}
        </>
      )}

      <div className="rounded-[18px] border border-line bg-card p-3.5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <PenLine size={15} strokeWidth={2.6} aria-hidden="true" /> Viết & Nói tổng hợp
        </h3>
        <ul className="mt-2 space-y-1.5 text-xs leading-5">
          <li>
            <b>Viết 54:</b> bản nháp hiện dùng {essayUsed}/{cap.required.length} mẫu (cần ≥{" "}
            {cap.min_required})
            {essayDone ? <> · đã tự chấm {essayDone.answer ?? "xong"}</> : " · chưa tự chấm"}
          </li>
          <li>
            <b>Nói S6:</b> đã tick {speakUsed}/{cap.required.length} mẫu (cần ≥ {cap.min_required})
            {speakDone ? <> · đã tự chấm {speakDone.answer ?? "xong"}</> : " · chưa tự chấm"}
          </li>
        </ul>
        <button
          type="button"
          onClick={onGoCapstone}
          className="hit-area mt-2 text-xs font-semibold text-blue-deep underline"
        >
          Mở phần Luyện thêm
        </button>
      </div>

      {record && (
        <button
          type="button"
          onClick={onGoMock}
          className="hit-area flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-line bg-card px-4 text-sm font-semibold shadow-elev-1 active:scale-[0.97] "
        >
          <RotateCcw size={15} strokeWidth={2.6} aria-hidden="true" /> Thi thử lại
        </button>
      )}
      <p className="text-center text-[12px] font-medium text-ink-2">
        Khi đã đăng nhập, mẫu nào sai sẽ quay lại trong{" "}
        <Link to="/today" className="font-semibold text-blue-deep underline">
          Hôm nay
        </Link>{" "}
        theo lịch ôn tập.
      </p>
    </section>
  );
}
