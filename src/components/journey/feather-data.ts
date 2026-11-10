import { Compass, Feather as QuillIcon, Moon, Sparkles, type LucideIcon } from "lucide-react";

import type { JourneyChapterOut, JourneyOut } from "@/lib/api/types";

/* The data side of the journey's feathers (Feathers.tsx): the chapter being walked, the relics of
 * the support topics, and which relic the learner keeps beside the swan (this device). */

export const ROMAN_CH = ["", "I", "II", "III", "IV", "V"] as const;

/** The chapter the learner is in (I–IV); null once the crown is won. */
export function currentChapter(j: JourneyOut): JourneyChapterOut | null {
  if (j.stage >= 5) return null;
  return j.chapters?.find((c) => c.n === j.stage) ?? null;
}

/** The relic of each support topic (a picture replaces the icon when it arrives). */
export const RELICS: Record<
  string,
  { name: string; Icon: LucideIcon; tone: string; line: string }
> = {
  compass: {
    name: "La bàn ánh sao",
    Icon: Compass,
    tone: "oklch(0.85 0.1 80)",
    line: "La bàn ánh sao: đường sang Hàn đã rõ.",
  },
  quill: {
    name: "Bút lông thiên nga",
    Icon: QuillIcon,
    tone: "oklch(0.9 0.04 250)",
    line: "Bút lông thiên nga: viết câu 54 không còn sợ.",
  },
  mirror: {
    name: "Gương trăng",
    Icon: Moon,
    tone: "oklch(0.86 0.08 290)",
    line: "Gương trăng: đọc ra ý ẩn sau chữ.",
  },
};
const FALLBACK = { name: "Bảo vật", Icon: Sparkles, tone: "oklch(0.88 0.08 85)", line: "" };

export function relicOf(code: string, name?: string | null) {
  const r = RELICS[code] ?? FALLBACK;
  return { ...r, name: name ?? r.name };
}

const WORN = "haru.journey.relic";

/** The relic the learner keeps beside the swan (this device): the one picked, else the latest. */
export function wornRelic(relics: string[] | undefined): string | null {
  if (!relics?.length) return null;
  try {
    const picked = window.localStorage.getItem(WORN);
    if (picked && relics.includes(picked)) return picked;
  } catch {
    /* storage blocked: the latest one */
  }
  return relics[relics.length - 1] ?? null;
}

export function wearRelic(code: string): void {
  try {
    window.localStorage.setItem(WORN, code);
  } catch {
    /* storage blocked: the latest one stays */
  }
}
