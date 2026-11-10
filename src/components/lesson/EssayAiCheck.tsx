import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useJobEvents } from "@/hooks/use-job-events";
import { ApiError, errorMessage } from "@/lib/api/client";
import { getLatestEssayCheck, startEssayCheck } from "@/lib/api/practice";
import type { EssayCheckOut, EssayResultOut } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Rich } from "./Rich";

const CATEGORY: Record<string, string> = {
  grammar: "Ngữ pháp",
  spelling: "Chính tả",
  spacing: "Cách chữ",
  register: "Mức lịch sự",
  word_choice: "Chọn từ",
  content: "Nội dung",
};

/** «Nhờ Haru chấm»: sends the paragraph to the AI check and shows the score on the item's own
 * rubric, what to fix (the learner's words → the fix, and why) and the text with only the mistakes
 * fixed. The last check of this paragraph comes back when the learner returns to the lesson. */
export function EssayAiCheck({
  lessonId,
  exerciseId,
  text,
  onScored,
}: {
  lessonId: number;
  exerciseId: string;
  text: string;
  /** Called once with the AI score of a finished check, so the lesson can record the task. */
  onScored?: (score: number, points: number) => void;
}) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const key = ["me", "essay-check", lessonId, exerciseId] as const;
  const latest = useQuery({
    queryKey: key,
    queryFn: () => getLatestEssayCheck(lessonId, exerciseId),
    enabled: auth.isAuthenticated,
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 4000 : false),
  });
  const check: EssayCheckOut | null | undefined = latest.data;
  const job = useJobEvents(check?.status === "pending" ? check.job_id : null);
  const refetch = latest.refetch;
  useEffect(() => {
    if (job.status === "succeeded" || job.status === "failed" || job.status === "cancelled") {
      void refetch();
    }
  }, [job.status, refetch]);

  const send = useMutation({
    mutationFn: () => startEssayCheck(lessonId, exerciseId, text),
    onSuccess: (out) => {
      queryClient.setQueryData(key, out);
      void queryClient.invalidateQueries({ queryKey: ["me", "weaknesses"] });
    },
  });

  const result = check?.status === "ready" ? check.result : null;
  const scoredFor = result && result.score !== null ? check?.id : null;
  useEffect(() => {
    if (scoredFor && result && result.score !== null) onScored?.(result.score, result.points);
    // once per finished check
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoredFor]);

  if (!auth.isAuthenticated) {
    return (
      <p className="mt-3 rounded-[12px] bg-blue-soft px-3 py-2 text-xs font-semibold leading-5">
        Đăng nhập để nhờ Haru chấm và sửa bài viết của bạn.
      </p>
    );
  }

  const pending = send.isPending || check?.status === "pending";
  const sameText = !!check && check.text === text.trim();
  const tooShort = text.trim().length < 15;
  const sendError = send.isError ? errorMessage(send.error) : null;

  return (
    <section aria-label="Haru chấm bài" className="mt-3 space-y-2.5">
      <button
        type="button"
        disabled={pending || tooShort || (sameText && check?.status === "ready")}
        onClick={() => send.mutate()}
        className="hit-area flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-blue px-4 text-sm font-semibold text-white shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
      >
        {pending ? (
          <Loader2
            size={16}
            strokeWidth={2.4}
            className="animate-spin motion-reduce:animate-none"
          />
        ) : (
          <Sparkles size={16} strokeWidth={2.4} />
        )}
        {pending
          ? "Haru đang chấm bài của bạn…"
          : sameText && check?.status === "ready"
            ? "Đã chấm bài này · sửa bài rồi gửi lại"
            : check
              ? "Nhờ Haru chấm lại"
              : "Nhờ Haru chấm và sửa bài"}
      </button>
      {tooShort && !check && (
        <p className="text-[12px] font-semibold text-ink-2">Viết vài câu rồi mới gửi chấm nhé.</p>
      )}
      {sendError && (
        <p role="alert" className="rounded-[12px] bg-danger-soft px-3 py-2 text-xs font-semibold">
          {sendError}
        </p>
      )}
      {check?.status === "failed" && !pending && (
        <p role="alert" className="rounded-[12px] bg-yellow-soft px-3 py-2 text-xs font-semibold">
          Lần trước chưa chấm được. Bài của bạn vẫn còn, bấm «Nhờ Haru chấm lại».
        </p>
      )}
      {result && <EssayResult result={result} stale={!sameText} />}
    </section>
  );
}

