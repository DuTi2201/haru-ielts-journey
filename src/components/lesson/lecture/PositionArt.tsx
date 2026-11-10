/** Position words drawn in code: one ball and one box, always the same two objects, so only the
 * place of the ball changes and the meaning cannot be mistaken. The coral ball is the thing
 * being placed; the wooden box is what it is placed against. Side view, flat ground. */
import type { ReactNode } from "react";

const INK = "#24305e";
const BOX = "#f2c078";
const BOX_DARK = "#d99b4a";
const BALL = "#ff7a6b";
const GROUND = "#e6defa";
const HOLE = "#8a5a2b";
const W = 4; // outline

const Ball = ({ x, y, r = 16 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={BALL} stroke={INK} strokeWidth={W} />
    <path
      d={`M${x - r * 0.55} ${y - r * 0.2} A${r * 0.6} ${r * 0.6} 0 0 1 ${x - r * 0.1} ${y - r * 0.6}`}
      stroke="#fff"
      strokeWidth={3}
      strokeLinecap="round"
      fill="none"
      opacity={0.85}
    />
  </g>
);

/** a closed box standing on `base`, left edge `x`, `w` wide, `h` tall */
const Box = ({ x, base, w = 54, h = 46 }: { x: number; base: number; w?: number; h?: number }) => (
  <g>
    <rect x={x} y={base - h} width={w} height={h} rx={5} fill={BOX} stroke={INK} strokeWidth={W} />
    <rect
      x={x + w * 0.36}
      y={base - h}
      width={w * 0.28}
      height={h * 0.3}
      fill={BOX_DARK}
      stroke={INK}
      strokeWidth={3}
    />
  </g>
);

const Arrow = ({ d }: { d: string }) => (
  <path
    d={d}
    stroke={INK}
    strokeWidth={4}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
);

const SCENES: Record<string, () => ReactNode> = {
  // on top of the box
  위: () => (
    <>
      <Box x={53} base={104} />
      <Ball x={80} y={42} />
      <Arrow d="M80 22 V10 M74 16 L80 10 L86 16" />
    </>
  ),
  // under a table that carries the box
  아래: () => (
    <>
      <Box x={53} base={58} w={54} h={40} />
      <rect
        x={30}
        y={58}
        width={100}
        height={9}
        rx={3}
        fill={BOX_DARK}
        stroke={INK}
        strokeWidth={W}
      />
      <path d="M40 67 V104 M120 67 V104" stroke={INK} strokeWidth={W} strokeLinecap="round" />
      <Ball x={80} y={88} r={15} />
    </>
  ),
  // in front: nearer to the viewer, lower and in front of the box
  앞: () => (
    <>
      <Box x={52} base={104} w={60} h={50} />
      <Ball x={80} y={84} r={20} />
    </>
  ),
  // behind: the box hides most of the ball
  뒤: () => (
    <>
      <Ball x={100} y={68} r={18} />
      <Box x={40} base={104} w={68} h={50} />
    </>
  ),
  // beside: same ground line, touching distance
  옆: () => (
    <>
      <Box x={38} base={104} w={58} h={50} />
      <Ball x={112} y={88} />
    </>
  ),
  // inside: open box, the ball sits within it
  안: () => (
    <>
      <rect x={44} y={46} width={72} height={58} rx={6} fill={HOLE} stroke={INK} strokeWidth={W} />
      <Ball x={80} y={74} r={17} />
      <path
        d="M44 76 H116 V98 a6 6 0 0 1 -6 6 H50 a6 6 0 0 1 -6 -6 Z"
        fill={BOX}
        stroke={INK}
        strokeWidth={W}
        strokeLinejoin="round"
      />
      <Arrow d="M80 20 V32 M74 26 L80 32 L86 26" />
    </>
  ),
  // outside: ball is out of the open box
  밖: () => (
    <>
      <rect x={20} y={46} width={66} height={58} rx={6} fill={HOLE} stroke={INK} strokeWidth={W} />
      <path
        d="M20 72 H86 V98 a6 6 0 0 1 -6 6 H26 a6 6 0 0 1 -6 -6 Z"
        fill={BOX}
        stroke={INK}
        strokeWidth={W}
        strokeLinejoin="round"
      />
      <Ball x={120} y={88} />
      <Arrow d="M64 36 Q92 20 112 58 M104 52 L112 58 L113 48" />
    </>
  ),
  // between two boxes
  사이: () => (
    <>
      <Box x={8} base={104} w={44} h={48} />
      <Box x={108} base={104} w={44} h={48} />
      <Ball x={80} y={88} />
      <Arrow d="M58 36 H102 M64 30 L58 36 L64 42 M96 30 L102 36 L96 42" />
    </>
  ),
  // right / left: the field is split down the middle and the ball is on that side
  오른쪽: () => (
    <>
      <rect x={80} y={20} width={72} height={84} rx={8} fill="#ffe3df" />
      <path
        d="M80 16 V108"
        stroke={INK}
        strokeWidth={3}
        strokeDasharray="6 6"
        strokeLinecap="round"
      />
      <Box x={14} base={104} w={44} h={44} />
      <Ball x={116} y={88} />
      <Arrow d="M92 46 H140 M132 38 L140 46 L132 54" />
    </>
  ),
  왼쪽: () => (
    <>
      <rect x={8} y={20} width={72} height={84} rx={8} fill="#ffe3df" />
      <path
        d="M80 16 V108"
        stroke={INK}
        strokeWidth={3}
        strokeDasharray="6 6"
        strokeLinecap="round"
      />
      <Box x={102} base={104} w={44} h={44} />
      <Ball x={44} y={88} />
      <Arrow d="M68 46 H20 M28 38 L20 46 L28 54" />
    </>
  ),
};

export const POSITION_WORDS = Object.keys(SCENES);

export const hasPositionArt = (hangul: string | null | undefined): boolean =>
  !!hangul && hangul in SCENES;

const MEANING: Record<string, string> = {
  위: "quả bóng ở trên cái hộp",
  아래: "quả bóng ở dưới cái bàn",
  앞: "quả bóng ở phía trước cái hộp",
  뒤: "quả bóng ở phía sau cái hộp",
  옆: "quả bóng ở bên cạnh cái hộp",
  안: "quả bóng ở trong cái hộp",
  밖: "quả bóng ở ngoài cái hộp",
  사이: "quả bóng ở giữa hai cái hộp",
  오른쪽: "quả bóng ở bên phải",
  왼쪽: "quả bóng ở bên trái",
};

/** The picture of one position word; renders nothing for any other word. */
export function PositionArt({
  hangul,
  className,
  alt = false,
}: {
  hangul: string;
  className?: string | undefined;
  /** name the drawing for a screen reader (when nothing next to it says the meaning) */
  alt?: boolean;
}) {
  const scene = SCENES[hangul];
  if (!scene) return null;
  return (
    <svg
      viewBox="0 -22 160 160"
      {...(alt ? { role: "img", "aria-label": MEANING[hangul] } : { "aria-hidden": true })}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x={0} y={-22} width={160} height={160} fill="#fff" />
      <rect x={0} y={104} width={160} height={34} fill={GROUND} />
      <path d="M0 104 H160" stroke={INK} strokeWidth={3} />
      {scene()}
    </svg>
  );
}
