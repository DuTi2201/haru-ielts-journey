import { useEffect, useRef, useState } from "react";

import { pictureUrl } from "@/lib/api/images";
import { cn } from "@/lib/utils";

import { hasPositionArt, PositionArt } from "./lecture/PositionArt";

/** A lesson picture on a soft tile. It reserves its space (so the page does not jump
 * when the file arrives), fades in once loaded, and — when the file cannot be fetched —
 * disappears (or tells the parent through `onFail`, which can show something else
 * instead). With no `src` it renders nothing, so a lesson with no pictures yet looks
 * exactly as it did before. Pictures are decoration next to text that already says what
 * they show, so `alt` is empty unless the caller passes one. */
export function LessonImage({
  src,
  alt = "",
  className,
  eager = false,
  onFail,
  word,
}: {
  src: string | null | undefined;
  alt?: string;
  /** size and shape: width/height or aspect ratio, margins */
  className?: string;
  /** load now rather than when scrolled near (a flashcard's answer side) */
  eager?: boolean;
  onFail?: (() => void) | undefined;
  /** the Korean word shown: a position word with no Studio picture gets the ball-and-box drawing */
  word?: string | undefined;
}) {
  const url = src ? pictureUrl(src) : null;
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const ref = useRef<HTMLImageElement>(null);

  // a picture served from the browser cache can finish before React attaches onLoad
  useEffect(() => {
    const el = ref.current;
    if (url && el?.complete && el.naturalWidth > 0) setLoaded(url);
  }, [url]);

  if ((!url || failed === url) && hasPositionArt(word)) {
    return (
      <span
        className={cn(
          "relative block shrink-0 overflow-hidden rounded-[12px] border border-line bg-white",
          className,
        )}
      >
        <PositionArt hangul={word!} className="absolute inset-0 h-full w-full" />
      </span>
    );
  }
  if (!url || failed === url) return null;
  const ready = loaded === url;
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-[12px] border border-line bg-progress",
        !ready && "animate-pulse motion-reduce:animate-none",
        className,
      )}
    >
      <img
        ref={ref}
        src={url}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(url)}
        onError={() => {
          setFailed(url);
          onFail?.();
        }}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}
