import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  History,
  Link2,
  Loader2,
  LogIn,
  LogOut,
  Newspaper,
  Plus,
  Radio,
  RotateCcw,
  ShieldCheck,
  Undo2,
  Zap,
} from "lucide-react";

import { CorpusEnrichmentPanel } from "@/components/haru/CorpusEnrichmentPanel";
import { LessonImagesPanel } from "@/components/haru/LessonImagesPanel";
import {
  ExamAnswersPanel,
  ExamItemBody,
  ExamOverview,
  ExamPassageBody,
} from "@/components/haru/ExamReview";
import { ExamSourceProvider } from "@/components/haru/ExamPageViewer";
import { Mascot } from "@/components/mascot/Mascot";
import { LoadingBlocks } from "@/components/haru/states";
import {
  ConfirmDialog,
  Field,
  GlassPanel,
  LeaveTransition,
  LiquidBar,
  PanelEmpty,
  PanelError,
  PanelLoading,
  PanelTitle,
  ProgressCard,
} from "@/components/haru/studio-ui";
import { BTN, BTN_SM, FIELD, useExiting } from "@/components/haru/studio-kit";
import { useAuth } from "@/hooks/use-auth";
import { useJobEvents, type JobEventsState } from "@/hooks/use-job-events";
import * as authApi from "@/lib/api/auth";
import { login } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/client";
import {
  createEditorialSource,
  dismissEditorialCandidate,
  ingestEditorialCandidate,
  listEditorialCandidates,
  listEditorialSources,
  triggerEditorialDiscovery,
} from "@/lib/api/editorial";
import {
  confirmImportBatch,
  createImportBatch,
  getImportBatch,
  listImportBatches,
  listImportItems,
  patchImportItem,
  rollbackImportBatch,
} from "@/lib/api/imports";
import type {
  ImportBatchOut,
  ImportItemOut,
  ImportItemPatch,
  ImportItemStatus,
  ImportKind,
} from "@/lib/api/types";
import { examBulkTargets, keySourceOf, splitExamItems } from "@/lib/exam-review";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Studio · Duyệt dữ liệu — Haru" },
      { name: "description", content: "Studio · Duyệt dữ liệu trong ứng dụng học tiếng Hàn Haru." },
      { property: "og:title", content: "Studio · Duyệt dữ liệu — Haru" },
      {
        property: "og:description",
        content: "Studio · Duyệt dữ liệu trong ứng dụng học tiếng Hàn Haru.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioScreen,
});

const KIND_LABEL: Record<ImportKind, string> = {
  lesson: "Bài học",
  corpus: "Phụ đề phim",
  exam_paper: "Đề thi",
  editorial_article: "Bài báo (URL)",
};
/** What can be uploaded here. Lessons are no longer made from an upload (lesson-v5):
 * they are written by hand and loaded with the server, so "lesson" is not offered —
 * it stays in the maps above only so a batch uploaded earlier still reads properly. */
const UPLOAD_KINDS: ImportKind[] = ["corpus", "exam_paper", "editorial_article"];
const KIND_SHORT: Record<ImportKind, string> = {
  lesson: "Bài học",
  corpus: "Phụ đề",
  exam_paper: "Đề thi",
  editorial_article: "Bài báo",
};
const KIND_BADGE: Record<ImportKind, string> = {
  lesson: "bg-blue-soft text-blue-deep",
  corpus: "bg-teal-soft text-ink",
  exam_paper: "bg-purple-soft text-ink",
  editorial_article: "bg-yellow-soft text-ink",
};
const STATUS_LABEL: Record<string, string> = {
  queued: "Đang chờ",
  extracting: "Đang trích xuất",
  validating: "Đang kiểm tra",
  awaiting_review: "Chờ duyệt",
  confirmed: "Đã xác nhận",
  cancelled: "Đã huỷ",
  rolled_back: "Đã hoàn tác",
  failed: "Lỗi",
};
/** The batch is still being read by Gemini — items may not exist yet. */
const BATCH_WORKING = new Set(["queued", "extracting", "validating"]);

const ITEM_KIND_LABEL: Record<string, string> = {
  lesson: "Bài học",
  editorial_meta: "Bài báo",
  vocab_item: "Từ vựng",
  grammar_point: "Ngữ pháp",
  corpus_item: "Câu thoại",
  exam_passage: "Đoạn văn",
  exam_item: "Câu hỏi",
  exam_summary: "Tóm tắt lần đọc",
};

/** Status is told by a word AND a colour (never colour alone). `row` is the
 * whole surface (edge + fill), so a variant never fights a base class. */
const ITEM_STATUS: Record<ImportItemStatus, { label: string; row: string; pill: string }> = {
  pending: {
    label: "Chờ duyệt",
    row: "border-glass-edge bg-glass-row",
    pill: "bg-blue-soft text-blue-deep",
  },
  flagged_yellow: {
    label: "Cần xem kỹ",
    row: "border-yellow-strong/70 bg-yellow-soft/60",
    pill: "bg-yellow-soft text-ink",
  },
  flagged_red: {
    label: "Nghi có lỗi",
    row: "border-danger/50 bg-danger-soft/60",
    pill: "bg-danger-soft text-danger",
  },
  confirmed: {
    label: "Đã xác nhận",
    row: "border-green/50 bg-green-soft/60",
    pill: "bg-green-soft text-ink",
  },
  rejected: {
    label: "Đã từ chối",
    row: "border-glass-edge bg-glass-row opacity-60",
    pill: "bg-progress text-ink-2",
  },
};

const isPending = (s: ImportItemStatus) =>
  s === "pending" || s === "flagged_yellow" || s === "flagged_red";

type ItemFilter = "pending" | "confirmed" | "rejected" | "all";
const FILTERS: { id: ItemFilter; label: string }[] = [
  { id: "pending", label: "Chờ duyệt" },
  { id: "confirmed", label: "Đã xác nhận" },
  { id: "rejected", label: "Từ chối" },
  { id: "all", label: "Tất cả" },
];
const matchesFilter = (status: ImportItemStatus, filter: ItemFilter) =>
  filter === "all" ? true : filter === "pending" ? isPending(status) : status === filter;

/** Long batches (hundreds of subtitle lines) render this many rows at a time;
 * the rest come with "Hiện thêm". Approving rows shrinks the queue, so the
 * next ones slide in by themselves. */
const PAGE_SIZE = 40;
/** Parallel PATCH requests while "Duyệt nhanh" confirms every pending item. */
const BULK_CONCURRENCY = 6;

const WHEN =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) || !WHEN ? "" : WHEN.format(d);
}

function jumpTo(id: string) {
  requestAnimationFrame(() =>
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" }),
  );
}

function summarize(item: ImportItemOut): string {
  const p = item.payload ?? {};
  switch (item.kind) {
    case "lesson":
      return String(p["title"] ?? "");
    case "editorial_meta":
      return String(p["title_en"] ?? "(chưa có tiêu đề)");
    case "vocab_item":
      return `${p["headword"] ?? ""} — ${p["meaning_vi"] ?? ""}`;
    case "grammar_point":
      return `${p["pattern"] ?? ""} — ${p["meaning_vi"] ?? ""}`;
    case "corpus_item":
      return String(p["text_en"] ?? "");
    case "exam_passage":
      return String(p["body_en"] ?? `(đoạn ${p["local_ref"] ?? ""})`);
    case "exam_item":
      return `#${p["number"] ?? "?"} ${p["stem_en"] ?? ""}`;
    default:
      return item.kind;
  }
}

const asText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const asTexts = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && !!v.trim()) : [];

/** The chunk layers of a staged card (family, node word, wrong choices; grammar:
 * its contrast group), so a reviewer can judge them without opening the JSON.
 * The wrong choices matter most: one that is also good Korean would mark a
 * learner wrong for a right answer. */
