import { useEffect, useRef, useState } from "react";
import { AlertCircle, Headphones, Loader2, LocateFixed, Pause, Play } from "lucide-react";

import {
  PLAYBACK_RATES,
  useArticleAudio,
  type ArticleAudioVariant,
} from "@/hooks/use-article-audio";
import type { SpokenPos } from "@/lib/read-along";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Height (bar + gap) the mini player takes above the tab bar. Published as
 * --player-bar-h so the sentence/word sheets and the page's bottom padding
 * make room for it instead of overlapping. */
const MINI_BAR_SPACE = "64px";

/** True while `el` is on screen. The bottom strip that the tab bar covers
 * counts as off screen, so the mini bar appears as soon as the full player is
 * no longer really visible. Assumes visible until the first observation. */
function useOnScreen(el: React.RefObject<HTMLElement | null>): boolean {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const node = el.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry?.isIntersecting ?? true),
      {
        rootMargin: "0px 0px -90px 0px",
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [el]);
  return onScreen;
}

/** "Nghe toàn văn" — reads the article's OWN title + main text aloud through
 * TTS (cleaned of menus/captions/ads server-side), so a learner hears real
 * native pronunciation and pausing on the actual news article, not a
 * Gemini-written summary of its vocab/grammar (that's PodcastPlayer, a
 * completely separate feature/cache). Sits right under the article header
 * since it reads exactly that text.
 *
 * First play per article synthesizes on the server (a minute or two) — the
 * card shows that job's real progress instead of a bare spinner. Once the
 * audio exists it becomes a normal player: seek bar, ±10s, speed. */
