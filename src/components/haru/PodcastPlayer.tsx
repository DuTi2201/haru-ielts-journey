import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Headphones,
  Loader2,
  LogIn,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
} from "lucide-react";

import { LiquidBar } from "@/components/haru/studio-ui";
import { useAuth } from "@/hooks/use-auth";
import { usePodcast, type LessonPodcastMode } from "@/hooks/use-podcast-audio";
import { clock, lectureChapters, type Chapter } from "@/lib/lecture-chapters";
import { track } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

const LESSON_HINT = "Đọc từng từ, nghĩa, ví dụ và ngữ pháp của bài, để bạn quen âm trước.";

const LESSON_WAIT =
  "Lần đầu phải thu cả bài (vài trăm câu ngắn) nên mất khoảng 3–5 phút, những lần sau nghe ngay. Bạn có thể rời trang; quay lại bấm nghe để tiếp tục.";

// The server reports 0.5 when it starts voicing and 0.9 when the last phrase is done.
const VOICING_FROM = 0.5;
const VOICING_SPAN = 0.4;

/** "còn khoảng 2 phút", from how fast the voicing has gone so far; null until there is enough to go on. */
function remainingLabel(elapsedSec: number, progress: number): string | null {
  const done = (progress - VOICING_FROM) / VOICING_SPAN;
  if (done < 0.05 || done >= 1) return null;
  const left = (elapsedSec * (1 - done)) / done;
  if (left < 15) return "sắp xong";
  if (left < 90) return "còn khoảng 1 phút";
  return `còn khoảng ${Math.round(left / 60)} phút`;
}

/** The consolidated "nghe và nhại lại" (listen-and-shadow) lecture — ONE track
 * covering ALL of a lesson's/article's vocab + grammar together. This is
 * deliberately the PRIMARY way to study vocab/grammar here (per owner feedback:
 * per-word flashcard TTS alone isn't worth building an app for). Per-word "Nghe"
 * buttons elsewhere stay as a secondary, quick-lookup control.
 *
 * A lesson's lecture comes in two forms, each stored and reused on its own:
 * the fixed "kịch bản mẫu" (default, same words every time) and an optional
 * "Gemini kể chuyện". An article always uses Gemini, so it shows no switch. */