function EssayResult({ result, stale }: { result: EssayResultOut; stale: boolean }) {
  return (
    <div className="space-y-2.5 animate-in duration-200 fade-in motion-reduce:animate-none">
      {stale && (
        <p className="rounded-[12px] bg-progress px-3 py-2 text-[12px] font-semibold leading-5">
          Đây là nhận xét cho bản bạn gửi lần trước; bài đã sửa chưa được chấm.
        </p>
      )}
      <div className="rounded-[16px] border border-line bg-card p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-deep">
            Haru chấm
          </h4>
          {result.score !== null && (
            <p className="text-lg font-bold tabular-nums">
              {result.score}
              <span className="text-sm font-semibold text-ink-2">/{result.points}</span>
            </p>
          )}
        </div>
        {result.summary_vi && (
          <Rich as="p" text={result.summary_vi} className="mt-1 text-sm leading-6" />
        )}
        {result.criteria.length > 0 && (
          <ul className="mt-2.5 space-y-1.5">
            {result.criteria.map((c) => (
              <li
                key={c.criterion_vi}
                className="rounded-[10px] bg-blue-soft px-2.5 py-1.5 text-xs leading-5"
              >
                <div className="flex justify-between gap-2">
                  <Rich text={c.criterion_vi} className="font-semibold" />
                  <span className="shrink-0 font-semibold tabular-nums">
                    {c.score ?? "–"}/{c.max}
                  </span>
                </div>
                {c.comment_vi && <Rich as="p" text={c.comment_vi} className="text-ink-2" />}
              </li>
            ))}
          </ul>
        )}
      </div>

      {result.fixes.length > 0 && (
        <div className="rounded-[16px] border border-transparent bg-yellow-soft p-3.5">
          <h4 className="text-xs font-semibold">Chỗ cần sửa · {result.fixes.length}</h4>
          <ul className="mt-2 space-y-2">
            {result.fixes.map((f, i) => (
              <li key={i} className="text-xs leading-5">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span
                    lang="ko"
                    className="font-korean text-[14px] text-danger line-through decoration-1"
                  >
                    {f.original}
                  </span>
                  {f.corrected && (
                    <>
                      <ArrowRight size={12} strokeWidth={2.6} className="shrink-0 text-ink-2" />
                      <span lang="ko" className="font-korean text-[14px] font-semibold text-green">
                        {f.corrected}
                      </span>
                    </>
                  )}
                  <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold">
                    {CATEGORY[f.category] ?? f.category}
                  </span>
                </p>
                <Rich as="p" text={f.reason_vi} className="text-ink-2" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.missing_vi.length > 0 && (
        <div className="rounded-[16px] border border-line bg-card p-3.5">
          <h4 className="text-xs font-semibold">Còn thiếu ý</h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5">
            {result.missing_vi.map((m) => (
              <li key={m}>
                <Rich text={m} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.strengths_vi.length > 0 && (
        <div className="rounded-[16px] border border-transparent bg-green-soft p-3.5">
          <h4 className="text-xs font-semibold">Làm tốt</h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5">
            {result.strengths_vi.map((s) => (
              <li key={s}>
                <Rich text={s} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.corrected_ko && (
        <div className="rounded-[16px] border border-line bg-card p-3.5">
          <h4 className="text-xs font-semibold">Bài của bạn sau khi sửa lỗi</h4>
          <p lang="ko" className="font-korean mt-1.5 whitespace-pre-line text-[14.5px] leading-7">
            {result.corrected_ko}
          </p>
        </div>
      )}

      {result.note && (
        <p className={cn("text-[12px] font-semibold leading-4 text-ink-2")}>{result.note}</p>
      )}
    </div>
  );
}
