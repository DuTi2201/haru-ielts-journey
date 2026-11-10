import { Music } from "lucide-react";
import { useEffect } from "react";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  MUSIC_DUCKED_VOLUME,
  MUSIC_MAX_VOLUME,
  MUSIC_MIN_VOLUME,
  MUSIC_TRACKS,
  initMusic,
  setMusicOn,
  setMusicTrack,
  setMusicVolume,
  useBackgroundMusic,
  type MusicState,
} from "@/lib/background-music";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const pct = (v: number) => Math.round(v * 100);

/** One short line, only when there is something to say ("playing" says nothing). */
function statusLine(m: MusicState): string | null {
  if (!m.on) return null;
  switch (m.status) {
    case "loading":
      return "Đang tải…";
    case "waiting":
      return "Chạm màn hình để phát.";
    case "error":
      return "Máy này không phát được.";
    default:
      return m.ducked ? `Đang nhỏ lại ${pct(MUSIC_DUCKED_VOLUME)}% khi có audio bài học.` : null;
  }
}

/** Starts the background music engine once for the whole app (it keeps playing across pages).
 * Rendered by the root layout; draws nothing. */
export function MusicBoot() {
  useEffect(() => initMusic(), []);
  return null;
}

/** Nhạc nền settings as a card on the «Tôi» page: on/off, track, volume. It used to be a floating
 * 🎵 button above the tab bar, which learners took for the lesson's audio player and which covered
 * the bottom of every page. */
export function MusicSettings() {
  const m = useBackgroundMusic();
  const line = statusLine(m);
  return (
    <section className="mt-5 rounded-[20px] border border-line bg-card p-5 shadow-elev-1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Music size={16} strokeWidth={2.4} className="text-blue" /> Nhạc nền khi học
        </h2>
        <Switch
          checked={m.on}
          onCheckedChange={(v) => {
            tap();
            setMusicOn(v);
          }}
          aria-label="Bật nhạc nền"
        />
      </div>
      <p className="mt-1 text-[12px] font-medium leading-4 text-ink-2" role="status">
        {line ?? "Tự nhỏ lại khi bài học phát audio."}
      </p>
      {m.on && (
        <>
          <div role="radiogroup" aria-label="Bản nhạc" className="mt-3 grid grid-cols-2 gap-2">
            {MUSIC_TRACKS.map((t) => {
              const picked = t.id === m.track;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  title={t.hint}
                  onClick={() => {
                    tap();
                    setMusicTrack(t.id);
                  }}
                  className={cn(
                    "min-h-10 rounded-[12px] px-2.5 text-left text-xs font-semibold transition-[background-color,transform] active:scale-[0.97]",
                    picked ? "bg-blue-soft text-blue-deep" : "bg-fill text-ink",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span id="music-volume-label" className="sr-only">
              Âm lượng
            </span>
            <Slider
              className="flex-1"
              aria-labelledby="music-volume-label"
              min={pct(MUSIC_MIN_VOLUME)}
              max={pct(MUSIC_MAX_VOLUME)}
              step={5}
              value={[pct(m.volume)]}
              onValueChange={([v]) => v !== undefined && setMusicVolume(v / 100)}
            />
            <span className="w-9 text-right text-xs font-semibold tabular-nums text-ink-2">
              {pct(m.volume)}%
            </span>
          </div>
        </>
      )}
    </section>
  );
}
