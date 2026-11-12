/** Flat vector pictures for the abstract words of the C1 lectures (Day 7). Same outline and palette
 * as StoryArt. Each picture shows the SHADE of a word, not a translation: the scale that tips for
 * assess, the magnifier that follows traces for deduce, the ripples that spread for ponder, the
 * gavel for a jury that deliberates. They move only while their own sentence is being said. */
import type { ReactNode } from "react";

const INK = "#24305e";
const CORAL = "#ff7a6b";
const SUN = "#ffd166";
const MINT = "#7fd8b5";
const SKY = "#8ecbff";
const WOOD = "#f2c078";
const LAV = "#e6defa";
const NAVY = "#4a5a9e";
const W = 3;

type P = { on: boolean };
const a = (on: boolean, cls: string) => (on ? cls : "");
const line = { stroke: INK, strokeWidth: W, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const box = { transformBox: "fill-box" as const, transformOrigin: "center" };

/** assess, take into consideration, strike a balance: weighing two sides */
const Scales = ({ on }: P) => (
  <g>
    <path d="M32 10v42M20 56h24" {...line} />
    <g className={a(on, "haru-a-tilt")} style={{ transformOrigin: "32px 14px" }}>
      <path d="M10 16h44" {...line} />
      <path d="M10 16 4 34h12Z" fill={SUN} {...line} />
      <path d="M54 16 48 34h12Z" fill={MINT} {...line} />
    </g>
    <circle cx="32" cy="14" r="3.5" fill="#fff" {...line} />
  </g>
);

/** deduce: follow the traces to the conclusion */
const Magnifier = ({ on }: P) => (
  <g>
    <path d="M8 54h4M16 50h4M24 54h4" {...line} strokeDasharray="1 5" />
    <g className={a(on, "haru-a-slide")}>
      <circle cx="28" cy="26" r="15" fill="#fff" {...line} />
      <path d="M20 22q4-6 11-4" fill="none" stroke={SKY} strokeWidth="3" strokeLinecap="round" />
      <path d="M39 37l15 15" {...line} strokeWidth="6" />
      <path d="M24 28h8M28 24v8" {...line} className={a(on, "haru-a-wave")} />
    </g>
  </g>
);

/** baffle: head spinning, not understanding */
const Dizzy = ({ on }: P) => (
  <g>
    <circle cx="32" cy="36" r="20" fill={LAV} {...line} />
    <g className={a(on, "haru-a-spin")} style={{ ...box }}>
      <path d="M20 30a4 4 0 1 1 4 4 2 2 0 1 1-2-2" fill="none" {...line} strokeWidth="2.5" />
    </g>
    <g className={a(on, "haru-a-spin")} style={{ ...box }}>
      <path d="M40 30a4 4 0 1 1 4 4 2 2 0 1 1-2-2" fill="none" {...line} strokeWidth="2.5" />
    </g>
    <path d="M22 48q5-4 10 0t10 0" fill="none" {...line} />
    <g className={a(on, "haru-a-bob")}>
      <path d="M26 8q0-5 6-5t6 5q0 4-6 6" fill="none" {...line} />
      <circle cx="32" cy="20" r="1.5" fill={INK} />
    </g>
  </g>
);

/** estimate: a rough size, not the exact number */
const Ruler = ({ on }: P) => (
  <g>
    <path d="M18 14q5-5 10 0t10 0t10 0M18 24q5-5 10 0t10 0t10 0" fill="none" stroke={CORAL} strokeWidth="4" strokeLinecap="round" className={a(on, "haru-a-wave")} />
    <rect x="6" y="36" width="52" height="16" rx="3" fill={SUN} {...line} />
    <path d="M14 36v7M22 36v5M30 36v7M38 36v5M46 36v7" {...line} />
  </g>
);

/** deliberate: a jury reaching a verdict */
const Gavel = ({ on }: P) => (
  <g>
    <rect x="30" y="52" width="28" height="7" rx="2" fill={WOOD} {...line} />
    <g className={a(on, "haru-a-hit")} style={{ transformOrigin: "20px 46px" }}>
      <path d="M22 44 44 22" {...line} strokeWidth="5" />
      <rect x="28" y="8" width="26" height="14" rx="4" fill={WOOD} {...line} transform="rotate(45 41 15)" />
    </g>
    <path d="M44 46l4 4M52 44l5 1M48 38l5-3" {...line} className={a(on, "haru-a-wave")} />
  </g>
);

/** reflect: look back at yourself */
const Mirror = ({ on }: P) => (
  <g>
    <ellipse cx="32" cy="26" rx="18" ry="21" fill={SKY} {...line} />
    <rect x="28" y="46" width="8" height="12" rx="2" fill={WOOD} {...line} />
    <g className={a(on, "haru-a-sweep")}>
      <path d="M22 16l6-6M20 28l16-16" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </g>
    <circle cx="32" cy="28" r="5" fill="#fff" opacity="0.8" />
  </g>
);

/** dilemma: two ways, cannot choose both */
const Crossroads = ({ on }: P) => (
  <g>
    <path d="M32 8v48M24 56h16" {...line} />
    <path d="M30 12H10l-5 6 5 6h20Z" fill={CORAL} {...line} className={a(on, "haru-a-wave")} />
    <path d="M34 30h20l5 6-5 6H34Z" fill={MINT} {...line} className={a(on, "haru-a-wave2")} />
  </g>
);

/** paradox: two things that fight inside one statement */
const Paradox = ({ on }: P) => (
  <g>
    <g className={a(on, "haru-a-slide")}>
      <path d="M4 24h24M22 17l7 7-7 7" fill="none" stroke={CORAL} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <g className={a(on, "haru-a-slide2")}>
      <path d="M60 42H36M42 35l-7 7 7 7" fill="none" stroke={NAVY} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <path d="M32 8v10M32 30v4M32 46v10" {...line} strokeDasharray="1 5" />
  </g>
);

/** hunch, intuition: a spark with no evidence behind it */
const Bolt = ({ on }: P) => (
  <g>
    <path d="M36 4 16 36h13l-5 24 24-34H34Z" fill={SUN} {...line} className={a(on, "haru-a-flicker")} />
    <path d="M8 18l5 3M56 20l-5 3M6 44l5-2" {...line} className={a(on, "haru-a-wave")} />
  </g>
);

/** guesswork: a roll of the dice */
const Dice = ({ on }: P) => (
  <g className={a(on, "haru-a-shake")} style={{ transformOrigin: "32px 34px" }}>
    <rect x="12" y="14" width="40" height="40" rx="8" fill="#fff" {...line} />
    <circle cx="23" cy="25" r="3" fill={INK} />
    <circle cx="41" cy="25" r="3" fill={INK} />
    <circle cx="32" cy="34" r="3" fill={INK} />
    <circle cx="23" cy="43" r="3" fill={INK} />
    <circle cx="41" cy="43" r="3" fill={INK} />
  </g>
);

/** plausible: sounds reasonable, ticks the box */
const CheckBubble = ({ on }: P) => (
  <g>
    <path d="M10 10h44a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H30L20 54V42H10a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Z" fill="#fff" {...line} />
    <path pathLength={1} d="M19 26l9 9 17-17" fill="none" stroke={MINT} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className={a(on, "haru-a-draw")} />
  </g>
);

/** grasp: the hand closes around the idea */
const Grasp = ({ on }: P) => (
  <g>
    <circle cx="32" cy="32" r="10" fill={SUN} {...line} className={a(on, "haru-a-pulse")} style={{ transformOrigin: "32px 32px" }} />
    <g className={a(on, "haru-a-grabl")}>
      <path d="M6 16q16 4 16 16T6 48" fill="none" {...line} strokeWidth="5" />
    </g>
    <g className={a(on, "haru-a-grabr")}>
      <path d="M58 16Q42 20 42 32T58 48" fill="none" {...line} strokeWidth="5" />
    </g>
  </g>
);

/** ponder: a stone sinks, thoughts spread in rings */
const Ripples = ({ on }: P) => (
  <g>
    <circle cx="32" cy="10" r="4" fill={NAVY} {...line} className={a(on, "haru-a-bob")} />
    <ellipse cx="32" cy="42" rx="26" ry="9" fill="none" stroke={SKY} strokeWidth="3" className={a(on, "haru-a-ripple")} style={{ transformOrigin: "32px 42px" }} />
    <ellipse cx="32" cy="42" rx="26" ry="9" fill="none" stroke={SKY} strokeWidth="3" className={a(on, "haru-a-ripple2")} style={{ transformOrigin: "32px 42px" }} />
    <ellipse cx="32" cy="42" rx="12" ry="4" fill={SKY} {...line} />
  </g>
);

/** gather: you hear it from someone */
const Ear = ({ on }: P) => (
  <g>
    <path d="M26 56c-8-1-10-8-8-16 0-12 6-26 20-26 10 0 14 8 12 16-2 8-12 10-12 18 0 4-4 9-12 8Z" fill={WOOD} {...line} />
    <path d="M30 28q8-8 12 2-6 2-8 8" fill="none" {...line} />
    <path d="M8 22q-4 10 0 20M2 16q-8 16 0 32" fill="none" {...line} className={a(on, "haru-a-wave")} />
  </g>
);

/** reckon, query: a plain question */
const Qmark = ({ on }: P) => (
  <g className={a(on, "haru-a-bob")}>
    <path d="M10 8h44a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H30L20 56V44H10a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4Z" fill={LAV} {...line} />
    <path d="M25 22q0-8 7-8t7 7q0 5-7 8v3" fill="none" {...line} strokeWidth="4" />
    <circle cx="32" cy="38" r="2" fill={INK} />
  </g>
);

/** discriminate: one person pushed apart by a wall */
const Split = ({ on }: P) => (
  <g>
    <circle cx="14" cy="20" r="7" fill={SUN} {...line} />
    <path d="M4 46q10-16 20 0Z" fill={SUN} {...line} />
    <g className={a(on, "haru-a-away")}>
      <circle cx="50" cy="20" r="7" fill={MINT} {...line} />
      <path d="M40 46q10-16 20 0Z" fill={MINT} {...line} />
    </g>
    <rect x="29" y="8" width="6" height="46" rx="2" fill={INK} />
    <path d="M26 24l12 12M38 24 26 36" stroke={CORAL} strokeWidth="4" strokeLinecap="round" />
  </g>
);

/** speculate: seeing the future in a crystal ball, no proof */
const Crystal = ({ on }: P) => (
  <g>
    <path d="M14 56h36l-5-10H19Z" fill={WOOD} {...line} />
    <circle cx="32" cy="28" r="19" fill={LAV} {...line} />
    <path d="M22 20q3-6 10-6" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    <path d="M32 24l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill={SUN} {...line} strokeWidth="2" className={a(on, "haru-a-pulse")} style={{ transformOrigin: "32px 31px" }} />
  </g>
);

/** assume, presume: a dotted outline, taken as true without checking */
const DottedCheck = ({ on }: P) => (
  <g className={a(on, "haru-a-wave")}>
    <rect x="8" y="8" width="48" height="48" rx="10" fill="none" stroke={INK} strokeWidth="3" strokeDasharray="5 5" strokeLinecap="round" />
    <path d="M20 33l9 9 16-18" fill="none" stroke={MINT} strokeWidth="6" strokeDasharray="1 8" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

/** justify: a shield with a reason behind it */
const Shield = ({ on }: P) => (
  <g className={a(on, "haru-a-pulse")} style={{ transformOrigin: "32px 34px" }}>
    <path d="M32 6 10 14v16c0 14 9 22 22 28 13-6 22-14 22-28V14Z" fill={SKY} {...line} />
    <path d="M21 31l8 8 14-16" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

/** curriculum: the planned road of a course */
const Roadmap = ({ on }: P) => (
  <g>
    <path pathLength={1} d="M12 56C12 42 52 46 52 32S14 26 18 14" fill="none" stroke={CORAL} strokeWidth="5" strokeLinecap="round" className={a(on, "haru-a-draw")} />
    <circle cx="12" cy="56" r="4" fill="#fff" {...line} />
    <path d="M18 14V4l12 4-12 4" fill={SUN} {...line} />
  </g>
);

/** tuition: the fee */
const Coin = ({ on }: P) => (
  <g className={a(on, "haru-a-coin")} style={{ transformOrigin: "32px 32px" }}>
    <circle cx="32" cy="32" r="21" fill={SUN} {...line} />
    <circle cx="32" cy="32" r="15" fill="none" stroke={INK} strokeWidth="2" />
    <text x="32" y="40" textAnchor="middle" fontSize="22" fontWeight="800" fill={INK}>$</text>
  </g>
);

/** seminar: everyone talks */
const Discuss = ({ on }: P) => (
  <g>
    <path d="M4 6h26a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H14l-6 6v-6H4a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z" fill={SKY} {...line} className={a(on, "haru-a-pop")} />
    <path d="M60 22H36a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14l6 6v-6h4a3 3 0 0 0 3-3V25a3 3 0 0 0-3-3Z" fill={MINT} {...line} className={a(on, "haru-a-pop2")} />
    <path d="M10 44h22a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H20l-5 4v-4h-5a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Z" fill={SUN} {...line} className={a(on, "haru-a-pop3")} />
  </g>
);

/** tutorial: working a problem through, pencil in hand */
const PencilSheet = ({ on }: P) => (
  <g>
    <rect x="8" y="6" width="38" height="50" rx="4" fill="#fff" {...line} />
    <path d="M15 18h24M15 27h24M15 36h14" {...line} />
    <g className={a(on, "haru-a-write")}>
      <path d="M36 52l4-12 18-18 8 8-18 18Z" fill={SUN} {...line} transform="translate(-6 -2)" />
    </g>
  </g>
);

/** cram: the clock is running, everything at once */
const Clock = ({ on }: P) => (
  <g>
    <circle cx="32" cy="36" r="20" fill="#fff" {...line} />
    <path d="M14 14l8 6M50 14l-8 6" {...line} strokeWidth="5" className={a(on, "haru-a-shake")} style={{ transformOrigin: "32px 14px" }} />
    <g className={a(on, "haru-a-spinfast")} style={{ transformOrigin: "32px 36px" }}>
      <path d="M32 36V22" {...line} />
    </g>
    <path d="M32 36l8 4" {...line} />
    <circle cx="32" cy="36" r="2.5" fill={INK} />
  </g>
);

/** mock exam: a rehearsal of the real paper */
const MockPaper = ({ on }: P) => (
  <g>
    <g className={a(on, "haru-a-slide")}>
      <rect x="18" y="6" width="38" height="48" rx="4" fill="none" stroke={INK} strokeWidth="3" strokeDasharray="5 4" />
    </g>
    <rect x="8" y="12" width="38" height="48" rx="4" fill="#fff" {...line} />
    <path d="M15 26h24M15 35h24M15 44h12" {...line} />
    <path d="M32 18h8" stroke={CORAL} strokeWidth="4" strokeLinecap="round" />
  </g>
);

/** conscientious: every task ticked off, one by one */
const Checklist = ({ on }: P) => (
  <g>
    <rect x="8" y="6" width="48" height="52" rx="5" fill="#fff" {...line} />
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <path d={`M16 ${20 + i * 14}h4`} {...line} strokeWidth="2" opacity="0" />
        <path
          pathLength={1}
          d={`M15 ${20 + i * 14}l4 4 7-8`}
          fill="none"
          stroke={MINT}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={a(on, "haru-a-draw")}
          style={on ? { animationDelay: `${i * 0.35}s` } : undefined}
        />
        <path d={`M31 ${22 + i * 14}h17`} {...line} strokeWidth="2.5" />
      </g>
    ))}
  </g>
);