function ChunkReviewNote({ item }: { item: ImportItemOut }) {
  const p = item.payload ?? {};
  if (item.kind === "vocab_item") {
    const family = asText(p["family"]);
    const node = asText(p["node_word"]);
    const distractors = asTexts(p["distractors"]);
    if (!family && !node && distractors.length === 0) return null;
    return (
      <div className="mt-1 space-y-0.5 text-[12px] font-medium leading-4 text-ink-2">
        {(family || node) && (
          <p className="break-words">
            {family && (
              <>
                Họ: <b>{family}</b>
              </>
            )}
            {family && node && " · "}
            {node && (
              <>
                Từ chính:{" "}
                <span lang="ko" className="font-korean font-semibold">
                  {node}
                </span>
              </>
            )}
          </p>
        )}
        {distractors.length > 0 && (
          <p className="break-words">
            Lựa chọn sai:{" "}
            <span lang="ko" className="font-korean font-semibold">
              {distractors.join(", ")}
            </span>{" "}
            — xoá từ nào vẫn ghép được với cụm.
          </p>
        )}
      </div>
    );
  }
  if (item.kind === "grammar_point") {
    const group = asText(p["contrast_group"]);
    const contrasts = Array.isArray(p["contrasts"]) ? p["contrasts"].length : 0;
    if (!group) return null;
    return (
      <p className="mt-1 break-words text-[12px] font-medium leading-4 text-ink-2">
        Nhóm đối chiếu: <b>{group}</b>
        {contrasts > 0 ? ` · ${contrasts} điểm khác nhau` : ""}
      </p>
    );
  }
  return null;
}

/** A job's live state as a ProgressCard: percentage from the server, or the
 * sliding blob until it reports one. */
function jobCard(job: JobEventsState, title: string, doneTitle: string) {
  const failed = job.status === "failed" || job.status === "cancelled";
  const done = job.status === "succeeded";
  return {
    title: done ? doneTitle : failed ? "Không thực hiện được" : title,
    pct: done ? 100 : job.progress > 0 ? Math.round(job.progress * 100) : null,
    tone: done ? ("done" as const) : failed ? ("failed" as const) : ("busy" as const),
    message: job.error ?? job.step ?? (job.status ? STATUS_LABEL[job.status] : "Đang chờ máy chủ…"),
  };
}

// --------------------------------------------------------------------- login --
function LoginPanel({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const mutation = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: onLoggedIn,
  });
  return (
    <main className="mesh-backdrop mx-auto flex min-h-dvh max-w-[390px] flex-col justify-center px-5 text-ink">
      <div className="glass-card rounded-[28px] p-6">
        <Mascot mood="wave" className="mx-auto mb-4 h-16 w-16" />
        <h1 className="text-center text-xl font-bold">Studio · Đăng nhập biên tập viên</h1>
        <p className="mt-1 text-center text-xs font-medium text-ink-2">
          Cần tài khoản role editor/admin để duyệt dữ liệu.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field
            label="Email"
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="relative">
            <Field
              label="Mật khẩu"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-2"
            >
              {showPassword ? (
                <EyeOff size={18} strokeWidth={2.2} />
              ) : (
                <Eye size={18} strokeWidth={2.2} />
              )}
            </button>
          </div>
          {mutation.isError && (
            <p role="alert" className="text-xs font-semibold text-danger">
              {errorMessage(mutation.error)}
            </p>
          )}
          <button
            type="submit"
            disabled={mutation.isPending}
            className={cn(BTN.primary, "w-full py-3 text-sm")}
          >
            {mutation.isPending ? (
              <Loader2 size={18} strokeWidth={2.4} className="animate-spin" />
            ) : (
              <LogIn size={18} strokeWidth={2.2} />
            )}
            {mutation.isPending ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
      </div>
    </main>
  );
}

// -------------------------------------------------------------------- upload --
/** kind="corpus" (film subtitles) can go in either as a photographed/scanned file
 * (image/PDF, OCR'd by Gemini server-side — see ingestion.extract_corpus_source_text)
 * or as plain typed/pasted text, so "text" mode just wraps the textarea value into
 * a synthetic .txt File and reuses the exact same upload call. No need to save a
 * .txt file yourself first — paste straight in. */
type TextUploadMode = "file" | "text";

/** Native file pickers keep their own (accessible) behaviour; only the button
 * part is themed. */
const FILE_FIELD =
  "!py-2 !text-sm file:mr-3 file:rounded-full file:border-0 file:bg-blue-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-deep";