export function ArticleAudioPlayer({
  articleId,
  variant = "original",
  title,
  source,
  follow,
  onFollowChange,
  onTrack,
}: {
  articleId: string;
  variant?: ArticleAudioVariant;
  title?: string | null;
  source?: string | null;
  /** Read along: the page scrolls to the sentence being read. The page owns
   * the flag (scrolling by hand switches it off); this only shows and flips it. */
  follow: boolean;
  onFollowChange: (next: boolean) => void;
  /** Reports which sentence is being read (null when none) and whether the
   * audio is actually playing, so the article below can highlight it. */
  onTrack: (track: { spoken: SpokenPos | null; playing: boolean }) => void;
}) {
  const easy = variant === "easy";
  const audio = useArticleAudio(articleId, variant);
  const [scrub, setScrub] = useState<number | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const cardOnScreen = useOnScreen(cardRef);

  const isBusy = audio.state === "loading";
  const isPlaying = audio.state === "playing";
  const hasError = audio.state === "error";
  const canSeek = audio.ready && audio.duration > 0 && !isBusy;
  const shownTime = scrub ?? audio.currentTime;

  function onToggle() {
    if (isPlaying) audio.pause();
    else void audio.play({ title, artist: source });
  }

  function commitScrub() {
    if (scrub === null) return;
    audio.seek(scrub);
    setScrub(null);
  }

  // Tell the article which sentence is being read. The object is only rebuilt
  // when the sentence or the playing flag changes, not on every time update.
  const { spoken, canFollow } = audio;
  useEffect(() => {
    onTrack({ spoken, playing: isPlaying });
  }, [spoken, isPlaying, onTrack]);
  useEffect(
    () => () => {
      onTrack({ spoken: null, playing: false });
    },
    [onTrack],
  );

  const pct = Math.round((audio.progress ?? 0) * 100);
  const playedPct =
    audio.duration > 0 ? Math.min(100, Math.max(0, (shownTime / audio.duration) * 100)) : 0;

  // A small floating bar keeps play/pause within reach once the learner has
  // scrolled the full player away — reading on while listening is the point.
  const showMini =
    !cardOnScreen && (isBusy || isPlaying || (audio.state === "paused" && audio.ready));
  useEffect(() => {
    if (!showMini) return;
    const root = document.documentElement;
    root.style.setProperty("--player-bar-h", MINI_BAR_SPACE);
    return () => {
      root.style.removeProperty("--player-bar-h");
    };
  }, [showMini]);

  return (
    <>
      <section
        ref={cardRef}
        aria-label={easy ? "Nghe bản dễ" : "Nghe toàn văn"}
        className="mt-4 rounded-[18px] border border-transparent bg-teal-soft p-3.5 shadow-elev-1"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            disabled={isBusy}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-card shadow-elev-1 active:scale-[0.97] disabled:opacity-70"
            aria-label={isPlaying ? "Tạm dừng" : easy ? "Nghe bản dễ" : "Nghe toàn văn"}
          >
            {isBusy ? (
              <Loader2 size={20} strokeWidth={2.4} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={20} strokeWidth={2.4} />
            ) : (
              <Play size={20} strokeWidth={2.4} className="translate-x-0.5" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Headphones size={15} strokeWidth={2.4} /> {easy ? "Nghe bản dễ" : "Nghe toàn văn"}
            </p>
            <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ink-2">
              {isBusy
                ? (audio.step ?? "Đang chuẩn bị giọng đọc…")
                : audio.needsTap
                  ? "Giọng đọc đã sẵn sàng — chạm ▶ để nghe."
                  : canSeek
                    ? easy
                      ? "Tiếng Hàn đơn giản, câu ngắn — hợp để luyện nghe."
                      : "Giọng đọc tiếng Hàn — tiêu đề và nội dung chính."
                    : easy
                      ? "Nghe bản tiếng Hàn đơn giản (câu ngắn, từ cơ bản)."
                      : "Nghe tiêu đề và nội dung chính bằng giọng đọc tiếng Hàn."}
            </p>
          </div>
          {canSeek && (
            <p className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-ink-2">
              {formatTime(shownTime)} / {formatTime(audio.duration)}
            </p>
          )}
        </div>

        {isBusy && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full border border-line bg-card">
              <div
                className="h-full rounded-full bg-blue transition-[width] duration-500"
                style={{ width: `${Math.max(pct, 6)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] font-semibold leading-snug text-ink-2">
              Lần đầu nghe bài này mất khoảng 1–2 phút để tạo giọng đọc; các lần sau nghe ngay. Bạn
              có thể đọc tiếp trong lúc chờ.
            </p>
          </div>
        )}

        {canSeek && (
          <div className="mt-3">
            <input
              type="range"
              min={0}
              max={audio.duration}
              step={0.1}
              value={Math.min(shownTime, audio.duration)}
              onChange={(e) => setScrub(Number(e.target.value))}
              onPointerUp={commitScrub}
              onTouchEnd={commitScrub}
              onKeyUp={commitScrub}
              onBlur={commitScrub}
              aria-label="Tua"
              className="block h-6 w-full cursor-pointer accent-blue"
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => audio.skip(-10)}
                  className="hit-area rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold active:scale-[0.97]"
                  aria-label="Lùi 10 giây"
                >
                  −10s
                </button>
                <button
                  type="button"
                  onClick={() => audio.skip(10)}
                  className="hit-area rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold active:scale-[0.97]"
                  aria-label="Tiến 10 giây"
                >
                  +10s
                </button>
              </div>
              <div className="flex gap-1.5" role="group" aria-label="Tốc độ đọc">
                {PLAYBACK_RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => audio.setRate(r)}
                    aria-pressed={audio.rate === r}
                    className={`hit-area rounded-full border border-line px-3 py-1.5 text-xs font-semibold active:scale-[0.97] ${audio.rate === r ? "bg-blue text-primary-foreground" : "bg-card"}`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>
            {canFollow && (
              <button
                type="button"
                onClick={() => onFollowChange(!follow)}
                aria-pressed={follow}
                className={`hit-area mt-2 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold active:scale-[0.97] ${follow ? "bg-blue text-primary-foreground" : "bg-card"}`}
              >
                <LocateFixed size={13} strokeWidth={2.6} /> Bám theo câu đọc
              </button>
            )}
          </div>
        )}

        {hasError && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-1.5 rounded-[12px] border border-transparent bg-danger-soft px-3 py-2 text-[12px] font-semibold leading-snug"
          >
            <AlertCircle size={14} strokeWidth={2.4} className="mt-px shrink-0 text-danger" />
            <span>{audio.error ?? "Không phát được, thử lại nhé."} Chạm ▶ để thử lại.</span>
          </p>
        )}
      </section>

      {showMini && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+8px)] z-40 mx-auto max-w-[390px] px-3">
          <div
            role="region"
            aria-label={easy ? "Đang nghe bản dễ" : "Đang nghe toàn văn"}
            className="glass-panel pointer-events-auto relative flex h-14 animate-in items-center gap-2 overflow-hidden rounded-[20px] pl-2 pr-3 duration-200 fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            <button
              type="button"
              onClick={onToggle}
              disabled={isBusy}
              className="hit-area flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card active:scale-[0.97] disabled:opacity-70"
              aria-label={isPlaying ? "Tạm dừng" : "Phát"}
            >
              {isBusy ? (
                <Loader2 size={17} strokeWidth={2.4} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={17} strokeWidth={2.4} />
              ) : (
                <Play size={17} strokeWidth={2.4} className="translate-x-px" />
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
              className="min-w-0 flex-1 text-left"
              aria-label="Cuộn lên trình phát"
            >
              <span className="block truncate text-xs font-semibold">
                {title || (easy ? "Nghe bản dễ" : "Nghe toàn văn")}
              </span>
              <span className="block truncate text-[12px] font-semibold tabular-nums text-ink-2">
                {isBusy
                  ? (audio.step ?? "Đang chuẩn bị giọng đọc…")
                  : canSeek
                    ? `${formatTime(shownTime)} / ${formatTime(audio.duration)}`
                    : "Chạm ▶ để nghe"}
              </span>
            </button>
            {canFollow && !follow && (
              <button
                type="button"
                onClick={() => onFollowChange(true)}
                className="hit-area flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card active:scale-[0.97]"
                aria-label="Cuộn tới câu đang đọc"
              >
                <LocateFixed size={17} strokeWidth={2.4} />
              </button>
            )}
            {canSeek && (
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-ink/10">
                <div
                  className="h-full bg-blue transition-[width] duration-300"
                  style={{ width: `${playedPct}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
