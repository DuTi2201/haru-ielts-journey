import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, ImageIcon, Loader2, Palette, RefreshCw } from "lucide-react";

import { BTN, BTN_SM } from "@/components/haru/studio-kit";
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
import { LessonImage } from "@/components/lesson/LessonImage";
import { useJobEvents } from "@/hooks/use-job-events";
import { errorMessage } from "@/lib/api/client";
import {
  getImagesOverview,
  getLessonImages,
  reuseImage,
  reuseSuggestedImages,
  setImageHidden,
  startImageDrawing,
} from "@/lib/api/images";
import type {
  ImageSlotKind,
  ImageSlotOut,
  LessonImageSummaryOut,
  ReuseCandidateOut,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("vi-VN");

const KIND_LABEL: Record<ImageSlotKind, string> = {
  lesson: "Đầu bài",
  vocab: "Từ vựng",
  grammar: "Ngữ pháp",
  scene: "Bài tập",
};

type KindFilter = "all" | "missing" | "reusable" | "hidden" | ImageSlotKind;

const FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "missing", label: "Chưa vẽ" },
  { id: "reusable", label: "Dùng lại được" },
  { id: "hidden", label: "Đang ẩn" },
  { id: "lesson", label: KIND_LABEL.lesson },
  { id: "vocab", label: KIND_LABEL.vocab },
  { id: "grammar", label: KIND_LABEL.grammar },
  { id: "scene", label: KIND_LABEL.scene },
];

function matches(slot: ImageSlotOut, filter: KindFilter): boolean {
  if (filter === "all") return true;
  if (filter === "missing") return !slot.url;
  if (filter === "reusable") return !slot.url && slot.reuse.length > 0;
  if (filter === "hidden") return slot.hidden;
  return slot.kind === filter;
}

/** What a finished run did, from the job's result. */
function describeRun(result: Record<string, unknown> | null, error: string | null): string {
  if (!result) return error ?? "Không có kết quả.";
  const created = Number(result["created"] ?? 0) || 0;
  const remaining = Number(result["remaining"] ?? 0) || 0;
  const failed = Array.isArray(result["failed"]) ? (result["failed"] as { label?: string }[]) : [];
  const parts = [`Đã vẽ ${fmt(created)} ảnh`];
  if (failed.length > 0) {
    const names = failed
      .slice(0, 3)
      .map((f) => f.label)
      .filter(Boolean)
      .join(", ");
    parts.push(`${fmt(failed.length)} ảnh bị bỏ qua${names ? ` (${names}…)` : ""}`);
  }
  const tail =
    remaining > 0
      ? ` Còn ${fmt(remaining)} ảnh chưa có — bấm vẽ lại để làm tiếp.`
      : " Mọi ảnh của phần này đã có.";
  return `${parts.join(", ")}.${tail}${error ? ` (${error})` : ""}`;
}

/** Every screen that shows a picture: the Studio card, the picker's banners, the lesson
 * page and the exercises' scenes. */
function refreshPictures(qc: QueryClient) {
  for (const key of ["lesson-images", "lesson-images-of", "lessons", "lesson", "lesson-practice"]) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}

type Confirm =
  | { kind: "missing"; lessonId: number | undefined; count: number; title: string }
  | { kind: "redraw"; slot: ImageSlotOut };

/** Studio card for the lessons' pictures: how many each lesson has, a button that has
 * Gemini draw the missing ones in the background, and a gallery to look them over —
 * hide one that came out wrong, or draw it again. A picture is made once and kept, so
 * learners never wait for one and the Gemini bill is spent only when this card says so. */
