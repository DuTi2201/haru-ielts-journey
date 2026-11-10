import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, LogIn, RotateCcw } from "lucide-react";

import { Mascot } from "@/components/mascot/Mascot";
import { PracticeShell } from "@/components/haru/PracticeShell";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { UnderlineText } from "@/components/haru/UnderlineText";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { answerExamQuestion, getExamDrill } from "@/lib/api/practice";
import type { ExamAnswerOut, ExamDrillQuestion } from "@/lib/api/types";
import { miss, success, tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exam/drill")({
  head: () => ({
    meta: [
      { title: "Luyện đề thi thật — Haru" },
      { name: "description", content: "Làm vài câu đọc từ đề thi TOPIK thật trên Haru." },
      { property: "og:title", content: "Luyện đề thi thật — Haru" },
      { property: "og:description", content: "Làm vài câu đọc từ đề thi TOPIK thật trên Haru." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamDrillScreen,
});

const MARKS = ["①", "②", "③", "④", "⑤"] as const;

/** The mark is drawn separately, so a leading ① already in the stored text is dropped. */
function optionText(text: string): string {
  return text.replace(/^\s*[①②③④⑤]\s*/, "");
}

interface Done {
  question: ExamDrillQuestion;
  result: ExamAnswerOut;
}

function Question({
  question,
  position,
  total,
  onAnswered,
  onNext,
}: {
  question: ExamDrillQuestion;
  position: number;
  total: number;
  onAnswered: (done: Done) => void;
  onNext: () => void;
}) {
  const [sending, setSending] = useState<number | null>(null);
  const [result, setResult] = useState<ExamAnswerOut | null>(null);

  async function choose(choice: number) {
    if (sending !== null || result) return;
    tap();
    setSending(choice);
    try {
      const out = await answerExamQuestion({ item_id: question.id, chosen: choice });
      setResult(out);
      if (out.correct) success();
      else miss();
      onAnswered({ question, result: out });
    } catch (err) {
      // Nothing was marked: the learner can pick again.
      toast(errorMessage(err), { id: "exam-answer" });
    } finally {
      setSending(null);
    }
  }

  const last = position === total;
  return (
    <div>
      <p className="text-xs font-semibold text-ink-2">
        Câu {position}/{total} · {question.qtype_name_vi}
      </p>
      <p className="mt-0.5 text-[12px] font-semibold text-ink-2">
        {question.paper_label} · câu {question.number}
      </p>
      <div
        role="progressbar"
        aria-label="Tiến độ lượt luyện"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={position - 1}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-progress"
      >
        <div
          className="h-full rounded-full bg-blue transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${((position - 1) / total) * 100}%` }}
        />
      </div>

      {question.instruction_en && (
        <p
          lang="ko"
          className="font-korean mt-4 whitespace-pre-wrap text-[13px] font-medium leading-6 text-ink-2"
        >
          <UnderlineText text={question.instruction_en} />
        </p>
      )}

      {question.passage_en && (
        <div className="card-soft mt-4 max-h-64 overflow-y-auto rounded-[20px] bg-card px-4 py-3">
          <p lang="ko" className="font-korean whitespace-pre-wrap text-[15px] leading-7">
            <UnderlineText text={question.passage_en} />
          </p>
        </div>
      )}

      {question.stem_en && (
        <p
          lang="ko"
          className="font-korean mt-4 whitespace-pre-wrap text-[17px] font-semibold leading-7"
        >
          <UnderlineText text={question.stem_en} />
        </p>
      )}

      <ul className="mt-3 space-y-2.5" aria-label="Các lựa chọn">
        {question.options.map((text, i) => {
          const choice = i + 1;
          const isAnswer = result?.answer === choice;
          const isPicked = result?.chosen === choice;
          return (
            <li key={choice}>
              <button
                type="button"
                disabled={sending !== null || result !== null}
                onClick={() => void choose(choice)}
                className={cn(
                  "card-soft flex min-h-12 w-full items-center gap-3 rounded-[16px] px-4 py-2.5 text-left transition-transform active:scale-[0.98]",
                  !result && "bg-card",
                  result && isAnswer && "bg-green-soft ring-2 ring-green",
                  result && isPicked && !isAnswer && "bg-danger-soft ring-2 ring-danger",
                  result && !isAnswer && !isPicked && "bg-card opacity-60",
                )}
              >
                <span
                  aria-hidden="true"
                  className="font-korean text-lg font-semibold text-blue-deep"
                >
                  {MARKS[i] ?? `${choice}.`}
                </span>
                <span
                  lang="ko"
                  className="font-korean min-w-0 flex-1 text-[15px] font-semibold leading-6"
                >
                  <UnderlineText text={optionText(text)} />
                </span>
                {sending === choice && <Loader2 size={16} className="shrink-0 animate-spin" />}
              </button>
            </li>
          );
        })}
      </ul>

      {result && (
        <div
          role="status"
          className="card-soft mt-4 animate-in space-y-2 rounded-[20px] bg-card p-4 duration-300 fade-in motion-reduce:animate-none"
        >
          <p className={cn("text-sm font-semibold", result.correct ? "text-ink" : "text-danger")}>
            {result.correct
              ? "Đúng rồi!"
              : `Chưa đúng — đáp án là ${MARKS[result.answer - 1] ?? result.answer}`}
          </p>
          <button
            type="button"
            onClick={() => {
              tap();
              onNext();
            }}
            className="hit-area mt-1 inline-flex min-h-11 w-full items-center justify-center rounded-[14px] border border-transparent bg-blue px-4 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
          >
            {last ? "Xem kết quả" : "Câu tiếp"}
          </button>
        </div>
      )}
    </div>
  );
}

function Summary({ done, onMore }: { done: Done[]; onMore: () => void }) {
  const right = done.filter((d) => d.result.correct).length;
  const wrong = done.filter((d) => !d.result.correct);
  return (
    <div
      role="status"
      className="card-soft mt-4 animate-in rounded-[24px] bg-green-soft p-5 text-center duration-300 fade-in zoom-in-95 motion-reduce:animate-none"
    >
      <Mascot mood="celebrate" className="mx-auto h-14 w-14" />
      <p className="mt-2 text-sm font-semibold">
        Xong lượt luyện! Đúng {right}/{done.length} câu.
      </p>
      {wrong.length > 0 && (
        <div className="mt-3 rounded-[16px] bg-card p-3 text-left">
          <p className="text-[12px] font-semibold text-ink-2">Câu cần xem lại</p>
          <ul className="mt-1 space-y-1">
            {wrong.map((d) => (
              <li key={d.question.id} className="text-xs leading-5">
                <span className="font-semibold">{d.question.qtype_name_vi}</span>
                <span className="text-ink-2">
                  {" "}
                  · {d.question.paper_label}, câu {d.question.number}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[12px] font-medium text-ink-2">
            Những câu sai sẽ được hỏi lại trước các câu khác sau vài giờ.
          </p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            tap();
            onMore();
          }}
          className="hit-area card-soft inline-flex min-h-10 items-center gap-1.5 rounded-full bg-card px-4 text-xs font-semibold active:scale-95"
        >
          <RotateCcw size={14} strokeWidth={2.4} /> Luyện thêm
        </button>
        <Link
          to="/progress"
          onClick={() => tap()}
          className="hit-area card-soft inline-flex min-h-10 items-center gap-1.5 rounded-full bg-blue px-4 text-xs font-semibold text-primary-foreground active:scale-95"
        >
          Về trang Tiến bộ
        </Link>
      </div>
    </div>
  );
}

function Session({ items, onMore }: { items: ExamDrillQuestion[]; onMore: () => void }) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<Done[]>([]);
  const current = items[index];

  if (!current) return <Summary done={done} onMore={onMore} />;
  return (
    <div className="mt-4">
      {/* keyed by question so each one starts unanswered */}
      <div
        key={current.id}
        className="animate-in duration-300 fade-in slide-in-from-right-6 motion-reduce:animate-none"
      >
        <Question
          question={current}
          position={index + 1}
          total={items.length}
          onAnswered={(d) => setDone((all) => [...all, d])}
          onNext={() => setIndex((i) => i + 1)}
        />
      </div>
      <p className="mt-5 text-center text-[12px] font-medium leading-4 text-ink-2">
        Câu hỏi lấy từ đề thi đã nhập; đáp án đã được người duyệt xác nhận từ đáp án của đề.
      </p>
    </div>
  );
}

function AnonymousNudge() {
  return (
    <section className="mt-8 rounded-[20px] border border-line bg-card p-6 text-center shadow-elev-2">
      <Mascot mood="wave" className="mx-auto h-16 w-16" />
      <h2 className="mt-3 text-lg font-semibold leading-snug">Đăng nhập để luyện đề</h2>
      <p className="mt-1.5 text-xs font-semibold leading-5 text-ink-2">
        Haru nhớ câu bạn đã làm để hỏi lại câu sai và không lặp câu cũ.
      </p>
      <Link
        to="/support-language"
        className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-transparent bg-blue py-2.5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
      >
        <LogIn size={16} strokeWidth={2.4} /> Đăng nhập / Tạo tài khoản
      </Link>
    </section>
  );
}

function ExamDrillScreen() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  // Each "Luyện thêm" is a new round: a new set of questions.
  const [round, setRound] = useState(0);

  const query = useQuery({
    queryKey: ["me", "exam-drill", round],
    queryFn: () => getExamDrill(5),
    enabled: auth.isAuthenticated,
    // The set is the sitting itself: refetching mid-way would swap the questions.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // The answers change the weak-spot report.
  useEffect(
    () => () => {
      void queryClient.invalidateQueries({ queryKey: ["me", "weaknesses"] });
    },
    [queryClient],
  );

  const data = query.data;

  return (
    <PracticeShell glyph="問">
      <header>
        <Link
          to="/progress"
          onClick={() => tap()}
          className="hit-area -ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-semibold text-blue-deep active:scale-95"
        >
          <ArrowLeft size={15} strokeWidth={2.6} /> Tiến bộ
        </Link>
        <h1 className="mt-1 text-2xl font-bold leading-tight">Luyện đề thi thật</h1>
        <p className="mt-1 text-[13px] font-semibold text-ink-2">
          Vài câu đọc từ đề thi thật, câu từng làm sai quay lại trước.
        </p>
      </header>

      {!auth.isLoading && !auth.isAuthenticated && <AnonymousNudge />}

      {(auth.isLoading || (auth.isAuthenticated && query.isLoading)) && (
        <LoadingBlocks
          className="mt-6"
          label="Đang chọn câu hỏi"
          blocks={["h-4 w-1/2 rounded-full", "h-40", "h-12", "h-12"]}
        />
      )}

      {query.isError && (
        <ErrorState
          className="mt-6"
          title="Không tải được câu hỏi."
          error={query.error}
          message={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          className="mt-8"
          title={
            data.available === 0
              ? "Chưa có câu hỏi nào dùng được."
              : "Bạn đã làm hết các câu hiện có."
          }
          hint={
            data.available === 0
              ? "Câu hỏi xuất hiện khi đề thi đã được nhập và đáp án được người duyệt xác nhận."
              : "Quay lại sau vài giờ: câu làm sai sẽ trở lại trước, câu làm đúng sau một tuần."
          }
          action={
            <Link
              to="/progress"
              className="hit-area card-soft mt-4 inline-flex min-h-10 items-center rounded-full bg-card px-4 text-xs font-semibold active:scale-95"
            >
              Về trang Tiến bộ
            </Link>
          }
        />
      )}

      {data && data.items.length > 0 && (
        <Session key={round} items={data.items} onMore={() => setRound((r) => r + 1)} />
      )}
    </PracticeShell>
  );
}