export function PodcastPlayer({
  kind,
  ownerId,
  title = "Bài giảng tổng hợp",
  onPlay,
  onSkip,
}: {
  kind: "lesson" | "article";
  ownerId: string | number;
  title?: string;
  /** Called when the learner starts the lecture (not on a resume after pause). */
  onPlay?: () => void;
  /** A way on when the lecture cannot be made now: the lesson goes on without it. */
  onSkip?: { label: string; go: () => void };
}) {
  const podcast = usePodcast(kind);
  // the lecture is recorded and kept per account, so it needs a login on THIS browser (tokens are per browser)
  const auth = useAuth();
  const [showScript, setShowScript] = useState(false);

  const isBusy = podcast.state === "loading";
  // when the voicing began, to estimate how long is left
  const voicingSince = useRef<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isBusy) {
      voicingSince.current = null;
      return;
    }
    if (voicingSince.current === null && podcast.progress >= VOICING_FROM)
      voicingSince.current = Date.now();
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [isBusy, podcast.progress]);
  const left =
    isBusy && voicingSince.current !== null
      ? remainingLabel((now - voicingSince.current) / 1000, podcast.progress)
      : null;
  const isPlaying = podcast.state === "playing";
  // a lesson always gets the fixed "kịch bản mẫu" (same words every time); Gemini's retelling is no longer offered for lessons
  const effectiveMode: LessonPodcastMode = kind === "lesson" ? "template" : "story";

  function onToggle() {
    if (auth.isAnonymous) return;
    if (isPlaying) {
      podcast.pause();
    } else {
      void podcast.play(ownerId, effectiveMode);
      onPlay?.();
    }
  }

  return (
    <section className="rounded-[20px] border border-transparent bg-purple-soft p-4 shadow-elev-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={isBusy || auth.isAnonymous}
          aria-label={isPlaying ? "Tạm dừng bài giảng" : "Nghe bài giảng"}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-card shadow-elev-1 active:scale-[0.97] disabled:opacity-60"
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
            <Headphones size={15} strokeWidth={2.4} /> {title}
          </p>
          <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ink-2">
            {isBusy
              ? kind === "lesson"
                ? LESSON_WAIT
                : "Haru đang soạn bài giảng — lần đầu có thể mất khoảng 30-60 giây…"
              : kind === "lesson"
                ? LESSON_HINT
                : "Nghe toàn bộ từ vựng + ngữ pháp trong MỘT bài giảng, học kiểu nghe và nhại lại."}
          </p>
        </div>
      </div>

      {auth.isAnonymous && (
        <Link
          to="/support-language"
          className="hit-area mt-3 flex items-center gap-2.5 rounded-[14px] border border-transparent bg-yellow-soft px-3 py-2.5 text-xs font-semibold leading-5 active:scale-[0.98] motion-reduce:transition-none"
        >
          <LogIn size={15} strokeWidth={2.4} className="shrink-0" />
          <span>Đăng nhập để nghe bài giảng (mỗi trình duyệt phải đăng nhập riêng).</span>
        </Link>
      )}

      {isBusy && podcast.progress > 0 && (
        <div className="mt-3" aria-live="polite">
          <LiquidBar
            pct={Math.round(podcast.progress * 100)}
            label="Tiến độ tạo bài giảng"
            animated={false}
          />
          <p className="mt-1.5 text-[12px] font-semibold text-ink-2">
            {podcast.step ?? "Đang xử lý"}
            {left ? ` · ${left}` : ""}
          </p>
        </div>
      )}

      {podcast.state === "error" && (
        <div role="alert" className="mt-3 rounded-[14px] bg-card px-3 py-2.5">
          <p className="text-[13px] font-semibold">Bài giảng chưa sẵn sàng lúc này.</p>
          <p className="mt-0.5 text-[12px] font-medium text-danger">{podcast.error}</p>
          <p className="mt-0.5 text-[12px] font-medium leading-5 text-ink-2">
            {kind === "lesson"
              ? "Trong lúc chờ, vẫn học được: bấm nút loa ở từng từ và câu ví dụ bên dưới."
              : "Trong lúc chờ, vẫn đọc được bài và bấm vào từng câu để nghe."}
          </p>
          <button
            type="button"
            onClick={onToggle}
            className="hit-area mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-blue px-4 text-xs font-semibold text-primary-foreground active:scale-[0.97]"
          >
            <RotateCcw size={14} strokeWidth={2.6} aria-hidden="true" /> Thử lại
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip.go}
              className="hit-area ml-2 mt-2 inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 text-xs font-semibold active:scale-[0.97]"
            >
              {onSkip.label}
            </button>
          )}
        </div>
      )}

      {podcast.duration > 0 && (podcast.state === "playing" || podcast.state === "paused") && (
        <LectureControls podcast={podcast} kind={kind} ownerId={ownerId} />
      )}

      {podcast.scriptText && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowScript((v) => !v)}
            aria-expanded={showScript}
            className="flex items-center gap-1 text-[12px] font-semibold text-blue-deep underline"
          >
            {showScript ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showScript ? "Ẩn lời bài giảng" : "Xem lời bài giảng"}
          </button>
          {showScript && (
            <p className="font-korean mt-2 max-h-64 overflow-y-auto whitespace-pre-line rounded-[14px] border border-line bg-card p-3 text-xs leading-6 text-ink-2">
              {podcast.scriptText}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const RATES = [0.75, 0.9, 1, 1.15] as const;

/** Seek bar, ±10 s, speed and chapters, once the lecture is loaded. Moves and speed changes are
 * counted (telemetry): where learners go back to says which part of a lesson is hard. */
export function LectureControls({
  podcast,
  kind,
  ownerId,
  exactChapters,
}: {
  podcast: ReturnType<typeof usePodcast>;
  kind: "lesson" | "article";
  ownerId: string | number;
  /** The parts of the lecture with their real start (from the slides), instead of the estimate. */
  exactChapters?: Chapter[] | undefined;
}) {
  const { time, duration, rate, seek, setRate } = podcast;
  const estimated = useMemo(
    () => (kind === "lesson" ? lectureChapters(podcast.scriptText, duration) : []),
    [kind, podcast.scriptText, duration],
  );
  const chapters = exactChapters ?? estimated;
  const current = [...chapters].reverse().find((c) => time >= c.at);
  const lessonId = typeof ownerId === "number" ? ownerId : Number(ownerId) || 0;

  function go(to: number, chapter?: string) {
    const from = seek(to);
    if (from === null) return;
    if (podcast.state === "paused") podcast.resume();
    track({
      type: "audio_seek",
      value: Math.round(to - from),
      payload: {
        ...(kind === "lesson" ? { lesson_id: lessonId } : {}),
        from_s: Math.round(from),
        to_s: Math.round(to),
        ...(chapter ? { chapter } : current ? { chapter: current.label } : {}),
      },
    });
  }

  return (
    <div className="mt-3 rounded-[14px] bg-card px-3 py-2.5">
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.round(duration))}
        step={1}
        value={Math.round(time)}
        onChange={(e) => go(Number(e.target.value))}
        aria-label="Vị trí trong bài giảng"
        aria-valuetext={`${clock(time)} trên ${clock(duration)}`}
        className="w-full accent-[var(--blue)]"
      />
      <div className="flex items-center justify-between text-[11px] font-semibold tabular-nums text-ink-2">
        <span>{clock(time)}</span>
        {current && current.label !== "Mở đầu" && <span>{current.label}</span>}
        <span>{clock(duration)}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => go(time - 10)}
          aria-label="Lùi 10 giây"
          className="flex min-h-10 items-center gap-1 rounded-full border border-line px-3 text-[12px] font-semibold active:scale-95"
        >
          <RotateCcw size={13} strokeWidth={2.6} aria-hidden="true" /> 10
        </button>
        <button
          type="button"
          onClick={() => go(time + 10)}
          aria-label="Tới 10 giây"
          className="flex min-h-10 items-center gap-1 rounded-full border border-line px-3 text-[12px] font-semibold active:scale-95"
        >
          10 <RotateCw size={13} strokeWidth={2.6} aria-hidden="true" />
        </button>
        <div role="radiogroup" aria-label="Tốc độ đọc" className="ml-auto flex gap-1">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={rate === r}
              onClick={() => {
                setRate(r);
                track({
                  type: "audio_rate",
                  value: r,
                  payload: kind === "lesson" ? { lesson_id: lessonId } : {},
                });
              }}
              className={cn(
                "min-h-10 min-w-10 rounded-full px-1.5 text-[12px] font-semibold tabular-nums",
                rate === r ? "bg-blue text-primary-foreground" : "bg-fill text-ink-2",
              )}
            >
              {r}×
            </button>
          ))}
        </div>
      </div>
      {chapters.length > 1 && (
        <ol aria-label="Các phần của bài giảng" className="mt-2 flex flex-wrap gap-1.5">
          {chapters.map((c) => (
            <li key={c.label}>
              <button
                type="button"
                onClick={() => go(c.at, c.label)}
                aria-current={current?.label === c.label ? "true" : undefined}
                className={cn(
                  "min-h-9 rounded-full px-3 text-[12px] font-semibold",
                  current?.label === c.label
                    ? "bg-purple-soft text-ink ring-1 ring-inset ring-line"
                    : "border border-line text-ink-2",
                )}
              >
                {c.label}{" "}
                <span className="tabular-nums opacity-70">
                  {exactChapters ? "" : "≈"}
                  {clock(c.at)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
