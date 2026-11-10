import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Flag, ListChecks } from "lucide-react";
import { toast } from "sonner";

import { Explanation } from "@/components/exam/Explanation";
import { QuestionCard } from "@/components/exam/QuestionCard";
import { SummaryView } from "@/components/exam/Summary";
import { GuideCard, Meter } from "@/components/exam/bits";
import { Mascot } from "@/components/mascot/Mascot";
import { PracticeShell } from "@/components/haru/PracticeShell";
import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { useAuth } from "@/hooks/use-auth";
import { usePlaySequence } from "@/hooks/use-play-sequence";
import { useTextAudio } from "@/hooks/use-text-audio";
import { errorMessage } from "@/lib/api/client";
import { finishRealExamSet, getRealExamSet, getRealExamSetAnswers } from "@/lib/api/real-exam";
import type { RxAnswerOut, RxSelfCheckOut, RxSummaryOut } from "@/lib/api/types";
import { miss, success, tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exam/real_/$setId")({
  head: () => ({
    meta: [
      { title: "Làm bài — Luyện đề thi thật — Haru" },
      { name: "description", content: "Một lượt luyện đề thi TOPIK thật trên Haru." },
      { property: "og:title", content: "Luyện đề thi thật — Haru" },
      { property: "og:description", content: "Một lượt luyện đề thi TOPIK thật trên Haru." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RealExamRunner,
});

const DOT: Record<string, string> = {
  solid: "bg-green",
  aided: "bg-yellow",
  wrong: "bg-danger",
  pending: "bg-card",
};

function RealExamRunner() {
  const { setId } = Route.useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const audio = useTextAudio();
  const sequence = usePlaySequence(audio);

  const setQuery = useQuery({
    queryKey: ["me", "real-exam", "set", setId],
    queryFn: () => getRealExamSet(setId),
    enabled: auth.isAuthenticated,
    // the sitting is fixed once opened; refetching would only reshuffle the hint state
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const answersQuery = useQuery({
    queryKey: ["me", "real-exam", "set", setId, "answers"],
    queryFn: () => getRealExamSetAnswers(setId),
    enabled: auth.isAuthenticated,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const set = setQuery.data;
  const [answers, setAnswers] = useState<Record<string, RxAnswerOut>>({});
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<"questions" | "summary" | null>(null);
  const [summary, setSummary] = useState<RxSummaryOut | null>(null);
  const seeded = useRef(false);

  // pick a sitting up again: the answers already given, the first question still open
  useEffect(() => {
    if (seeded.current || !set || !answersQuery.data) return;
    seeded.current = true;
    const map: Record<string, RxAnswerOut> = {};
    for (const a of answersQuery.data) map[a.qid] = a;
    setAnswers(map);
    const firstOpen = set.questions.findIndex((q) => !map[q.qid]);
    setIndex(firstOpen === -1 ? 0 : firstOpen);
    setMode(set.finished || firstOpen === -1 ? "summary" : "questions");
  }, [set, answersQuery.data]);

  const finish = useMutation({
    mutationFn: () => finishRealExamSet(setId),
    onSuccess: (s) => {
      setSummary(s);
      setMode("summary");
      void queryClient.invalidateQueries({ queryKey: ["me", "real-exam"] });
      void queryClient.invalidateQueries({ queryKey: ["me", "weaknesses"] });
    },
    onError: (e) => toast.error("Chưa tổng kết được lượt này.", { description: errorMessage(e) }),
  });

  // a sitting opened already finished shows its summary straight away
  const { mutate: finishNow } = finish;
  useEffect(() => {
    if (mode === "summary" && !summary && !finish.isPending) finishNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const current = set?.questions[index];
  const currentAnswer = current ? answers[current.qid] : undefined;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  function onAnswered(a: RxAnswerOut) {
    setAnswers((prev) => ({ ...prev, [a.qid]: a }));
    if (a.result === "solid" || a.result === "aided") success();
    else if (a.result === "wrong") miss();
  }

  function onSelfChecked(r: RxSelfCheckOut) {
    setAnswers((prev) => {
      const a = prev[current?.qid ?? ""];
      if (!a) return prev;
      return { ...prev, [a.qid]: { ...a, result: r.result, needs_self_check: false } };
    });
  }

  function go(i: number) {
    sequence.stop();
    audio.stop();
    setIndex(i);
    setMode("questions");
  }

  function next() {
    if (!set) return;
    if (index + 1 < set.questions.length) {
      const after = set.questions.findIndex((q, i) => i > index && !answers[q.qid]);
      go(after === -1 ? index + 1 : after);
    } else {
      setSummary(null);
      finish.mutate();
    }
  }

  const ready = set && mode !== null;

  return (
    <PracticeShell glyph="問">
      <header>
        <Link
          to="/exam/real"
          onClick={() => tap()}
          className="hit-area -ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-semibold text-blue-deep active:scale-95"
        >
          <ArrowLeft size={15} strokeWidth={2.6} /> Luyện đề thi thật
        </Link>
        <h1 className="mt-1 text-xl font-bold leading-tight">{set?.title_vi ?? "Lượt luyện"}</h1>
        {set?.why_vi && (
          <p className="mt-1 text-xs font-semibold leading-5 text-ink-2">{set.why_vi}</p>
        )}
      </header>

      {!auth.isLoading && !auth.isAuthenticated && (
        <section className="mt-8 rounded-[20px] border border-line bg-card p-6 text-center shadow-elev-2">
          <Mascot mood="wave" className="mx-auto h-16 w-16" />
          <h2 className="mt-3 text-lg font-semibold">Đăng nhập để luyện đề</h2>
          <Link
            to="/support-language"
            className="mt-4 inline-flex w-full items-center justify-center rounded-[14px] border border-transparent bg-blue py-2.5 text-sm font-semibold text-primary-foreground shadow-elev-1"
          >
            Đăng nhập / Tạo tài khoản
          </Link>
        </section>
      )}

      {(auth.isLoading ||
        (auth.isAuthenticated && (setQuery.isLoading || answersQuery.isLoading))) && (
        <LoadingBlocks
          className="mt-6"
          label="Đang mở lượt luyện"
          blocks={["h-4 w-1/2 rounded-full", "h-48", "h-12", "h-12"]}
        />
      )}

      {(setQuery.isError || answersQuery.isError) && (
        <ErrorState
          className="mt-6"
          title="Không mở được lượt luyện."
          error={setQuery.error ?? answersQuery.error}
          message={errorMessage(setQuery.error ?? answersQuery.error)}
          onRetry={() => {
            void setQuery.refetch();
            void answersQuery.refetch();
          }}
          retrying={setQuery.isRefetching}
        />
      )}

      {ready && mode === "summary" && (
        <div className="mt-5">
          {summary ? (
            <>
              <SummaryView s={summary} />
              <button
                type="button"
                onClick={() => {
                  tap();
                  go(0);
                }}
                className="hit-area mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-line bg-card px-4 text-xs font-semibold shadow-elev-1 active:scale-[0.97]"
              >
                <ListChecks size={14} strokeWidth={2.6} aria-hidden="true" />
                Xem lại lời giải từng câu
              </button>
            </>
          ) : (
            <LoadingBlocks label="Đang tổng kết" blocks={["h-32", "h-20", "h-20"]} />
          )}
        </div>
      )}

      {ready && mode === "questions" && current && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-2">
            <span>
              Câu {index + 1}/{set.questions.length}
            </span>
            <span>Đã trả lời {answeredCount}</span>
          </div>
          <div className="mt-1.5">
            <Meter
              value={answeredCount}
              total={set.questions.length}
              label="Số câu đã trả lời"
              tone="blue"
            />
          </div>
          <nav aria-label="Các câu trong lượt" className="mt-2 flex flex-wrap gap-1.5">
            {set.questions.map((q, i) => {
              const a = answers[q.qid];
              return (
                <button
                  key={q.qid}
                  type="button"
                  aria-label={`Câu ${i + 1}${a ? `, ${a.result}` : ""}`}
                  aria-current={i === index}
                  onClick={() => {
                    tap();
                    go(i);
                  }}
                  className={cn(
                    "hit-area flex h-8 min-w-8 items-center justify-center rounded-full border border-line px-2 text-[12px] font-semibold active:scale-95",
                    a ? DOT[a.result] : "bg-paper",
                    i === index && "ring-2 ring-blue ring-offset-1",
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </nav>

          <div className="mt-3">
            {set.guides
              .filter((g) => g.code === current.type)
              .map((g) => (
                <GuideCard
                  key={`${g.code}:${current.qid}:${currentAnswer ? "a" : "q"}`}
                  guide={g}
                  defaultOpen={!currentAnswer && index === 0}
                />
              ))}
          </div>

          <div
            key={current.qid}
            className="mt-3 animate-in duration-300 fade-in slide-in-from-right-6 motion-reduce:animate-none"
          >
            {currentAnswer ? (
              <Explanation
                q={current}
                a={currentAnswer}
                audio={audio}
                sequence={sequence}
                isLast={index + 1 >= set.questions.length}
                onNext={next}
                onSelfChecked={onSelfChecked}
              />
            ) : (
              <QuestionCard
                setId={setId}
                q={current}
                audio={audio}
                sequence={sequence}
                onAnswered={onAnswered}
              />
            )}
          </div>

          {answeredCount > 0 && answeredCount < set.questions.length && (
            <button
              type="button"
              disabled={finish.isPending}
              onClick={() => {
                tap();
                sequence.stop();
                audio.stop();
                finish.mutate();
              }}
              className="hit-area mt-4 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold text-blue-deep active:scale-95"
            >
              <Flag size={14} strokeWidth={2.6} aria-hidden="true" />
              Dừng ở đây và xem bạn thu được gì
            </button>
          )}
        </div>
      )}
    </PracticeShell>
  );
}
