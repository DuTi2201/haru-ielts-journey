/** The BBC Learning English video of a sound, played in YouTube's own embedded player so the
 * learner can watch the mouth. The IFrame API gives us a speed control (0.5x is the useful one for
 * mouth shapes) and a "back 5 s" button. If the player cannot start (blocked, offline), a link to
 * the video on YouTube is shown instead. */
import { ExternalLink, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

interface YTPlayer {
  setPlaybackRate(rate: number): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, number | string>;
      events?: { onReady?: () => void; onError?: () => void };
    },
  ) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      reject(new Error("youtube api"));
    };
    document.head.appendChild(s);
    setTimeout(() => {
      if (!window.YT?.Player) {
        apiPromise = null;
        reject(new Error("youtube api timeout"));
      }
    }, 12_000);
  });
  return apiPromise;
}

const RATES = [0.5, 0.75, 1] as const;

export function YouTubePlayer({ videoId, title }: { videoId: string; title: string }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [failed, setFailed] = useState(false);
  const [rate, setRate] = useState<number>(1);

  useEffect(() => {
    let dead = false;
    setFailed(false);
    setRate(1);
    const mount = document.createElement("div");
    host.current?.replaceChildren(mount);
    loadApi()
      .then((YT) => {
        if (dead) return;
        player.current = new YT.Player(mount, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1, cc_load_policy: 0 },
          events: { onError: () => setFailed(true) },
        });
      })
      .catch(() => !dead && setFailed(true));
    return () => {
      dead = true;
      player.current?.destroy();
      player.current = null;
    };
  }, [videoId]);

  const link = `https://www.youtube.com/watch?v=${videoId}`;
  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-[16px] bg-ink" title={title}>
        <div
          ref={host}
          className="absolute inset-0 [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:h-full [&>iframe]:w-full"
        />
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink p-4 text-center text-primary-foreground">
            <p className="text-[13px] font-medium">Không phát được video ngay trong ứng dụng.</p>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-blue px-4 text-[13px] font-semibold"
            >
              <ExternalLink size={15} aria-hidden="true" />
              Mở trên YouTube
            </a>
          </div>
        )}
      </div>
      {!failed && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-semibold text-ink-2">Tốc độ</span>
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={rate === r}
              onClick={() => {
                tap();
                player.current?.setPlaybackRate(r);
                setRate(r);
              }}
              className={cn(
                "hit-area inline-flex min-h-9 min-w-12 items-center justify-center rounded-full px-3 text-[12.5px] font-semibold",
                rate === r ? "bg-blue text-primary-foreground" : "bg-fill",
              )}
            >
              {r}x
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              tap();
              const p = player.current;
              if (p) p.seekTo(Math.max(0, p.getCurrentTime() - 5), true);
            }}
            className="hit-area ml-auto inline-flex min-h-9 items-center gap-1 rounded-full bg-fill px-3 text-[12.5px] font-semibold"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Lùi 5 giây
          </button>
        </div>
      )}
    </div>
  );
}
