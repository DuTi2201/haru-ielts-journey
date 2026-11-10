import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Sparkles, Undo2 } from "lucide-react";

import {
  ConfirmDialog,
  GlassPanel,
  LiquidBar,
  PanelEmpty,
  PanelError,
  PanelLoading,
  PanelTitle,
  ProgressCard,
} from "@/components/haru/studio-ui";
import { BTN, BTN_SM } from "@/components/haru/studio-kit";
import { useJobEvents } from "@/hooks/use-job-events";
import { errorMessage } from "@/lib/api/client";
import {
  getCorpusEnrichment,
  listHiddenCorpusItems,
  restoreHiddenCorpusItem,
  startCorpusEnrichment,
} from "@/lib/api/imports";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("vi-VN");

/** One sentence about what a finished run did, from the job's result. */
function describeRun(result: Record<string, unknown> | null, error: string | null): string {
  if (!result) return error ?? "Không có kết quả.";
  const n = (key: string) => Number(result[key] ?? 0) || 0;
  const parts = [`Đã thêm nghĩa và cách dùng cho ${fmt(n("enriched"))} câu`];
  if (n("hidden") > 0) parts.push(`ẩn ${fmt(n("hidden"))} câu thiếu tự nhiên`);
  const left = n("remaining");
  const tail =
    left > 0
      ? ` Còn ${fmt(left)} câu chưa xong — bấm chạy lại để làm tiếp.`
      : " Mọi câu trong kho đã được xử lý.";
  return `${parts.join(", ")}.${tail}${error ? ` (${error})` : ""}`;
}

/** Studio card that fills the corpus with what learners were missing: a
 * Vietnamese meaning and a usage note per sentence, fresh topics, and a check
 * that hides lines no native speaker would say. The work runs on the server in
 * the background, a chunk at a time, and can be started again at any point —
 * it only does what is still missing. */