/** knowledgeable: an open book with light coming out of it */
const Book = ({ on }: P) => (
  <g>
    <path d="M6 18q13-6 26 2v36Q19 48 6 54Z" fill="#fff" {...line} />
    <path d="M58 18q-13-6-26 2v36q13-8 26-2Z" fill={LAV} {...line} />
    <path d="M14 28q7-2 12 1M14 36q7-2 12 1" fill="none" {...line} strokeWidth="2" />
    <path d="M32 12V4M20 8l3 5M44 8l-3 5" {...line} className={a(on, "haru-a-wave")} />
  </g>
);

/** plagiarise: a copy passed off as your own */
const Copy = ({ on }: P) => (
  <g>
    <rect x="4" y="8" width="28" height="38" rx="3" fill="#fff" {...line} />
    <path d="M10 18h16M10 26h16M10 34h10" {...line} />
    <g className={a(on, "haru-a-slide")}>
      <path d="M33 30h10M39 25l5 5-5 5" fill="none" stroke={CORAL} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <rect x="36" y="16" width="26" height="38" rx="3" fill="#fff" stroke={INK} strokeWidth="3" strokeDasharray="4 3" />
    <text x="49" y="42" textAnchor="middle" fontSize="16" fontWeight="800" fill={CORAL}>©</text>
  </g>
);

