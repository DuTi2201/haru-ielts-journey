import type { ReactNode } from "react";
import { Headphones, Loader2, X } from "lucide-react";

import type { VocabItemOut } from "@/lib/api/types";

/** Floating card that appears above the tab bar when a highlighted word in
 * the article is tapped — so the meaning shows right where the learner is
 * reading instead of at the very end of a long article. */
export function WordSheet({
  word,
  onClose,
  onListen,
  listening,
  footer,
}: {
  word: VocabItemOut;
  onClose: () => void;
  onListen: () => void;
  listening: boolean;
  footer?: ReactNode;
}) {
  return (
    <div
      data-sheet="word"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--player-bar-h,0px)+8px)] z-50 mx-auto max-w-[390px] px-3"
    >
      <div
        role="dialog"
        aria-label={`Nghĩa của từ ${word.headword}`}
        className="glass-panel-strong pointer-events-auto max-h-[min(58dvh,calc(100dvh-var(--tabbar-h)-var(--player-bar-h,0px)-120px))] animate-in overflow-y-auto overscroll-contain rounded-[22px] p-4 duration-200 fade-in slide-in-from-bottom-3 motion-reduce:animate-none"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-korean text-lg font-semibold leading-tight">
            {word.headword}{" "}
            {word.pos && (
              <span className="font-sans text-[12px] font-semibold text-ink-2">({word.pos})</span>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onListen}
              disabled={listening}
              className="hit-area flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-xs font-semibold text-blue-deep active:scale-[0.97] disabled:opacity-60"
            >
              {listening ? (
                <Loader2 size={14} strokeWidth={2.6} className="animate-spin" />
              ) : (
                <Headphones size={14} strokeWidth={2.6} />
              )}
              Nghe
            </button>
            <button
              type="button"
              onClick={onClose}
              className="hit-area flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card active:scale-[0.97]"
              aria-label="Đóng"
            >
              <X size={16} strokeWidth={2.6} />
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm font-semibold text-blue-deep">{word.meaning_vi}</p>
        {word.example_en && (
          <p className="font-korean mt-1.5 break-keep text-xs leading-5 text-ink-2">
            {word.example_en}
          </p>
        )}
        {footer}
      </div>
    </div>
  );
}
