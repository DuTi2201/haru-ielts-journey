/* Hành trình Thiên Nga: the pictures (owner's artwork, made with Gemini; cut out and compressed in
 * src/assets/journey). Bundled imports, so each file is fetched only when a screen shows it. */
import castle1DayA from "@/assets/journey/castle1-day-a.webp";
import castle1DayB from "@/assets/journey/castle1-day-b.webp";
import castle1Dark from "@/assets/journey/castle1-dark.webp";
import castle2Dark from "@/assets/journey/castle2-dark.webp";
import castle2Day from "@/assets/journey/castle2-day.webp";
import castle3Dark from "@/assets/journey/castle3-dark.webp";
import castle3Day from "@/assets/journey/castle3-day.webp";
import castle4Dark from "@/assets/journey/castle4-dark.webp";
import castle4Day from "@/assets/journey/castle4-day.webp";
import castle5Dark from "@/assets/journey/castle5-dark.webp";
import castle5Day from "@/assets/journey/castle5-day.webp";
import crowFlyA from "@/assets/journey/crow-fly-a.webp";
import crowFlyB from "@/assets/journey/crow-fly-b.webp";
import crowPerch from "@/assets/journey/crow-perch.webp";
import cursedA from "@/assets/journey/cursed-a.webp";
import cursedB from "@/assets/journey/cursed-b.webp";
import heroJourney from "@/assets/journey/hero-journey.webp";
import propCandle from "@/assets/journey/prop-candle.webp";
import propHourglass from "@/assets/journey/prop-hourglass.webp";
import propRose from "@/assets/journey/prop-rose.webp";
import propRoseWilted from "@/assets/journey/prop-rose-wilted.webp";
import propShield from "@/assets/journey/prop-shield.webp";
import stage1A from "@/assets/journey/stage1-a.webp";
import stage1B from "@/assets/journey/stage1-b.webp";
import stage2A from "@/assets/journey/stage2-a.webp";
import stage2B from "@/assets/journey/stage2-b.webp";
import stage3A from "@/assets/journey/stage3-a.webp";
import stage3B from "@/assets/journey/stage3-b.webp";
import stage4A from "@/assets/journey/stage4-a.webp";
import stage4B from "@/assets/journey/stage4-b.webp";
import stage5A from "@/assets/journey/stage5-a.webp";
import stage5B from "@/assets/journey/stage5-b.webp";
import stage5C from "@/assets/journey/stage5-c.webp";
import vinesFront from "@/assets/journey/vines-front.webp";
import featherGrey from "@/assets/journey/feather-grey.webp";
import featherStar from "@/assets/journey/feather-star.webp";
import featherWhite from "@/assets/journey/feather-white.webp";
import relicCompass from "@/assets/journey/relic-compass.webp";
import relicMirror from "@/assets/journey/relic-mirror.webp";
import relicQuill from "@/assets/journey/relic-quill.webp";
import ribbonFall from "@/assets/journey/ribbon-fall.webp";

export type Stage = 1 | 2 | 3 | 4 | 5;

export function asStage(n: number | null | undefined): Stage {
  const v = Math.round(n ?? 1);
  return (v < 1 ? 1 : v > 5 ? 5 : v) as Stage;
}

/** The castle of each stage: as it is, and abandoned (the learner has been away). Stage 1 has a
 * clear starry night (evening) and a misty one (the rest of the day). */
export const CASTLE: Record<Stage, { day: string; night?: string; dark: string }> = {
  1: { day: castle1DayB, night: castle1DayA, dark: castle1Dark },
  2: { day: castle2Day, dark: castle2Dark },
  3: { day: castle3Day, dark: castle3Dark },
  4: { day: castle4Day, dark: castle4Dark },
  5: { day: castle5Day, dark: castle5Dark },
};

/** The swan of each stage: two or three drawings of one pose, shown in turn. */
export const SWAN: Record<Stage, string[]> = {
  1: [stage1A, stage1B],
  2: [stage2A, stage2B],
  3: [stage3A, stage3B],
  4: [stage4A, stage4B],
  5: [stage5A, stage5B, stage5C],
};
export const SWAN_CURSED = [cursedA, cursedB];

export const CROW = { flyA: crowFlyA, flyB: crowFlyB, perch: crowPerch };
export const PROP = {
  candle: propCandle,
  hourglass: propHourglass,
  /** the rose in bloom, and the same rose wilting over its own fallen petals */
  rose: propRose,
  roseWilted: propRoseWilted,
  /** the weekly streak shield: a white swan feather turning from black */
  shield: propShield,
};
export const VINES = vinesFront;
/** Lông vũ: earned (white), waiting (grey, dusty) and starlight (the support lessons). */
export const FEATHER = { white: featherWhite, grey: featherGrey, star: featherStar };
/** The blindfold of chapter I, falling when Sơ cấp is finished. */
export const RIBBON = ribbonFall;
/** The relic of each support topic. */
export const RELIC_ART: Record<string, string> = {
  compass: relicCompass,
  quill: relicQuill,
  mirror: relicMirror,
};
export const HERO_JOURNEY = heroJourney;

/** The story of each stage (the tarot card of the Swords suit it borrows from, and what it means
 * for a learner). The card stays in the code as the drawings' brief; the learner sees the mood, not
 * the card: 8 → 2 → 6 Kiếm reads like a numbering mistake to anyone who does not read tarot. */
export const STAGES: Record<
  Stage,
  { name: string; card: string; line: string; say: string; mood: string; glow: string }
> = {
  1: {
    name: "Bóng tối trong tháp gai",
    card: "8 Kiếm",
    line: "Mắt bị bịt, quanh mình là kiếm của nỗi sợ nói sai. Nhưng ngọn nến vẫn còn cháy.",
    say: "Mình chưa nói được… nhưng ngọn nến vẫn còn cháy.",
    mood: "Lạc lối, chênh vênh",
    glow: "var(--purple)",
  },
  2: {
    name: "Vết nứt ánh sáng",
    card: "2 Kiếm",
    line: "Xong Sơ cấp, dải bịt mắt đã tuột xuống. Lông trắng mọc lại sau mỗi phần bài.",
    say: "Dải bịt mắt tuột rồi, lông trắng đang mọc lại!",
    mood: "Thức tỉnh",
    glow: "var(--purple)",
  },
  3: {
    name: "Vượt hồ đêm",
    card: "6 Kiếm",
    line: "Rời tháp gai, bơi qua hồ sương. Thanh kiếm nằm trên thuyền, chờ bạn xong Trung cấp.",
    say: "Kiếm đang chờ trên thuyền, bơi tiếp nào!",
    mood: "Lên đường",
    glow: "var(--blue)",
  },
  4: {
    name: "Bình minh trên vòm nhọn",
    card: "Át Kiếm",
    line: "Xong Trung cấp: kiếm giương cao toả sáng, gai đã nở thành hoa hồng.",
    say: "Kiếm đã sáng, gai đã nở hoa. Mình nói được rồi!",
    mood: "Sáng tỏ",
    glow: "var(--yellow-strong)",
  },
  5: {
    name: "Bạch Thiên Nga",
    card: "Vương Kiếm",
    line: "Xong Cao cấp, lời nguyền đã tan. Vương miện và quyền trượng là của bạn.",
    say: "Vương miện là của bạn. Giữ lâu đài luôn sáng nhé!",
    mood: "Tự do",
    glow: "var(--yellow-strong)",
  },
};