function UploadPanel({ onQueued }: { onQueued: (batchId: string, jobId: string) => void }) {
  const [kind, setKind] = useState<ImportKind>("corpus");
  const [file, setFile] = useState<File | null>(null);
  const [examFiles, setExamFiles] = useState<File[]>([]);
  const [textMode, setTextMode] = useState<TextUploadMode>("file");
  const [pastedText, setPastedText] = useState("");
  const [filmTitle, setFilmTitle] = useState("");
  const [examKind, setExamKind] = useState("");
  const [sessionLabel, setSessionLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [titleKo, setTitleKo] = useState("");
  const [forceRefresh, setForceRefresh] = useState(false);

  const supportsTextMode = kind === "corpus";

  const mutation = useMutation({
    mutationFn: () => {
      if (kind === "editorial_article") {
        if (!sourceUrl.trim() || !sourceName.trim()) {
          throw new Error("Cần nhập URL bài báo và tên nguồn báo");
        }
        return createImportBatch({
          kind,
          sourceUrl: sourceUrl.trim(),
          sourceName: sourceName.trim(),
          titleKo: titleKo.trim() || undefined,
          force: forceRefresh,
        });
      }
      if (kind === "exam_paper") {
        if (examFiles.length === 0) throw new Error("Chưa chọn file");
        if (!examKind.trim() || !sessionLabel.trim()) {
          throw new Error("Cần nhập loại đề và kỳ thi");
        }
        return createImportBatch({
          kind,
          files: examFiles,
          examKind: examKind.trim(),
          sessionLabel: sessionLabel.trim(),
        });
      }
      if (supportsTextMode && textMode === "text") {
        if (!pastedText.trim()) throw new Error("Chưa nhập nội dung");
        const textFile = new File([pastedText], "phu-de.txt", { type: "text/plain" });
        if (kind === "corpus" && !filmTitle.trim()) {
          throw new Error("Cần nhập tên phim");
        }
        return createImportBatch({
          kind,
          file: textFile,
          filmTitle: kind === "corpus" ? filmTitle.trim() : undefined,
        });
      }
      if (!file) throw new Error("Chưa chọn file");
      return createImportBatch({
        kind,
        file,
        filmTitle: filmTitle || undefined,
      });
    },
    onSuccess: (res) => {
      onQueued(res.import_batch_id, res.job_id);
      setExamFiles([]);
      setFile(null);
    },
  });

  return (
    <GlassPanel id="studio-upload">
      <PanelTitle icon={<FileUp size={19} strokeWidth={2.2} />}>Tải lên dữ liệu mới</PanelTitle>
      <form
        className="mt-3 space-y-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div role="group" aria-label="Loại dữ liệu" className="grid grid-cols-2 gap-2">
          {UPLOAD_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "min-h-11 rounded-[16px] border px-2.5 py-2 text-left text-[12px] font-semibold leading-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue/50",
                kind === k
                  ? `${KIND_BADGE[k]} border-line ring-2 ring-blue/40`
                  : "border-glass-edge bg-glass-row text-ink-2",
              )}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        {kind === "editorial_article" ? (
          <>
            <div className="relative">
              <Link2
                size={15}
                strokeWidth={2.2}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-2"
              />
              <Field
                label="Đường dẫn bài báo"
                type="url"
                required
                placeholder="Đường dẫn bài báo (https://…)"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="pl-9"
              />
            </div>
            <Field
              label="Tên nguồn báo"
              required
              placeholder="Tên nguồn báo (vd: Kyunghyang)"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
            />
            <Field
              label="Tiêu đề (tuỳ chọn)"
              placeholder="Tiêu đề (tuỳ chọn)"
              value={titleKo}
              onChange={(e) => setTitleKo(e.target.value)}
            />
            <p className="-mt-1 px-1 text-[12px] font-medium leading-4 text-ink-2">
              Để trống thì Gemini tự đọc tiêu đề từ trang báo.
            </p>
            <label className="flex items-start gap-2 text-[12px] font-semibold leading-4 text-ink-2">
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-blue"
              />
              Bài này đã tải trước đó — lấy lại nội dung mới (nguồn/nội dung sạch hơn)
            </label>
          </>
        ) : kind === "exam_paper" ? (
          <>
            <input
              type="file"
              required
              multiple
              aria-label="Tệp đề thi"
              accept="image/png,image/jpeg,image/webp,application/pdf,.txt,text/plain"
              onChange={(e) => setExamFiles(Array.from(e.target.files ?? []))}
              className={cn(FIELD, FILE_FIELD)}
            />
            <p className="text-[12px] font-medium leading-4 text-ink-2">
              Chọn các tệp là trang của CÙNG một đề thi (tối đa 6 tệp, mỗi tệp tối đa 20 MB) — một
              phần thi một lần, vd chỉ đề đọc. Hệ thống tự cắt thành từng trang và đọc mỗi lần vài
              trang, nên tệp lớn không sao. Bảng đáp án KHÔNG tải ở đây: sau khi đề được đọc xong,
              dùng khung “Đáp án” trong lô để tải bảng đáp án hoặc dán đáp án.
            </p>
            {examFiles.length > 0 && (
              <ul className="space-y-0.5 text-[12px] font-semibold text-ink-2">
                {examFiles.map((f, i) => (
                  <li key={i} className="truncate">
                    • {f.name}
                  </li>
                ))}
              </ul>
            )}
            <Field
              label="Loại đề"
              required
              placeholder="Loại đề (vd: TOPIK II)"
              value={examKind}
              onChange={(e) => setExamKind(e.target.value)}
            />
            <Field
              label="Kỳ thi"
              required
              placeholder="Kỳ thi (vd: 64회 읽기)"
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
            />
          </>
        ) : (
          <>
            {supportsTextMode && (
              <div role="group" aria-label="Cách nhập" className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["file", "Tải file (ảnh/PDF/text)", FileUp],
                    ["text", "Dán văn bản", FileText],
                  ] as const
                ).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={textMode === mode}
                    onClick={() => setTextMode(mode)}
                    className={cn(
                      "flex min-h-10 items-center justify-center gap-1.5 rounded-full border px-2 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue/50",
                      textMode === mode
                        ? "border-transparent bg-blue text-primary-foreground"
                        : "border-glass-edge bg-glass-row text-ink-2",
                    )}
                  >
                    <Icon size={13} strokeWidth={2.4} /> {label}
                  </button>
                ))}
              </div>
            )}

            {supportsTextMode && textMode === "text" ? (
              <textarea
                required
                rows={7}
                aria-label="Nội dung dán vào"
                placeholder="Dán lời thoại/phụ đề vào đây, mỗi câu một dòng (không cần mã thời gian)…"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className={cn(FIELD, "font-korean")}
              />
            ) : (
              <input
                type="file"
                required
                aria-label="Tệp tải lên"
                accept="image/png,image/jpeg,image/webp,application/pdf,.txt,.srt,.vtt,text/plain"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className={cn(FIELD, FILE_FIELD)}
              />
            )}
            {kind === "corpus" && textMode === "file" && (
              <p className="text-[12px] font-medium leading-4 text-ink-2">
                Chấp nhận tệp .srt/.vtt, ảnh chụp phụ đề (Gemini sẽ tự nhận diện chữ), hoặc tệp
                .txt/text thuần.
              </p>
            )}
          </>
        )}

        {kind === "corpus" && (
          <Field
            label="Tên phim"
            required
            placeholder="Tên phim (vd: Reply 1988)"
            value={filmTitle}
            onChange={(e) => setFilmTitle(e.target.value)}
          />
        )}
        {mutation.isError && (
          <p role="alert" className="text-xs font-semibold text-danger">
            {errorMessage(mutation.error)}
          </p>
        )}
        <button type="submit" disabled={mutation.isPending} className={cn(BTN.primary, "w-full")}>
          {mutation.isPending && <Loader2 size={15} strokeWidth={2.4} className="animate-spin" />}
          {mutation.isPending ? "Đang tải lên…" : "Tải lên & trích xuất bằng Gemini"}
        </button>
      </form>
    </GlassPanel>
  );
}

// ----------------------------------------------------------- review: one row --
type PayloadParse = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

function parsePayload(text: string): PayloadParse {
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: "Payload phải là một object { … }" };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không đọc được JSON" };
  }
}

/** The JSON editor for one item. It is only mounted while open, so the
 * pretty-printed payload of a long batch is not built for every row up front,
 * and its text state lives here — typing never re-renders the list. */
