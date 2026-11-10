import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Flag,
  Lightbulb,
  Loader2,
  Play,
  Square,
  Volume2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Ko, Rich } from "@/components/lesson/Rich";
import type { usePlaySequence } from "@/hooks/use-play-sequence";
import type { useTextAudio } from "@/hooks/use-text-audio";
import { errorMessage } from "@/lib/api/client";
import { selfCheckRealExam } from "@/lib/api/real-exam";
import type {
  RxAnswerOut,
  RxBlankResultOut,
  RxQuestionOut,
  RxResult,
  RxSelfCheckOut,
} from "@/lib/api/types";
import { miss, success, tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import {
  ExamImage,
  ExamText,
  MARKS,
  PointList,
  ResultChip,
  SectionTitle,
  TranslateNote,
} from "./bits";

type Audio = ReturnType<typeof useTextAudio>;
type Sequence = ReturnType<typeof usePlaySequence>;

const WHO: Record<string, string> = { F: "Nữ", M: "Nam", N: "Dẫn" };

function Banner({ a }: { a: RxAnswerOut }) {
  const isMcq = a.ans !== null;
  const skipped = isMcq && a.chosen === null;
  const right = a.ans !== null ? MARKS[a.ans - 1] : "";
  let title: string;
  let body: string;
  if (a.result === "solid") {
    title = "Vững!";
    body = "Bạn làm đúng mà không cần gợi ý — điểm này bạn giữ được.";
  } else if (a.result === "aided") {
    title = "Đúng, nhờ gợi ý.";
    body =
      "Chưa tính là vững. Câu sẽ quay lại sau vài ngày để bạn làm lại một mình — đó mới là lúc kiến thức thật sự là của bạn.";
  } else if (a.result === "pending") {
    title = "Đã nộp — còn bước tự chấm.";
    body =
      "Đối chiếu bài của bạn với đáp án mẫu bên dưới rồi chấm, để Haru ghi nhận đúng mức bạn đạt.";
  } else if (skipped) {
    title = "Bạn chọn xem lời giải.";
    body = `Đáp án là ${right}. Đọc kỹ vì sao rồi câu sẽ quay lại sau vài giờ để thử lại.`;
  } else if (isMcq) {
    title = `Chưa đúng — đáp án là ${right}.`;
    body =
      "Câu sai là chỗ bạn học được nhiều nhất: đọc lý do bên dưới, câu sẽ quay lại sau vài giờ.";
  } else {
    title = "Chưa đúng.";
    body = "Xem đáp án mẫu và lý do bên dưới; câu sẽ quay lại sau vài giờ.";
  }
  const tone =
    a.result === "solid"
      ? "bg-green-soft"
      : a.result === "aided"
        ? "bg-yellow-soft"
        : a.result === "wrong"
          ? "bg-danger-soft"
          : "bg-card";
  return (
    <section role="status" className={cn("rounded-[16px] border border-line px-3.5 py-3", tone)}>
      <div className="flex items-center gap-2">
        {a.result === "wrong" ? (
          <XCircle size={20} strokeWidth={2.4} aria-hidden="true" />
        ) : a.result === "pending" ? (
          <Flag size={20} strokeWidth={2.4} aria-hidden="true" />
        ) : (
          <CheckCircle2 size={20} strokeWidth={2.4} aria-hidden="true" />
        )}
        <p className="text-base font-semibold leading-6">{title}</p>
      </div>
      <p className="mt-1 text-xs font-semibold leading-5">{body}</p>
      {a.hints > 0 && a.result !== "aided" && (
        <p className="mt-1 text-[12px] font-semibold text-ink-2">Bạn đã mở {a.hints} gợi ý.</p>
      )}
    </section>
  );
}

function Options({ q, a }: { q: RxQuestionOut; a: RxAnswerOut }) {
  const count = q.pic ? 4 : q.opts.length;
  return (
    <ul className="mt-2 space-y-2" aria-label="Từng đáp án">
      {Array.from({ length: count }, (_, i) => {
        const n = i + 1;
        const isRight = a.ans === n;
        const isMine = a.chosen === n;
        const note = a.option_notes[String(n)] ?? "";
        const vi = a.options_vi[i];
        return (
          <li
            key={n}
            className={cn(
              "rounded-[14px] border border-line px-3 py-2",
              isRight ? "bg-green-soft" : isMine ? "bg-danger-soft" : "bg-card",
            )}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg font-semibold leading-6">{MARKS[i]}</span>
              <div className="min-w-0 flex-1">
                {!q.pic && (
                  <ExamText
                    text={q.opts[i] ?? ""}
                    className="text-[15px] font-semibold leading-6"
                  />
                )}
                {vi && <p className="text-xs font-semibold leading-5 text-ink-2">{vi}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {isRight && (
                  <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[11px] font-semibold">
                    Đáp án đúng
                  </span>
                )}
                {isMine && !isRight && (
                  <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[11px] font-semibold">
                    Bạn chọn
                  </span>
                )}
              </div>
            </div>
            {!isRight && note && (
              <p className="mt-1 text-xs font-semibold leading-5">
                <span className="font-semibold">Vì sao sai: </span>
                <Rich text={note} />
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Script({
  q,
  a,
  audio,
  sequence,
}: {
  q: RxQuestionOut;
  a: RxAnswerOut;
  audio: Audio;
  sequence: Sequence;
}) {
  const [line, setLine] = useState<number | null>(null);
  const all = sequence.activeId === q.qid;
  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>Lời thoại và nghĩa</SectionTitle>
        {q.clips.length > 0 && (
          <button
            type="button"
            onClick={() => {
              tap();
              if (all) {
                sequence.stop();
                return;
              }
              audio.stop();
              setLine(null);
              sequence.start(
                q.qid,
                q.clips.map((c) => ({ text: c.ko, voice: c.voice })),
              );
            }}
            className="hit-area flex min-h-9 items-center gap-1 rounded-full border border-line bg-card px-3 text-[12px] font-semibold active:scale-95"
          >
            {all ? (
              <Square size={12} strokeWidth={2.6} aria-hidden="true" />
            ) : (
              <Volume2 size={13} strokeWidth={2.4} aria-hidden="true" />
            )}
            {all ? "Dừng" : "Nghe cả bài"}
          </button>
        )}
      </div>
      <ol className="mt-1.5 space-y-2">
        {a.turns.map((t, i) => {
          const playing = line === i && audio.state !== "idle" && !all;
          return (
            <li key={i} className="rounded-[14px] border border-line bg-paper px-3 py-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 w-9 shrink-0 text-[12px] font-semibold text-ink-2">
                  {WHO[t.who] ?? t.who}
                </span>
                <div className="min-w-0 flex-1">
                  <p lang="ko" className="font-korean text-[15px] font-semibold leading-7">
                    {t.ko}
                  </p>
                  {t.vi && <TranslateNote>{t.vi}</TranslateNote>}
                </div>
                {t.voice && (
                  <button
                    type="button"
                    aria-label={`Nghe lại câu ${i + 1}`}
                    onClick={() => {
                      tap();
                      if (sequence.activeId) sequence.stop();
                      if (playing) {
                        audio.stop();
                        setLine(null);
                        return;
                      }
                      setLine(i);
                      void audio.play(t.ko, t.voice ?? undefined);
                    }}
                    className="hit-area flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card active:scale-95"
                  >
                    {playing && audio.state === "loading" ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : playing ? (
                      <Square size={12} strokeWidth={2.6} aria-hidden="true" />
                    ) : (
                      <Play size={14} strokeWidth={2.6} aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PassageLines({ a, title }: { a: RxAnswerOut; title: string }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="mt-1.5 space-y-2 rounded-[14px] border border-line bg-paper px-3 py-2.5">
        {a.passage_lines.map(([ko, vi], i) => (
          <div key={i}>
            <p className="font-korean text-[15px] font-semibold leading-7">
              <ExamText text={ko} />
            </p>
            {vi && <TranslateNote>{vi}</TranslateNote>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Blank({ b }: { b: RxBlankResultOut }) {
  return (
    <li
      className={cn(
        "rounded-[14px] border border-line px-3 py-2",
        b.matched ? "bg-green-soft" : "bg-card",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">Chỗ trống {b.id}</span>
        <span className="text-[12px] font-semibold">
          {b.matched ? "Khớp đáp án mẫu" : "Chưa khớp — tự đối chiếu"}
        </span>
      </div>
      <p className="mt-1 text-xs font-semibold text-ink-2">
        Bạn viết:{" "}
        <Ko className="font-semibold text-ink">{b.text.trim() ? b.text : "(để trống)"}</Ko>
      </p>
      <p className="mt-0.5 text-xs font-semibold">
        Đáp án mẫu: <Ko className="font-semibold">{b.sample}</Ko>
      </p>
      {b.accepted.length > 1 && (
        <p className="mt-0.5 text-[12px] font-semibold text-ink-2">
          Cũng được chấp nhận: <Ko>{b.accepted.filter((x) => x !== b.sample).join(" · ")}</Ko>
        </p>
      )}
      {b.why && (
        <p className="mt-1 text-xs font-semibold leading-5">
          <Rich text={b.why} />
        </p>
      )}
      {b.gram.length > 0 && (
        <p className="mt-1 text-xs font-semibold leading-5">
          {b.gram.map((g, i) => (
            <span key={i} className="mr-2">
              <Ko className="font-semibold">{g.k}</Ko> — {g.vi}
            </span>
          ))}
        </p>
      )}
      {b.traps.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {b.traps.map((t, i) => (
            <li key={i} className="flex gap-1.5 text-[12px] font-semibold leading-4">
              <CircleAlert
                size={12}
                strokeWidth={2.4}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <Rich text={t} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function SelfCheck({ a, onDone }: { a: RxAnswerOut; onDone: (r: RxSelfCheckOut) => void }) {
  const fill = a.blanks.length > 0;
  const [ticks, setTicks] = useState<boolean[]>(() => a.rubric.map(() => false));
  const send = useMutation({
    mutationFn: (body: { ok?: boolean; rubric_ok?: boolean[] }) =>
      selfCheckRealExam(a.attempt_id, body),
    onSuccess: (r) => {
      if (r.result === "solid") success();
      else miss();
      onDone(r);
    },
    onError: (e) => toast.error("Chưa lưu được kết quả tự chấm.", { description: errorMessage(e) }),
  });

  return (
    <section className="rounded-[16px] border border-dashed border-line bg-card px-3 py-3">
      <SectionTitle>Bước tự chấm</SectionTitle>
      {fill ? (
        <>
          <p className="mt-1 text-xs font-semibold leading-5">
            Câu bạn viết chưa khớp danh sách có sẵn, nhưng có thể vẫn đúng. Đọc đáp án mẫu và lý do
            ở trên rồi trả lời thật lòng: bài của bạn đúng nghĩa và đúng ngữ pháp chưa?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={send.isPending}
              onClick={() => {
                tap();
                send.mutate({ ok: true });
              }}
              className="hit-area min-h-11 rounded-full border border-transparent bg-green-soft px-4 text-xs font-semibold shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
            >
              Bài của tôi đúng
            </button>
            <button
              type="button"
              disabled={send.isPending}
              onClick={() => {
                tap();
                send.mutate({ ok: false });
              }}
              className="hit-area min-h-11 rounded-full border border-transparent bg-danger-soft px-4 text-xs font-semibold shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
            >
              Chưa đúng — tôi sẽ sửa
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs font-semibold leading-5">
            Đọc bài mẫu rồi tick những tiêu chí bài của bạn đã đạt. Đạt từ 80% tiêu chí (và đủ độ
            dài) thì tính là vững.
          </p>
          <ul className="mt-2 space-y-1.5">
            {a.rubric.map((r, i) => (
              <li key={i}>
                <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[12px] border border-line bg-paper px-3 py-2">
                  <input
                    type="checkbox"
                    checked={ticks[i] ?? false}
                    onChange={(e) =>
                      setTicks((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--blue)]"
                  />
                  <span className="text-xs font-semibold leading-5">
                    <span className="font-semibold">
                      <Rich text={r.k} />
                    </span>
                    {r.w && (
                      <span className="block text-ink-2">
                        <Rich text={r.w} />
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={send.isPending}
            onClick={() => {
              tap();
              send.mutate({ rubric_ok: ticks });
            }}
            className="hit-area mt-2.5 flex min-h-11 items-center gap-1.5 rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
          >
            {send.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Lưu kết quả tự chấm
          </button>
        </>
      )}
    </section>
  );
}

function WritingFeedback({ a }: { a: RxAnswerOut }) {
  return (
    <>
      {a.blanks.length > 0 && (
        <section>
          <SectionTitle>Từng chỗ trống</SectionTitle>
          <ul className="mt-1.5 space-y-2">
            {a.blanks.map((b) => (
              <Blank key={b.id} b={b} />
            ))}
          </ul>
        </section>
      )}
      {a.checks.length > 0 && (
        <section>
          <SectionTitle>Máy kiểm tra giúp bạn</SectionTitle>
          <ul className="mt-1.5 space-y-1.5">
            {a.checks.map((c, i) => (
              <li
                key={i}
                className={cn(
                  "flex gap-2 rounded-[12px] border border-line px-3 py-1.5 text-xs font-semibold leading-5",
                  c.ok ? "bg-green-soft" : "bg-danger-soft",
                )}
              >
                {c.ok ? (
                  <CheckCircle2
                    size={14}
                    strokeWidth={2.4}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <XCircle
                    size={14}
                    strokeWidth={2.4}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span>
                  <span className="font-semibold">{c.label}: </span>
                  <Rich text={c.note} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {a.data.length > 0 && (
        <section>
          <SectionTitle>Số liệu của đề</SectionTitle>
          <ul className="mt-1.5 space-y-1">
            {a.data.map(([ko, vi], i) => (
              <li key={i} className="text-xs font-semibold leading-5">
                <Ko className="font-semibold">{ko}</Ko> <span className="text-ink-2">— {vi}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {a.sample && (
        <section>
          <SectionTitle>{a.blanks.length > 0 ? "Câu mẫu" : "Bài mẫu"}</SectionTitle>
          <div className="mt-1.5 rounded-[14px] border border-transparent bg-green-soft px-3 py-2.5">
            {a.sample.split("\n").map((line, i) => (
              <p key={i} lang="ko" className="font-korean text-[15px] font-semibold leading-7">
                {line}
              </p>
            ))}
            {a.sample_vi && <TranslateNote>{a.sample_vi}</TranslateNote>}
          </div>
        </section>
      )}
      {a.phrases.length > 0 && (
        <section>
          <SectionTitle>Mẫu câu dùng lại được</SectionTitle>
          <ul className="mt-1.5 space-y-1">
            {a.phrases.map((p, i) => (
              <li key={i} className="text-xs font-semibold leading-5">
                <Ko className="font-semibold">{p.k}</Ko>{" "}
                <span className="text-ink-2">— {p.vi}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {a.tips && (
        <p className="flex gap-1.5 text-xs font-semibold leading-5">
          <Lightbulb size={13} strokeWidth={2.4} className="mt-1 shrink-0" aria-hidden="true" />
          <Rich text={a.tips} />
        </p>
      )}
    </>
  );
}

/** Everything the learner takes from one answered question: whether it was right and why,
 * why every other option is wrong, the script or passage with its meaning, the grammar and words
 * the question rests on (linked to the lessons), the one thing to take away, and the next step. */
export function Explanation({
  q,
  a,
  audio,
  sequence,
  isLast,
  onNext,
  onSelfChecked,
}: {
  q: RxQuestionOut;
  a: RxAnswerOut;
  audio: Audio;
  sequence: Sequence;
  isLast: boolean;
  onNext: () => void;
  onSelfChecked: (r: RxSelfCheckOut) => void;
}) {
  const isMcq = a.ans !== null;
  return (
    <article className="space-y-4 rounded-[20px] border border-line bg-card p-4 shadow-elev-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex rounded-full border border-transparent bg-blue-soft px-2.5 py-0.5 text-[12px] font-semibold">
          {q.exam_short} · {q.sec === "L" ? "Nghe" : q.sec === "R" ? "Đọc" : "Viết"} {q.n}
        </span>
        <ResultChip result={a.result as RxResult} />
      </div>

      <Banner a={a} />

      {a.take && (
        <section className="rounded-[16px] border border-transparent bg-yellow-soft px-3.5 py-3">
          <SectionTitle>Điều cần mang theo</SectionTitle>
          <p className="mt-1 text-sm font-semibold leading-6">
            <Rich text={a.take} />
          </p>
          {a.guide_tip && (
            <p className="mt-1.5 flex gap-1.5 text-xs font-semibold leading-5">
              <Lightbulb size={13} strokeWidth={2.4} className="mt-1 shrink-0" aria-hidden="true" />
              <Rich text={a.guide_tip} />
            </p>
          )}
        </section>
      )}

      {q.image_url && <ExamImage path={q.image_url} alt={`Hình của câu ${q.n}`} />}

      {isMcq && (
        <section>
          <SectionTitle>Vì sao đáp án này đúng</SectionTitle>
          {a.why && (
            <p className="mt-1 text-sm font-semibold leading-6">
              <Rich text={a.why} />
            </p>
          )}
          <Options q={q} a={a} />
        </section>
      )}

      {a.turns.length > 0 && <Script q={q} a={a} audio={audio} sequence={sequence} />}
      {a.turns.length === 0 && a.passage_lines.length > 0 && (
        <PassageLines a={a} title="Bài đọc và nghĩa" />
      )}
      {a.given_vi && (
        <TranslateNote>
          <span className="font-semibold">Câu cho sẵn: </span>
          {a.given_vi}
        </TranslateNote>
      )}

      {!isMcq && <WritingFeedback a={a} />}

      {a.needs_self_check && <SelfCheck a={a} onDone={onSelfChecked} />}

      <section>
        <SectionTitle>Kiến thức trong câu này</SectionTitle>
        <div className="mt-1.5">
          <PointList
            points={a.points}
            emptyHint={
              q.sec === "W"
                ? "Các mẫu câu cần dùng nằm ở mục “Mẫu câu dùng lại được” phía trên."
                : "Câu này không dựa vào mẫu ngữ pháp riêng nào — chỉ cần nghe/đọc hiểu."
            }
          />
        </div>
        {a.points.some((p) => p.status === "new") && (
          <p className="mt-1.5 text-[12px] font-semibold leading-4 text-ink-2">
            “Mới” là điểm chưa có trong bài học nào của Haru — không sao, bạn vừa gặp nó ở đây và nó
            sẽ được ghi vào phần cần ôn của bạn.
          </p>
        )}
      </section>

      <div>
        <button
          type="button"
          onClick={() => {
            tap();
            sequence.stop();
            audio.stop();
            onNext();
          }}
          className="hit-area flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] "
        >
          {isLast ? "Xem bạn thu được gì" : "Câu tiếp theo"}
          <ArrowRight size={16} strokeWidth={2.6} aria-hidden="true" />
        </button>
        {a.needs_self_check && (
          <p className="mt-1.5 text-center text-[12px] font-semibold text-ink-2">
            Chưa tự chấm thì câu này chưa được tính vào mức vững của bạn.
          </p>
        )}
      </div>
    </article>
  );
}
