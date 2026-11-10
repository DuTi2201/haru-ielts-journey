import { useRef } from "react";
import type { PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Loader2, Gauge, Volume2 } from "lucide-react";

import { Shimmer } from "@/components/haru/states";
import type { CorpusAudio } from "@/hooks/use-corpus-audio";
import { getSimilarCorpus } from "@/lib/api/content";
import type { CorpusItemOut } from "@/lib/api/types";
import { REGISTER_INFO, registerLabel } from "@/lib/listening-filters";
import { cn } from "@/lib/utils";

/** Four little bars that dance while a sentence is being read. */
function AudioBars({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex h-3.5 items-end gap-[2px]", className)}>
      {[0, 0.25, 0.1, 0.35].map((delay) => (
        <span
          key={delay}
          className="eq-bar h-full w-[3px] rounded-full bg-blue"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}

/** Sentences close to this one, to hear and compare — usually the same pattern
 * in another ending or speech level. Secondary content: while it loads or if it
 * fails the card simply shows nothing. */
function SimilarSentences({ item, audio }: { item: CorpusItemOut; audio: CorpusAudio }) {
  const query = useQuery({
    queryKey: ["corpusSimilar", item.id],
    queryFn: () => getSimilarCorpus(item.id),
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (query.isLoading) return <Shimmer className="mx-6 mb-4 h-16 rounded-[16px]" />;
  const rows = (query.data ?? []).slice(0, 3);
  if (rows.length === 0) return null;
  return (
    <div className="border-t border-line px-6 pb-4 pt-3 text-left">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">
        Câu gần giống — nghe để so sánh
      </p>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => {
          const active = audio.activeId === row.id;
          const loading = active && audio.state === "loading";
          const playing = active && audio.state === "playing";
          return (
            <li key={row.id} className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => void audio.play(row.id, row.text_ko)}
                disabled={loading}
                aria-label={`Nghe câu: ${row.text_ko}`}
                className="hit-area card-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue-deep active:scale-95 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={16} strokeWidth={2.4} className="animate-spin" />
                ) : playing ? (
                  <AudioBars />
                ) : (
                  <Volume2 size={16} strokeWidth={2.4} />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p lang="ko" className="font-korean break-keep text-[13px] font-semibold leading-5">
                  {row.text_ko}
                </p>
                {row.meaning_vi && (
                  <p className="text-[12px] font-medium leading-4 text-ink-2">{row.meaning_vi}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-yellow-soft px-2 py-0.5 text-[11px] font-semibold">
                {registerLabel(row.register)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SWIPE_MIN_PX = 56;

/** One /listening sentence as a small player: a big play button with a pulse
 * ring while it is being read, the subtitle folded under it (it unfolds, it
 * does not pop in), and prev/next — by button or by swiping the card. The
 * route owns which sentence is showing; this only draws it and reports what
 * the learner asked for. */
export function ListeningPlayer({
  item,
  position,
  total,
  audio,
  revealed,
  direction,
  isLast,
  onToggleReveal,
  onPrev,
  onNext,
}: {
  item: CorpusItemOut;
  position: number; // 1-based, within this round
  total: number; // sentences in this round
  audio: CorpusAudio;
  revealed: boolean;
  /** which way the card should slide in ("next" comes from the right) */
  direction: "next" | "prev";
  /** the round's last sentence: "next" finishes the round instead */
  isLast: boolean;
  onToggleReveal: () => void;
  onPrev: (() => void) | null;
  onNext: () => void;
}) {
  const own = audio.activeId === item.id;
  const playing = own && audio.state === "playing";
  const loading = own && audio.state === "loading";
  const failed = own && audio.state === "error";
  const swipe = useRef<{ x: number; y: number; ok: boolean } | null>(null);
  const info = REGISTER_INFO[item.register];

  // Horizontal swipe on the card: left = next sentence, right = previous.
  // The card keeps `touch-action: pan-y`, so vertical scrolling still works and
  // the browser hands horizontal drags to us. A gesture that starts on a button
  // is left to that button.
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const onControl = (e.target as HTMLElement).closest("button, a, input");
    swipe.current = { x: e.clientX, y: e.clientY, ok: !onControl };
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const start = swipe.current;
    swipe.current = null;
    if (!start?.ok) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) onNext();
    else onPrev?.();
  }

  return (
    <div
      key={item.id}
      className={cn(
        "animate-in duration-300 fade-in motion-reduce:animate-none",
        direction === "next" ? "slide-in-from-right-6" : "slide-in-from-left-6",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-ink-2">
        <span className="tabular-nums">
          Câu {position}/{total}
        </span>
        <span aria-hidden="true">·</span>
        <span className="min-w-0 truncate">{item.film_title}</span>
        {playing && <AudioBars className="shrink-0" />}
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipe.current = null;
        }}
        className="card-soft mt-2 touch-pan-y overflow-hidden rounded-[24px] bg-card text-center"
      >
        <div className="px-6 pb-3 pt-9">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            {playing && (
              <>
                {/* soft glow + a ring that ripples outward while it plays */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full opacity-60 shadow-[0_0_30px_2px_var(--blue)]"
                />
                <span
                  aria-hidden="true"
                  className="pulse-ring absolute inset-0 rounded-full bg-blue/30 motion-reduce:hidden"
                />
              </>
            )}
            <button
              type="button"
              onClick={() => void audio.play(item.id, item.text_ko)}
              disabled={loading}
              aria-label={playing ? "Nghe lại câu" : "Nghe câu"}
              className="card-soft relative flex h-20 w-20 items-center justify-center rounded-full bg-blue-soft text-blue-deep transition-transform duration-200 active:scale-95 disabled:opacity-60 motion-reduce:transition-none"
            >
              {loading ? (
                <Loader2 size={32} strokeWidth={2.2} className="animate-spin" />
              ) : (
                <Volume2 size={32} strokeWidth={2.2} />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => audio.setSlow(!audio.slow)}
            aria-pressed={audio.slow}
            className={cn(
              "hit-area card-soft mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-transform active:scale-95 motion-reduce:transition-none",
              audio.slow ? "bg-blue text-primary-foreground" : "bg-card text-ink-2",
            )}
          >
            <Gauge size={14} strokeWidth={2.4} /> Nghe chậm
          </button>

          <p
            role="status"
            aria-live="polite"
            className="mt-2 min-h-4 text-[12px] font-semibold text-ink-2"
          >
            {loading
              ? "Đang tạo giọng đọc — lần đầu nghe câu này sẽ hơi lâu."
              : failed
                ? audio.error || "Không tạo được giọng đọc, thử lại nhé."
                : own && audio.usedFallback
                  ? "Không tạo được giọng từ máy chủ — đang dùng giọng của thiết bị."
                  : ""}
          </p>
        </div>

        {/* subtitle: folded under the player, unfolds smoothly */}
        <div
          id="listening-subtitle"
          aria-hidden={!revealed}
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
            revealed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <div className="px-6 pb-4">
              <p lang="ko" className="font-korean break-keep text-lg font-semibold leading-snug">
                {item.text_ko}
              </p>
              {item.meaning_vi && (
                <p className="mt-2 text-[15px] font-semibold leading-6">
                  <span className="sr-only">Nghĩa: </span>
                  {item.meaning_vi}
                </p>
              )}
              {item.usage_note_vi && (
                <div className="mt-3 rounded-[16px] bg-yellow-soft/70 px-3.5 py-3 text-left">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">
                    Cách dùng
                  </p>
                  <p className="mt-1 text-[13px] font-medium leading-5">{item.usage_note_vi}</p>
                </div>
              )}
              {/* one scrollable row instead of tags wrapping over many lines */}
              <div className="-mx-6 mt-3 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="mx-auto flex w-max gap-1.5">
                  <span className="rounded-full bg-teal-soft px-2.5 py-1 text-[12px] font-semibold text-teal">
                    Cấp {item.level}
                  </span>
                  <span className="rounded-full bg-yellow-soft px-2.5 py-1 text-[12px] font-semibold">
                    {registerLabel(item.register)}
                  </span>
                  {item.topics.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-blue-soft px-2.5 py-1 text-[12px] font-semibold text-blue-deep"
                    >
                      {t}
                    </span>
                  ))}
                  {item.grammar_patterns.map((g) => (
                    <span
                      key={g}
                      lang="ko"
                      className="font-korean rounded-full bg-purple-soft px-2.5 py-1 text-[12px] font-semibold text-purple"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
              {/* the usage note already says who to say it to; the general hint
                  about the speech level only fills in when there is no note */}
              {info && !item.usage_note_vi && (
                <p className="mt-2 text-left text-[12px] font-medium leading-5 text-ink-2">
                  <span className="font-semibold text-ink">Khi nào dùng: </span>
                  {info.hint}
                </p>
              )}
            </div>
            {revealed && <SimilarSentences item={item} audio={audio} />}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleReveal}
          aria-expanded={revealed}
          aria-controls="listening-subtitle"
          className="flex min-h-12 w-full items-center justify-center gap-1.5 border-t border-transparent text-sm font-semibold text-blue-deep active:bg-blue-soft/50"
        >
          {revealed ? "Ẩn phụ đề và nghĩa" : "Chạm để xem phụ đề và nghĩa"}
          <ChevronDown
            size={16}
            strokeWidth={2.6}
            className={cn(
              "transition-transform duration-300 motion-reduce:transition-none",
              revealed && "rotate-180",
            )}
          />
        </button>
      </div>

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={onPrev ?? undefined}
          disabled={!onPrev}
          aria-label="Câu trước"
          className="card-soft flex min-h-12 w-14 shrink-0 items-center justify-center rounded-[16px] bg-card transition-transform active:scale-95 disabled:opacity-40"
        >
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          onClick={onNext}
          className="card-soft flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-[16px] bg-blue text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
        >
          {isLast ? (
            <>
              <Check size={16} strokeWidth={2.6} /> Xong lượt này
            </>
          ) : (
            <>
              Câu tiếp <ArrowRight size={16} strokeWidth={2.4} />
            </>
          )}
        </button>
      </div>
      <p className="mt-2 text-center text-[12px] font-medium text-ink-2">
        Vuốt thẻ sang trái/phải để đổi câu.
      </p>
    </div>
  );
}
