import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, HelpCircle, Lightbulb, Loader2, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Ko, Rich } from "@/components/lesson/Rich";
import type { usePlaySequence } from "@/hooks/use-play-sequence";
import type { useTextAudio } from "@/hooks/use-text-audio";
import { errorMessage } from "@/lib/api/client";
import { answerRealExam, openRealExamHint } from "@/lib/api/real-exam";
import type { RxAnswerOut, RxHintOut, RxQuestionOut } from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import { ExamImage, ExamText, FitChip, MARKS, SectionTitle, TierChip } from "./bits";

type Audio = ReturnType<typeof useTextAudio>;
type Sequence = ReturnType<typeof usePlaySequence>;

const HINT_BUTTONS: Record<"mcq" | "write", string[]> = {
  mcq: ["1 · Nhìn vào đâu?", "2 · Dịch đáp án & từ khó", "3 · Loại một đáp án"],
  write: ["1 · Nhìn vào đâu?", "2 · Mẫu ngữ pháp cần dùng", "3 · Gợi ý khung bài"],
};

export function QuestionCard({
  setId,
  q,
  audio,
  sequence,
  onAnswered,
}: {
  setId: string;
  q: RxQuestionOut;
  audio: Audio;
  sequence: Sequence;
  onAnswered: (a: RxAnswerOut) => void;
}) {
  const isWrite = q.sec === "W";
  const [choice, setChoice] = useState<number | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [essay, setEssay] = useState("");
  const [hints, setHints] = useState<Record<number, RxHintOut>>({});
  const [hintBusy, setHintBusy] = useState(false);
  const restored = useRef(false);

  // a sitting picked up again: show the hints already opened for this question
  useEffect(() => {
    if (restored.current || q.hint_level === 0) return;
    restored.current = true;
    void (async () => {
      for (let l = 1; l <= q.hint_level; l++) {
        try {
          const h = await openRealExamHint(setId, q.qid, l);
          setHints((prev) => ({ ...prev, [l]: h }));
        } catch {
          return;
        }
      }
    })();
  }, [q.hint_level, q.qid, setId]);

  const level = Math.max(0, ...Object.keys(hints).map(Number));
  const struck = hints[3]?.kind === "eliminate" ? hints[3].option : null;
  const optionsVi = hints[2]?.kind === "translate" ? (hints[2].options_vi ?? []) : [];

  async function openHint(l: number) {
    tap();
    setHintBusy(true);
    try {
      const h = await openRealExamHint(setId, q.qid, l);
      setHints((prev) => ({ ...prev, [l]: h }));
    } catch (e) {
      toast.error("Chưa mở được gợi ý.", { description: errorMessage(e) });
    } finally {
      setHintBusy(false);
    }
  }

  const send = useMutation({
    mutationFn: (body: {
      choice?: number | null;
      answers?: Record<string, string>;
      text?: string;
    }) => answerRealExam(setId, { qid: q.qid, ...body }),
    onSuccess: (a) => {
      sequence.stop();
      onAnswered(a);
    },
    onError: (e) => toast.error("Chưa nộp được câu này.", { description: errorMessage(e) }),
  });

  const canSubmit = isWrite
    ? q.blanks.length > 0
      ? q.blanks.some((id) => (texts[id] ?? "").trim() !== "")
      : essay.trim().length > 0
    : choice !== null;

  function submit() {
    tap();
    if (!isWrite) send.mutate({ choice });
    else if (q.blanks.length > 0) send.mutate({ answers: texts });
    else send.mutate({ text: essay });
  }

  const showPassage = q.passage && !q.image_url;

  return (
    <article className="rounded-[20px] border border-line bg-card p-4 shadow-elev-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex rounded-full border border-transparent bg-blue-soft px-2.5 py-0.5 text-[12px] font-semibold">
          {q.exam_short} · {q.sec === "L" ? "Nghe" : q.sec === "R" ? "Đọc" : "Viết"} {q.n}
        </span>
        <TierChip tier={q.tier} />
        <FitChip fit={q.fit} />
      </div>
      <p className="mt-1.5 text-[12px] font-semibold text-ink-2">{q.type_name}</p>
      {q.bundle_size > 1 && (
        <p className="mt-0.5 text-[12px] font-semibold text-ink-2">
          Cùng một bài với {q.bundle_size - 1} câu khác ({q.bundle_index + 1}/{q.bundle_size}).
        </p>
      )}

      {q.stem && (
        <p className="mt-3 text-sm font-semibold leading-6">
          <ExamText text={q.stem} />
        </p>
      )}

      {q.clips.length > 0 && <ListenPanel q={q} audio={audio} sequence={sequence} />}

      {q.image_url && (
        <div className="mt-3">
          <ExamImage path={q.image_url} alt={`Hình của câu ${q.n}`} />
        </div>
      )}

      {q.given && (
        <div className="mt-3 rounded-[14px] border border-transparent bg-yellow-soft px-3 py-2">
          <SectionTitle>Câu cho sẵn</SectionTitle>
          <p className="mt-1 font-korean text-[15px] font-semibold leading-7">{q.given}</p>
        </div>
      )}

      {showPassage && (
        <div className="mt-3 space-y-1.5 rounded-[14px] border border-line bg-paper px-3 py-3">
          {q.passage?.split("\n").map((line, i) => (
            <p key={i} className="font-korean text-[15px] font-semibold leading-7">
              <ExamText text={line} />
            </p>
          ))}
        </div>
      )}

      {q.prompt && (
        <div className="mt-3 space-y-1.5 rounded-[14px] border border-line bg-paper px-3 py-3">
          <p lang="ko" className="font-korean text-[15px] font-semibold leading-7">
            {q.prompt}
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            {q.questions.map((x, i) => (
              <li key={i} lang="ko" className="font-korean text-[15px] font-semibold leading-6">
                {x}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* the options */}
      {!isWrite && (
        <ul className="mt-3 space-y-2" aria-label="Các đáp án">
          {(q.pic ? ["", "", "", ""] : q.opts).map((opt, i) => {
            const n = i + 1;
            const out = struck === n;
            const vi = optionsVi[i];
            return (
              <li key={n}>
                <button
                  type="button"
                  disabled={out || send.isPending}
                  aria-pressed={choice === n}
                  onClick={() => {
                    tap();
                    setChoice(n);
                  }}
                  className={cn(
                    "hit-area flex min-h-12 w-full items-start gap-2.5 rounded-[14px] border border-line px-3 py-2 text-left active:scale-[0.99]",
                    out ? "bg-paper opacity-50" : choice === n ? "bg-blue-soft" : "bg-card",
                  )}
                >
                  <span className="mt-0.5 text-lg font-semibold leading-6">{MARKS[i]}</span>
                  <span className="min-w-0 flex-1">
                    {!q.pic && (
                      <ExamText
                        text={opt}
                        className={cn("text-[15px] font-semibold leading-6", out && "line-through")}
                      />
                    )}
                    {q.pic && (
                      <span className="text-xs font-semibold text-ink-2">Hình {MARKS[i]}</span>
                    )}
                    {vi && (
                      <span className="mt-0.5 block text-xs font-semibold leading-5 text-ink-2">
                        {vi}
                      </span>
                    )}
                    {out && (
                      <span className="mt-0.5 block text-[12px] font-semibold text-ink-2">
                        Đã loại — đáp án này sai.
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* writing */}
      {isWrite && q.blanks.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {q.blanks.map((id) => (
            <label key={id} className="block">
              <span className="text-xs font-semibold">Chỗ trống {id}</span>
              <input
                lang="ko"
                value={texts[id] ?? ""}
                onChange={(e) => setTexts((prev) => ({ ...prev, [id]: e.target.value }))}
                autoComplete="off"
                spellCheck={false}
                className="mt-1 min-h-11 w-full rounded-[12px] border border-line bg-card px-3 font-korean text-[15px] font-semibold"
              />
            </label>
          ))}
        </div>
      )}
      {isWrite && q.blanks.length === 0 && (
        <div className="mt-3">
          <textarea
            lang="ko"
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
            rows={q.limit && q.limit[1] > 400 ? 14 : 8}
            spellCheck={false}
            aria-label="Bài viết của bạn"
            className="w-full rounded-[12px] border border-line bg-card px-3 py-2 font-korean text-[15px] font-semibold leading-7"
          />
          <p
            className={cn(
              "mt-1 text-[12px] font-semibold",
              q.limit && essay.replace(/\n/g, "").length > q.limit[1]
                ? "text-danger"
                : "text-ink-2",
            )}
          >
            {essay.replace(/\n/g, "").length} chữ
            {q.limit ? ` · yêu cầu ${q.limit[0]}–${q.limit[1]} (tính cả khoảng trắng)` : ""}
          </p>
        </div>
      )}

      <HintPanel
        isWrite={isWrite}
        hints={hints}
        level={level}
        busy={hintBusy}
        onOpen={(l) => void openHint(l)}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || send.isPending}
          className="hit-area flex min-h-11 items-center gap-1.5 rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
        >
          {send.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {isWrite ? "Nộp bài viết" : "Kiểm tra"}
        </button>
        {!isWrite && (
          <button
            type="button"
            onClick={() => {
              tap();
              send.mutate({ choice: null });
            }}
            disabled={send.isPending}
            className="hit-area flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-xs font-semibold shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
          >
            <Eye size={14} strokeWidth={2.4} aria-hidden="true" />
            Chưa biết — cho tôi xem lời giải
          </button>
        )}
      </div>
      <p className="mt-2 text-[12px] font-semibold leading-4 text-ink-2">
        Không có đồng hồ. Dùng gợi ý khi cần — chỉ là câu làm không gợi ý mới được tính là “vững”.
      </p>
    </article>
  );
}

function ListenPanel({
  q,
  audio,
  sequence,
}: {
  q: RxQuestionOut;
  audio: Audio;
  sequence: Sequence;
}) {
  const here = sequence.activeId === q.qid;
  const loading = here && audio.state === "loading";
  return (
    <div className="mt-3 rounded-[14px] border border-transparent bg-blue-soft px-3 py-3">
      <button
        type="button"
        aria-pressed={here}
        onClick={() => {
          tap();
          if (here) {
            sequence.stop();
            return;
          }
          if (sequence.activeId) sequence.stop();
          sequence.start(
            q.qid,
            q.clips.map((c) => ({ text: c.ko, voice: c.voice })),
          );
        }}
        className={cn(
          "hit-area flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-line text-sm font-semibold shadow-elev-1 active:scale-[0.97] ",
          here ? "bg-danger-soft" : "bg-blue text-primary-foreground",
        )}
      >
        {here ? (
          <>
            <Square size={14} strokeWidth={2.6} aria-hidden="true" />
            {loading ? "Đang tạo giọng…" : "Dừng"}
          </>
        ) : (
          <>
            <Volume2 size={18} strokeWidth={2.4} aria-hidden="true" />
            Nghe
          </>
        )}
      </button>
      <p className="mt-2 text-[12px] font-semibold leading-4">
        Nghe bao nhiêu lần tuỳ bạn — mục tiêu là hiểu, không phải nghe đúng một lần. Lời thoại hiện
        ra sau khi bạn trả lời.
      </p>
      {here && audio.state === "error" && (
        <p role="status" className="mt-1 text-[12px] font-semibold text-danger">
          {audio.error ?? "Không phát được âm thanh."}
        </p>
      )}
      {here && audio.usedFallback && (
        <p role="status" className="mt-1 text-[12px] font-semibold text-ink-2">
          Chưa tạo được giọng đọc của Haru, tạm dùng giọng của thiết bị.
        </p>
      )}
    </div>
  );
}

function HintPanel({
  isWrite,
  hints,
  level,
  busy,
  onOpen,
}: {
  isWrite: boolean;
  hints: Record<number, RxHintOut>;
  level: number;
  busy: boolean;
  onOpen: (level: number) => void;
}) {
  const labels = HINT_BUTTONS[isWrite ? "write" : "mcq"];
  return (
    <section className="mt-4 rounded-[14px] border border-dashed border-line px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <HelpCircle size={14} strokeWidth={2.4} aria-hidden="true" />
        <SectionTitle>Cần gợi ý?</SectionTitle>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {labels.map((label, i) => {
          const l = i + 1;
          const opened = hints[l] !== undefined;
          return (
            <button
              key={l}
              type="button"
              disabled={busy || opened || l > level + 1}
              onClick={() => onOpen(l)}
              className={cn(
                "hit-area min-h-9 rounded-full border border-line px-3 text-[12px] font-semibold active:scale-95 disabled:opacity-50",
                opened ? "bg-yellow-soft" : "bg-card",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 space-y-2">
        {Object.values(hints)
          .sort((a, b) => a.level - b.level)
          .map((h) => (
            <HintBody key={h.level} hint={h} />
          ))}
      </div>
    </section>
  );
}

function HintBody({ hint }: { hint: RxHintOut }) {
  if (hint.kind === "focus") {
    return (
      <p className="flex gap-1.5 rounded-[12px] bg-yellow-soft px-2.5 py-1.5 text-xs font-semibold leading-5">
        <Lightbulb size={13} strokeWidth={2.4} className="mt-1 shrink-0" aria-hidden="true" />
        <Rich text={hint.text} />
      </p>
    );
  }
  if (hint.kind === "translate") {
    return (
      <div className="rounded-[12px] bg-yellow-soft px-2.5 py-1.5 text-xs font-semibold leading-5">
        <p className="font-semibold">Nghĩa các đáp án hiện dưới từng đáp án.</p>
        {hint.gloss && hint.gloss.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {hint.gloss.map((g, i) => (
              <li key={i}>
                <Ko className="font-semibold">{g[0]}</Ko> — {g[1]}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (hint.kind === "eliminate") {
    return (
      <p className="rounded-[12px] bg-yellow-soft px-2.5 py-1.5 text-xs font-semibold leading-5">
        Đáp án {hint.option !== null ? MARKS[hint.option - 1] : ""} đã bị loại — nó sai.
      </p>
    );
  }
  if (hint.kind === "patterns") {
    return (
      <div className="space-y-1.5 rounded-[12px] bg-yellow-soft px-2.5 py-1.5 text-xs font-semibold leading-5">
        {(hint.items ?? []).map((it, i) => {
          const gram = (it["gram"] as { k: string; vi: string }[] | undefined) ?? [];
          const id = typeof it["id"] === "string" ? it["id"] : "";
          return (
            <div key={i}>
              {id && <span className="font-semibold">{id}: </span>}
              {gram.map((g, j) => (
                <span key={j} className="mr-2">
                  <Ko className="font-semibold">{g.k}</Ko> — {g.vi}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    );
  }
  if (hint.kind === "start") {
    return (
      <p className="rounded-[12px] bg-yellow-soft px-2.5 py-1.5 text-xs font-semibold leading-5">
        Mở đầu:{" "}
        {(hint.items ?? []).map((it, i) => (
          <Ko key={i} className="mr-2 font-semibold">
            {typeof it["id"] === "string" ? `${it["id"]} ` : ""}
            {typeof it["text"] === "string" ? it["text"] : ""}
          </Ko>
        ))}
      </p>
    );
  }
  return (
    <div className="rounded-[12px] bg-yellow-soft px-2.5 py-1.5 text-xs font-semibold leading-5">
      <p className="font-semibold">Khung bài</p>
      <ol className="mt-0.5 list-decimal space-y-0.5 pl-4">
        {(hint.rubric ?? []).map((r, i) => (
          <li key={i}>
            <Rich text={r.k} />
          </li>
        ))}
      </ol>
    </div>
  );
}
