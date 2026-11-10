import { PenLine } from "lucide-react";

import type {
  ExerciseResultOut,
  PracticeGuideBlock,
  PracticeItem,
  WriteEssayOut,
  WriteFillOut,
} from "@/lib/api/types";
import { Disclosure, GuideBlocks } from "../Disclosure";
import { ExerciseView } from "../ExerciseView";
import type { AnswerEvent } from "../McqExercise";

/** The written part of a topic review that is not the Viết 54 capstone: the Viết 51, 52 and 53
 * of the same exam sheet (fill-ins and the chart description), in the order of the real paper.
 * Without this block they would be in the lesson's data but nowhere on screen. */
export function ReviewWriting({
  lessonId,
  items,
  guide,
  previous,
  onAnswer,
}: {
  lessonId: number;
  items: (WriteFillOut | WriteEssayOut)[];
  /** the bank's Viết guide (how to read the task, the frames, the usual mistakes) */
  guide: PracticeGuideBlock[];
  previous: Record<string, ExerciseResultOut>;
  onAnswer: (a: AnswerEvent) => void;
}) {
  if (items.length === 0 && guide.length === 0) return null;
  const done = items.filter((i) => previous[i.id]).length;
  return (
    <section aria-label="Viết các câu còn lại của đề" className="mb-8 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <PenLine size={20} strokeWidth={2.4} aria-hidden="true" className="text-blue" />
          {items.length > 0 ? "Phần Viết trước câu 54" : "Hướng dẫn làm phần Viết"}
          {items.length > 0 && (
            <span className="text-xs font-semibold tabular-nums text-ink-2">
              · {done}/{items.length}
            </span>
          )}
        </h2>
        {items.length > 0 && (
          <p className="mt-0.5 text-xs font-medium leading-5 text-ink-2">
            Các câu Viết còn lại của một đề thi, theo đúng thứ tự trên giấy thi: câu 51 và 52 điền
            chỗ trống (10 điểm mỗi câu), câu 53 mô tả biểu đồ (30 điểm). Làm xong rồi mới sang bài
            Viết 54 bên dưới.
          </p>
        )}
      </div>
      {guide.length > 0 && (
        <Disclosure title="Hướng dẫn chi tiết cho người mới: cách đọc đề, khung và lỗi hay gặp">
          <GuideBlocks blocks={guide} />
        </Disclosure>
      )}
      {items.map((item) => (
        <ExerciseView
          key={item.id}
          lessonId={lessonId}
          item={item as PracticeItem}
          once={false}
          previous={previous}
          onAnswer={onAnswer}
        />
      ))}
    </section>
  );
}
