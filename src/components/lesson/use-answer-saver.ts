import { useCallback, useRef } from "react";
import { track } from "@/lib/telemetry";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { postLessonAnswer } from "@/lib/api/content";
import type { ExerciseAnswerRequest, LessonProgressOut } from "@/lib/api/types";
import { lessonProgressKey as progressKey, MISTAKE_BOOK_KEY } from "@/lib/lesson-meta";
import type { AnswerEvent } from "./McqExercise";

const toRequest = (a: AnswerEvent): ExerciseAnswerRequest => ({
  exercise_id: a.exerciseId,
  question_id: a.questionId,
  correct: a.correct,
  answer: a.answer.slice(0, 500),
});

/** Saves a lesson's practice answers for a signed-in learner (that is what feeds the
 * lesson's progress, the error log and the grammar cards' review schedule); an anonymous
 * learner is told once that signing in would keep them. `saveAll` hands in a whole batch
 * (a finished mock exam) one answer at a time, so that two questions about the same card
 * never reach the server together. */
export function useAnswerSaver(lessonId: number) {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const loginHint = useRef(false);

  const save = useMutation({
    mutationFn: (body: ExerciseAnswerRequest) => postLessonAnswer(lessonId, body),
    onSuccess: (result) => {
      // the first answer to a question, right or wrong: how well the lesson taught it
      const before = qc.getQueryData<LessonProgressOut>(progressKey(lessonId));
      if (before && !before.results.some((r) => r.question_id === result.question_id))
        track({
          type: "first_try",
          value: result.correct ? 1 : 0,
          payload: { lesson_id: lessonId, question_id: result.question_id },
        });
      qc.setQueryData<LessonProgressOut>(progressKey(lessonId), (old) => {
        if (!old) return old;
        const results = [
          ...old.results.filter((r) => r.question_id !== result.question_id),
          result,
        ];
        return {
          ...old,
          results,
          answered: results.length,
          correct: results.filter((r) => r.correct).length,
        };
      });
      // the picker shows these counts too: stale now, refetched when it is opened
      void qc.invalidateQueries({ queryKey: ["lessons"], refetchType: "none" });
      // and so does today's plan (which lesson is next, how far along it is)
      void qc.invalidateQueries({ queryKey: ["me", "plan"], refetchType: "none" });
      // a wrong answer is one more line in the mistake book, a right one takes it out
      void qc.invalidateQueries({ queryKey: MISTAKE_BOOK_KEY, refetchType: "none" });
    },
    onError: (err) => {
      // a question the server no longer knows (the lesson was edited) is not the learner's problem
      if (err instanceof ApiError && err.status === 422) return;
      toast.error("Chưa lưu được kết quả câu này.", { description: errorMessage(err) });
    },
  });

  const hintToLogIn = useCallback(() => {
    if (loginHint.current) return;
    loginHint.current = true;
    toast("Đăng nhập để lưu kết quả luyện tập và sổ lỗi.", {
      id: "practice-login",
      action: {
        label: "Đăng nhập",
        onClick: () => void navigate({ to: "/support-language" }),
      },
    });
  }, [navigate]);

  const onAnswer = useCallback(
    (a: AnswerEvent) => {
      if (auth.isAnonymous) {
        hintToLogIn();
        return;
      }
      save.mutate(toRequest(a));
    },
    [auth.isAnonymous, hintToLogIn, save],
  );

  const { mutateAsync } = save;
  const saveAll = useCallback(
    async (answers: AnswerEvent[]) => {
      if (auth.isAnonymous) {
        hintToLogIn();
        return;
      }
      for (const a of answers) {
        try {
          await mutateAsync(toRequest(a));
        } catch {
          /* onError has told the learner; keep going with the rest */
        }
      }
    },
    [auth.isAnonymous, hintToLogIn, mutateAsync],
  );

  return { onAnswer, saveAll };
}
