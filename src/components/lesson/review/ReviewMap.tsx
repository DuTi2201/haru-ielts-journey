import { AlertTriangle, ArrowRight, Compass } from "lucide-react";

import type { ReviewFunctionOut, ReviewOut } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Rich } from "../Rich";
import { PatternChip } from "./PatternChip";

function FunctionCard({
  fn,
  index,
  review,
  seen,
  onSeen,
}: {
  fn: ReviewFunctionOut;
  index: number;
  review: ReviewOut;
  seen: boolean;
  onSeen: () => void;
}) {
  return (
    <details
      name="review-map"
      className="group rounded-[18px] border border-line bg-paper shadow-elev-1"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) onSeen();
      }}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            seen ? "bg-green text-primary-foreground" : "bg-blue-soft text-blue-deep",
          )}
        >
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-5">{fn.title_vi}</span>
          <span className="block text-[12px] font-semibold leading-4 text-ink-2">
            {fn.patterns.length} mẫu · {fn.rules.length} luật chọn
          </span>
        </span>
        <ArrowRight
          size={16}
          strokeWidth={2.6}
          aria-hidden="true"
          className="shrink-0 transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"
        />
      </summary>

      <div className="space-y-3.5 border-t border-line px-3.5 pb-3.5 pt-3">
        <Rich as="p" text={fn.summary_vi} className="text-xs leading-5 text-ink-2" />

        <div className="flex flex-wrap gap-1.5" aria-label="Các mẫu trong nhóm này">
          {fn.patterns.map((p) => (
            <PatternChip key={p} pattern={p} card={review.cards[p]} />
          ))}
        </div>

        <section aria-label="Khi nào dùng cái nào">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">
            Khi nào dùng cái nào
          </h3>
          <ol className="mt-1.5 space-y-2">
            {fn.rules.map((r, i) => (
              <li
                key={i}
                className="rounded-[14px] border border-transparent bg-blue-soft p-2.5 text-xs leading-5"
              >
                <Rich text={r.when_vi} className="font-semibold" />
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <ArrowRight size={13} strokeWidth={2.8} aria-hidden="true" className="shrink-0" />
                  {r.use.map((p, k) => (
                    <PatternChip
                      key={p}
                      pattern={p}
                      card={review.cards[p]}
                      tone={k === 0 ? "bg-green-soft" : "bg-card"}
                    />
                  ))}
                </div>
                {r.note_vi && <Rich as="p" text={r.note_vi} className="mt-1.5 text-ink-2" />}
              </li>
            ))}
          </ol>
        </section>

        {fn.pitfalls_vi && fn.pitfalls_vi.length > 0 && (
          <details className="group/p rounded-[14px] border border-transparent bg-danger-soft p-2.5">
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide [&::-webkit-details-marker]:hidden">
              <AlertTriangle size={13} strokeWidth={2.6} aria-hidden="true" /> Lỗi hay gặp (
              {fn.pitfalls_vi.length})
              <ArrowRight
                size={13}
                strokeWidth={2.6}
                aria-hidden="true"
                className="ml-auto transition-transform group-open/p:rotate-90 motion-reduce:transition-none"
              />
            </summary>
            <ul className="mt-1.5 space-y-1.5">
              {fn.pitfalls_vi.map((t, i) => (
                <li key={i} className="text-xs leading-5">
                  <Rich text={t} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </details>
  );
}

/** Step 1 of the topic review: the topic's grammar by the job it does in a sentence, with the
 * rule for choosing between look-alikes. Opening a group ticks it off. */
export function ReviewMap({
  review,
  seen,
  onSeen,
}: {
  review: ReviewOut;
  seen: string[];
  onSeen: (fnId: string) => void;
}) {
  const patterns = review.functions.reduce((n, f) => n + f.patterns.length, 0);
  const extension = review.functions
    .flatMap((f) => f.patterns)
    .filter((p) => review.cards[p]?.tier === "extension").length;
  const opened = review.functions.filter((f) => seen.includes(f.id)).length;
  return (
    <section aria-label="Bản đồ ngữ pháp" className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Compass size={20} strokeWidth={2.4} aria-hidden="true" className="text-blue" />
          Bản đồ ngữ pháp
        </h2>
        <p className="mt-0.5 text-[13px] font-medium leading-5 text-ink-2">
          {patterns} mẫu xếp theo <b>việc câu văn cần làm</b>. Mở từng nhóm, rồi sang Thi thử.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-progress"
            role="progressbar"
            aria-label="Nhóm đã xem"
            aria-valuemin={0}
            aria-valuemax={review.functions.length}
            aria-valuenow={opened}
          >
            <div
              className="h-full rounded-full bg-green transition-[width]"
              style={{ width: `${(opened / Math.max(1, review.functions.length)) * 100}%` }}
            />
          </div>
          <span className="text-[12px] font-semibold tabular-nums text-ink-2">
            {opened}/{review.functions.length} nhóm
          </span>
        </div>
        <details className="group/h mt-2">
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 text-[12.5px] font-semibold text-blue-deep [&::-webkit-details-marker]:hidden">
            Cách đọc bản đồ
            <ArrowRight
              size={13}
              strokeWidth={2.6}
              aria-hidden="true"
              className="transition-transform group-open/h:rotate-90 motion-reduce:transition-none"
            />
          </summary>
          <p className="mt-1 rounded-[14px] bg-fill px-3 py-2 text-xs leading-5 text-ink-2">
            Xếp theo việc câu văn cần làm (nêu lý do, nói thời gian, so sánh…) thay vì theo từng
            bài. Mỗi nhóm có luật “gặp tình huống này → dùng mẫu nào”; mẫu tô xanh là lựa chọn đầu
            tiên.
            {extension > 0 && <> 🟣 là kiến thức mở rộng ({extension} mẫu).</>} Trong ví dụ,{" "}
            <b>( )</b> là chỗ của mẫu cần chọn.
          </p>
        </details>
      </div>
      <div className="space-y-2.5">
        {review.functions.map((fn, i) => (
          <FunctionCard
            key={fn.id}
            fn={fn}
            index={i}
            review={review}
            seen={seen.includes(fn.id)}
            onSeen={() => onSeen(fn.id)}
          />
        ))}
      </div>
    </section>
  );
}
