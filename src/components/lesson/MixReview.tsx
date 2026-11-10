import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, Shuffle } from "lucide-react";

import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { getLessonMix } from "@/lib/api/content";
import type { MixItemOut, MixReason } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { ExerciseView } from "./ExerciseView";
import { LinkedGrammarContext } from "./linked-grammar-context";
import type { AnswerEvent } from "./McqExercise";
import { useAnswerSaver } from "./use-answer-saver";

const REASON: Record<MixReason, { label: string; tone: string }> = {
  due: { label: "Thẻ đến hạn ôn", tone: "bg-yellow-soft" },
  wrong: { label: "Câu từng sai", tone: "bg-danger-soft" },
  new: { label: "Câu chưa làm", tone: "bg-blue-soft" },
};
const RUNG: Record<number, string> = { 0: "Nhận ra", 1: "Xếp câu", 2: "Điền câu" };

/** The end of a lesson's practice: a short mixed review of what the learner has already met —
 * exercises about cards that are due, then questions answered wrong before, then ones not done
 * yet — taken from this lesson and the lessons before it. The server picks the exercise at the
 * level each card calls for (a little harder after right answers, a step back after wrong ones).
 * Every item is answered under the lesson it comes from, so it counts there as well. */
export function MixReview({
  lessonId,
  onOpenGrammar,
}: {
  lessonId: number;
  onOpenGrammar?: (() => void) | undefined;
}) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  // the set is fixed while the learner works through it: answering must not reshuffle it
  const mix = useQuery({
    queryKey: ["lesson-mix", lessonId],
    queryFn: () => getLessonMix(lessonId),
    enabled: auth.isAuthenticated,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const [round, setRound] = useState(0);
  const events = useRef(new Map<string, boolean>());
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [right, setRight] = useState(0);

  const record = useCallback((item: MixItemOut, a: AnswerEvent) => {
    const key = `${item.lesson_id}:${a.questionId}`;
    if (!events.current.has(key)) {
      events.current.set(key, a.correct);
      setRight((n) => n + (a.correct ? 1 : 0));
    } else if (a.correct && events.current.get(key) === false) {
      events.current.set(key, true); // counted by hand as right
      setRight((n) => n + 1);
    }
    setTouched((t) => new Set(t).add(`${item.lesson_id}:${item.exercise.id}`));
  }, []);

  if (!auth.isAuthenticated) return null;

  const data = mix.data;
  const items = data?.items ?? [];

  function again() {
    events.current = new Map();
    setTouched(new Set());
    setRight(0);
    setRound((r) => r + 1);
    void mix.refetch();
  }

  return (
    <section
      aria-label="Ôn trộn kiến thức"
      className="rounded-[20px] border border-transparent bg-purple-soft p-3.5 shadow-elev-1"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Shuffle size={16} strokeWidth={2.6} aria-hidden="true" /> Ôn trộn kiến thức
      </h3>

      {mix.isLoading && (
        <LoadingBlocks className="mt-3" label="Đang chọn câu ôn" blocks={["h-10 rounded-full"]} />
      )}
      {mix.isError && (
        <ErrorState
          className="mt-3"
          title="Không tải được phần ôn trộn."
          message={errorMessage(mix.error)}
          onRetry={() => void mix.refetch()}
          retrying={mix.isRefetching}
        />
      )}

      {data && items.length === 0 && (
        <p className="mt-1.5 text-xs font-semibold leading-5 text-ink-2">
          Chưa có gì để ôn trộn. Phần này lấy câu về những thẻ ngữ pháp bạn đã gặp (ở tab Ngữ pháp
          hoặc trong “Ôn tập hôm nay”) — học vài thẻ rồi quay lại nhé.
        </p>
      )}

      {data && items.length > 0 && !open && (
        <>
          <p className="mt-1.5 text-xs font-semibold leading-5 text-ink-2">
            {items.length} câu về những gì bạn đã học ở bài này và các bài trước:{" "}
            {(["due", "wrong", "new"] as const)
              .filter((r) => (data.by_reason[r] ?? 0) > 0)
              .map((r) => `${data.by_reason[r]} ${REASON[r].label.toLowerCase()}`)
              .join(" · ")}
            .
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="hit-area mt-3 flex min-h-11 items-center gap-1.5 rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] "
          >
            Bắt đầu ôn trộn
          </button>
        </>
      )}

      {data && items.length > 0 && open && (
        <div className="mt-3 space-y-4" key={round}>
          <p className="text-xs font-semibold text-ink-2" aria-live="polite">
            Đã làm {touched.size}/{items.length} bài
            {events.current.size > 0 && ` · đúng ${right}/${events.current.size} câu`}
          </p>
          {items.map((item) => (
            <MixItem
              key={`${item.lesson_id}:${item.exercise.id}`}
              item={item}
              currentLessonId={lessonId}
              onOpenGrammar={onOpenGrammar}
              onEvent={record}
            />
          ))}
          {touched.size >= items.length && (
            <button
              type="button"
              onClick={again}
              disabled={mix.isRefetching}
              className="hit-area ml-auto flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-sm font-semibold shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
            >
              <RotateCcw size={14} strokeWidth={2.4} /> Ôn lượt khác
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function MixItem({
  item,
  currentLessonId,
  onOpenGrammar,
  onEvent,
}: {
  item: MixItemOut;
  currentLessonId: number;
  onOpenGrammar: (() => void) | undefined;
  onEvent: (item: MixItemOut, a: AnswerEvent) => void;
}) {
  const auth = useAuth();
  // answered under the lesson the exercise belongs to
  const { onAnswer } = useAnswerSaver(item.lesson_id);
  const linked = useMemo(
    () => ({
      cards: item.grammar,
      lessonId: currentLessonId,
      signedIn: auth.isAuthenticated,
      openGrammar: onOpenGrammar,
    }),
    [item.grammar, currentLessonId, auth.isAuthenticated, onOpenGrammar],
  );
  const reason = REASON[item.reason];
  return (
    <LinkedGrammarContext.Provider value={linked}>
      <div>
        <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
          <span className={cn("rounded-full px-2.5 py-0.5", reason.tone)}>{reason.label}</span>
          <span className="rounded-full bg-card px-2.5 py-0.5">{RUNG[item.rung] ?? "Luyện"}</span>
          {item.lesson_id !== currentLessonId && (
            <span className="text-ink-2">Từ bài “{item.lesson_title}”</span>
          )}
        </p>
        <ExerciseView
          lessonId={item.lesson_id}
          item={item.exercise}
          once={false}
          previous={{}}
          onAnswer={(a) => {
            onAnswer(a);
            onEvent(item, a);
          }}
        />
      </div>
    </LinkedGrammarContext.Provider>
  );
}