/** self-study: just you, a desk lamp, a quiet room */
const Lamp = ({ on }: P) => (
  <g>
    <path d="M18 60h24M30 60V30" {...line} />
    <path d="M30 30 40 12" {...line} strokeWidth="5" />
    <path d="M34 8 52 16 44 30 28 22Z" fill={CORAL} {...line} />
    <path d="M30 28 20 56h32l-6-24Z" fill={SUN} opacity="0.45" className={a(on, "haru-a-flicker")} />
  </g>
);

/** graduate: the cap in the air */
const Cap = ({ on }: P) => (
  <g className={a(on, "haru-a-fly")}>
    <path d="M32 14 4 26l28 12 28-12Z" fill={NAVY} {...line} />
    <path d="M16 34v10q16 9 32 0V34" fill={NAVY} {...line} />
    <path d="M58 27v14" {...line} />
    <circle cx="58" cy="44" r="3" fill={SUN} {...line} />
  </g>
);

/** special needs: a little extra support */
const PlusHeart = ({ on }: P) => (
  <g className={a(on, "haru-a-pulse")} style={{ transformOrigin: "32px 34px" }}>
    <path d="M32 56C6 40 8 14 23 14c4 0 7 3 9 7 2-4 5-7 9-7 15 0 17 26-9 42Z" fill={CORAL} {...line} />
    <path d="M32 26v16M24 34h16" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
  </g>
);

