import { useId, useState } from "react";
import { Check, ChevronDown, NotebookPen } from "lucide-react";

import { modeFor, NOTE_MODES, type NoteMode, type NotebookPage } from "@/lib/notebook-page";
import { readLocal, writeLocal } from "@/lib/lesson-local";
import { cn } from "@/lib/utils";

const DONE_KEY = "notebook-pages";

/** "Ghi vào vở": after a sitting, the page to write by hand. It is optional homework, so it is one
 * folded line until wanted. Opened, it is a notebook page (keyword left, meaning right, one sentence
 * of one's own below); the way to use it is chosen from how many pages the learner has written
 * (copy, then fill in, then recall) and changed with one small link. */
export function NotebookCard({ page, pageId }: { page: NotebookPage; pageId: string }) {
  const panelId = useId();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(() => readLocal<string[]>(DONE_KEY, []).includes(pageId));
  const [mode, setMode] = useState<NoteMode>(() =>
    modeFor(readLocal<string[]>(DONE_KEY, []).length),
  );
  const [meanings, setMeanings] = useState(false);
  const [compare, setCompare] = useState(false);
  const current = NOTE_MODES.find((m) => m.id === mode)!;

  const nextMode = () => {
    const i = NOTE_MODES.findIndex((m) => m.id === mode);
    setMode(NOTE_MODES[(i + 1) % NOTE_MODES.length]!.id);
    setMeanings(false);
    setCompare(false);
  };
  const complete = () => {
    const list = readLocal<string[]>(DONE_KEY, []);
    if (!list.includes(pageId)) writeLocal(DONE_KEY, [...list, pageId]);
    setDone(true);
    setOpen(false);
  };
  const hideKo = mode === "fill" && !meanings;

  return (
    <section
      aria-labelledby={titleId}
      className="mt-6 rounded-[18px] border border-line bg-card text-left shadow-elev-1"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="hit-area flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left"
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-soft"
        >
          {done ? (
            <Check size={17} strokeWidth={2.8} />
          ) : (
            <NotebookPen size={17} strokeWidth={2.4} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span id={titleId} className="block text-[14px] font-semibold leading-5">
            Ghi vào vở · 3 phút
          </span>
          <span className="block text-[12px] font-medium leading-4 text-ink-2">
            {done
              ? "Đã ghi. Lần sau mở vở, che cột phải, đọc nghĩa."
              : "Trang chép sẵn, bạn chỉ việc viết."}
          </span>
        </span>
        <ChevronDown
          size={17}
          strokeWidth={2.6}
          aria-hidden="true"
          className={cn(
            "shrink-0 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div id={panelId} className="space-y-3 border-t border-line px-4 pb-4 pt-3">
          {mode === "recall" && !compare ? (
            <div className="rounded-[14px] border border-dashed border-line px-3.5 py-3 text-[13px] font-medium leading-6">
              <p className="font-semibold">Tự viết vào vở, không nhìn trang này:</p>
              <ul className="mt-1 list-disc pl-5">
                {page.words.length > 0 && (
                  <li>{page.words.length} từ vừa học và nghĩa của chúng</li>
                )}
                {page.patterns.length > 0 && <li>công thức mẫu câu và 1 câu của riêng bạn</li>}
                <li>1 câu tóm tắt: hôm nay mình làm được gì</li>
              </ul>
              <button
                type="button"
                onClick={() => setCompare(true)}
                className="hit-area mt-2 min-h-11 rounded-full border border-line bg-card px-4 text-[13px] font-semibold"
              >
                Mở trang mẫu để so
              </button>
            </div>
          ) : (
            <>
              <p className="text-[12.5px] font-medium leading-5 text-ink-2">{current.how}</p>
              <div className="rounded-[14px] border border-line border-l-4 bg-paper px-3.5 py-3">
                {page.words.length > 0 && (
                  <div>
                    <ul className="grid grid-cols-[max-content_1fr] gap-x-4">
                      <li className="col-span-2 grid grid-cols-subgrid border-b border-line pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                        <span>Từ khóa</span>
                        <span>Nghĩa</span>
                      </li>
                      {page.words.map((w) => (
                        <li
                          key={w.ko}
                          className="col-span-2 grid grid-cols-subgrid items-baseline border-b border-dashed border-line py-1.5"
                        >
                          {hideKo ? (
                            <span aria-hidden="true" className="h-7" />
                          ) : (
                            <span lang="ko" className="text-[20px] font-medium leading-7">
                              {w.ko}
                              {w.pron && (
                                <span className="block text-[11px] font-medium leading-4 text-ink-2">
                                  {w.pron}
                                </span>
                              )}
                            </span>
                          )}
                          <span className="text-[14px] font-medium leading-5">{w.vi}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {page.patterns.map((p) => (
                  <div key={p.formula} className="mt-3">
                    <p className="border-b border-line pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                      Mẫu câu
                    </p>
                    <p lang="ko" className="mt-1.5 text-[16px] font-bold leading-6">
                      {p.formula}
                    </p>
                    {p.ko && !hideKo && (
                      <p lang="ko" className="text-[15px] font-medium leading-6">
                        {p.ko}
                      </p>
                    )}
                    {p.vi && <p className="text-[13px] font-medium leading-5 text-ink-2">{p.vi}</p>}
                  </div>
                ))}
                <div className="mt-3 border-t border-line pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                    Câu của mình
                  </p>
                  <p className="mt-1 text-[13px] font-medium leading-5">
                    Viết 1 câu tiếng Hàn: dùng mẫu trên và 1 từ ở trên.
                  </p>
                </div>
              </div>
              {mode === "fill" && (
                <button
                  type="button"
                  aria-pressed={meanings}
                  onClick={() => setMeanings((m) => !m)}
                  className="hit-area min-h-11 w-full rounded-[14px] border border-line bg-card px-4 text-[13px] font-semibold"
                >
                  {meanings ? "Ẩn chữ Hàn" : "Hiện chữ Hàn để so"}
                </button>
              )}
            </>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={complete}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[16px] border border-line bg-card px-4 text-sm font-semibold shadow-elev-1 active:scale-[0.97] motion-reduce:active:scale-100"
            >
              <Check size={16} strokeWidth={2.8} aria-hidden="true" /> Mình đã ghi xong
            </button>
            <button
              type="button"
              onClick={nextMode}
              className="hit-area min-h-11 shrink-0 px-2 text-[13px] font-semibold text-ink-2 underline underline-offset-2"
            >
              Đổi cách ghi
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
