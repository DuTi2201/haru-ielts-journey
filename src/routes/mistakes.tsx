import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookX, Check, Download, LogIn, RotateCcw, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Mascot } from "@/components/mascot/Mascot";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { BulletList, Disclosure } from "@/components/lesson/Disclosure";
import { Shell } from "@/components/lesson/LessonShell";
import { Ko, Rich } from "@/components/lesson/Rich";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { getMistakeBook, setMistakeUnderstood } from "@/lib/api/practice";
import type { MistakeBookOut, MistakeLessonOut, MistakeLineOut, MistakeOut } from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { writeLocal } from "@/lib/lesson-local";
import { MISTAKE_BOOK_KEY } from "@/lib/lesson-meta";
import { downloadText, localDate, mistakesToMarkdown, optionMark } from "@/lib/mistake-markdown";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mistakes")({
  head: () => ({
    meta: [
      { title: "Sổ lỗi sai — Haru" },
      {
        name: "description",
        content: "Những câu luyện tập bạn làm sai, kèm đáp án và giải thích.",
      },
      { property: "og:title", content: "Sổ lỗi sai — Haru" },
      {
        property: "og:description",
        content: "Những câu luyện tập bạn làm sai, kèm đáp án và giải thích.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MistakesScreen,
});

const SPEAKER: Record<string, string> = { F: "Nữ", M: "Nam", N: "Dẫn" };

function Lines({ lines }: { lines: MistakeLineOut[] }) {
  return (
    <ol className="space-y-1.5">
      {lines.map((l, i) => (
        <li key={i} className="flex items-start gap-2">
          {l.speaker && (
            <span className="mt-0.5 inline-flex h-5 min-w-[34px] shrink-0 items-center justify-center rounded-full bg-progress px-1.5 text-[11px] font-semibold">
              {SPEAKER[l.speaker] ?? l.speaker}
            </span>
          )}
          <span className="min-w-0">
            <Rich text={l.text} className="text-[13px] leading-6 [overflow-wrap:anywhere]" />
            {l.vi && (
              <span className="block text-[11.5px] font-medium leading-5 text-ink-2">{l.vi}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** What the learner picked or typed, next to the right answer. */
function Compare({ m }: { m: MistakeOut }) {
  const typedLines =
    m.type === "listen_dictation" && m.chosen ? m.chosen.split(" / ") : m.chosen ? [m.chosen] : [];
  if (m.options.length > 0) {
    return (
      <ol className="mt-2.5 space-y-1.5">
        {m.options.map((o) => {
          const mine = o.id === m.chosen_id;
          const right = o.id === m.correct_id;
          return (
            <li
              key={o.id}
              className={cn(
                "flex items-start gap-2 rounded-[12px] border px-2.5 py-1.5 text-xs leading-5",
                right
                  ? "border-green bg-green-soft"
                  : mine
                    ? "border-danger bg-danger-soft"
                    : "border-line bg-card",
              )}
            >
              <span aria-hidden="true" className="shrink-0 font-semibold">
                {optionMark(o.id)}
              </span>
              <Rich text={o.text} className="min-w-0 flex-1 [overflow-wrap:anywhere]" />
              {right && <span className="shrink-0 font-semibold text-green">Đáp án đúng</span>}
              {mine && !right && (
                <span className="shrink-0 font-semibold text-danger">Bạn chọn</span>
              )}
            </li>
          );
        })}
      </ol>
    );
  }
  return (
    <div className="mt-2.5 space-y-2">
      <div className="rounded-[12px] border border-danger bg-danger-soft px-2.5 py-1.5">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-danger">Bạn đã gõ</p>
        {typedLines.length > 0 ? (
          typedLines.map((l, i) => (
            <Ko key={i} className="block text-[13px] leading-6 [overflow-wrap:anywhere]">
              {l}
            </Ko>
          ))
        ) : (
          <p className="text-xs text-ink-2">(để trống)</p>
        )}
      </div>
      <div className="rounded-[12px] border border-green bg-green-soft px-2.5 py-1.5">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-green">Đáp án</p>
        {m.correct.map((c, i) => (
          <Ko key={i} className="block text-[13px] leading-6 [overflow-wrap:anywhere]">
            {c}
          </Ko>
        ))}
        {m.translation.length > 0 && (
          <p className="mt-0.5 text-[11.5px] font-medium leading-5 text-ink-2">
            {m.translation.join(" ")}
          </p>
        )}
      </div>
    </div>
  );
}

function MistakeCard({
  m,
  onToggle,
  pending,
}: {
  m: MistakeOut;
  onToggle: () => void;
  pending: boolean;
}) {
  return (
    <article
      aria-label={m.title}
      className={cn(
        "rounded-[18px] border border-line bg-card p-3.5 shadow-elev-1",
        m.understood && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {m.skill && !m.title.startsWith(m.skill) && (
          <span className="rounded-full bg-blue-soft px-2.5 py-0.5 text-[12px] font-semibold text-blue-deep">
            {m.skill}
          </span>
        )}
        <h3 className="min-w-0 flex-1 text-[13px] font-semibold leading-5">{m.title}</h3>
      </div>

      {m.prompt && (
        <Rich as="p" text={m.prompt} className="mt-2 text-[13px] font-semibold leading-6" />
      )}

      {m.context.length > 0 && (
        <Disclosure
          className="mt-2.5"
          title={m.type.startsWith("listen_") ? "Lời thoại đã nghe" : "Đề bài"}
        >
          <Lines lines={m.context} />
        </Disclosure>
      )}

      <Compare m={m} />

      {m.explanation_vi && (
        <div className="mt-2.5 rounded-[12px] bg-yellow-soft px-3 py-2">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">Giải thích</p>
          <Rich as="p" text={m.explanation_vi} className="text-xs font-medium leading-5" />
        </div>
      )}

      {m.notes_vi.length > 0 && <BulletList items={m.notes_vi} className="mt-2.5" />}

      {m.focus.length > 0 && (
        <div className="mt-2.5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">Từ cần nhớ</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {m.focus.map((f) => (
              <li key={f.ko} className="rounded-full bg-progress px-2.5 py-0.5 text-[11.5px]">
                <Ko className="font-semibold">{f.ko}</Ko> · {f.vi}
              </li>
            ))}
          </ul>
        </div>
      )}

      {m.grammar.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {m.grammar.map((g) => (
            <li key={g.pattern} className="text-xs leading-5">
              <Ko className="font-semibold">{g.pattern}</Ko>
              {g.meaning_vi && <span className="text-ink-2"> — {g.meaning_vi}</span>}
              {g.lesson_id != null && (
                <Link
                  to="/lesson/$id"
                  params={{ id: String(g.lesson_id) }}
                  onClick={() => writeLocal(`step:${g.lesson_id}`, "grammar")}
                  className="hit-area ml-1 inline-flex min-h-8 items-center font-semibold text-blue-deep underline"
                >
                  Mở thẻ
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-line pt-2.5">
        <button
          type="button"
          onClick={onToggle}
          disabled={pending}
          aria-pressed={m.understood}
          className={cn(
            "hit-area inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-xs font-semibold shadow-elev-1 active:scale-[0.97] disabled:opacity-60",
            m.understood ? "bg-card" : "bg-blue text-primary-foreground",
          )}
        >
          {m.understood ? (
            <>
              <RotateCcw size={14} strokeWidth={2.6} aria-hidden="true" /> Đọc lại sau
            </>
          ) : (
            <>
              <Check size={14} strokeWidth={2.8} aria-hidden="true" /> Đã hiểu
            </>
          )}
        </button>
      </div>
    </article>
  );
}

function LessonSection({
  lesson,
  showDone,
  onToggle,
  pendingKey,
}: {
  lesson: MistakeLessonOut;
  showDone: boolean;
  onToggle: (lessonId: number, m: MistakeOut) => void;
  pendingKey: string | null;
}) {
  const shown = lesson.mistakes.filter((m) => showDone || !m.understood);
  if (shown.length === 0) return null;
  const open = lesson.mistakes.filter((m) => !m.understood).length;
  return (
    <section aria-label={lesson.title} className="mt-7">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug">{lesson.title}</h2>
          <p className="text-[12px] font-semibold text-ink-2">{open} câu cần đọc lại</p>
        </div>
        <Link
          to="/lesson/$id"
          params={{ id: String(lesson.lesson_id) }}
          onClick={() => {
            tap();
            writeLocal(`step:${lesson.lesson_id}`, "practice");
          }}
          className="hit-area inline-flex min-h-9 shrink-0 items-center rounded-full border border-line bg-card px-3 text-[12px] font-semibold shadow-elev-1 active:scale-[0.97]"
        >
          Làm lại trong bài
        </Link>
      </div>
      <div className="mt-3 space-y-3">
        {shown.map((m) => (
          <MistakeCard
            key={m.question_id}
            m={m}
            onToggle={() => onToggle(lesson.lesson_id, m)}
            pending={pendingKey === `${lesson.lesson_id}:${m.question_id}`}
          />
        ))}
      </div>
    </section>
  );
}

function Book({ book }: { book: MistakeBookOut }) {
  const qc = useQueryClient();
  const [showDone, setShowDone] = useState(false);
  const mark = useMutation({
    mutationFn: (v: { lessonId: number; questionId: string; understood: boolean }) =>
      setMistakeUnderstood(v.lessonId, v.questionId, v.understood),
    onSuccess: (next) => qc.setQueryData<MistakeBookOut>(MISTAKE_BOOK_KEY, next),
    onError: (err) => toast.error("Chưa lưu được.", { description: errorMessage(err) }),
  });
  const pendingKey = mark.isPending
    ? `${mark.variables.lessonId}:${mark.variables.questionId}`
    : null;

  const total = book.open + book.understood;
  if (total === 0) {
    return (
      <EmptyState
        title="Chưa có câu sai nào."
        hint="Làm bài ở tab Luyện tập của bài học. Câu nào sai sẽ tự vào đây, kèm đáp án và giải thích."
        action={
          <Link
            to="/lesson"
            className="hit-area mt-4 inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 text-xs font-semibold shadow-elev-1"
          >
            Chọn bài học
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs font-semibold leading-5">
          {book.open} câu cần đọc lại
          {book.understood > 0 && <span className="text-ink-2"> · {book.understood} đã hiểu</span>}
        </p>
        {book.open > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Thêm tuỳ chọn"
              className="hit-area inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 active:scale-[0.95]"
            >
              <MoreHorizontal size={18} strokeWidth={2.4} aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-[14px]">
              <DropdownMenuItem
                onSelect={() => {
                  tap();
                  const day = localDate();
                  downloadText(`so-loi-sai-haru-${day}.md`, mistakesToMarkdown(book, day));
                }}
                className="gap-2 text-xs font-semibold"
              >
                <Download size={14} strokeWidth={2.6} aria-hidden="true" /> Lưu ra máy để in / ôn
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {book.understood > 0 && (
        <label className="mt-2 flex min-h-9 items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
            className="h-4 w-4 accent-[var(--blue)]"
          />
          Hiện cả câu đã hiểu
        </label>
      )}
      {book.open === 0 && !showDone && (
        <p className="mt-5 rounded-[14px] bg-green-soft px-3.5 py-2.5 text-xs font-semibold leading-5">
          Bạn đã đọc hết các câu sai. Làm lại bài luyện tập để chắc hơn.
        </p>
      )}
      {book.lessons.map((l) => (
        <LessonSection
          key={l.lesson_id}
          lesson={l}
          showDone={showDone}
          pendingKey={pendingKey}
          onToggle={(lessonId, m) => {
            tap();
            mark.mutate({ lessonId, questionId: m.question_id, understood: !m.understood });
          }}
        />
      ))}
    </>
  );
}

function MistakesScreen() {
  const auth = useAuth();
  const query = useQuery({
    queryKey: MISTAKE_BOOK_KEY,
    queryFn: getMistakeBook,
    enabled: auth.isAuthenticated,
    staleTime: 15_000,
  });

  return (
    <Shell>
      <header>
        <p className="text-[13px] font-semibold text-ink-2">Luyện tập</p>
        <h1 className="mt-0.5 flex items-center gap-2 text-2xl font-bold leading-tight">
          <BookX size={22} strokeWidth={2.2} aria-hidden="true" className="shrink-0 text-blue" />
          Sổ lỗi sai
        </h1>
        <p className="mt-1.5 text-xs font-medium leading-5 text-ink-2">
          Câu bạn làm sai trong bài luyện tập. Đọc giải thích, chép lại câu đúng, rồi làm lại bài.
          Câu nào bạn làm đúng lần sau sẽ tự rời khỏi sổ.
        </p>
      </header>

      {!auth.isLoading && !auth.isAuthenticated && (
        <section className="mt-8 rounded-[20px] border border-line bg-card p-6 text-center shadow-elev-2">
          <Mascot mood="wave" className="mx-auto h-16 w-16" />
          <h2 className="mt-3 text-lg font-semibold leading-snug">Đăng nhập để có sổ lỗi sai</h2>
          <p className="mt-1.5 text-xs font-semibold leading-5 text-ink-2">
            Haru chỉ lưu câu sai của bạn khi bạn đã đăng nhập.
          </p>
          <Link
            to="/support-language"
            className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-transparent bg-blue py-2.5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
          >
            <LogIn size={16} strokeWidth={2.4} /> Đăng nhập / Tạo tài khoản
          </Link>
        </section>
      )}

      {(auth.isLoading || (auth.isAuthenticated && query.isLoading)) && (
        <LoadingBlocks
          className="mt-6"
          label="Đang tải sổ lỗi sai"
          blocks={["h-12", "h-48", "h-48"]}
        />
      )}

      {query.isError && (
        <ErrorState
          className="mt-6"
          title="Không tải được sổ lỗi sai."
          message={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      )}

      {query.data && <Book book={query.data} />}
    </Shell>
  );
}