/** give lessons in: the teacher at the board */
const Board = ({ on }: P) => (
  <g>
    <rect x="5" y="8" width="54" height="36" rx="3" fill="#3b8f78" {...line} />
    <path pathLength={1} d="M13 20h28M13 30h18" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" className={a(on, "haru-a-draw")} />
    <path d="M10 50h44" {...line} />
    <rect x="44" y="46" width="8" height="4" rx="1" fill="#fff" {...line} strokeWidth="2" />
  </g>
);

/** fate: a path laid out in the stars */
const Star = ({ on }: P) => (
  <g className={a(on, "haru-a-pulse")} style={{ transformOrigin: "32px 34px" }}>
    <path d="M32 6l8 17 18 2-13 13 3 18-16-9-16 9 3-18L6 25l18-2Z" fill={SUN} {...line} />
  </g>
);

export const WORD_ICONS: Record<string, (p: P) => ReactNode> = {
  scales: Scales, magnifier: Magnifier, dizzy: Dizzy, ruler: Ruler, gavel: Gavel, mirror: Mirror, crossroads: Crossroads,
  paradox: Paradox, bolt: Bolt, dice: Dice, check_bubble: CheckBubble, grasp: Grasp, ripples: Ripples, ear: Ear, qmark: Qmark,
  split: Split, crystal: Crystal, dotted_check: DottedCheck, shield: Shield, roadmap: Roadmap, coin: Coin, discuss: Discuss,
  pencil_sheet: PencilSheet, clock: Clock, mock_paper: MockPaper, checklist: Checklist, book: Book, copy: Copy, lamp: Lamp,
  cap: Cap, plus_heart: PlusHeart, board: Board, star: Star,
};

/** The picture that shows a Day 7 word on its own slide (a word not listed keeps its usual picture). */
export const WORD_PICTURE: Record<string, string> = {
  assess: "scales", assume: "dotted_check", presume: "dotted_check", speculate: "crystal", estimate: "ruler", deduce: "magnifier",
  justify: "shield", reflect: "mirror", discriminate: "split", baffle: "dizzy",
  grasp: "grasp", plausible: "check_bubble", gather: "ear", reckon: "qmark", suppose: "qmark", ponder: "ripples",
  contemplate: "eye", deliberate: "gavel",
  notion: "bulb", query: "qmark", dilemma: "crossroads", hunch: "bolt", intuition: "eye", guesswork: "dice", genius: "bulb",
  faith: "heart", paradox: "paradox",
  "special needs": "plus_heart", conscientious: "checklist", cram: "clock", "mock exam": "mock_paper", knowledgeable: "book",
  curriculum: "roadmap", "give lessons in": "board", tuition: "coin", seminar: "discuss", tutorial: "pencil_sheet",
  plagiarise: "copy", "self-study": "lamp", graduate: "cap",
  "take into consideration": "scales", "strike a balance": "scales", "cross your mind": "thought", "figure out": "magnifier", "come up with": "bulb",
};
