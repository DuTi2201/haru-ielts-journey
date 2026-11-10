import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { HERO_JOURNEY, STAGES, type Stage } from "./assets";
import { ROMAN, SwanFigure } from "./Journey";

const ALL: Stage[] = [1, 2, 3, 4, 5];

/** The halo outside the frame takes the frame's light (it sits outside `.jr-showcase`). */
const HALO: Record<Stage, string> = {
  1: "oklch(0.62 0.16 55 / 0.42)",
  2: "oklch(0.6 0.12 265 / 0.45)",
  3: "oklch(0.6 0.12 265 / 0.45)",
  4: "oklch(0.7 0.14 20 / 0.45)",
  5: "oklch(0.85 0.13 85 / 0.55)",
};
const haloVars = (s: Stage) => ({ "--jr-glow": HALO[s] }) as React.CSSProperties;

/** The landing page's telling of Hành trình Thiên Nga: one panorama from the thorn tower at night
 * to the castle at sunrise; picking a stage (or waiting) pans to it and shows that stage's swan. */
export function JourneyShowcase({ className }: { className?: string }) {
  const [stage, setStage] = useState<Stage>(1);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || prefersReducedMotion()) return;
    const t = window.setInterval(() => setStage((s) => ((s % 5) + 1) as Stage), 4200);
    return () => window.clearInterval(t);
  }, [auto]);
  const st = STAGES[stage];
  const pick = (s: Stage) => {
    setAuto(false);
    setStage(s);
  };

  return (
    <div className={cn("relative isolate", className)} data-stage={stage}>
      <span className="jr-halo" style={haloVars(stage)} aria-hidden="true" />
      <div
        className="jr-scene jr-showcase relative min-h-[600px] rounded-[32px] sm:min-h-[540px]"
        data-stage={stage}
        onPointerEnter={() => setAuto(false)}
      >
        <img
          src={HERO_JOURNEY}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-[object-position,transform,transform-origin] duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{
            objectPosition: `${(stage - 1) * 25}% 50%`,
            transform: "scale(1.35)",
            transformOrigin: `${(stage - 1) * 25}% 60%`,
          }}
        />
        <span className="jr-tint" aria-hidden="true" />
        <span className="jr-vignette" aria-hidden="true" />
        <span className="jr-scrim" aria-hidden="true" />
        <span className="jr-grain" aria-hidden="true" />

        <div className="relative z-[2] flex min-h-[600px] flex-col p-5 sm:min-h-[540px] sm:p-8">
          <p className="jr-eyebrow">Hành trình Thiên Nga</p>
          <h2 className="jr-display mt-3 max-w-[560px] sm:!text-[48px]">
            Mỗi người học là một thiên nga đang chờ phá lời nguyền
          </h2>
          <p className="jr-story mt-3 max-w-[520px]">
            Mỗi phần bài học xong là một chiếc lông trắng mọc lại; ngày nào vắng học, bầy quạ kéo
            về. Năm chương, một vương miện.
          </p>

          <div
            role="tablist"
            aria-label="Năm chặng của hành trình"
            className="mt-6 flex max-w-[320px] items-center justify-between"
          >
            {ALL.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={s === stage}
                aria-label={`Chương ${ROMAN[s]}: ${STAGES[s].name}`}
                onClick={() => pick(s)}
                data-on={s === stage || undefined}
                className="jr-numeral"
              >
                {ROMAN[s]}
              </button>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-[400px] jr-title" aria-live="polite">
              <p className="jr-chapter">
                Chương {ROMAN[stage]} · {st.mood}
              </p>
              <p className="jr-display mt-1 !text-[30px]">{st.name}</p>
              <p className="jr-story mt-1.5">{st.line}</p>
              <Link
                to="/lesson"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-[14px] bg-card px-5 text-[14px] font-bold text-blue-deep shadow-elev-2 active:scale-[0.97]"
              >
                Bắt đầu hành trình của bạn <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <span className="jr-stage-swan self-center sm:self-end">
              <span className="jr-ground" aria-hidden="true" />
              <SwanFigure
                key={stage}
                stage={stage}
                className="h-44 w-44 sm:h-60 sm:w-60"
                onTap={() => pick(stage === 5 ? 1 : ((stage + 1) as Stage))}
                label={`Thiên nga chương ${ROMAN[stage]}. Chạm để xem chương tiếp theo`}
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
