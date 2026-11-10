import type { VocabItemOut, VocabPriority } from "@/lib/api/types";

/** Which words a lesson's list shows: all of them, only the ones to learn now, or only the ones
 * to recognise. */
export type PriorityView = "all" | "core" | "recognize";

export const PRIORITY_LABEL: Record<VocabPriority, string> = {
  core: "Cần thuộc",
  recognize: "Nhận ra",
};

export const PRIORITY_TITLE: Record<VocabPriority, string> = {
  core: "Từ cần thuộc ngay: các bài sau xây trên những từ này, nên học để dùng được, không chỉ hiểu.",
  recognize:
    "Chỉ cần nhận ra: gặp trong bài đọc, bài nghe hay đề thi thì hiểu được là đủ, chưa cần tự nói hay viết.",
};

/** The words of each group, so a switch can say how many it holds. */
export function priorityCounts(vocab: Pick<VocabItemOut, "priority">[]) {
  let core = 0;
  let recognize = 0;
  for (const v of vocab) {
    if (v.priority === "core") core += 1;
    else if (v.priority === "recognize") recognize += 1;
  }
  return { all: vocab.length, core, recognize };
}

export function byPriority<T extends Pick<VocabItemOut, "priority">>(
  vocab: T[],
  view: PriorityView,
): T[] {
  return view === "all" ? vocab : vocab.filter((v) => v.priority === view);
}
