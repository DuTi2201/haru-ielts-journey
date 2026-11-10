import type { ExerciseResultOut, PracticeItem } from "@/lib/api/types";
import type {
  BuildOrderOut,
  DictationOut,
  SpeakOut,
  WriteEssayOut,
  WriteFillOut,
} from "@/lib/api/types";
import { BuildOrder } from "./BuildOrder";
import { DictationExercise } from "./DictationExercise";
import { McqExercise, type AnswerEvent } from "./McqExercise";
import { SpeakTask } from "./SpeakTask";
import { WriteEssay } from "./WriteEssay";
import { WriteFill } from "./WriteFill";

/** One exercise of any kind, as the practice screen, the mixed review and the entry
 * diagnostic all show it. */
export function ExerciseView({
  lessonId,
  item,
  once,
  previous,
  onAnswer,
}: {
  lessonId: number;
  item: PracticeItem;
  once: boolean;
  previous: Record<string, ExerciseResultOut>;
  onAnswer: (a: AnswerEvent) => void;
}) {
  // (a multiple-choice exercise's `type` is free text — listen_picture, read_cloze… —
  // so the other kinds are told apart by guards rather than by a union switch)
  if (isBuildOrder(item)) {
    return <BuildOrder exercise={item} previous={previous} onAnswer={onAnswer} />;
  }
  if (isWriteFill(item)) {
    return (
      <WriteFill lessonId={lessonId} exercise={item} previous={previous} onAnswer={onAnswer} />
    );
  }
  if (isWriteEssay(item)) {
    return (
      <WriteEssay lessonId={lessonId} exercise={item} previous={previous} onAnswer={onAnswer} />
    );
  }
  if (isDictation(item)) {
    // (listened to as often as the learner likes: `once` does not apply)
    return (
      <DictationExercise
        lessonId={lessonId}
        exercise={item}
        previous={previous}
        onAnswer={onAnswer}
      />
    );
  }
  if (isSpeak(item)) {
    return (
      <SpeakTask
        lessonId={lessonId}
        exercise={item}
        previous={previous}
        once={once}
        onAnswer={onAnswer}
      />
    );
  }
  return (
    <McqExercise
      lessonId={lessonId}
      exercise={item}
      once={once}
      previous={previous}
      onAnswer={onAnswer}
    />
  );
}

const isBuildOrder = (i: PracticeItem): i is BuildOrderOut => i.type === "build_order";
const isWriteFill = (i: PracticeItem): i is WriteFillOut => i.type === "write_fill";
const isWriteEssay = (i: PracticeItem): i is WriteEssayOut => i.type === "write_essay";
const isSpeak = (i: PracticeItem): i is SpeakOut => i.type === "speak";
const isDictation = (i: PracticeItem): i is DictationOut => i.type === "listen_dictation";
