import { ChevronLeft, ChevronRight, Headphones, Lightbulb, X } from "lucide-react";

import { speakKorean } from "@/lib/audio-playback";
import type { StudySentenceOut } from "@/lib/api/types";

/** Floating card for one tapped sentence: Vietnamese translation, the words
 * a beginner may not know (with dictionary form + meaning) and short notes on
 * the hard endings/grammar — everything needed to actually understand the
 * sentence, right where the learner is reading. ‹ › step through the article
 * sentence by sentence without going back to the text. */
export function SentenceSheet({
  sentence,
  position,
  total,
  onPrev,
  onNext,
  onClose,
}: {
  sentence: StudySentenceOut;
  position: number; // 1-based
  total: number;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
}) {
  return (
    <div
      data-sheet="sentence"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--player-bar-h,0px)+8px)] z-50 mx-auto max-w-[390px] px-3"
    >
      <div
        role="dialog"
        aria-label="Phân tích câu"
        className="glass-panel-strong pointer-events-auto max-h-[min(58dvh,calc(100dvh-var(--tabbar-h)-var(--player-bar-h,0px)-120px))] animate-in overflow-y-auto overscroll-contain rounded-[22px] p-4 duration-200 fade-in slide-in-from-bottom-3 motion-reduce:animate-none"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-korean break-keep text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]">
            {sentence.ko}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="hit-area flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card active:scale-[0.97]"
            aria-label="Đóng"
          >
            <X size={16} strokeWidth={2.6} />
          </button>
        </div>

        {sentence.vi ? (
          <p className="mt-2 text-sm font-semibold leading-6 text-blue-deep">{sentence.vi}</p>
        ) : (
          <p className="mt-2 text-xs font-medium text-ink-2">Câu này chưa có bản dịch.</p>
        )}

        {sentence.words.length > 0 && (
          <ul className="mt-2.5 space-y-1.5 border-t border-line pt-2.5">
            {sentence.words.map((w) => (
              <li key={w.surface} className="flex items-baseline gap-2 text-xs leading-5">
                <span className="font-korean shrink-0 text-[13px] font-semibold">{w.surface}</span>
                <span className="min-w-0 flex-1 font-semibold text-ink">
                  {w.meaning_vi}
                  {(w.base && w.base !== w.surface) || w.pos ? (
                    <span className="ml-1 font-medium text-ink-2">
                      (
                      {[w.base && w.base !== w.surface ? w.base : null, w.pos]
                        .filter(Boolean)
                        .join(" · ")}
                      )
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}

        {sentence.grammar_notes_vi.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            {sentence.grammar_notes_vi.map((note) => (
              <p
                key={note}
                className="flex items-start gap-1.5 rounded-[10px] bg-card px-2.5 py-1.5 text-[12px] font-semibold leading-5"
              >
                <Lightbulb
                  size={12}
                  strokeWidth={2.4}
                  className="mt-1 shrink-0 text-yellow-strong"
                />
                <span>{note}</span>
              </p>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => speakKorean(sentence.ko)}
            className="hit-area flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-xs font-semibold text-blue-deep active:scale-[0.97]"
          >
            <Headphones size={14} strokeWidth={2.6} /> Nghe câu
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev ?? undefined}
              disabled={!onPrev}
              className="hit-area flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card active:scale-[0.97] disabled:opacity-40"
              aria-label="Câu trước"
            >
              <ChevronLeft size={17} strokeWidth={2.6} />
            </button>
            <span className="min-w-[3ch] text-center text-xs font-semibold tabular-nums text-ink-2">
              {position}/{total}
            </span>
            <button
              type="button"
              onClick={onNext ?? undefined}
              disabled={!onNext}
              className="hit-area flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card active:scale-[0.97] disabled:opacity-40"
              aria-label="Câu sau"
            >
              <ChevronRight size={17} strokeWidth={2.6} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
