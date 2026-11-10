/** Where a learner is in the course decides how a lesson is shown to them (what is said, what is
 * open, what comes first): the content is the same, the scaffolding fades as they go.
 *
 * - foundation (Nền tảng): everything in Vietnamese, how a form is built shown on the card, the
 *   lecture with slides is the first step: the teacher explains before the learner tries
 * - beginner / intermediate (Sơ cấp, Trung cấp): words → patterns → a check, the why behind a tap,
 *   then the lesson's dialogue as a chat, then practice by skill
 * - advanced (Cao cấp): Korean first — the meanings of examples behind a tap, look-alikes up front
 *   (nuance is what is learnt there)
 * - writing (Viết 54), reading (Đọc hiểu), life (Nhập cảnh & cư trú): a skill course; the lesson
 *   says first what it produces (a paragraph, a form filled in, a text understood) and goes straight
 *   to it on demand
 * Pure; read from the lesson's slug, track and level. */
import type { LessonOut, LessonTrack } from "@/lib/api/types";

export type Stage =
  "foundation" | "beginner" | "intermediate" | "advanced" | "writing" | "reading" | "life";

export interface StageProfile {
  stage: Stage;
  /** a word for the stage, on the lesson's header */
  label: string;
  /** the card shows how a pattern is built without opening «Vì sao?» */
  structureOnCard: boolean;
  /** the meanings of example sentences show at once (else behind a tap) */
  examplesInVietnamese: boolean;
  /** the slide lecture is the first step of the first sitting (else it waits in a fold) */
  lectureFirst: boolean;
  /** what the lesson produces, said up front; null for a regular lesson */
  product: { title: string; hint: string; skill: "writing" | "reading" } | null;
  /** practice offered at the end of a sitting */
  practice: ("chat" | "talk" | "write" | "review")[];
}

export function stageOf(lesson: Pick<LessonOut, "slug" | "track" | "level">): Stage {
  const slug = lesson.slug ?? "";
  if (slug.startsWith("sinh-hoat-00-nen-tang")) return "foundation";
  if (slug.startsWith("viet-nghi-luan-")) return "writing";
  if (slug.startsWith("nhap-canh-")) return "life";
  if (slug.startsWith("xa-hoi-22-")) return "reading";
  const track: LessonTrack | null | undefined = lesson.track;
  if (track === "advanced") return "advanced";
  if (track === "beginner") return "beginner";
  return "intermediate";
}

const PROFILES: Record<Stage, Omit<StageProfile, "stage">> = {
  foundation: {
    label: "Nền tảng",
    structureOnCard: true,
    examplesInVietnamese: true,
    lectureFirst: true,
    product: null,
    practice: ["review", "chat"],
  },
  beginner: {
    label: "Sơ cấp",
    structureOnCard: true,
    examplesInVietnamese: true,
    lectureFirst: false,
    product: null,
    practice: ["chat", "talk", "review"],
  },
  intermediate: {
    label: "Trung cấp",
    structureOnCard: false,
    examplesInVietnamese: true,
    lectureFirst: false,
    product: null,
    practice: ["chat", "talk", "write", "review"],
  },
  advanced: {
    label: "Cao cấp",
    structureOnCard: false,
    examplesInVietnamese: false,
    lectureFirst: false,
    product: null,
    practice: ["talk", "write", "review"],
  },
  writing: {
    label: "Viết 54",
    structureOnCard: false,
    examplesInVietnamese: true,
    lectureFirst: false,
    product: {
      title: "Sản phẩm của bài: đoạn văn của bạn",
      hint: "Đọc đề và bài mẫu, học các mẫu câu, rồi viết. Haru chấm theo thang điểm của đề.",
      skill: "writing",
    },
    practice: ["write", "review"],
  },
  reading: {
    label: "Đọc hiểu",
    structureOnCard: false,
    examplesInVietnamese: false,
    lectureFirst: false,
    product: {
      title: "Sản phẩm của bài: đọc ra chủ đề, thái độ, mục đích",
      hint: "Học dấu hiệu nhận ra, rồi làm các bài đọc như đề TOPIK.",
      skill: "reading",
    },
    practice: ["review"],
  },
  life: {
    label: "Đời sống ở Hàn",
    structureOnCard: true,
    examplesInVietnamese: true,
    lectureFirst: false,
    product: {
      title: "Sản phẩm của bài: làm được việc thật",
      hint: "Từ và mẫu câu cho tình huống, rồi đọc và điền giấy tờ như ở Hàn.",
      skill: "writing",
    },
    practice: ["chat", "talk", "review"],
  },
};

export function stageProfile(lesson: Pick<LessonOut, "slug" | "track" | "level">): StageProfile {
  const stage = stageOf(lesson);
  return { stage, ...PROFILES[stage] };
}