export function LessonImagesPanel() {
  const qc = useQueryClient();
  const [startedJobId, setStartedJobId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [openLesson, setOpenLesson] = useState<number | null>(null);
  const [filter, setFilter] = useState<KindFilter>("all");
  const [summary, setSummary] = useState<{ tone: "done" | "failed"; message: string } | null>(null);
  const handled = useRef<string | null>(null);

  const overview = useQuery({
    queryKey: ["lesson-images"],
    queryFn: getImagesOverview,
    // while a run is going the counts creep up picture by picture
    refetchInterval: (q) => (q.state.data?.active_job_id ? 5000 : false),
  });
  const data = overview.data;

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
    setStartedJobId(null);
    setSummary({
      tone: ok ? "done" : "failed",
      message: describeRun(job.job?.result ?? null, ok ? null : job.error),
    });
    if (ok) toast.success("Đã vẽ xong một lượt ảnh");
    else toast.error(job.error ?? "Vẽ ảnh chưa xong");
    refreshPictures(qc);
  }, [jobId, job.status, job.job, job.error, finished, qc]);

  const start = useMutation({
    mutationFn: startImageDrawing,
    onSuccess: (res) => {
      handled.current = null;
      setSummary(null);
      setStartedJobId(res.job_id);
      void qc.invalidateQueries({ queryKey: ["lesson-images"] });
      toast.success("Đã bắt đầu — Gemini đang vẽ ảnh");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reuseSure = useMutation({
    mutationFn: () => reuseSuggestedImages(),
    onSuccess: (res) => {
      setSummary(null);
      refreshPictures(qc);
      if (res.reused > 0)
        toast.success(`Đã dùng lại ảnh có sẵn cho ${fmt(res.reused)} từ — không tốn lượt vẽ`);
      else toast("Không có ảnh nào đủ chắc để dùng lại.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const total = data?.total ?? 0;
  const have = data?.have ?? 0;
  const pct = total > 0 ? Math.round((have / total) * 100) : 0;
  const busy = running || start.isPending;
  const off = data !== undefined && !data.enabled;

  const busyCard = running
    ? {
        title: "Gemini đang vẽ ảnh…",
        pct: job.progress > 0 ? Math.round(job.progress * 100) : null,
        message: job.error ?? job.step ?? "Đang chờ máy chủ…",
      }
    : null;

  function ask(lessonId: number | undefined, count: number, title: string) {
    setConfirm({ kind: "missing", lessonId, count, title });
  }

  function onConfirm() {
    if (!confirm) return;
    if (confirm.kind === "missing") {
      start.mutate(confirm.lessonId === undefined ? {} : { lesson_id: confirm.lessonId });
    } else {
      start.mutate({ keys: [confirm.slot.key], force: true });
    }
  }

  return (
    <GlassPanel id="studio-images">
      <PanelTitle icon={<ImageIcon size={17} strokeWidth={2.2} />}>Ảnh minh hoạ bài học</PanelTitle>
      <p className="mt-1 text-xs font-medium leading-5 text-ink-2">
        Gemini vẽ ảnh đầu bài, từ vựng, ngữ pháp và cảnh trong bài tập. Mỗi ảnh chỉ vẽ một lần rồi
        được lưu lại, người học không phải chờ. Ảnh nào vẽ sai thì ẩn đi hoặc vẽ lại.
      </p>

      {overview.isLoading && <PanelLoading rows={2} label="Đang đếm ảnh của các bài…" />}
      {overview.isError && (
        <PanelError
          className="mt-3"
          message={errorMessage(overview.error)}
          onRetry={() => void overview.refetch()}
          retrying={overview.isFetching}
        />
      )}

      {off && (
        <p className="mt-3 rounded-[14px] bg-yellow-soft px-3 py-2 text-xs font-semibold leading-5">
          Tính năng vẽ ảnh đang tắt trên máy chủ (LESSON_IMAGE_GEN_ENABLED). Ảnh đã vẽ vẫn không
          hiện cho người học cho tới khi bật lại.
        </p>
      )}

      {data && data.lessons.length === 0 && (
        <PanelEmpty
          title="Chưa có bài nào cần ảnh"
          hint="Khi các bài học đã được nạp, danh sách ảnh của từng bài sẽ hiện ở đây."
        />
      )}

      {data && data.lessons.length > 0 && (
        <>
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2 text-xs font-semibold">
              <span>Đã có ảnh</span>
              <span className="tabular-nums text-ink-2">
                {fmt(have)}/{fmt(total)} ảnh
              </span>
            </div>
            <LiquidBar
              pct={pct}
              label="Tiến độ vẽ ảnh của mọi bài"
              tone={have >= total ? "done" : "busy"}
              animated={false}
              className="mt-1.5"
            />
            {data.model && (
              <p className="mt-1.5 text-[12px] font-semibold text-ink-2">Mô hình: {data.model}</p>
            )}
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

          {(data.reusable ?? 0) > 0 && (
            <div
              role="note"
              className="mt-3 rounded-[14px] bg-green-soft px-3 py-2.5 text-xs font-semibold leading-5"
            >
              <p>
                {fmt(data.reusable)} từ chưa có ảnh nhưng đã có ảnh của từ cùng nghĩa — dùng lại ảnh
                đó thì khỏi tốn lượt vẽ.
                {data.reusable_sure > 0
                  ? ` ${fmt(data.reusable_sure)} từ trong số đó giống chắc chắn.`
                  : " Mở từng bài để chọn ảnh dùng lại."}
              </p>
              {data.reusable_sure > 0 && (
                <button
                  type="button"
                  className={cn(BTN.ok, BTN_SM, "mt-2")}
                  disabled={busy || reuseSure.isPending}
                  onClick={() => reuseSure.mutate()}
                >
                  {reuseSure.isPending ? (
                    <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
                  ) : (
                    <Copy size={14} strokeWidth={2.4} />
                  )}
                  Dùng lại {fmt(data.reusable_sure)} ảnh chắc chắn (miễn phí)
                </button>
              )}
            </div>
          )}

          <div className="mt-3">
            <button
              type="button"
              className={BTN.primary}
              disabled={busy || off || have >= total}
              onClick={() => ask(undefined, total - have, "tất cả các bài")}
            >
              {busy ? (
                <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
              ) : (
                <Palette size={14} strokeWidth={2.4} />
              )}
              {have >= total
                ? "Mọi bài đã có đủ ảnh"
                : busy
                  ? "Đang vẽ…"
                  : `Vẽ ${fmt(total - have)} ảnh còn thiếu (mọi bài)`}
            </button>
          </div>

          <ul className="mt-3 space-y-2">
            {data.lessons.map((lesson) => (
              <LessonRow
                key={lesson.lesson_id}
                lesson={lesson}
                open={openLesson === lesson.lesson_id}
                drawing={running && data.active_lesson_id === lesson.lesson_id}
                busy={busy}
                off={off}
                filter={filter}
                onFilter={setFilter}
                onToggle={() =>
                  setOpenLesson((cur) => (cur === lesson.lesson_id ? null : lesson.lesson_id))
                }
                onDraw={() => ask(lesson.lesson_id, lesson.total - lesson.have, lesson.title)}
                onRedraw={(slot) => setConfirm({ kind: "redraw", slot })}
                onDrawOne={(slot) => start.mutate({ keys: [slot.key] })}
                onChanged={() => refreshPictures(qc)}
              />
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm?.kind === "redraw" ? "Vẽ lại ảnh này?" : "Bắt đầu vẽ ảnh?"}
        description={
          confirm?.kind === "redraw"
            ? `Ảnh “${confirm.slot.label}” sẽ được Gemini vẽ lại và thay ảnh hiện tại. Mỗi lần vẽ là một lần gọi Gemini tính phí.`
            : confirm
              ? `Gemini sẽ vẽ ${fmt(confirm.count)} ảnh còn thiếu của ${confirm.title}. Mỗi ảnh là một lần gọi Gemini tính phí; ảnh giống nhau dùng chung một lần vẽ.${(data?.reusable ?? 0) > 0 ? ` Có ${fmt(data?.reusable ?? 0)} từ đã có ảnh của từ cùng nghĩa — nên dùng lại trước để đỡ tốn.` : ""} Ảnh vẽ xong hiện ngay cho người học. Bạn có thể rời trang — việc vẽ vẫn chạy trên máy chủ, và bấm lại để làm tiếp nếu bị gián đoạn.`
              : ""
        }
        confirmLabel={confirm?.kind === "redraw" ? "Vẽ lại" : "Bắt đầu vẽ"}
        onConfirm={onConfirm}
      />
    </GlassPanel>
  );
}

function LessonRow({
  lesson,
  open,
  drawing,
  busy,
  off,
  filter,
  onFilter,
  onToggle,
  onDraw,
  onRedraw,
  onDrawOne,
  onChanged,
}: {
  lesson: LessonImageSummaryOut;
  open: boolean;
  drawing: boolean;
  busy: boolean;
  off: boolean;
  filter: KindFilter;
  onFilter: (f: KindFilter) => void;
  onToggle: () => void;
  onDraw: () => void;
  onRedraw: (slot: ImageSlotOut) => void;
  onDrawOne: (slot: ImageSlotOut) => void;
  onChanged: () => void;
}) {
  const missing = lesson.total - lesson.have;
  const pct = lesson.total > 0 ? Math.round((lesson.have / lesson.total) * 100) : 0;
  return (
    <li className="rounded-[18px] border border-glass-edge bg-glass-row px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`lesson-images-${lesson.lesson_id}`}
          className="min-w-0 flex-1 text-left"
        >
          <p className="break-words text-[13px] font-semibold leading-5">{lesson.title}</p>
          <p className="text-[12px] font-semibold tabular-nums text-ink-2">
            {fmt(lesson.have)}/{fmt(lesson.total)} ảnh
            {lesson.hidden > 0 ? ` · ẩn ${fmt(lesson.hidden)}` : ""}
            {lesson.reusable > 0 ? ` · ${fmt(lesson.reusable)} dùng lại được` : ""}
            {drawing ? " · đang vẽ…" : ""}
          </p>
          <LiquidBar
            pct={pct}
            label={`Ảnh của bài ${lesson.title}`}
            tone={missing === 0 ? "done" : "busy"}
            animated={false}
            className="mt-1"
          />
        </button>
        <button
          type="button"
          className={cn(missing === 0 ? BTN.soft : BTN.primary, BTN_SM, "shrink-0")}
          disabled={busy || off || missing === 0}
          onClick={onDraw}
          aria-label={
            missing === 0
              ? `Bài ${lesson.title} đã đủ ảnh`
              : `Vẽ ${missing} ảnh còn thiếu của bài ${lesson.title}`
          }
        >
          {drawing ? (
            <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
          ) : (
            <Palette size={14} strokeWidth={2.4} />
          )}
          {missing === 0 ? "Đủ" : `Vẽ ${fmt(missing)}`}
        </button>
      </div>

      {open && (
        <Gallery
          lessonId={lesson.lesson_id}
          busy={busy}
          off={off}
          filter={filter}
          onFilter={onFilter}
          onRedraw={onRedraw}
          onDrawOne={onDrawOne}
          onChanged={onChanged}
        />
      )}
    </li>
  );
}

function Gallery({
  lessonId,
  busy,
  off,
  filter,
  onFilter,
  onRedraw,
  onDrawOne,
  onChanged,
}: {
  lessonId: number;
  busy: boolean;
  off: boolean;
  filter: KindFilter;
  onFilter: (f: KindFilter) => void;
  onRedraw: (slot: ImageSlotOut) => void;
  onDrawOne: (slot: ImageSlotOut) => void;
  onChanged: () => void;
}) {
  const images = useQuery({
    queryKey: ["lesson-images-of", lessonId],
    queryFn: () => getLessonImages(lessonId),
  });
  const hide = useMutation({
    mutationFn: ({ key, hidden }: { key: string; hidden: boolean }) => setImageHidden(key, hidden),
    onSuccess: (_res, vars) => {
      toast.success(vars.hidden ? "Đã ẩn ảnh khỏi bài học" : "Đã hiện lại ảnh");
      onChanged();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reuse = useMutation({
    mutationFn: ({ from, to }: { from: ReuseCandidateOut; to: ImageSlotOut }) =>
      reuseImage(from.key, to.key),
    onSuccess: (_res, vars) => {
      toast.success(`Đã dùng ảnh “${vars.from.label}” cho “${vars.to.label}”`);
      onChanged();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const slots = images.data?.slots ?? [];
  const shown = slots.filter((s) => matches(s, filter));

  return (
    <div id={`lesson-images-${lessonId}`} className="mt-3 border-t border-glass-edge pt-3">
      {images.isLoading && <PanelLoading rows={2} label="Đang tải ảnh của bài…" />}
      {images.isError && (
        <PanelError
          message={errorMessage(images.error)}
          onRetry={() => void images.refetch()}
          retrying={images.isFetching}
        />
      )}
      {images.data && (
        <>
          <div role="group" aria-label="Lọc ảnh" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => onFilter(f.id)}
                className={cn(
                  "hit-area rounded-full border border-line px-2.5 py-1 text-[12px] font-semibold",
                  filter === f.id ? "bg-blue text-primary-foreground" : "bg-card/70 text-ink-2",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="mt-3 text-center text-xs font-semibold text-ink-2">
              Không có ảnh nào ở mục này.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-2.5">
              {shown.map((slot) => (
                <li
                  key={slot.key}
                  className={cn(
                    "flex flex-col rounded-[16px] border border-glass-edge bg-card/60 p-2",
                    slot.hidden && "opacity-70",
                  )}
                >
                  {slot.url ? (
                    <LessonImage
                      src={slot.url}
                      alt={`Ảnh: ${slot.label}`}
                      className="aspect-[4/3] w-full"
                    />
                  ) : (
                    <span className="flex aspect-[4/3] w-full items-center justify-center rounded-[12px] border border-dashed border-line text-[12px] font-semibold text-ink-2">
                      Chưa vẽ
                    </span>
                  )}
                  <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[12px] font-semibold leading-4">
                    <span className="rounded-full bg-progress px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">
                      {KIND_LABEL[slot.kind]}
                    </span>
                    {slot.hidden && (
                      <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[11px] font-semibold text-danger">
                        Đang ẩn
                      </span>
                    )}
                    {slot.model?.startsWith("reuse:") && (
                      <span className="rounded-full bg-green-soft px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">
                        Dùng lại
                      </span>
                    )}
                  </p>
                  <p lang="ko" className="mt-0.5 break-words text-[12.5px] font-semibold leading-4">
                    {slot.label}
                  </p>
                  {slot.meaning && (
                    <p className="break-words text-[12px] font-semibold leading-4 text-blue-deep">
                      {slot.meaning}
                    </p>
                  )}
                  <p className="mt-0.5 line-clamp-3 break-words text-[10.5px] leading-4 text-ink-2">
                    {slot.prompt}
                  </p>
                  {!slot.url && slot.reuse.length > 0 && (
                    <ReuseOptions
                      options={slot.reuse}
                      disabled={busy || reuse.isPending}
                      onPick={(from) => reuse.mutate({ from, to: slot })}
                    />
                  )}
                  <div className="mt-auto flex flex-col gap-1.5 pt-2">
                    {slot.url ? (
                      <>
                        <button
                          type="button"
                          className={cn(
                            BTN.soft,
                            BTN_SM,
                            "w-full whitespace-nowrap px-2 text-[12px]",
                          )}
                          disabled={busy || off}
                          onClick={() => onRedraw(slot)}
                          aria-label={`Vẽ lại ảnh ${slot.label}`}
                        >
                          <RefreshCw size={12} strokeWidth={2.4} /> Vẽ lại
                        </button>
                        <button
                          type="button"
                          className={cn(
                            BTN.soft,
                            BTN_SM,
                            "w-full whitespace-nowrap px-2 text-[12px]",
                          )}
                          disabled={hide.isPending}
                          onClick={() => hide.mutate({ key: slot.key, hidden: !slot.hidden })}
                          aria-label={`${slot.hidden ? "Hiện lại" : "Ẩn"} ảnh ${slot.label}`}
                        >
                          {slot.hidden ? (
                            <Eye size={12} strokeWidth={2.4} />
                          ) : (
                            <EyeOff size={12} strokeWidth={2.4} />
                          )}
                          {slot.hidden ? "Hiện" : "Ẩn"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={cn(
                          BTN.primary,
                          BTN_SM,
                          "w-full whitespace-nowrap px-2 text-[12px]",
                        )}
                        disabled={busy || off}
                        onClick={() => onDrawOne(slot)}
                        aria-label={`Vẽ ảnh ${slot.label}`}
                      >
                        <Palette size={12} strokeWidth={2.4} /> Vẽ ảnh này
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** "Giống ảnh có sẵn": the existing pictures of words that mean the same as a missing one,
 * each with a button that copies it (free) instead of paying for a new drawing. */
function ReuseOptions({
  options,
  disabled,
  onPick,
}: {
  options: ReuseCandidateOut[];
  disabled: boolean;
  onPick: (option: ReuseCandidateOut) => void;
}) {
  return (
    <div className="mt-2 rounded-[12px] bg-green-soft/70 p-1.5">
      <p className="text-[11px] font-semibold leading-4 text-ink-2">Giống ảnh có sẵn</p>
      <ul className="mt-1 space-y-1.5">
        {options.map((option) => (
          <li key={option.key} className="rounded-[10px] bg-card/80 p-1.5">
            <div className="flex items-center gap-1.5">
              <LessonImage
                src={option.url}
                alt={`Ảnh: ${option.label}`}
                className="h-9 w-9 rounded-[8px]"
              />
              <div className="min-w-0 flex-1">
                <p lang="ko" className="break-words text-[11.5px] font-semibold leading-4">
                  {option.label}
                </p>
                <p className="break-keep break-words text-[11px] leading-3.5 text-ink-2">
                  {option.why}
                </p>
              </div>
            </div>
            <button
              type="button"
              className={cn(
                option.confident ? BTN.ok : BTN.soft,
                BTN_SM,
                "mt-1.5 w-full whitespace-nowrap px-2 text-[12px]",
              )}
              disabled={disabled}
              onClick={() => onPick(option)}
              aria-label={`Dùng ảnh của ${option.label}`}
            >
              <Copy size={12} strokeWidth={2.4} className="shrink-0" /> Dùng ảnh này
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
