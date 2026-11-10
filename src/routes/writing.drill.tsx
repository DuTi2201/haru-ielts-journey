import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useState } from "react";
import { ArrowLeft, Layers, Loader2, LogIn, PenLine } from "lucide-react";

import { Mascot } from "@/components/mascot/Mascot";
import { PracticeShell } from "@/components/haru/PracticeShell";
import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { useAuth } from "@/hooks/use-auth";
import { useJobEvents } from "@/hooks/use-job-events";
import { ApiError, errorMessage } from "@/lib/api/client";
import { answerWritingDrill, getWritingDrill, startWritingDrill } from "@/lib/api/practice";
import type {
  WritingBlankResultOut,
  WritingDrillOut,
  WritingLabel,
  WritingPromptOut,
  WritingVerdict,
} from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/writing/drill")({
  // ?id= keeps the exercise across a reload; without it the page offers to start one.
  // ?deck= writes with the words of that «Kho từ TOPIK» deck.
  validateSearch: (search: Record<string, unknown>): { id?: string | undefined; deck?: string | undefined } => {
    const out: { id?: string; deck?: string } = {};
    if (typeof search["id"] === "string" && search["id"] !== "") out.id = search["id"];
    if (typeof search["deck"] === "string" && search["deck"] !== "") out.deck = search["deck"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Luyện viết câu 51–52 — Haru" },
      { name: "description", content: "Điền câu vào chỗ trống như câu 51–52 TOPIK trên Haru." },
      { property: "og:title", content: "Luyện viết câu 51–52 — Haru" },
      {
        property: "og:description",
        content: "Điền câu vào chỗ trống như câu 51–52 TOPIK trên Haru.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WritingDrillScreen,
});

const LABELS: WritingLabel[] = ["㉠", "㉡"];
const MAX_CHARS = 200;

const REGISTER_NOTE: Record<string, string> = {
  합쇼체: "trang trọng (-ㅂ니다/-습니다)",
  해요체: "lịch sự thân mật (-아요/-어요)",
};

const VERDICT: Record<WritingVerdict, { label: string; box: string }> = {
  good: { label: "Tốt", box: "bg-green-soft" },
  minor: { label: "Gần đúng, còn vài chỗ nhỏ", box: "bg-blue-soft" },
  off: { label: "Cần sửa", box: "bg-danger-soft" },
  unchecked: { label: "Chưa kiểm tra được", box: "bg-progress" },
};

const CATEGORY: Record<string, string> = {
  grammar: "Ngữ pháp",
  spelling: "Chính tả",
  register: "Mức độ lịch sự",
  word_choice: "Chọn từ",
  content: "Ý của câu",
};

function BackToProgress() {
  return (
    <Link
      to="/progress"
      onClick={() => tap()}
      className="hit-area -ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-semibold text-blue-deep active:scale-95"
    >
      <ArrowLeft size={15} strokeWidth={2.6} /> Tiến bộ
    </Link>
  );
}

/** The paragraph with ㉠ ㉡ drawn as marks, the way the exam prints them. */
function Paragraph({ prompt }: { prompt: WritingPromptOut }) {
  const parts = prompt.body_ko.split(/(㉠|㉡)/);
  return (
    <div className="card-soft rounded-[20px] bg-card px-4 py-4">
      {(prompt.text_type || prompt.title_ko) && (
        <p lang="ko" className="font-korean text-xs font-semibold text-ink-2">
          {prompt.text_type}
          {prompt.text_type && prompt.title_ko ? " · " : ""}
          {prompt.title_ko}
        </p>
      )}
      <p lang="ko" className="font-korean mt-1.5 whitespace-pre-wrap text-[15px] leading-7">
        {parts.map((part, i) =>
          part === "㉠" || part === "㉡" ? (
            <span
              key={i}
              className="mx-0.5 inline-flex min-w-7 justify-center rounded-md bg-yellow-soft px-1.5 font-semibold"
            >
              {part}
            </span>
          ) : (
            <Fragment key={i}>{part}</Fragment>
          ),
        )}
      </p>
    </div>
  );
}

function Targets({ prompt }: { prompt: WritingPromptOut }) {
  if (prompt.targets.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-[12px] font-semibold text-ink-2">Cụm từ hôm nay (từ thẻ của bạn)</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {prompt.targets.map((t) => (
          <li
            key={t.item_id}
            className="rounded-full bg-blue-soft px-2.5 py-0.5 text-[12px] font-semibold text-blue-deep"
          >
            <span lang="ko" className="font-korean font-semibold">
              {t.hangul}
            </span>{" "}
            · {t.meaning_vi}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pending({ what, progress }: { what: string; progress: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="card-soft mt-8 rounded-[24px] bg-card p-6 text-center"
    >
      <Mascot mood="reading" className="mx-auto h-14 w-14" />
      <p className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold">
        <Loader2 size={15} className="animate-spin" /> {what}
      </p>
      <p className="mt-1 text-xs font-medium leading-5 text-ink-2">
        Thường mất vài chục giây. Bạn có thể giữ trang này mở.
      </p>
      {progress > 0 && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-progress" aria-hidden="true">
          <div
            className="h-full rounded-full bg-blue transition-[width] duration-300"
            style={{ width: `${Math.min(100, Math.round(progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Exercise({
  drill,
  prompt,
  sending,
  error,
  onSend,
}: {
  drill: WritingDrillOut;
  prompt: WritingPromptOut;
  sending: boolean;
  error: string | null;
  onSend: (answers: Partial<Record<WritingLabel, string>>) => void;
}) {
  const [values, setValues] = useState<Record<WritingLabel, string>>({
    "㉠": drill.answers?.["㉠"] ?? "",
    "㉡": drill.answers?.["㉡"] ?? "",
  });
  const filled = LABELS.some((l) => values[l].trim() !== "");
  const registerNote = prompt.register ? REGISTER_NOTE[prompt.register] : undefined;

  return (
    <div className="mt-5">
      {drill.grade_status === "failed" && (
        <p
          role="alert"
          className="mb-3 rounded-[14px] bg-yellow-soft px-3 py-2 text-xs font-semibold leading-5"
        >
          Lần chấm trước chưa thành công. Câu của bạn vẫn còn đây, bạn có thể sửa rồi gửi lại.
        </p>
      )}
      <Paragraph prompt={prompt} />
      {registerNote && (
        <p className="mt-2 text-[12px] font-semibold leading-4 text-ink-2">
          Đoạn viết theo văn phong{" "}
          <span lang="ko" className="font-korean font-semibold">
            {prompt.register}
          </span>
          : {registerNote}. Câu của bạn nên cùng văn phong.
        </p>
      )}
      <Targets prompt={prompt} />

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!filled || sending) return;
          const answers: Partial<Record<WritingLabel, string>> = {};
          for (const l of LABELS) answers[l] = values[l].trim();
          onSend(answers);
        }}
      >
        {prompt.blanks.map((blank) => {
          const label = blank.label;
          const id = `blank-${label}`;
          return (
            <div key={label} className="card-soft rounded-[20px] bg-card p-4">
              <label
                htmlFor={id}
                className="flex items-start gap-2 text-sm font-semibold leading-5"
              >
                <span className="mt-px inline-flex min-w-7 justify-center rounded-md bg-yellow-soft px-1.5 font-semibold">
                  {label}
                </span>
                <span>{blank.intent_vi}</span>
              </label>
              {blank.uses.length > 0 && (
                <p className="mt-1 text-[12px] font-semibold text-ink-2">
                  Thử dùng:{" "}
                  {blank.uses.map((u, i) => (
                    <span key={u}>
                      {i > 0 && ", "}
                      <span lang="ko" className="font-korean font-semibold text-blue-deep">
                        {u}
                      </span>
                    </span>
                  ))}
                </p>
              )}
              <textarea
                id={id}
                lang="ko"
                rows={2}
                maxLength={MAX_CHARS}
                value={values[label]}
                onChange={(e) => setValues((v) => ({ ...v, [label]: e.target.value }))}
                disabled={sending}
                placeholder="Viết một câu tiếng Hàn"
                className="font-korean mt-2 w-full resize-none rounded-[14px] border border-line bg-paper px-3 py-2 text-[15px] leading-6 outline-none focus:ring-2 focus:ring-blue disabled:opacity-60"
              />
              <p className="mt-0.5 text-right text-[11px] font-medium text-ink-2">
                {values[label].length}/{MAX_CHARS}
              </p>
            </div>
          );
        })}

        {error && (
          <p
            role="alert"
            className="rounded-[14px] bg-danger-soft px-3 py-2 text-xs font-semibold leading-5"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!filled || sending}
          className="hit-area inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-transparent bg-blue px-4 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <PenLine size={16} strokeWidth={2.4} />
          )}
          Gửi chấm
        </button>
        <p className="text-center text-[12px] font-medium leading-4 text-ink-2">
          Mỗi đề chỉ chấm một lần. Hãy đọc lại câu trước khi gửi.
        </p>
      </form>
    </div>
  );
}

function BlankResult({ blank }: { blank: WritingBlankResultOut }) {
  const verdict = VERDICT[blank.verdict];
  return (
    <article className="card-soft rounded-[20px] bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex min-w-7 justify-center rounded-md bg-yellow-soft px-1.5 font-semibold">
          {blank.label}
        </span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", verdict.box)}>
          {verdict.label}
        </span>
      </div>
      <p className="mt-2 text-[12px] font-semibold text-ink-2">{blank.intent_vi}</p>

      <p className="mt-2 text-[12px] font-semibold text-ink-2">Câu của bạn</p>
      <p lang="ko" className="font-korean text-[15px] font-semibold leading-6">
        {blank.answer.trim() === "" ? "(để trống)" : blank.answer}
      </p>

      {blank.comment_vi && <p className="mt-2 text-xs font-medium leading-5">{blank.comment_vi}</p>}

      {blank.fixes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {blank.fixes.map((fix, i) => (
            <li key={i} className="rounded-[14px] bg-paper px-3 py-2 text-xs leading-5">
              <p className="flex flex-wrap items-center gap-x-1.5">
                <span
                  lang="ko"
                  className="font-korean font-semibold text-danger line-through decoration-1"
                >
                  {fix.original}
                </span>
                {fix.corrected && (
                  <>
                    <span aria-hidden="true">→</span>
                    <span lang="ko" className="font-korean font-semibold text-ink">
                      {fix.corrected}
                    </span>
                  </>
                )}
              </p>
              <p className="mt-0.5 font-medium text-ink-2">
                <span className="font-semibold">{CATEGORY[fix.category] ?? fix.category}</span>
                {fix.reason_vi ? `: ${fix.reason_vi}` : ""}
                <span className="ml-1 text-[11px]">
                  ({fix.source === "auto" ? "kiểm tra tự động" : "AI nhận xét"})
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-line pt-3">
        <p className="text-[12px] font-semibold text-ink-2">Câu mẫu</p>
        <p lang="ko" className="font-korean text-[15px] font-semibold leading-6">
          {blank.model_answer}
        </p>
        {blank.alt_answers.length > 0 && (
          <p className="mt-1 text-[12px] font-medium leading-4 text-ink-2">
            Cũng có thể:{" "}
            {blank.alt_answers.map((a, i) => (
              <span key={a} lang="ko" className="font-korean">
                {i > 0 && " / "}
                {a}
              </span>
            ))}
          </p>
        )}
      </div>
    </article>
  );
}

function Result({
  drill,
  onAgain,
  again,
}: {
  drill: WritingDrillOut;
  onAgain: () => void;
  again: boolean;
}) {
  const result = drill.result;
  if (!result) return null;
  return (
    <div className="mt-5 space-y-3.5">
      {drill.prompt && <Paragraph prompt={drill.prompt} />}
      {!result.ai_checked && (
        <p className="rounded-[14px] bg-yellow-soft px-3 py-2 text-xs font-semibold leading-5">
          Lần này chưa nhờ AI nhận xét được, chỉ có kiểm tra tự động cơ bản (câu trống, văn phong,
          số câu). Hãy so với câu mẫu bên dưới.
        </p>
      )}
      {result.blanks.map((b) => (
        <BlankResult key={b.label} blank={b} />
      ))}
      <p className="text-center text-[12px] font-medium leading-4 text-ink-2">{result.note}</p>
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            tap();
            onAgain();
          }}
          disabled={again}
          className="hit-area card-soft inline-flex min-h-10 items-center gap-1.5 rounded-full bg-blue px-4 text-xs font-semibold text-primary-foreground active:scale-95 disabled:opacity-60"
        >
          {again ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <PenLine size={14} strokeWidth={2.4} />
          )}
          Làm đề mới
        </button>
        <Link
          to="/progress"
          onClick={() => tap()}
          className="hit-area card-soft inline-flex min-h-10 items-center gap-1.5 rounded-full bg-card px-4 text-xs font-semibold active:scale-95"
        >
          Về trang Tiến bộ
        </Link>
      </div>
    </div>
  );
}

function Intro({
  onStart,
  starting,
  error,
  needsCards,
}: {
  onStart: () => void;
  starting: boolean;
  error: string | null;
  /** The server answered "no_cards": the learner has not answered any vocabulary card yet. */
  needsCards: boolean;
}) {
  return (
    <section className="card-soft mt-6 rounded-[24px] bg-card p-5">
      <Mascot mood="reading" className="mx-auto h-14 w-14" />
      <h2 className="mt-2 text-center text-base font-semibold">Điền câu vào chỗ trống</h2>
      <p className="mt-2 text-xs font-medium leading-5 text-ink-2">
        Giống câu 51–52 của TOPIK II: một đoạn văn ngắn có hai chỗ trống ㉠ và ㉡. Haru soạn đoạn
        văn từ chính những cụm bạn hay sai hoặc đang học, bạn viết mỗi chỗ một câu. Sau đó Haru chỉ
        ra chỗ cần sửa và đưa câu mẫu.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs font-medium leading-5 text-ink-2">
        <li>
          Cần ôn vài thẻ từ vựng trước, để Haru biết bạn đang học cụm nào.{" "}
          <Link
            to="/review"
            onClick={() => tap()}
            className="font-semibold text-blue-deep underline underline-offset-2"
          >
            Ôn thẻ ngay
          </Link>
        </li>
        <li>Nhận xét do AI viết và có thể chưa hoàn hảo; so thêm với câu mẫu.</li>
        <li>Mỗi ngày soạn được tối đa 12 đề.</li>
      </ul>
      {needsCards && (
        // Guidance, not a failure: say where to go and what to do there.
        <div role="alert" className="mt-3 rounded-[14px] bg-blue-soft px-3 py-3 text-blue-deep">
          <p className="text-xs font-semibold leading-5">
            Haru chưa có thẻ nào của bạn để soạn đề.
          </p>
          <p className="mt-1 text-xs font-medium leading-5">
            Vào “Ôn tập hôm nay”, trả lời vài thẻ từ vựng, rồi quay lại đây bấm “Soạn đề cho tôi”.
          </p>
        </div>
      )}
      {error && !needsCards && (
        <div role="alert" className="mt-3 rounded-[14px] bg-danger-soft px-3 py-2.5">
          <p className="text-xs font-semibold leading-5">{error}</p>
          <p className="mt-1 text-xs font-medium leading-5">
            Bấm “Soạn đề cho tôi” để thử lại. Hoặc làm ngay câu 51–52 trong{" "}
            <Link
              to="/exam/real"
              onClick={() => tap()}
              className="font-semibold text-blue-deep underline underline-offset-2"
            >
              đề thi thật
            </Link>{" "}
            — không cần chờ AI soạn.
          </p>
        </div>
      )}
      {needsCards ? (
        <Link
          to="/review"
          onClick={() => tap()}
          className="hit-area mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-transparent bg-blue px-4 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
        >
          <Layers size={16} strokeWidth={2.4} />
          Ôn thẻ từ vựng
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => {
            tap();
            onStart();
          }}
          disabled={starting}
          className="hit-area mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-transparent bg-blue px-4 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-60"
        >
          {starting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <PenLine size={16} strokeWidth={2.4} />
          )}
          Soạn đề cho tôi
        </button>
      )}
    </section>
  );
}

function AnonymousNudge() {
  return (
    <section className="mt-8 rounded-[20px] border border-line bg-card p-6 text-center shadow-elev-2">
      <Mascot mood="wave" className="mx-auto h-16 w-16" />
      <h2 className="mt-3 text-lg font-semibold leading-snug">Đăng nhập để luyện viết</h2>
      <p className="mt-1.5 text-xs font-semibold leading-5 text-ink-2">
        Đề viết được soạn từ những thẻ bạn đã ôn, nên Haru cần biết bạn là ai.
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

function WritingDrillScreen() {
  const auth = useAuth();
  const { id, deck } = Route.useSearch();
  const navigate = useNavigate({ from: "/writing/drill" });
  const queryClient = useQueryClient();

  const drillKey = ["me", "writing-drill", id] as const;
  const drillQuery = useQuery({
    queryKey: drillKey,
    queryFn: () => getWritingDrill(id as string),
    enabled: auth.isAuthenticated && id !== undefined,
    // A missing or foreign exercise (4xx) will not appear by asking again.
    retry: (count, err) =>
      !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    // A safety net next to the job stream: the server also expires a job that never finished.
    refetchInterval: (q) => {
      const d = q.state.data;
      return d && (d.status === "pending" || d.grade_status === "pending") ? 4000 : false;
    },
  });
  const drill = drillQuery.data;

  const waiting = drill && (drill.status === "pending" || drill.grade_status === "pending");
  const job = useJobEvents(waiting ? drill.job_id : null);
  const refetchDrill = drillQuery.refetch;
  useEffect(() => {
    if (job.status === "succeeded" || job.status === "failed" || job.status === "cancelled") {
      void refetchDrill();
    }
  }, [job.status, refetchDrill]);

  const start = useMutation({
    mutationFn: () => startWritingDrill(deck),
    onSuccess: (out) => {
      void navigate({ to: "/writing/drill", search: { id: out.drill_id }, replace: true });
    },
  });

  const send = useMutation({
    mutationFn: (answers: Partial<Record<WritingLabel, string>>) =>
      answerWritingDrill(id as string, { answers }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: drillKey }),
    // 409: the exercise was already sent (another tab, a double tap): show where it stands.
    onError: () => void queryClient.invalidateQueries({ queryKey: drillKey }),
  });

  // The answers change the weak-spot report.
  useEffect(
    () => () => {
      void queryClient.invalidateQueries({ queryKey: ["me", "weaknesses"] });
    },
    [queryClient],
  );

  const startError = start.isError ? errorMessage(start.error) : null;
  const needsCards =
    start.error instanceof ApiError &&
    start.error.status === 409 &&
    start.error.problem.code === "no_cards";
  const sendError = send.isError ? errorMessage(send.error) : null;

  let body: React.ReactNode = null;
  if (auth.isLoading || (auth.isAuthenticated && id !== undefined && drillQuery.isLoading)) {
    body = (
      <LoadingBlocks
        className="mt-6"
        label="Đang tải đề"
        blocks={["h-4 w-1/2 rounded-full", "h-40", "h-24"]}
      />
    );
  } else if (!auth.isAuthenticated) {
    body = <AnonymousNudge />;
  } else if (id === undefined) {
    body = (
      <Intro
        onStart={() => start.mutate()}
        starting={start.isPending}
        error={startError}
        needsCards={needsCards}
      />
    );
  } else if (drillQuery.isError) {
    body = (
      <ErrorState
        className="mt-6"
        title="Không mở được đề này."
        error={drillQuery.error}
        message={errorMessage(drillQuery.error)}
        onRetry={() => void drillQuery.refetch()}
        retrying={drillQuery.isRefetching}
      />
    );
  } else if (drill) {
    if (drill.status === "pending") {
      body = <Pending what="Haru đang soạn đề cho bạn…" progress={job.progress} />;
    } else if (drill.status === "failed" || !drill.prompt) {
      body = (
        <>
          <ErrorState
            className="mt-6"
            title="Chưa soạn được đề lần này."
            message="Lỗi tạm thời ở phía máy chủ. Soạn lại một đề khác nhé."
            onRetry={() => start.mutate()}
            retrying={start.isPending}
          />
          {startError && (
            <p className="mt-2 text-center text-xs font-semibold text-danger">{startError}</p>
          )}
        </>
      );
    } else if (drill.grade_status === "pending") {
      body = <Pending what="Haru đang chấm bài của bạn…" progress={job.progress} />;
    } else if (drill.grade_status === "ready" && drill.result) {
      body = (
        <>
          <Result drill={drill} onAgain={() => start.mutate()} again={start.isPending} />
          {startError && (
            <p className="mt-2 text-center text-xs font-semibold text-danger">{startError}</p>
          )}
        </>
      );
    } else {
      body = (
        <Exercise
          key={drill.id + drill.grade_status}
          drill={drill}
          prompt={drill.prompt}
          sending={send.isPending}
          error={sendError}
          onSend={(answers) => send.mutate(answers)}
        />
      );
    }
  }

  return (
    <PracticeShell glyph="書">
      <header>
        <BackToProgress />
        <h1 className="mt-1 text-2xl font-bold leading-tight">Luyện viết câu 51–52</h1>
        <p className="mt-1 text-[13px] font-semibold text-ink-2">
          Viết câu còn thiếu cho đoạn văn, dùng cụm từ bạn đang học.
        </p>
      </header>
      {body}
    </PracticeShell>
  );
}
