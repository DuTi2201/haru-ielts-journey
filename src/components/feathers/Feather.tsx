import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { prefersReducedMotion } from "@/lib/motion";
import { FEATHER } from "@/components/journey/assets";
import { cn } from "@/lib/utils";

import "./feathers.css";

/* Lông vũ: one small part of a lesson, about five minutes. The white feather once earned, the
 * dusty grey one while waiting (ringed for the part on screen), a faded white one for a lesson the
 * entry check let the learner skip, and the starlight feather of the support lessons. */

export type FeatherLook = "earned" | "next" | "empty" | "credited" | "star" | "star-empty";

const ART: Record<FeatherLook, string> = {
  earned: FEATHER.white,
  credited: FEATHER.white,
  star: FEATHER.star,
  next: FEATHER.grey,
  empty: FEATHER.grey,
  "star-empty": FEATHER.grey,
};

export function FeatherGlyph({
  look,
  size = 28,
  tilt = 0,
  className,
}: {
  look: FeatherLook;
  size?: number;
  tilt?: number;
  className?: string;
}) {
  return (
    <img
      src={ART[look]}
      alt=""
      draggable={false}
      decoding="async"
      width={Math.round(size * 0.39)}
      height={size}
      className={cn("fx-glyph", className)}
      data-look={look}
      style={{ rotate: `${tilt}deg`, height: size, width: "auto" } as CSSProperties}
      aria-hidden="true"
    />
  );
}

/** A feather flying from where it was earned to its place in the strip: the strip passes the
 * place (`to`) and the feather lands in about a second; nothing moves for reduced motion. */
export function FeatherFlight({
  from,
  to,
  star = false,
  onDone,
}: {
  from: DOMRect | null;
  to: DOMRect;
  star?: boolean;
  onDone: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [go, setGo] = useState(false);
  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      onDone();
      return;
    }
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    const t = window.setTimeout(onDone, 1100);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [onDone]);
  const vw = typeof window === "undefined" ? 390 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const start = from ?? new DOMRect(vw / 2 - 20, vh * 0.55, 40, 40);
  const x0 = start.left + start.width / 2;
  const y0 = start.top + start.height / 2;
  const x1 = to.left + to.width / 2;
  const y1 = to.top + to.height / 2;
  return (
    <span
      ref={ref}
      className="fx-flight"
      data-go={go || undefined}
      style={
        {
          "--x0": `${x0}px`,
          "--y0": `${y0}px`,
          "--dx": `${x1 - x0}px`,
          "--dy": `${y1 - y0}px`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <span className="fx-flight-x">
        <span className="fx-flight-y">
          <FeatherGlyph look={star ? "star" : "earned"} size={46} />
        </span>
      </span>
    </span>
  );
}
