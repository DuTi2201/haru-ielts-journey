import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  EyeOff,
  Headphones,
  Languages,
  Lightbulb,
  LogIn,
  MessagesSquare,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PracticeShell } from "@/components/haru/PracticeShell";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { Ko, Rich } from "@/components/lesson/Rich";
import { useAuth } from "@/hooks/use-auth";
import { usePlaySequence } from "@/hooks/use-play-sequence";
import { useTextAudio } from "@/hooks/use-text-audio";
import { errorMessage } from "@/lib/api/client";
import { finishDailyReading, getDailyReading } from "@/lib/api/content";
import type { DailyFinishOut, DailyPassageOut } from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/daily")({
  head: () => ({
    meta: [
      { title: "Đọc & nghe hôm nay — Haru" },
      {
        name: "description",
        content: "Hội thoại và bài đọc ngắn mỗi ngày, chọn theo những gì bạn đã học.",
      },
      { property: "og:title", content: "Đọc & nghe hôm nay — Haru" },
      {
        property: "og:description",
        content: "Hội thoại và bài đọc ngắn mỗi ngày, chọn theo những gì bạn đã học.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DailyScreen,
});

const DAILY_KEY = ["me", "daily-reading"] as const;

function Back() {
  return (
    <Link
      to="/today"
      onClick={() => tap()}
      className="hit-area -ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-semibold text-blue-deep active:scale-95"
    >
      <ArrowLeft size={15} strokeWidth={2.6} /> Hôm nay
    </Link>
  );
}

function DailyScreen() {
  const auth = useAuth();
  const daily = useQuery({
    queryKey: DAILY_KEY,
    queryFn: getDailyReading,
    enabled: auth.isAuthenticated,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  // one audio element for the whole screen: one clip plays at a time
  const audio = useTextAudio();
  const sequence = usePlaySequence(audio);

  const data = daily.data;
  return (
    <PracticeShell glyph="독">
      <Back />
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
        <Headphones size={24} strokeWidth={2.4} aria-hidden="true" /> Đọc &amp; nghe hôm nay
      </h1>
      <p className="mt-1 text-xs font-semibold leading-5 text-ink-2">
        Một hội thoại và một bài đọc, chọn theo những mẫu ngữ pháp bạn đã học — ưu tiên phần bạn sắp
        quên.
      </p>

      {!auth.isAuthenticated && (
        <Link
          to="/support-language"
          className="hit-area mt-4 flex items-center gap-2.5 rounded-[14px] border border-transparent bg-yellow-soft px-3 py-2.5 text-xs font-semibold leading-5 active:scale-[0.98]"
        >
          <LogIn size={15} strokeWidth={2.4} className="shrink-0" />
          <span>Đăng nhập để nhận bài đọc theo tiến trình học của bạn.</span>
        </Link>
      )}
      {auth.isAuthenticated && daily.isLoading && (
        <LoadingBlocks
          className="mt-4"
          label="Đang tải bài đọc"
          blocks={["h-10", "h-64", "h-48"]}
        />
      )}
      {auth.isAuthenticated && daily.isError && (
        <ErrorState
          className="mt-4"
          title="Không tải được bài đọc hôm nay."
          message={errorMessage(daily.error)}
          onRetry={() => void daily.refetch()}
          retrying={daily.isRefetching}
        />
      )}
      {data && data.items.length === 0 && (
        <EmptyState
          title="Chưa có bài đọc nào phù hợp."
          hint={data.note_vi ?? "Học thêm ở phần Bài học, ngày mai quay lại nhé."}
          action={
            <Link
              to="/lesson"
              className="hit-area mt-3 inline-flex min-h-11 items-center rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] "
            >
              Đến bài học
            </Link>
          }
        />
      )}
      {data && data.items.length > 0 && (
        <div className="mt-4 space-y-5">
          <DayProgress done={data.done} total={data.total} />
          {data.items.map((passage) => (
            <PassageCard key={passage.id} passage={passage} audio={audio} sequence={sequence} />
          ))}
        </div>
      )}
    </PracticeShell>
  );
}

function DayProgress({ done, total }: { done: number; total: number }) {
  const complete = total > 0 && done >= total;
  return (
    <section
      className={cn(
        "rounded-[16px] border border-line p-3 shadow-elev-1",
        complete ? "bg-green-soft" : "bg-card",
      )}
    >
      <div className="flex items-center justify-between text-xs font-semibold">
        <span>{complete ? "Xong bài hôm nay — hẹn ngày mai!" : "Bài hôm nay"}</span>
        <span>
          {done}/{total} bài đã làm câu hỏi
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Tiến độ bài đọc hôm nay"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-progress"
      >
        <div
          className="h-full rounded-full bg-green transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${total ? Math.max((done / total) * 100, 3) : 0}%` }}
        />
      </div>
    </section>
  );
}

type Audio = ReturnType<typeof useTextAudio>;
type Sequence = ReturnType<typeof usePlaySequence>;

function PassageCard({
  passage,
  audio,
  sequence,
}: {
  passage: DailyPassageOut;
  audio: Audio;
  sequence: Sequence;
}) {
  const [showVi, setShowVi] = useState(false);
  const [listenOnly, setListenOnly] = useState(false);
  const isDialogue = passage.kind === "dialogue";
  const sequenceHere = sequence.activeId === passage.id;
  const sounding = audio.state === "loading" || audio.state === "playing";
  // the whole reading plays as one clip; "playing the whole text" is that clip being the active one
  const wholeHere =
    !isDialogue && sounding && audio.activeText === passage.text_en && !sequenceHere;
  const busyHere = sequenceHere || wholeHere;
  // the last clip of this text failed (or was said by the device's own voice)
  const ownsActive = isDialogue
    ? passage.lines.some((l) => l.ko === audio.activeText)
    : audio.activeText === passage.text_en;
  const showNote = ownsActive && !sounding && (audio.state === "error" || audio.usedFallback);

  function listenAll() {
    tap();
    if (busyHere) {
      sequence.stop();
      return;
    }
    if (sequence.activeId) sequence.stop(); // another dialogue is being read: end its run first
    if (isDialogue) {
      sequence.start(
        passage.id,
        passage.lines.map((line) => ({ text: line.ko, voice: line.voice })),
      );
    } else {
      void audio.play(passage.text_en, passage.voice);
    }
  }

  function playLine(text: string, voice: string) {
    tap();
    if (sequence.activeId) sequence.stop();
    void audio.play(text, voice);
  }

  const loading = busyHere && audio.state === "loading";
  const words = passage.words.filter((w) => !w.known && w.meaning_vi);
  const KindIcon = isDialogue ? MessagesSquare : BookOpen;

  return (
    <article className="rounded-[20px] border border-line bg-card p-4 shadow-elev-1">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-blue-soft px-2.5 py-0.5 text-[12px] font-semibold">
          <KindIcon size={12} strokeWidth={2.6} aria-hidden="true" />
          {isDialogue ? "Hội thoại" : "Bài đọc"}
        </span>
        {passage.status === "done" && passage.total != null && (
          <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-green-soft px-2.5 py-0.5 text-[12px] font-semibold">
            <Check size={12} strokeWidth={2.8} aria-hidden="true" /> Đã làm {passage.correct}/
            {passage.total}
          </span>
        )}
      </div>
      <h2 lang="ko" className="mt-2 font-korean text-xl font-semibold leading-7">
        {passage.title_en}
      </h2>
      <p className="text-xs font-semibold text-ink-2">{passage.title_vi}</p>
      {passage.scene_vi && (
        <p className="mt-2 text-xs font-semibold leading-5 text-ink-2">{passage.scene_vi}</p>
      )}
      <p className="mt-2 flex items-start gap-1.5 rounded-[12px] bg-yellow-soft px-2.5 py-1.5 text-[12px] font-semibold leading-4">
        <Lightbulb size={13} strokeWidth={2.4} className="mt-px shrink-0" aria-hidden="true" />
        <Rich text={passage.why_vi} />
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={listenAll}
          aria-pressed={busyHere}
          className={cn(
            "hit-area flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold shadow-elev-1 active:scale-[0.97] ",
            busyHere ? "bg-danger-soft" : "bg-blue text-primary-foreground",
          )}
        >
          {busyHere ? (
            <>
              <Square size={14} strokeWidth={2.6} aria-hidden="true" />
              {loading ? "Đang tạo giọng…" : "Dừng"}
            </>
          ) : (
            <>
              <Volume2 size={16} strokeWidth={2.4} aria-hidden="true" />
              {isDialogue ? "Nghe cả hội thoại" : "Nghe cả bài"}
            </>
          )}
        </button>
        <Toggle
          on={showVi}
          onClick={() => setShowVi((v) => !v)}
          icon={<Languages size={14} strokeWidth={2.4} aria-hidden="true" />}
          label="Nghĩa"
        />
        <Toggle
          on={listenOnly}
          onClick={() => setListenOnly((v) => !v)}
          icon={<EyeOff size={14} strokeWidth={2.4} aria-hidden="true" />}
          label="Chỉ nghe"
        />
      </div>
      {showNote && <AudioNote audio={audio} />}

      {isDialogue ? (
        <ol className="mt-3 space-y-2" aria-label="Các lượt lời của hội thoại">
          {passage.lines.map((line, i) => {
            const woman = line.who === "F";
            const active =
              (sequenceHere && sequence.activeIndex === i) ||
              (!sequenceHere && sounding && audio.activeText === line.ko);
            return (
              <li key={i} className={cn("flex", woman ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[88%] rounded-[16px] border border-line px-3 py-2",
                    woman ? "rounded-tl-[4px] bg-blue-soft" : "rounded-tr-[4px] bg-yellow-soft",
                    active && "ring-2 ring-blue-deep ring-offset-1",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-ink-2">{line.speaker}</span>
                    <button
                      type="button"
                      onClick={() => playLine(line.ko, line.voice)}
                      aria-label={`Nghe câu ${i + 1}`}
                      className="hit-area flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card active:scale-95"
                    >
                      <Volume2 size={14} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  </div>
                  <p
                    lang="ko"
                    aria-hidden={listenOnly || undefined}
                    className={cn(
                      "font-korean text-[15px] font-semibold leading-6",
                      listenOnly && "select-none blur-[6px]",
                    )}
                  >
                    {line.ko}
                  </p>
                  {showVi && (
                    <p className="mt-1 text-xs font-semibold leading-5 text-ink-2">{line.vi}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div
          className={cn(
            "mt-3 space-y-2 rounded-[16px] border border-line bg-paper px-3 py-3",
            wholeHere && "ring-2 ring-blue-deep ring-offset-1",
          )}
        >
          {passage.lines.map((line, i) => (
            <div key={i}>
              <p
                lang="ko"
                aria-hidden={listenOnly || undefined}
                className={cn(
                  "font-korean text-[15px] font-semibold leading-7",
                  listenOnly && "select-none blur-[6px]",
                )}
              >
                {line.ko}
              </p>
              {showVi && <p className="text-xs font-semibold leading-5 text-ink-2">{line.vi}</p>}
            </div>
          ))}
        </div>
      )}

      <Vocabulary passage={passage} words={words} />
      <Questions key={passage.id} passage={passage} />
    </article>
  );
}

function AudioNote({ audio }: { audio: Audio }) {
  return (
    <p role="status" className="mt-2 text-[12px] font-semibold leading-4 text-ink-2">
      {audio.usedFallback
        ? "Chưa tạo được giọng đọc của Haru, tạm dùng giọng của thiết bị. "
        : (audio.error ?? "")}
    </p>
  );
}

function Toggle({
  on,
  onClick,
  icon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tap();
        onClick();
      }}
      aria-pressed={on}
      className={cn(
        "hit-area flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3.5 text-xs font-semibold shadow-elev-1 active:scale-[0.97] ",
        on ? "bg-green-soft" : "bg-card",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Vocabulary({
  passage,
  words,
}: {
  passage: DailyPassageOut;
  words: DailyPassageOut["words"];
}) {
  const hasGloss = passage.glossary.length > 0 || words.length > 0;
  return (
    <>
      {hasGloss && (
        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-2">Từ cần biết</h3>
          <ul className="mt-1.5 space-y-1">
            {passage.glossary.map((g) => (
              <li key={g.ko} className="text-xs font-semibold leading-5">
                <Ko className="font-semibold">{g.ko}</Ko> — {g.vi}
              </li>
            ))}
            {words.map((w) => (
              <li key={w.headword} className="text-xs font-semibold leading-5">
                <Ko className="font-semibold">{w.headword}</Ko> — {w.meaning_vi}{" "}
                <span className="text-[11px] font-semibold text-ink-2">(chưa học)</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {passage.grammar.length > 0 && (
        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-2">
            Ngữ pháp trong bài
          </h3>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {passage.grammar.map((g) => {
              const chip = <Rich text={g.pattern} />;
              const cls =
                "inline-flex min-h-8 items-center rounded-full border border-transparent bg-purple-soft px-2.5 py-1 text-[12px] font-semibold leading-4";
              return (
                <li key={g.pattern}>
                  {g.lesson_id != null ? (
                    <Link
                      to="/lesson/$id"
                      params={{ id: String(g.lesson_id) }}
                      onClick={() => tap()}
                      title={g.meaning_vi ?? undefined}
                      className={cn(cls, "active:scale-95")}
                    >
                      {chip}
                    </Link>
                  ) : (
                    <span className={cls}>{chip}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

function Questions({ passage }: { passage: DailyPassageOut }) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<(number | null)[]>(() => passage.questions.map(() => null));
  const [result, setResult] = useState<DailyFinishOut | null>(null);

  const send = useMutation({
    mutationFn: () => finishDailyReading(passage.id, picked),
    onSuccess: (r) => {
      setResult(r);
      void qc.invalidateQueries({ queryKey: DAILY_KEY });
      void qc.invalidateQueries({ queryKey: ["me", "plan"] });
    },
    onError: (err) => toast.error("Chưa nộp được bài.", { description: errorMessage(err) }),
  });

  const answeredCount = picked.filter((p) => p !== null).length;
  return (
    <section className="mt-5 border-t border-dashed border-line pt-4">
      <h3 className="text-sm font-semibold">Hiểu bài chưa?</h3>
      {passage.status === "done" && !result && passage.total != null && (
        <p className="mt-1 text-[12px] font-semibold leading-4 text-ink-2">
          Kết quả đã lưu: {passage.correct}/{passage.total}. Làm lại để xem giải thích — điểm lần
          đầu vẫn được giữ.
        </p>
      )}
      <ol className="mt-2 space-y-4">
        {passage.questions.map((q, qi) => {
          const graded = result?.answers[qi];
          return (
            <li key={qi}>
              <p className="text-sm font-semibold leading-5">
                {qi + 1}. <Rich text={q.q_vi} />
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {q.options.map((opt, oi) => {
                  const chosen = picked[qi] === oi;
                  const isRight = graded ? graded.correct === oi : false;
                  const isWrongChoice = graded ? chosen && !graded.is_right : false;
                  return (
                    <li key={oi}>
                      <button
                        type="button"
                        disabled={result !== null}
                        aria-pressed={chosen}
                        onClick={() => {
                          tap();
                          setPicked((p) => p.map((v, i) => (i === qi ? oi : v)));
                        }}
                        className={cn(
                          "hit-area flex min-h-11 w-full items-center gap-2 rounded-[14px] border border-line px-3 py-2 text-left text-sm font-semibold leading-5 active:scale-[0.99]",
                          isRight
                            ? "bg-green-soft"
                            : isWrongChoice
                              ? "bg-danger-soft"
                              : chosen
                                ? "bg-blue-soft"
                                : "bg-card",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <Rich text={opt} />
                        </span>
                        {isRight && <Check size={16} strokeWidth={2.8} aria-label="Đáp án đúng" />}
                        {isWrongChoice && (
                          <X size={16} strokeWidth={2.8} aria-label="Bạn chọn sai" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {graded && (
                <p className="mt-1.5 rounded-[12px] bg-paper px-2.5 py-1.5 text-xs font-semibold leading-5">
                  <span className="font-semibold">
                    {graded.is_right
                      ? "Đúng. "
                      : graded.answer === null
                        ? "Chưa trả lời. "
                        : "Chưa đúng. "}
                  </span>
                  <Rich text={graded.explain_vi} />
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {result ? (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-[14px] border border-transparent bg-green-soft px-3 py-2.5">
          <p className="text-sm font-semibold">
            {result.correct}/{result.total} câu đúng
          </p>
          <p className="text-[12px] font-semibold text-ink-2">
            Hôm nay: {result.done}/{result.day_total} bài
          </p>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-ink-2">
            {answeredCount}/{passage.questions.length} câu đã chọn
          </p>
          <button
            type="button"
            onClick={() => send.mutate()}
            disabled={send.isPending || answeredCount === 0}
            className="hit-area flex min-h-11 items-center gap-1.5 rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
          >
            {send.isPending ? "Đang chấm…" : "Nộp bài"}
          </button>
        </div>
      )}
    </section>
  );
}
