import {
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Loader2,
  Minus,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ExamSourceContext, type ExamSourceApi } from "@/components/haru/exam-source-context";
import { BTN, FIELD } from "@/components/haru/studio-kit";
import { openPaper, type PaperPages } from "@/lib/exam-source";
import { cn } from "@/lib/utils";

/* The original paper next to the cards. The reviewer picks the PDF (or page images)
 * they uploaded; it is opened in this browser only — nothing is sent anywhere — and a
 * card's "Xem trang N" shows page N of it in a sheet that stays open while the list
 * scrolls. The page numbers are the backend's: pages of the uploaded file(s), counted
 * from 1, not the numbers printed on the paper. */

const ZOOMS = [1, 1.5, 2.2] as const;
const SHEET_HEIGHT = "min(64dvh, 560px)";

function IconButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(BTN.soft, "!min-h-9 !w-9 !px-0")}
    >
      <Icon size={16} strokeWidth={2.4} />
    </button>
  );
}

/** One page, drawn onto a canvas at the width of its box (times the zoom). */
function PageCanvas({ paper, page, zoom }: { paper: PaperPages; page: number; zoom: number }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [drawing, setDrawing] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const target = canvas.current;
    if (!target || width <= 0) return;
    const abort = new AbortController();
    setDrawing(true);
    setFailed(false);
    paper
      .render(page, target, Math.round(width * zoom), abort.signal)
      .then(() => {
        if (!abort.signal.aborted) setDrawing(false);
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setFailed(true);
          setDrawing(false);
        }
      });
    return () => abort.abort();
  }, [paper, page, width, zoom]);

  return (
    <div ref={box} className="relative w-full overflow-auto rounded-[12px] bg-card/70">
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Trang ${page} của đề gốc`}
        data-testid="exam-page-canvas"
        className="block max-w-none"
      />
      {drawing && !failed && (
        <div className="absolute inset-0 grid place-items-center">
          <Loader2 size={20} className="animate-spin text-ink-2" aria-label="Đang vẽ trang" />
        </div>
      )}
      {failed && (
        <p role="alert" className="p-3 text-[12px] font-semibold text-danger">
          Không vẽ được trang này.
        </p>
      )}
    </div>
  );
}

/** Holds the chosen paper and the sheet that shows it; the cards below reach it
 * through `useExamSource()` (a stable function, so a page change never re-renders them). */
export function ExamSourceProvider({
  expectedPages,
  children,
}: {
  /** pages the extraction read (from the summary); null when unknown */
  expectedPages: number | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [zoomAt, setZoomAt] = useState(0);
  const [paper, setPaper] = useState<PaperPages | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<PaperPages | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const openPage = useCallback((next: number | null) => {
    if (next !== null && next >= 1) setPage(next);
    setOpen(true);
  }, []);
  const api = useMemo<ExamSourceApi>(() => ({ openPage }), [openPage]);

  useEffect(() => () => current.current?.dispose(), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = async (files: File[]) => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const next = await openPaper(files);
      current.current?.dispose();
      current.current = next;
      setPaper(next);
      setPage((p) => Math.min(Math.max(1, p), next.count));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không mở được tệp");
    } finally {
      setLoading(false);
      if (picker.current) picker.current.value = "";
    }
  };

  const zoom = ZOOMS[zoomAt] ?? 1;
  const count = paper?.count ?? 0;
  const mismatch =
    paper && expectedPages !== null && expectedPages > 0 && paper.count !== expectedPages;

  return (
    <ExamSourceContext.Provider value={api}>
      {children}
      {open && (
        <>
          {/* keeps the last cards reachable above the sheet */}
          <div aria-hidden="true" style={{ height: SHEET_HEIGHT }} />
          <div
            role="dialog"
            aria-modal="false"
            aria-label="Trang gốc của đề"
            style={{ maxHeight: SHEET_HEIGHT }}
            className="glass-panel-strong fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[520px] flex-col gap-2 rounded-t-[24px] p-3 pb-[max(12px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center gap-1.5">
              <FileSearch size={15} strokeWidth={2.4} className="shrink-0" />
              <p className="min-w-0 flex-1 text-xs font-semibold" aria-live="polite">
                {paper ? `Trang ${page} / ${count}` : "Trang gốc của đề"}
              </p>
              {paper && (
                <>
                  <IconButton
                    label="Trang trước"
                    icon={ChevronLeft}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  />
                  <IconButton
                    label="Trang sau"
                    icon={ChevronRight}
                    disabled={page >= count}
                    onClick={() => setPage((p) => Math.min(count, p + 1))}
                  />
                  <IconButton
                    label="Thu nhỏ"
                    icon={Minus}
                    disabled={zoomAt <= 0}
                    onClick={() => setZoomAt((z) => Math.max(0, z - 1))}
                  />
                  <IconButton
                    label="Phóng to"
                    icon={Plus}
                    disabled={zoomAt >= ZOOMS.length - 1}
                    onClick={() => setZoomAt((z) => Math.min(ZOOMS.length - 1, z + 1))}
                  />
                </>
              )}
              <IconButton label="Đóng trang gốc" icon={X} onClick={() => setOpen(false)} />
            </div>

            {mismatch && (
              <p role="status" className="text-[12px] font-semibold leading-4 text-danger">
                Các tệp bạn chọn có {paper.count} trang, còn lần đọc thấy {expectedPages} trang — có
                thể chưa đúng tệp hoặc sai thứ tự, số trang sẽ không khớp.
              </p>
            )}

            {paper ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <PageCanvas paper={paper} page={page} zoom={zoom} />
              </div>
            ) : null}

            <div className={cn("space-y-1.5", paper && "border-t border-glass-edge pt-2")}>
              {!paper && (
                <p className="text-[12px] font-medium leading-4 text-ink-2">
                  Chọn đúng tệp PDF (hoặc các ảnh trang, theo thứ tự đã tải lên) của đề để đối
                  chiếu. Tệp chỉ được mở ngay trong trình duyệt này, không tải lên đâu cả.
                </p>
              )}
              <label className="block">
                <span className="sr-only">Tệp đề gốc</span>
                <input
                  ref={picker}
                  type="file"
                  multiple
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  aria-label="Tệp đề gốc để đối chiếu"
                  disabled={loading}
                  onChange={(e) => void pick(Array.from(e.target.files ?? []))}
                  className={cn(
                    FIELD,
                    "!py-2 !text-sm file:mr-3 file:rounded-full file:border-0 file:bg-blue-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-deep",
                    paper && "!py-1.5",
                  )}
                />
              </label>
              {loading && (
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
                  <Loader2 size={13} className="animate-spin" /> Đang mở tệp…
                </p>
              )}
              {error && (
                <p role="alert" className="text-[12px] font-semibold leading-4 text-danger">
                  {error}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </ExamSourceContext.Provider>
  );
}
