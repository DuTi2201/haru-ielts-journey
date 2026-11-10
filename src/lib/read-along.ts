import { prefersReducedMotion } from "@/lib/motion";

/** When each sentence of an article recording starts (from the backend's
 * POST /editorials/{id}/audio job result). `[p, s, startMs]`: paragraph `p`
 * of the body (-1 = the headline), sentence `s` of it (always 0 for the
 * simplified text, which is followed one paragraph at a time). An item lasts
 * until the next one starts. */
export type ReadAlongItem = [p: number, s: number, startMs: number];
export interface ReadAlongTimings {
  v: number;
  items: ReadAlongItem[];
}

/** The sentence (or paragraph) being read right now. */
export interface SpokenPos {
  p: number;
  s: number;
}

export const HEADLINE = -1;

/** The highlight appears this much before the voice reaches the sentence: the
 * player only reports its position a few times a second, and the eye reads the
 * highlight as "now" if it is slightly early rather than slightly late. */
const LEAD_SECONDS = 0.12;

/** Index of the item being read at `seconds`, or -1 before the first one (or
 * when there is no usable timeline). Items are in reading order, so this is a
 * binary search for the last item that has already started. */
export function findSpokenIndex(timings: ReadAlongTimings | null, seconds: number): number {
  if (!timings || timings.v !== 1 || timings.items.length === 0) return -1;
  const items = timings.items;
  const at = (seconds + LEAD_SECONDS) * 1000;
  let lo = 0;
  let hi = items.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((items[mid]?.[2] ?? Infinity) <= at) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

// ------------------------------------------------------------ follow scroll --
/** Keep the spoken text on screen. Does nothing while it is already in the
 * comfortable middle of the screen, so a sentence that is already visible never
 * makes the page twitch; otherwise it glides it up to roughly a third of the
 * way down. Reads the screen, so it lives here and not in a render. */
export function scrollSpokenIntoView(target: HTMLElement | null): void {
  if (!target || !target.isConnected) return;
  const vh = window.innerHeight;
  const rect = target.getBoundingClientRect();
  const topSafe = vh * 0.12;
  const bottomSafe = vh * 0.66; // leaves room for the mini player and the tab bar
  if (rect.top >= topSafe && rect.bottom <= bottomSafe) return;
  const aim = vh * 0.28;
  const tall = rect.height > bottomSafe - topSafe;
  window.scrollBy({
    top: rect.top - (tall ? topSafe : aim),
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}
