import { Headphones } from "lucide-react";

import type { DictationOut, ExerciseResultOut } from "@/lib/api/types";
import { DictationExercise } from "../DictationExercise";
import type { AnswerEvent } from "../McqExercise";

/** Under the Viết & Nói capstone of a topic review: a few short dictations. They are kept few on
 * purpose — dictation trains the ear for the speed of the exam, but it pulls attention to small
 * details and wears the learner out when there is too much of it. */
export function ReviewDictation({
  lessonId,
  items,
  previous,
  onAnswer,
}: {
  lessonId: number;
  items: DictationOut[];
  previous: Record<string, ExerciseResultOut>;
  onAnswer: (a: AnswerEvent) => void;
}) {
  if (items.length === 0) return null;
  const done = items.filter((d) => previous[d.id]).length;
  return (
    <section aria-label="Chép chính tả" className="mt-8 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Headphones size={20} strokeWidth={2.4} aria-hidden="true" className="text-blue" />
          Chép chính tả
          <span className="text-xs font-semibold tabular-nums text-ink-2">
            · {done}/{items.length}
          </span>
        </h2>
        <p className="mt-0.5 text-xs font-medium leading-5 text-ink-2">
          Cách luyện tai rất tốt cho TOPIK 3–5: nghe, chép lại, rồi so với lời thoại. Mục tiêu là
          quen với tốc độ nói của đề thi, không phải chép đúng từng chữ. Dễ sa vào tiểu tiết nên chỉ
          cần làm <b>một vài bài</b>, đừng ép làm hết. Chép xong nhớ <b>nghe lại và học thuộc từ</b>
          .
        </p>
      </div>
      {items.map((d) => (
        <DictationExercise
          key={d.id}
          lessonId={lessonId}
          exercise={d}
          previous={previous}
          onAnswer={onAnswer}
        />
      ))}
    </section>
  );
}
