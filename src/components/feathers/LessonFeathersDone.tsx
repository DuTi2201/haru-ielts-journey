import { useEffect, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { ROMAN, SwanFigure } from "@/components/journey/Journey";
import { getMyPlan } from "@/lib/api/content";
import { tap } from "@/lib/feedback";

import { FeatherGlyph } from "./Feather";

/* A lesson's last feather earned: a short scene (letterbox, the swan, its feathers fanning out like
 * a wing) and how far the chapter has come. Closes itself after a few seconds, or on a tap. */

export function LessonFeathersDone({
  count,
  chapter,
  star = false,
  onClose,
}: {
  count: number;
  chapter: number | null;
  star?: boolean;
  onClose: () => void;
}) {
  const plan = useQuery({ queryKey: ["me", "plan"], queryFn: getMyPlan, staleTime: 0 });
  const j = plan.data?.journey;
  const ch = j?.chapters?.find((c) => c.n === chapter) ?? null;
  useEffect(() => {
    const t = window.setTimeout(onClose, 5200);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  const n = Math.min(count, 13);
  const spread = Math.min(150, 18 * (n - 1));
  return (
    <div
      className="fx-scene"
      role="dialog"
      aria-modal="true"
      aria-label="Bài xong"
      onClick={() => {
        tap();
        onClose();
      }}
    >
      <button
        type="button"
        aria-label="Đóng"
        className="absolute right-4 top-[calc(9vh+12px)] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
      >
        <X size={18} />
      </button>
      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="fx-wing" aria-hidden="true">
          {Array.from({ length: n }, (_, i) => (
            <span
              key={i}
              style={
                {
                  "--i": i,
                  rotate: `${n === 1 ? 0 : -spread / 2 + (spread / (n - 1)) * i}deg`,
                  translate: "-50% 0",
                } as CSSProperties
              }
            >
              <FeatherGlyph look={star ? "star" : "earned"} size={78} />
            </span>
          ))}
        </div>
        {j && <SwanFigure stage={j.shown_stage} className="fx-rise -mt-6 h-32 w-32" />}
        <p
          className="fx-rise mt-3 text-[13px] font-semibold uppercase tracking-[0.2em] opacity-75"
          style={{ "--d": "500ms" } as CSSProperties}
        >
          Bài xong
        </p>
        <p
          className="fx-rise mt-1 text-[26px] font-bold"
          style={{ "--d": "650ms" } as CSSProperties}
        >
          +{count} {star ? "lông ánh sao" : "lông trắng"}
        </p>
        {ch && !star && (
          <p
            className="fx-rise mt-2 text-[14px] opacity-85"
            style={{ "--d": "800ms" } as CSSProperties}
          >
            Chương {ROMAN[ch.n]} · {ch.earned + ch.credited}/{ch.total} lông
            {ch.done ? " · đủ rồi!" : ""}
          </p>
        )}
        {star && j && (
          <p
            className="fx-rise mt-2 text-[14px] opacity-85"
            style={{ "--d": "800ms" } as CSSProperties}
          >
            {j.starlight ?? 0} lông ánh sao
          </p>
        )}
      </div>
    </div>
  );
}