function PayloadEditor({
  id,
  payload,
  busy,
  onSave,
}: {
  id: string;
  payload: Record<string, unknown>;
  busy: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const canonical = useMemo(() => JSON.stringify(payload, null, 2), [payload]);
  const [text, setText] = useState(canonical);
  // The server's copy changed (e.g. right after a save): show it, reformatted.
  const [seen, setSeen] = useState(canonical);
  if (seen !== canonical) {
    setSeen(canonical);
    setText(canonical);
  }
  const parsed = useMemo(() => parsePayload(text), [text]);
  const dirty = text !== canonical;

  return (
    <div className="mt-2 space-y-2">
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label="Payload JSON"
        aria-invalid={!parsed.ok}
        aria-describedby={`${id}-state`}
        className={cn(
          FIELD,
          "rounded-[12px] p-2.5 font-mono text-[16px] leading-5 md:text-xs",
          !parsed.ok && "border-danger focus:border-danger focus:ring-danger/30",
        )}
      />
      <p
        id={`${id}-state`}
        aria-live="polite"
        className={cn(
          "break-words text-[12px] font-semibold leading-4",
          parsed.ok ? "text-ink-2" : "text-danger",
        )}
      >
        {parsed.ok
          ? dirty
            ? "JSON hợp lệ — chưa lưu"
            : "Khớp với bản đã lưu"
          : `JSON chưa hợp lệ: ${parsed.error}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !dirty || !parsed.ok}
          onClick={() => parsed.ok && onSave(parsed.value)}
          className={cn(BTN.primary, BTN_SM)}
        >
          {busy && <Loader2 size={13} strokeWidth={2.4} className="animate-spin" />}
          Lưu payload
        </button>
        {dirty && (
          <button type="button" onClick={() => setText(canonical)} className={cn(BTN.soft, BTN_SM)}>
            <RotateCcw size={12} strokeWidth={2.4} /> Hoàn nguyên
          </button>
        )}
      </div>
    </div>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const tone = pct >= 85 ? "bg-green" : pct >= 60 ? "bg-yellow-strong" : "bg-danger";
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-ink-2">
      <span className="sr-only">Độ tin cậy</span>
      <span aria-hidden="true" className="h-1.5 w-9 overflow-hidden rounded-full bg-progress">
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums">{pct}%</span>
    </span>
  );
}

interface ItemRowProps {
  item: ImportItemOut;
  busy: boolean;
  leaving: boolean;
  onPatch: (id: string, body: ImportItemPatch) => void;
  /** exam_item only: the passage card its passage_ref points at */
  passage?: ImportItemOut | undefined;
  /** exam_item only: where the batch's answers came from (file / paper / manual) */
  keySource?: string | undefined;
}

/** memo: the batch re-renders on every job-progress tick while it is being
 * confirmed; rows only re-render when their own item / busy / leaving change. */
const ItemRow = memo(function ItemRow({
  item,
  busy,
  leaving,
  onPatch,
  passage,
  keySource,
}: ItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const editorId = useId();
  const st = ITEM_STATUS[item.status];
  const examCard = item.kind === "exam_item" || item.kind === "exam_passage";

  return (
    <LeaveTransition leaving={leaving}>
      <div
        data-status={item.status}
        className={cn(
          "rounded-[16px] border p-3 shadow-[inset_0_1px_0_0_var(--glass-shine)] transition-colors duration-300",
          st.row,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold">
              <span className={cn("rounded-full px-2 py-0.5", st.pill)}>{st.label}</span>
              <span className="uppercase tracking-wide text-ink-2">
                {ITEM_KIND_LABEL[item.kind] ?? item.kind}
              </span>
              <ConfidenceMeter value={item.confidence} />
            </div>
            {!examCard && (
              <p className="mt-1.5 line-clamp-3 break-words text-sm font-semibold leading-5">
                {summarize(item)}
              </p>
            )}
            <ChunkReviewNote item={item} />
            {item.kind === "corpus_item" && typeof item.payload?.["meaning_vi"] === "string" && (
              <p className="mt-1 line-clamp-2 break-words text-xs font-medium leading-5 text-ink-2">
                {item.payload["meaning_vi"]}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={editorId}
            onClick={() => setExpanded((v) => !v)}
            className={cn(BTN.soft, BTN_SM, "shrink-0")}
          >
            {expanded ? "Ẩn JSON" : "Sửa JSON"}
          </button>
        </div>
        {/* An exam card needs the full width (Korean text, four options): it sits
            under the header row instead of beside the button. */}
        {item.kind === "exam_item" && (
          <ExamItemBody
            item={item}
            passage={passage}
            keySource={keySource}
            onPatch={onPatch}
            busy={busy}
          />
        )}
        {item.kind === "exam_passage" && (
          <ExamPassageBody item={item} onPatch={onPatch} busy={busy} />
        )}
        {expanded && (
          <PayloadEditor
            id={editorId}
            payload={item.payload}
            busy={busy}
            onSave={(payload) => onPatch(item.id, { payload })}
          />
        )}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy || item.status === "confirmed"}
            onClick={() => onPatch(item.id, { status: "confirmed" })}
            className={BTN.ok}
          >
            <CheckCircle2 size={15} strokeWidth={2.4} /> Xác nhận
          </button>
          <button
            type="button"
            disabled={busy || item.status === "rejected"}
            onClick={() => onPatch(item.id, { status: "rejected" })}
            className={BTN.soft}
          >
            <Ban size={14} strokeWidth={2.4} /> Từ chối
          </button>
        </div>
      </div>
    </LeaveTransition>
  );
});

// ------------------------------------------------------------ review: a batch --
function BatchDetail({ batchId }: { batchId: string }) {
  const qc = useQueryClient();
  const itemsKey = useMemo(() => ["importItems", batchId] as const, [batchId]);
  const [confirmJobId, setConfirmJobId] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<ItemFilter | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const { exiting, startExit } = useExiting();

  const batchQ = useQuery({
    queryKey: ["importBatch", batchId],
    queryFn: () => getImportBatch(batchId),
    refetchInterval: 3000,
  });
  const batch = batchQ.data;
  const working = !!batch && BATCH_WORKING.has(batch.status);
  const itemsQ = useQuery({
    queryKey: itemsKey,
    queryFn: () => listImportItems(batchId),
    // Gemini is still writing the proposals: keep pulling them in.
    refetchInterval: working ? 3000 : false,
  });
  // exam-v2 stores a hidden "summary" item (how the paper was read): it is the
  // header of the batch, not a card to review, so it never enters the counts.
  const { summary: examSummary, items } = useMemo(
    () => splitExamItems(itemsQ.data ?? []),
    [itemsQ.data],
  );
  const isExam = batch?.kind === "exam_paper";
  const passageByRef = useMemo(() => {
    const map = new Map<string, ImportItemOut>();
    for (const i of items) {
      if (i.kind === "exam_passage" && typeof i.payload?.["local_ref"] === "string") {
        map.set(i.payload["local_ref"], i);
      }
    }
    return map;
  }, [items]);
  const keySource = keySourceOf(examSummary);
  // pages the paper was read from: the page viewer warns when the file picked has another count
  const examPages =
    isExam && typeof examSummary?.payload?.["pages"] === "number"
      ? examSummary.payload["pages"]
      : null;
  const examBulk = useMemo(() => (isExam ? examBulkTargets(items) : null), [isExam, items]);
  const examQuestions = useMemo(
    () => items.filter((i) => i.kind === "exam_item" && i.status !== "rejected"),
    [items],
  );
  const examAnswered = useMemo(
    () => examQuestions.filter((i) => typeof i.payload?.["answer"] === "number").length,
    [examQuestions],
  );

  const counts = useMemo(() => {
    const c = { pending: 0, flagged: 0, confirmed: 0, rejected: 0 };
    for (const i of items) {
      if (isPending(i.status)) {
        c.pending++;
        if (i.status !== "pending") c.flagged++;
      } else if (i.status === "confirmed") c.confirmed++;
      else c.rejected++;
    }
    return c;
  }, [items]);
  const reviewed = counts.confirmed + counts.rejected;

  // First time the items are here: start on the queue if there is one, else on everything.
  if (filterState === null && itemsQ.isSuccess) {
    setFilterState(counts.pending > 0 ? "pending" : "all");
  }
  const filter: ItemFilter = filterState ?? "all";

  const refreshBatch = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["importBatch", batchId] });
    qc.invalidateQueries({ queryKey: itemsKey });
  }, [qc, batchId, itemsKey]);

  // One mutation for every row: a row shows "busy" only for its own request.
  const patchM = useMutation({
    mutationFn: (v: { id: string; body: ImportItemPatch }) =>
      patchImportItem(batchId, v.id, v.body),
    onMutate: (v) => setBusy((prev) => new Set(prev).add(v.id)),
    onSuccess: (updated, v) => {
      qc.setQueryData<ImportItemOut[]>(itemsKey, (old) =>
        old?.map((i) => (i.id === updated.id ? updated : i)),
      );
      qc.invalidateQueries({ queryKey: ["importBatch", batchId] });
      if (v.body.payload) toast.success("Đã lưu payload");
      // The row just left the current view: let it glide out first.
      if (v.body.status && !matchesFilter(updated.status, filter)) startExit(updated.id);
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: (_data, _err, v) =>
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(v.id);
        return next;
      }),
  });
  const { mutate: patchItem } = patchM;
  const onPatch = useCallback(
    (id: string, body: ImportItemPatch) => patchItem({ id, body }),
    [patchItem],
  );

  const confirmM = useMutation({
    mutationFn: () => confirmImportBatch(batchId),
    onSuccess: (res) => setConfirmJobId(res.job_id),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const rollbackM = useMutation({
    mutationFn: () => rollbackImportBatch(batchId),
    onSuccess: () => {
      refreshBatch();
      toast.success("Đã hoàn tác lô");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const confirmJob = useJobEvents(confirmJobId);
  const notified = useRef<string | null>(null);
  useEffect(() => {
    if (!confirmJobId || !confirmJob.status) return;
    const key = `${confirmJobId}:${confirmJob.status}`;
    if (notified.current === key) return;
    if (confirmJob.status === "succeeded") {
      notified.current = key;
      refreshBatch();
      toast.success("Đã ghi dữ liệu vào hệ thống");
    } else if (confirmJob.status === "failed") {
      notified.current = key;
      toast.error(confirmJob.error ?? "Ghi dữ liệu thất bại");
    }
  }, [confirmJob.status, confirmJob.error, confirmJobId, refreshBatch]);

  /** "Duyệt nhanh toàn bộ" — the per-item Xác nhận/Từ chối buttons below
   * are for when a reviewer actually wants to check each proposal, but
   * that's laborious for a batch with dozens of vocab/grammar items that
   * are all high-confidence. This marks every still-pending/flagged item
   * confirmed in one shot, then immediately calls the same batch-confirm
   * job — so a lesson doesn't end up half-applied (only the first few
   * items a reviewer got through by hand) while the rest sit unreviewed.
   * The PATCHes run a few at a time (a subtitle batch can hold hundreds) and
   * the first failure stops the run before anything is confirmed. */
  const bulkM = useMutation({
    mutationFn: async () => {
      const current = splitExamItems(qc.getQueryData<ImportItemOut[]>(itemsKey) ?? []).items;
      // On an exam paper only clean cards are confirmed in bulk: a flagged one
      // (withheld passage, missing passage, differing reads…) needs a person.
      const todo = isExam ? examBulkTargets(current) : current.filter((i) => isPending(i.status));
      setBulk({ done: 0, total: todo.length });
      const run = { next: 0, done: 0, failure: null as unknown };
      const worker = async () => {
        while (run.failure === null) {
          const item = todo[run.next++];
          if (!item) return;
          try {
            await patchImportItem(batchId, item.id, { status: "confirmed" });
            run.done++;
            setBulk({ done: run.done, total: todo.length });
          } catch (e) {
            run.failure = e;
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(BULK_CONCURRENCY, todo.length) }, () => worker()),
      );
      if (run.failure !== null) throw run.failure;
      return confirmImportBatch(batchId);
    },
    onSuccess: (res) => setConfirmJobId(res.job_id),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => {
      setBulk(null);
      qc.invalidateQueries({ queryKey: itemsKey });
    },
  });

  function startBulk() {
    // Flagged (yellow/red) items are confirmed too — say so before writing.
    // (Not on an exam paper: there only the clean cards are confirmed.)
    if (!isExam && counts.flagged > 0) setBulkOpen(true);
    else bulkM.mutate();
  }
  const bulkCount = examBulk ? examBulk.length : counts.pending;

  const shown = useMemo(
    () => items.filter((i) => matchesFilter(i.status, filter) || exiting.has(i.id)),
    [items, filter, exiting],
  );
  const page = shown.slice(0, visible);
  const total = items.length;
  const reviewPct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  const confirmBusy = confirmM.isPending || bulkM.isPending;

  const chooseFilter = (next: ItemFilter) => {
    setFilterState(next);
    setVisible(PAGE_SIZE);
  };
  const countOf = (f: ItemFilter) =>
    f === "all" ? total : f === "pending" ? counts.pending : counts[f];

  const confirmCard = confirmJobId ? jobCard(confirmJob, "Đang ghi dữ liệu…", "Đã ghi xong") : null;

  return (
    <ExamSourceProvider expectedPages={examPages}>
      <GlassPanel id="studio-review">
        <PanelTitle
          aside={
            <button
              type="button"
              disabled={rollbackM.isPending || !batch || batch.status === "rolled_back"}
              onClick={() => setRollbackOpen(true)}
              className={cn(BTN.soft, BTN_SM, "shrink-0")}
            >
              <Undo2 size={14} strokeWidth={2.2} /> Hoàn tác
            </button>
          }
        >
          Lô {batch ? KIND_SHORT[batch.kind] : ""} #{batchId.slice(0, 6)}
        </PanelTitle>
        <div className="mt-1.5 flex min-w-0 items-center gap-2">
          {batch && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                KIND_BADGE[batch.kind],
              )}
            >
              {STATUS_LABEL[batch.status] ?? batch.status}
            </span>
          )}
          {batch?.source_file && (
            <p className="min-w-0 truncate text-xs font-medium text-ink-2">{batch.source_file}</p>
          )}
        </div>

        {/* Where the review stands — always visible, never animated. */}
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-[12px] font-semibold text-ink-2">
            <span>
              Đã duyệt {reviewed}/{total}
            </span>
            <span className="tabular-nums">{reviewPct}%</span>
          </div>
          <LiquidBar
            pct={reviewPct}
            label="Tiến độ duyệt"
            tone={total > 0 && reviewed === total ? "done" : "busy"}
            animated={false}
            className="mt-1.5"
          />
        </div>

        <div role="group" aria-label="Lọc mục" className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => chooseFilter(f.id)}
              className={cn(
                "hit-area shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue/50",
                filter === f.id
                  ? "border-transparent bg-blue text-primary-foreground"
                  : "border-glass-edge bg-glass-row text-ink-2",
              )}
            >
              {f.label} <span className="tabular-nums opacity-80">{countOf(f.id)}</span>
            </button>
          ))}
        </div>

        {isExam && <ExamOverview summary={examSummary} items={items} />}
        {isExam && !working && total > 0 && batch?.status !== "rolled_back" && (
          <ExamAnswersPanel
            batchId={batchId}
            answered={examAnswered}
            total={examQuestions.length}
            onApplied={refreshBatch}
          />
        )}

        <details className="mt-2 text-[12px] font-medium leading-4 text-ink-2">
          <summary className="cursor-pointer select-none font-semibold">
            "Duyệt nhanh" là gì?
          </summary>
          {isExam ? (
            <p className="mt-1">
              "Duyệt nhanh" chỉ xác nhận các thẻ không có cờ (câu hỏi chỉ được xác nhận cùng đoạn
              văn của nó) rồi ghi vào hệ thống. Thẻ có cờ — đoạn văn không công bố, thiếu đoạn văn,
              hai lượt đọc khác nhau… — vẫn chờ bạn xem từng thẻ và bấm "Xác nhận" hoặc "Từ chối".
            </p>
          ) : (
            <p className="mt-1">
              "Duyệt nhanh" xác nhận luôn mọi mục còn chờ (kể cả mục bị gắn cờ vàng/đỏ) rồi ghi vào
              hệ thống ngay — dùng khi bạn đã tin các đề xuất của Gemini, không cần sửa từng mục.
              Muốn kiểm tra kỹ thì bấm "Sửa JSON"/"Từ chối" cho từng mục bên dưới trước khi xác nhận
              lô.
            </p>
          )}
        </details>

        {(confirmCard || bulk) && (
          <div className="mt-3 space-y-2">
            {bulk && (
              <ProgressCard
                title="Đang duyệt nhanh…"
                pct={bulk.total > 0 ? Math.round((bulk.done / bulk.total) * 100) : null}
                message={`${bulk.done}/${bulk.total} mục đã xác nhận`}
              />
            )}
            {confirmCard && (
              <ProgressCard
                {...confirmCard}
                onDismiss={confirmCard.tone === "busy" ? undefined : () => setConfirmJobId(null)}
              />
            )}
          </div>
        )}

        {itemsQ.isLoading || (working && total === 0) ? (
          <div className="mt-3">
            <PanelLoading
              rows={3}
              label={
                working ? "Gemini đang trích xuất, các mục sẽ hiện ở đây…" : "Đang tải các mục…"
              }
            />
            {working && (
              <p className="mt-2 text-center text-[12px] font-semibold text-ink-2">
                Gemini đang trích xuất — các mục sẽ tự hiện ở đây.
              </p>
            )}
          </div>
        ) : itemsQ.isError ? (
          <PanelError
            className="mt-3"
            message={errorMessage(itemsQ.error)}
            onRetry={() => itemsQ.refetch()}
            retrying={itemsQ.isFetching}
          />
        ) : total === 0 ? (
          <PanelEmpty
            className="mt-3"
            title="Lô này chưa có mục nào"
            hint="Gemini không tìm thấy nội dung để trích xuất. Thử tải lại một file rõ hơn."
          />
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {page.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  busy={busy.has(item.id)}
                  leaving={exiting.has(item.id) && !matchesFilter(item.status, filter)}
                  onPatch={onPatch}
                  passage={
                    item.kind === "exam_item" && typeof item.payload?.["passage_ref"] === "string"
                      ? passageByRef.get(item.payload["passage_ref"])
                      : undefined
                  }
                  keySource={item.kind === "exam_item" ? keySource : undefined}
                />
              ))}
            </ul>
            {shown.length === 0 && (
              <PanelEmpty
                className="mt-3"
                title={
                  filter === "pending"
                    ? "Đã duyệt hết các mục chờ"
                    : "Không có mục nào trong nhóm này"
                }
                hint={
                  filter === "pending"
                    ? "Bấm “Xác nhận lô” bên dưới để ghi vào hệ thống."
                    : "Chọn nhóm khác ở trên để xem các mục còn lại."
                }
                action={
                  filter !== "all" ? (
                    <button
                      type="button"
                      onClick={() => chooseFilter("all")}
                      className={cn(BTN.soft, BTN_SM)}
                    >
                      Xem tất cả
                    </button>
                  ) : undefined
                }
              />
            )}
            {shown.length > page.length && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisible((n) => n + PAGE_SIZE)}
                  className={cn(BTN.soft, BTN_SM)}
                >
                  Hiện thêm {Math.min(PAGE_SIZE, shown.length - page.length)} mục (còn{" "}
                  {shown.length - page.length})
                </button>
              </div>
            )}
          </>
        )}

        {/* Floating action bar: stays at the bottom of the screen while a long
          list scrolls under it (the only blurred layer in this panel). */}
        <div className="glass-panel-strong sticky bottom-[max(12px,env(safe-area-inset-bottom))] z-20 mt-3 flex gap-2 rounded-[22px] p-2">
          <button
            type="button"
            disabled={confirmBusy || bulkCount === 0}
            onClick={startBulk}
            className={cn(BTN.warn, "flex-1 whitespace-nowrap px-3")}
          >
            <Zap size={15} strokeWidth={2.2} />
            {bulkM.isPending ? "Đang duyệt…" : `Duyệt nhanh (${bulkCount})`}
          </button>
          <button
            type="button"
            disabled={confirmBusy || total === 0}
            onClick={() => confirmM.mutate()}
            className={cn(BTN.primary, "flex-1 whitespace-nowrap px-3")}
          >
            {confirmM.isPending ? (
              <Loader2 size={15} strokeWidth={2.4} className="animate-spin" />
            ) : (
              <ShieldCheck size={15} strokeWidth={2.2} />
            )}
            Xác nhận lô
          </button>
        </div>

        <ConfirmDialog
          open={rollbackOpen}
          onOpenChange={setRollbackOpen}
          title="Hoàn tác lô này?"
          description="Những mục lô này đã ghi vào hệ thống sẽ được gỡ lại. Bạn chắc chắn muốn hoàn tác?"
          confirmLabel="Hoàn tác lô"
          tone="danger"
          onConfirm={() => rollbackM.mutate()}
        />
        <ConfirmDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          title={`Duyệt nhanh ${counts.pending} mục?`}
          description={`${counts.flagged} mục đang bị gắn cờ vàng/đỏ cũng sẽ được xác nhận và ghi vào hệ thống ngay.`}
          confirmLabel="Duyệt & ghi"
          tone="warn"
          onConfirm={() => bulkM.mutate()}
        />
      </GlassPanel>
    </ExamSourceProvider>
  );
}

// ------------------------------------------------------ RSS candidate / sources --
/** RSS auto-discovery only ever proposes a candidate here — nothing
 * publishes without an admin picking "Duyệt & nhập" (which routes
 * through the exact same import_batch/Gemini-extract/review-queue flow
 * as a manually-typed URL) or "Bỏ qua" to dismiss it. Runs every 6h via
 * Celery beat, so this queue can be empty for a while after a source is
 * first registered — that's expected, not a bug. */
function EditorialCandidatesPanel({
  onQueued,
}: {
  onQueued: (batchId: string, jobId: string) => void;
}) {
  const qc = useQueryClient();
  const candidatesQ = useQuery({
    queryKey: ["editorialCandidates"],
    queryFn: () => listEditorialCandidates({ status: "new" }),
    refetchInterval: 60_000,
  });
  const { exiting, gone, startExit } = useExiting();
  const refresh = useCallback(
    () => qc.invalidateQueries({ queryKey: ["editorialCandidates"] }),
    [qc],
  );

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissEditorialCandidate(id),
    onSuccess: (_res, id) => startExit(id, refresh),
  });
  const ingest = useMutation({
    mutationFn: (id: string) => ingestEditorialCandidate(id),
    onSuccess: (res, id) => {
      onQueued(res.import_batch_id, res.job_id);
      startExit(id, refresh);
    },
  });
  // Fire-and-forget on the backend (no job/id to poll — see the task's own
  // docstring), so there's nothing to await here: kick it off, give feedparser
  // a few seconds to actually hit every RSS source, then refetch the list.
  const discover = useMutation({
    mutationFn: () => triggerEditorialDiscovery(),
    onSuccess: () => {
      toast.info("Đang quét RSS các nguồn báo…");
      setTimeout(refresh, 5000);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const candidates = (candidatesQ.data ?? []).filter((c) => !gone.has(c.id));
  const working = ingest.isPending || dismiss.isPending;

  return (
    <GlassPanel id="studio-candidates">
      <PanelTitle
        icon={<Radio size={17} strokeWidth={2.2} />}
        aside={
          <button
            type="button"
            disabled={discover.isPending}
            onClick={() => discover.mutate()}
            className={cn(BTN.soft, BTN_SM, "shrink-0")}
          >
            <RotateCcw
              size={12}
              strokeWidth={2.4}
              className={discover.isPending ? "animate-spin" : ""}
            />
            {discover.isPending ? "Đang quét…" : "Quét ngay"}
          </button>
        }
      >
        Bài chờ duyệt (RSS tự động)
      </PanelTitle>
      <p className="mt-1 text-[12px] font-medium leading-4 text-ink-2">
        Hệ thống tự quét RSS mỗi 6 giờ để đề xuất bài mới — không tự đăng, bạn vẫn phải duyệt từng
        bài.
      </p>

      {candidatesQ.isLoading && <PanelLoading label="Đang tải bài chờ duyệt…" />}
      {candidatesQ.isError && (
        <PanelError
          className="mt-3"
          message={errorMessage(candidatesQ.error)}
          onRetry={() => candidatesQ.refetch()}
          retrying={candidatesQ.isFetching}
        />
      )}
      {candidatesQ.isSuccess && candidates.length === 0 && (
        <PanelEmpty
          className="mt-3"
          title="Chưa có bài nào chờ duyệt"
          hint="Nếu đang gấp, chọn “Bài báo (URL)” ở khung tải lên phía trên để nhập tay một bài ngay."
        />
      )}

      <ul className="mt-3 space-y-2">
        {candidates.map((c) => (
          <LeaveTransition key={c.id} leaving={exiting.has(c.id)}>
            <div className="rounded-[16px] border border-glass-edge bg-glass-row p-3 shadow-[inset_0_1px_0_0_var(--glass-shine)]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                {c.source_name}
              </p>
              <p className="font-korean mt-0.5 text-sm font-semibold leading-5">{c.title_en}</p>
              {c.snippet_en && (
                <p className="font-korean mt-1 line-clamp-2 text-xs leading-5 text-ink-2">
                  {c.snippet_en}
                </p>
              )}
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={working}
                  onClick={() => ingest.mutate(c.id)}
                  className={BTN.ok}
                >
                  <CheckCircle2 size={14} strokeWidth={2.4} /> Duyệt & nhập
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => dismiss.mutate(c.id)}
                  className={BTN.soft}
                >
                  <Ban size={14} strokeWidth={2.4} /> Bỏ qua
                </button>
              </div>
            </div>
          </LeaveTransition>
        ))}
      </ul>
      {(dismiss.isError || ingest.isError) && (
        <p role="alert" className="mt-2 text-xs font-semibold text-danger">
          {errorMessage(dismiss.error ?? ingest.error)}
        </p>
      )}
    </GlassPanel>
  );
}

/** Registered RSS outlets discover_editorial_candidates polls. Nothing
 * ships pre-seeded with a guaranteed-live feed — an admin adds each
 * source's own verified rss_url here (a source with no rss_url or
 * active=false is simply skipped by the periodic task). */
function EditorialSourcesPanel() {
  const qc = useQueryClient();
  const sourcesQ = useQuery({ queryKey: ["editorialSources"], queryFn: listEditorialSources });
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [rssUrl, setRssUrl] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createEditorialSource({
        name: name.trim(),
        base_url: baseUrl.trim(),
        rss_url: rssUrl.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["editorialSources"] });
      toast.success("Đã lưu nguồn báo");
      setName("");
      setBaseUrl("");
      setRssUrl("");
      setShowForm(false);
    },
  });

  const sources = sourcesQ.data ?? [];

  return (
    <GlassPanel id="studio-sources">
      <PanelTitle
        icon={<Newspaper size={17} strokeWidth={2.2} />}
        aside={
          <button
            type="button"
            aria-expanded={showForm}
            onClick={() => setShowForm((v) => !v)}
            className={cn(BTN.soft, BTN_SM, "shrink-0")}
          >
            <Plus size={12} strokeWidth={2.4} /> Thêm nguồn
          </button>
        }
      >
        Nguồn báo đăng ký
      </PanelTitle>

      {showForm && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field
            label="Tên báo"
            required
            placeholder="Tên báo (vd: Kyunghyang)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Trang chủ"
            required
            type="url"
            placeholder="Trang chủ (https://…)"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          <Field
            label="RSS URL"
            type="url"
            placeholder="RSS URL (tuỳ chọn)"
            value={rssUrl}
            onChange={(e) => setRssUrl(e.target.value)}
          />
          <p className="px-1 text-[12px] font-medium leading-4 text-ink-2">
            Để trống nếu chưa có RSS — nguồn này chỉ dùng để nhập tay bằng URL.
          </p>
          {create.isError && (
            <p role="alert" className="text-xs font-semibold text-danger">
              {errorMessage(create.error)}
            </p>
          )}
          <button type="submit" disabled={create.isPending} className={cn(BTN.primary, "w-full")}>
            {create.isPending && <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />}
            {create.isPending ? "Đang lưu…" : "Lưu nguồn báo"}
          </button>
        </form>
      )}

      {sourcesQ.isLoading && <PanelLoading rows={2} label="Đang tải nguồn báo…" />}
      {sourcesQ.isError && (
        <PanelError
          className="mt-3"
          message={errorMessage(sourcesQ.error)}
          onRetry={() => sourcesQ.refetch()}
          retrying={sourcesQ.isFetching}
        />
      )}
      {sourcesQ.isSuccess && sources.length === 0 && (
        <PanelEmpty
          className="mt-3"
          title="Chưa đăng ký nguồn báo nào"
          hint="Thêm một nguồn có RSS để hệ thống tự đề xuất bài mới mỗi 6 giờ."
          action={
            !showForm ? (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className={cn(BTN.primary, BTN_SM)}
              >
                <Plus size={13} strokeWidth={2.4} /> Thêm nguồn đầu tiên
              </button>
            ) : undefined
          }
        />
      )}

      {sources.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-[14px] border border-glass-edge bg-glass-row px-3 py-2.5 shadow-[inset_0_1px_0_0_var(--glass-shine)]"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{s.name}</p>
                <p className="truncate text-[12px] font-semibold text-ink-2">
                  {s.rss_url ? "Có RSS · quét tự động" : "Chưa có RSS · chỉ nhập tay bằng URL"}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  s.active ? "bg-green-soft text-ink" : "bg-progress text-ink-2",
                )}
              >
                {s.active ? "Đang bật" : "Đã tắt"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}

// ------------------------------------------------------------ recent batches --
const RECENT_COLLAPSED = 6;

function RecentBatchesPanel({
  activeBatchId,
  onSelect,
}: {
  activeBatchId: string | null;
  onSelect: (batchId: string) => void;
}) {
  const batchesQ = useQuery({
    queryKey: ["importBatches"],
    queryFn: () => listImportBatches(),
    refetchInterval: 5000,
  });
  const [showAll, setShowAll] = useState(false);
  const all: ImportBatchOut[] = batchesQ.data ?? [];
  const list = showAll ? all : all.slice(0, RECENT_COLLAPSED);

  return (
    <GlassPanel id="studio-batches">
      <PanelTitle icon={<History size={17} strokeWidth={2.2} />}>Lô gần đây</PanelTitle>
      {batchesQ.isLoading && <PanelLoading label="Đang tải các lô…" />}
      {batchesQ.isError && (
        <PanelError
          className="mt-3"
          message={errorMessage(batchesQ.error)}
          onRetry={() => batchesQ.refetch()}
          retrying={batchesQ.isFetching}
        />
      )}
      {batchesQ.isSuccess && all.length === 0 && (
        <PanelEmpty
          className="mt-3"
          title="Chưa có lô nào"
          hint="Tải một file hoặc dán URL bài báo ở khung đầu trang — lô mới sẽ hiện ở đây."
        />
      )}
      {list.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {list.map((b) => {
            const active = activeBatchId === b.id;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => onSelect(b.id)}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-2.5 rounded-[16px] border px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue/50",
                    active
                      ? "border-blue/50 bg-blue-soft/80 ring-2 ring-blue/30"
                      : "border-glass-edge bg-glass-row",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      KIND_BADGE[b.kind],
                    )}
                  >
                    {KIND_SHORT[b.kind]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">
                      {b.source_file ?? `Lô #${b.id.slice(0, 6)}`}
                    </span>
                    <span className="block truncate text-[12px] font-semibold text-ink-2">
                      {formatWhen(b.created_at)} · {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                  </span>
                  {b.flagged_count > 0 && (
                    <span className="shrink-0 rounded-full bg-yellow-soft px-2 py-0.5 text-[11px] font-semibold text-ink">
                      ⚑ {b.flagged_count}
                    </span>
                  )}
                  <ChevronRight size={16} strokeWidth={2.4} className="shrink-0 text-ink-2" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {all.length > RECENT_COLLAPSED && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className={cn(BTN.soft, BTN_SM)}
          >
            {showAll ? "Thu gọn" : `Xem tất cả ${all.length} lô`}
          </button>
        </div>
      )}
    </GlassPanel>
  );
}

// ----------------------------------------------------------------- dashboard --
/** Section anchors the top nav's quick-jump chips scroll to — Studio is
 * one long scrolling page (no separate routes per panel), so "navigation"
 * here means getting back to the learner app and jumping between panels,
 * not switching pages. */
const STUDIO_SECTIONS = [
  { id: "studio-upload", label: "Tải lên" },
  { id: "studio-candidates", label: "RSS chờ duyệt" },
  { id: "studio-sources", label: "Nguồn báo" },
  { id: "studio-corpus", label: "Kho câu" },
  { id: "studio-batches", label: "Lô gần đây" },
] as const;

function StudioNav({
  role,
  onLogout,
  reviewing,
}: {
  role: string;
  onLogout: () => void;
  reviewing: boolean;
}) {
  const sections = reviewing
    ? [...STUDIO_SECTIONS, { id: "studio-review", label: "Đang duyệt" }]
    : STUDIO_SECTIONS;
  return (
    <nav
      aria-label="Điều hướng Studio"
      className="glass-panel sticky top-[max(8px,env(safe-area-inset-top))] z-30 -mx-1 mb-4 rounded-[22px] px-3 py-2"
    >
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/support-language"
          className="hit-area flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-2"
        >
          <ArrowLeft size={15} strokeWidth={2.4} /> Về ứng dụng
        </Link>
        <span className="shrink-0 rounded-full bg-yellow-soft px-2 py-0.5 text-[11px] font-semibold text-ink">
          {role === "admin" ? "Admin" : "Biên tập viên"}
        </span>
        <button
          type="button"
          onClick={onLogout}
          className="hit-area flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-2"
        >
          <LogOut size={15} strokeWidth={2.4} /> Đăng xuất
        </button>
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => {
              // Smooth scroll without pushing a history entry per chip (Back
              // should leave Studio, not walk through the anchors).
              e.preventDefault();
              jumpTo(s.id);
            }}
            className={cn(
              "hit-area shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue/50",
              s.id === "studio-review"
                ? "border-transparent bg-blue text-primary-foreground"
                : "border-glass-edge bg-glass-row text-ink-2",
            )}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function StudioDashboard() {
  const auth = useAuth();
  const [extractJobId, setExtractJobId] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const qc = useQueryClient();
  const extractJob = useJobEvents(extractJobId);
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (!extractJobId || !extractJob.status) return;
    const key = `${extractJobId}:${extractJob.status}`;
    if (notified.current === key) return;
    if (extractJob.status === "succeeded") {
      notified.current = key;
      // The batch now has its proposals: refresh the list AND the open batch
      // (its items were fetched while Gemini was still working).
      qc.invalidateQueries({ queryKey: ["importBatches"] });
      qc.invalidateQueries({ queryKey: ["importBatch"] });
      qc.invalidateQueries({ queryKey: ["importItems"] });
      setExtractJobId(null);
      toast.success("Đã trích xuất xong — mời bạn duyệt", {
        action: { label: "Xem lô", onClick: () => jumpTo("studio-review") },
      });
    } else if (extractJob.status === "failed") {
      notified.current = key;
      toast.error(extractJob.error ?? "Trích xuất thất bại");
    }
  }, [extractJob.status, extractJob.error, extractJobId, qc]);

  function handleLogout() {
    authApi.logout();
    auth.refresh();
    toast("Đã đăng xuất khỏi Studio");
  }

  const onQueued = (batchId: string, jobId: string) => {
    setExtractJobId(jobId);
    setActiveBatchId(batchId);
    qc.invalidateQueries({ queryKey: ["importBatches"] });
    toast.success("Đã nhận — Gemini đang trích xuất");
  };
  const selectBatch = (batchId: string) => {
    setActiveBatchId(batchId);
    jumpTo("studio-review");
  };

  const extractCard = extractJobId
    ? jobCard(extractJob, "Gemini đang trích xuất…", "Đã trích xuất xong")
    : null;

  return (
    <main className="mesh-backdrop mx-auto min-h-dvh max-w-[560px] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+4rem)] pt-[max(12px,env(safe-area-inset-top))] text-ink sm:px-5 lg:max-w-[1440px] lg:px-8 lg:pt-6">
      <StudioNav
        role={auth.profile?.role ?? "editor"}
        onLogout={handleLogout}
        reviewing={activeBatchId !== null}
      />
      <header className="flex items-center gap-3 px-1">
        <Mascot mood="reading" className="h-14 w-14 lg:h-16 lg:w-16" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold lg:text-2xl">Studio · Duyệt dữ liệu</h1>
          <p className="text-xs font-medium leading-5 text-ink-2 lg:text-[13px]">
            Nhập phụ đề phim, đề thi, bài báo — Gemini trích xuất, bạn duyệt trước khi vào hệ thống.
          </p>
        </div>
      </header>

      {/* phone: one column in working order; laptop: the tools on the left, the batch being
          reviewed on the right, where there is room for its long list of proposals */}
      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <UploadPanel onQueued={onQueued} />
          {extractCard && (
            <ProgressCard
              {...extractCard}
              onDismiss={extractCard.tone === "failed" ? () => setExtractJobId(null) : undefined}
            />
          )}
          <EditorialCandidatesPanel onQueued={onQueued} />
          <EditorialSourcesPanel />
          <CorpusEnrichmentPanel />
          <LessonImagesPanel />
        </div>
        <div className="mt-4 space-y-4 lg:sticky lg:top-[calc(env(safe-area-inset-top)+96px)] lg:mt-0 lg:max-h-[calc(100dvh-120px)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          <RecentBatchesPanel activeBatchId={activeBatchId} onSelect={selectBatch} />
          {activeBatchId ? (
            <BatchDetail key={activeBatchId} batchId={activeBatchId} />
          ) : (
            <div className="hidden flex-col items-center rounded-[24px] border border-dashed border-line px-6 py-10 text-center lg:flex">
              <Mascot mood="thinking" className="h-24 w-24" />
              <p className="mt-2 text-sm font-semibold">Chọn một lô để duyệt</p>
              <p className="mt-1 max-w-[36ch] text-xs font-medium leading-5 text-ink-2">
                Tải lên hoặc chọn một lô ở trên. Các đề xuất của Gemini sẽ hiện ở đây để bạn duyệt,
                sửa hoặc bỏ.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function NotAuthorizedPanel({ role, onLogout }: { role: string; onLogout: () => void }) {
  return (
    <main className="mesh-backdrop mx-auto flex min-h-dvh max-w-[390px] flex-col justify-center px-5 text-ink">
      <div className="glass-card flex flex-col items-center gap-3 rounded-[28px] p-6 text-center">
        <Mascot mood="comfort" className="h-16 w-16" />
        <h1 className="text-lg font-bold">Không có quyền truy cập Studio</h1>
        <p className="text-xs font-medium leading-5 text-ink-2">
          Tài khoản này có vai trò "{role}" — Studio chỉ dành cho tài khoản editor hoặc admin.
        </p>
        <div className="mt-1 flex w-full gap-2">
          <Link to="/support-language" className={cn(BTN.primary, "flex-1")}>
            <ArrowLeft size={14} strokeWidth={2.4} /> Về ứng dụng
          </Link>
          <button type="button" onClick={onLogout} className={cn(BTN.soft, "flex-1")}>
            <LogOut size={14} strokeWidth={2.4} /> Đăng xuất
          </button>
        </div>
      </div>
    </main>
  );
}

/** Studio is a separate operator-facing screen, deliberately outside the
 * learner tab-bar app — but it shares the same login state as the rest
 * of the app (via useAuth) rather than keeping its own disconnected
 * "authed" flag, and it checks the profile's actual role (not just "is
 * any token present") before showing the review queue. */
function StudioScreen() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <main className="mesh-backdrop mx-auto min-h-dvh max-w-[390px] px-5 pt-24">
        <LoadingBlocks
          blocks={["h-40 rounded-[24px]", "h-24 rounded-[24px]"]}
          label="Đang kiểm tra đăng nhập…"
        />
      </main>
    );
  }
  if (!auth.isAuthenticated) {
    return <LoginPanel onLoggedIn={() => auth.refresh()} />;
  }
  if (auth.profile?.role !== "admin" && auth.profile?.role !== "editor") {
    return (
      <NotAuthorizedPanel
        role={auth.profile?.role ?? "learner"}
        onLogout={() => {
          authApi.logout();
          auth.refresh();
        }}
      />
    );
  }
  return <StudioDashboard />;
}
