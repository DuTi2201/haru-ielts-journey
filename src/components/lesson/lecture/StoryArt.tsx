/** Small flat vector pictures for lecture slides, drawn in code in one style (same outline, same
 * palette as PositionArt). Each picture moves only while its sentence is the one being said
 * (`on`), so the motion always points at what the voice is saying. Reduced motion: no movement. */
import type { ReactNode } from "react";

const INK = "#24305e";
const CORAL = "#ff7a6b";
const SUN = "#ffd166";
const MINT = "#7fd8b5";
const SKY = "#8ecbff";
const WOOD = "#f2c078";
const LAV = "#e6defa";
const W = 3;

type P = { on: boolean };
const a = (on: boolean, cls: string) => (on ? cls : "");
const line = { stroke: INK, strokeWidth: W, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const Hourglass = ({ on }: P) => (
  <g className={a(on, "haru-a-flip")} style={{ transformOrigin: "32px 32px" }}>
    <path d="M18 10h28M18 54h28" {...line} />
    <path d="M20 12h24L32 32Z" fill={SUN} {...line} />
    <path d="M32 32 44 52H20Z" fill={SUN} {...line} />
  </g>
);
const House = ({ on }: P) => (
  <g className={a(on, "haru-a-bob")}>
    <rect x="14" y="30" width="36" height="24" fill={WOOD} {...line} />
    <path d="M8 32 32 10l24 22Z" fill={CORAL} {...line} />
    <rect x="27" y="40" width="10" height="14" fill="#fff" {...line} />
  </g>
);
const Suitcase = ({ on }: P) => (
  <g className={a(on, "haru-a-slide")}>
    <path d="M24 24v-6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6" fill="none" {...line} />
    <rect x="10" y="24" width="44" height="28" rx="5" fill={SKY} {...line} />
    <path d="M22 24v28M42 24v28" {...line} />
    <circle cx="20" cy="56" r="3" fill={INK} />
    <circle cx="44" cy="56" r="3" fill={INK} />
  </g>
);
const Tv = ({ on }: P) => (
  <g>
    <rect x="8" y="12" width="48" height="34" rx="5" fill={LAV} {...line} />
    <rect x="13" y="17" width="38" height="24" rx="2" fill={SKY} className={a(on, "haru-a-flicker")} />
    <path d="M29 23v12l10-6Z" fill="#fff" />
    <path d="M22 54h20M32 46v8" {...line} />
  </g>
);
const Bed = ({ on }: P) => (
  <g className={a(on, "haru-a-bob")}>
    <rect x="8" y="22" width="6" height="30" rx="2" fill={WOOD} {...line} />
    <rect x="8" y="34" width="48" height="12" rx="3" fill={SKY} {...line} />
    <rect x="16" y="28" width="16" height="8" rx="4" fill="#fff" {...line} />
    <path d="M56 46v8" {...line} />
    <path d="M44 12h8l-8 8h8" fill="none" {...line} className={a(on, "haru-a-wave")} />
  </g>
);
const Coffee = ({ on }: P) => (
  <g>
    <path d="M14 26h28v14a10 10 0 0 1-10 10h-8a10 10 0 0 1-10-10Z" fill="#fff" {...line} />
    <path d="M42 30h3a5 5 0 0 1 0 10h-3" fill="none" {...line} />
    <path d="M22 18q-3-4 0-8M32 18q-3-4 0-8" fill="none" {...line} className={a(on, "haru-a-steam")} />
    <path d="M10 10 54 54" stroke={CORAL} strokeWidth="5" strokeLinecap="round" />
  </g>
);
const Steak = ({ on }: P) => (
  <g className={a(on, "haru-a-bob")}>
    <path d="M10 34c0-12 10-20 24-20s18 8 16 20-12 16-24 14S10 44 10 34Z" fill={CORAL} {...line} />
    <circle cx="30" cy="32" r="8" fill="#ffb3a7" {...line} />
    <circle cx="48" cy="46" r="4" fill="#fff" {...line} />
  </g>
);
const Salad = ({ on }: P) => (
  <g className={a(on, "haru-a-bob")}>
    <ellipse cx="22" cy="26" rx="10" ry="6" fill={MINT} transform="rotate(-25 22 26)" {...line} />
    <ellipse cx="38" cy="24" rx="10" ry="6" fill={MINT} transform="rotate(20 38 24)" {...line} />
    <circle cx="32" cy="22" r="5" fill={CORAL} {...line} />
    <path d="M8 32h48a24 20 0 0 1-48 0Z" fill="#fff" {...line} />
  </g>
);
const Speaker = ({ on }: P) => (
  <g>
    <rect x="10" y="8" width="30" height="48" rx="6" fill={LAV} {...line} />
    <circle cx="25" cy="22" r="5" fill="#fff" {...line} />
    <circle cx="25" cy="40" r="10" fill="#4a5a9e" {...line} />
    <path d="M46 22q6 10 0 20" fill="none" {...line} className={a(on, "haru-a-wave")} />
    <path d="M52 15q10 17 0 34" fill="none" {...line} className={a(on, "haru-a-wave2")} />
  </g>
);
const Angry = ({ on }: P) => (
  <g className={a(on, "haru-a-shake")} style={{ transformOrigin: "32px 36px" }}>
    <circle cx="32" cy="36" r="20" fill="#ff9d8a" {...line} />
    <path d="M18 26l11 5M46 26l-11 5" {...line} />
    <circle cx="25" cy="36" r="2.5" fill={INK} />
    <circle cx="39" cy="36" r="2.5" fill={INK} />
    <path d="M24 48q8-6 16 0" fill="none" {...line} />
    <circle cx="14" cy="10" r="3" fill="#fff" {...line} className={a(on, "haru-a-steam")} />
    <circle cx="50" cy="10" r="3" fill="#fff" {...line} className={a(on, "haru-a-steam")} />
  </g>
);
const Trend = ({ on }: P) => (
  <g>
    <path d="M8 8v48h48" fill="none" {...line} />
    <path pathLength={1} d="M14 46 26 34l8 6 18-24" fill="none" stroke={MINT} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className={a(on, "haru-a-draw")} strokeDasharray={on ? undefined : "none"} />
    <path d="M44 14h10v10" fill="none" stroke={MINT} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);
const Calendar = ({ on }: P) => (
  <g className={a(on, "haru-a-bob")}>
    <rect x="9" y="14" width="46" height="40" rx="5" fill="#fff" {...line} />
    <path d="M9 14h46v10H9Z" fill={CORAL} {...line} />
    <path d="M21 8v10M43 8v10" {...line} />
    <rect x="34" y="34" width="10" height="10" rx="2" fill={SUN} {...line} />
    <path d="M16 36h10M16 44h10" {...line} />
  </g>
);
const Plane = ({ on }: P) => (
  <g className={a(on, "haru-a-fly")}>
    <path d="M6 36 54 18l-6 10 8 4-4 6-10-2-8 12-4-2 2-12-12 2Z" fill={SKY} {...line} />
  </g>
);
const Bulb = ({ on }: P) => (
  <g>
    <circle cx="32" cy="26" r="14" fill={SUN} {...line} className={a(on, "haru-a-pulse")} style={{ transformOrigin: "32px 26px" }} />
    <rect x="26" y="40" width="12" height="10" rx="2" fill="#cfd6f2" {...line} />
    <path d="M28 54h8" {...line} />
    <path d="M32 4v4M10 14l3 3M54 14l-3 3M6 30h4M54 30h4" {...line} className={a(on, "haru-a-wave")} />
  </g>
);
const Repeat = ({ on }: P) => (
  <g className={a(on, "haru-a-spin")} style={{ transformOrigin: "32px 32px" }}>
    <path d="M46 22a16 16 0 1 0 3 12" fill="none" {...line} />
    <path d="M48 10v14H34" fill="none" {...line} />
  </g>
);
const Thought = ({ on }: P) => (
  <g className={a(on, "haru-a-bob")}>
    <path d="M18 40a10 10 0 0 1 2-19 12 12 0 0 1 22-3 11 11 0 0 1 6 20 9 9 0 0 1-8 4H26a8 8 0 0 1-8-2Z" fill="#fff" {...line} />
    <circle cx="24" cy="48" r="3" fill="#fff" {...line} />
    <circle cx="17" cy="55" r="2" fill="#fff" {...line} />
    <path d="M26 30h.1M32 30h.1M38 30h.1" {...line} strokeWidth="5" />
  </g>
);
const Heart = ({ on }: P) => (
  <g className={a(on, "haru-a-pulse")} style={{ transformOrigin: "32px 34px" }}>
    <path d="M32 54C8 38 10 16 24 16c4 0 7 3 8 6 1-3 4-6 8-6 14 0 16 22-8 38Z" fill={CORAL} {...line} />
  </g>
);
const Eye = ({ on }: P) => (
  <g>
    <path d="M5 32q27-26 54 0-27 26-54 0Z" fill="#fff" {...line} />
    <g className={a(on, "haru-a-blink")} style={{ transformOrigin: "32px 32px" }}>
      <circle cx="32" cy="32" r="10" fill={SKY} {...line} />
      <circle cx="32" cy="32" r="4" fill={INK} />
    </g>
  </g>
);
const Face = ({ on }: P) => (
  <g className={a(on, "haru-a-bob")}>
    <circle cx="32" cy="32" r="22" fill={SUN} {...line} />
    <circle cx="24" cy="28" r="2.5" fill={INK} />
    <circle cx="40" cy="28" r="2.5" fill={INK} />
    <path d="M22 38q10 10 20 0" fill="none" {...line} />
  </g>
);
const Key = ({ on }: P) => (
  <g className={a(on, "haru-a-wiggle")} style={{ transformOrigin: "20px 32px" }}>
    <circle cx="20" cy="32" r="11" fill={SUN} {...line} />
    <circle cx="20" cy="32" r="3.5" fill="#fff" {...line} />
    <path d="M31 32h24M46 32v8M54 32v6" fill="none" {...line} />
  </g>
);

const ICONS: Record<string, (p: P) => ReactNode> = {
  hourglass: Hourglass, house: House, suitcase: Suitcase, tv: Tv, bed: Bed, coffee_off: Coffee, steak: Steak,
  salad: Salad, speaker: Speaker, angry: Angry, trend: Trend, calendar: Calendar, plane: Plane, bulb: Bulb,
  repeat: Repeat, thought: Thought, heart: Heart, eye: Eye, face: Face, key: Key,
};

export function StoryIcon({ name, on, size = 56 }: { name: string; on: boolean; size?: number }) {
  const Icon = ICONS[name];
  if (!Icon) return null;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="shrink-0 overflow-visible">
      <Icon on={on} />
    </svg>
  );
}