export function CorpusEnrichmentPanel() {
  const qc = useQueryClient();
  const [startedJobId, setStartedJobId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [summary, setSummary] = useState<{ tone: "done" | "failed"; message: string } | null>(null);
  const handled = useRef<string | null>(null);

  const status = useQuery({
    queryKey: ["corpusEnrichment"],
    queryFn: getCorpusEnrichment,
    // while a run is going the counts creep up chunk by chunk
    refetchInterval: (q) => (q.state.data?.active_job_id ? 5000 : false),
  });
  const data = status.data;

  // A run started earlier (or from another device) is picked up on arrival.
  const jobId = startedJobId ?? data?.active_job_id ?? null;
  const job = useJobEvents(jobId);
  const finished =
    job.status === "succeeded" || job.status === "failed" || job.status === "cancelled";
  const running = jobId !== null && !finished;

  useEffect(() => {
    if (!jobId || !job.status || !finished) return;
    const key = `${jobId}:${job.status}`;
    if (handled.current === key) return;
    handled.current = key;
    const ok = job.status === "succeeded";
    const message = describeRun(job.job?.result ?? null, ok ? null : job.error);
    setStartedJobId(null);
    setSummary({ tone: ok ? "done" : "failed", message });
    if (ok) toast.success("Đã làm giàu xong một lượt");
    else toast.error(job.error ?? "Làm giàu kho câu chưa xong");
    void qc.invalidateQueries({ queryKey: ["corpusEnrichment"] });
    void qc.invalidateQueries({ queryKey: ["corpusHidden"] });
    // what learners browse (counts per topic changed)
    void qc.invalidateQueries({ queryKey: ["corpusFacets"] });
  }, [jobId, job.status, job.job, job.error, finished, qc]);

  const start = useMutation({
    mutationFn: startCorpusEnrichment,
    onSuccess: (res) => {
      handled.current = null;
      setSummary(null);
      setStartedJobId(res.job_id);
      void qc.invalidateQueries({ queryKey: ["corpusEnrichment"] });
      toast.success("Đã bắt đầu — Gemini đang xử lý kho câu");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const hidden = useQuery({
    queryKey: ["corpusHidden"],
    queryFn: listHiddenCorpusItems,
    enabled: showHidden,
  });
  const restore = useMutation({
    mutationFn: restoreHiddenCorpusItem,
    onSuccess: () => {
      toast.success("Đã hiện lại câu này — lần làm giàu tới sẽ thêm nghĩa cho nó");
      void qc.invalidateQueries({ queryKey: ["corpusHidden"] });
      void qc.invalidateQueries({ queryKey: ["corpusEnrichment"] });
      void qc.invalidateQueries({ queryKey: ["corpusFacets"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const pct = data && data.total > 0 ? Math.round((data.enriched / data.total) * 100) : 0;
  const busyCard = running
    ? {
        title: "Gemini đang làm giàu kho câu…",
        pct: job.progress > 0 ? Math.round(job.progress * 100) : null,
        message: job.error ?? job.step ?? "Đang chờ máy chủ…",
      }
    : null;

  return (
    <GlassPanel id="studio-corpus">
      <PanelTitle icon={<Sparkles size={17} strokeWidth={2.2} />}>Làm giàu kho câu</PanelTitle>
      <p className="mt-1 text-xs font-medium leading-5 text-ink-2">
        Dịch nghĩa tiếng Việt, viết ghi chú cách dùng, gắn lại chủ đề và ẩn các câu thiếu tự nhiên
        (nghe như dịch máy) để người học không gặp phải.
      </p>

      {status.isLoading && <PanelLoading rows={1} label="Đang đếm câu trong kho…" />}
      {status.isError && (
        <PanelError
          className="mt-3"
          message={errorMessage(status.error)}
          onRetry={() => void status.refetch()}
          retrying={status.isFetching}
        />
      )}

      {data && (
        <>
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2 text-xs font-semibold">
              <span>Đã có nghĩa và cách dùng</span>
              <span className="tabular-nums text-ink-2">
                {fmt(data.enriched)}/{fmt(data.total)} câu
              </span>
            </div>
            <LiquidBar
              pct={pct}
              label="Tiến độ làm giàu kho câu"
              tone={data.pending === 0 ? "done" : "busy"}
              animated={false}
              className="mt-1.5"
            />
            <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-semibold">
              <span className="rounded-full bg-danger-soft px-2.5 py-1 text-danger">
                Đang ẩn: {fmt(data.hidden)}
              </span>
              <span className="rounded-full bg-yellow-soft px-2.5 py-1">
                trong đó hơi gượng (văn dịch): {fmt(data.awkward)}
              </span>
            </div>
          </div>

          {busyCard && <ProgressCard {...busyCard} className="mt-3" />}
          {!running && summary && (
            <ProgressCard
              className="mt-3"
              title={summary.tone === "done" ? "Xong một lượt" : "Chưa xong"}
              pct={pct}
              tone={summary.tone}
              message={summary.message}
              onDismiss={() => setSummary(null)}
            />
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN.primary}
              disabled={running || start.isPending || data.pending === 0}
              onClick={() => setConfirmOpen(true)}
            >
              {running || start.isPending ? (
                <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
              ) : (
                <Sparkles size={14} strokeWidth={2.4} />
              )}
              {data.pending === 0
                ? "Kho câu đã đầy đủ"
                : running
                  ? "Đang chạy…"
                  : `Làm giàu ${fmt(data.pending)} câu còn thiếu`}
            </button>
            <button
              type="button"
              className={cn(BTN.soft)}
              aria-expanded={showHidden}
              onClick={() => setShowHidden((v) => !v)}
            >
              {showHidden ? (
                <EyeOff size={14} strokeWidth={2.4} />
              ) : (
                <Eye size={14} strokeWidth={2.4} />
              )}
              {showHidden ? "Ẩn danh sách" : `Xem câu đang ẩn (${fmt(data.hidden)})`}
            </button>
          </div>

          {showHidden && (
            <div className="mt-3">
              {hidden.isLoading && <PanelLoading rows={2} label="Đang tải câu bị ẩn…" />}
              {hidden.isError && (
                <PanelError
                  message={errorMessage(hidden.error)}
                  onRetry={() => void hidden.refetch()}
                  retrying={hidden.isFetching}
                />
              )}
              {hidden.isSuccess && hidden.data.length === 0 && (
                <PanelEmpty
                  title="Chưa có câu nào bị ẩn"
                  hint="Câu thiếu tự nhiên sẽ hiện ở đây sau khi chạy làm giàu — bạn kiểm tra và hiện lại câu nào bị ẩn nhầm."
                />
              )}
              {hidden.isSuccess && hidden.data.length > 0 && (
                <ul className="space-y-1.5">
                  {hidden.data.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-2.5 rounded-[16px] border border-glass-edge bg-glass-row px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          lang="ko"
                          className="font-korean break-words text-sm font-semibold leading-5"
                        >
                          {row.text_ko}
                        </p>
                        <p className="truncate text-[12px] font-semibold text-ink-2">
                          {row.film_title}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={cn(BTN.soft, BTN_SM, "shrink-0")}
                        disabled={restore.isPending}
                        onClick={() => restore.mutate(row.id)}
                        aria-label={`Hiện lại câu: ${row.text_ko}`}
                      >
                        <Undo2 size={14} strokeWidth={2.4} /> Hiện lại
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Làm giàu kho câu?"
        description={`Gemini sẽ dịch nghĩa và viết ghi chú cách dùng cho ${fmt(data?.pending ?? 0)} câu, gắn lại chủ đề (thay các chủ đề cũ) và ẩn câu nghe như dịch máy khỏi người học. Có thể mất vài phút; bạn có thể rời trang, và bấm chạy lại để làm tiếp nếu bị gián đoạn. Câu bị ẩn nhầm có thể hiện lại ở danh sách bên dưới.`}
        confirmLabel="Bắt đầu"
        onConfirm={() => start.mutate()}
      />
    </GlassPanel>
  );
}
