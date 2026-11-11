import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, CheckCircle2, Circle, Eye, EyeOff } from "lucide-react";

import type { CapstoneDetectorOut, ExerciseResultOut, WriteEssayOut } from "@/lib/api/types";
import { countWords, lengthStatus, selfPassed } from "@/lib/lesson-grade";
import { readLocal, writeLocal } from "@/lib/lesson-local";
import { detect } from "@/lib/review";
import { cn } from "@/lib/utils";
import { DataBlockView } from "./DataBlock";
import { ExerciseHead, firstSentence, splitProgress } from "./ExerciseHead";
import { EssayAiCheck } from "./EssayAiCheck";
import { BulletList, Disclosure } from "./Disclosure";
import { GrammarLinkBox } from "./GrammarLinkBox";
import type { AnswerEvent } from "./McqExercise";
import { Ko, Rich } from "./Rich";
import { SelfScore } from "./SelfScore";

const STATUS_TEXT = {
  empty: "Chưa viết",
  short: "Còn thiếu",
  ok: "Đủ độ dài",
  long: "Quá dài",
} as const;

/** TOPIK writing 53–54: an essay with a live character count (spaces counted, as in
 * the exam), the question's chart or table, a frame to follow, and — after the
 * learner has tried — the sample answer, the usual mistakes and a self-marking
 * rubric. «Nhờ Haru chấm» (EssayAiCheck) scores the text on the same rubric and shows the fixes. The draft is kept on this device until the learner clears it. */
export function WriteEssay({
  lessonId,
  exercise,
  previous,
  onAnswer,
  onTextChange,
  belowText,
}: {
  lessonId: number;
  exercise: WriteEssayOut;
  previous: Record<string, ExerciseResultOut>;
  onAnswer: (a: AnswerEvent) => void;
  /** Told the draft on mount and on every keystroke (the topic review checks it for patterns). */
  onTextChange?: ((text: string) => void) | undefined;
  /** Shown under the character count (the topic review lists the patterns found so far). */
  belowText?: ReactNode;
}) {
  const draftKey = `draft:${lessonId}:${exercise.id}`;
  const [text, setText] = useState(() => readLocal<string>(draftKey, ""));
  const [revealed, setRevealed] = useState(false);
  const [checks, setChecks] = useState<Set<number>>(new Set());
  const [passed, setPassed] = useState<boolean | null>(null);
  const detectors = useMemo(() => exercise.detectors ?? [], [exercise.detectors]);
  const found = useMemo(() => detect(text, detectors), [text, detectors]);
  useEffect(() => {
    onTextChange?.(text);
  }, [text, onTextChange]);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const progress = splitProgress(exercise.title_vi);
  const task = firstSentence(exercise.instruction_vi || progress.name);

  /** A sentence frame goes into the box at the cursor, and its first ____ is selected to type over. */
  function insertFrame(frame: string) {
    const el = taRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? start;
    const before = text.slice(0, start);
    const lead = before.length > 0 && !/\s$/.test(before) ? " " : "";
    const next = before + lead + frame + text.slice(end);
    setText(next);
    writeLocal(draftKey, next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const gap = /_{3,}/.exec(next.slice(start));
      if (gap) el.setSelectionRange(start + gap.index, start + gap.index + gap[0].length);
      else el.setSelectionRange(start + lead.length + frame.length, start + lead.length + frame.length);
    });
  }

  const count = countWords(text);
  const status = lengthStatus(count, exercise.limits.min, exercise.limits.max);
  const prev = previous[exercise.id];
  // a self-practice prompt ships a framework but no model answer yet
  const hasModel = exercise.model_answer_en.trim().length > 0;
  const modelCount = countWords(exercise.model_answer_en);

  const rubric = exercise.rubric ?? [];
  const criteria =
    rubric.length > 0
      ? rubric.map((r) => ({ label: r.criterion_vi, note: r.note_vi, max: r.max }))
      : [{ label: "Bài viết nói chung", max: exercise.points }];

  return (
    <article
      aria-label={exercise.title_vi}
      className="rounded-[20px] border border-line bg-paper p-3.5 shadow-elev-1"
    >
      <ExerciseHead
        chip={exercise.limits.max <= 60 ? "Viết câu" : "Viết đoạn"}
        n={progress.n}
        total={progress.total}
        task={task.head}
        detail={task.rest || null}
      />

      {exercise.data && exercise.data.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {exercise.data.map((block, i) => (
            <DataBlockView key={i} block={block} />
          ))}
        </div>
      )}

      {(exercise.prompt_en || (exercise.bullets_en && exercise.bullets_en.length > 0)) && (
        <div className="mt-3 rounded-[16px] border border-line bg-card p-3.5">
          {exercise.prompt_en && (
            <p lang="en" className="text-[17px] font-bold leading-7">
              {exercise.prompt_en}
            </p>
          )}
          {exercise.bullets_en && exercise.bullets_en.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {exercise.bullets_en.map((b) => (
                <li key={b} lang="ko" className="font-korean text-[15px] leading-6">
                  · {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(exercise.frames?.length ?? 0) > 0 && (
        <section aria-label="Khung câu" className="mt-3">
          <p className="text-[13px] font-bold text-ink">Khung câu, bấm để chèn vào bài</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {exercise.frames?.map((f) => (
              <li key={f}>
                <button
                  type="button"
                  onClick={() => insertFrame(f)}
                  className="hit-area min-h-11 w-full rounded-[12px] border border-blue/40 bg-blue-soft px-3 py-2 text-left text-[15px] font-semibold leading-6 text-blue-deep active:scale-[0.98]"
                >
                  {f}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {((exercise.useful_vi?.length ?? 0) > 0 ||
        (exercise.avoid_vi?.length ?? 0) > 0 ||
        (exercise.framework_vi?.length ?? 0) > 0 ||
        (exercise.patterns_vi?.length ?? 0) > 0 ||
        (exercise.outline?.length ?? 0) > 0) && (
        <div className="mt-3 space-y-2">
          <Disclosure title={(exercise.useful_vi?.length ?? 0) > 0 ? "Từ và cụm nên dùng · lỗi cần tránh" : "Gợi ý cách viết"}>
            {(exercise.useful_vi?.length ?? 0) > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Từ và cụm nên dùng">
                {exercise.useful_vi?.map((u) => (
                  <li key={u}>
                    <button
                      type="button"
                      onClick={() => insertFrame(u)}
                      className="min-h-10 rounded-full bg-green-soft px-3 text-[14px] font-semibold active:scale-95"
                    >
                      {u}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {(exercise.avoid_vi?.length ?? 0) > 0 && (
              <div className="mt-2.5 rounded-[12px] bg-yellow-soft px-3 py-2">
                <p className="text-[13px] font-bold">Tránh</p>
                <BulletList items={exercise.avoid_vi ?? []} />
              </div>
            )}
            {(exercise.framework_vi?.length ?? 0) > 0 && <BulletList items={exercise.framework_vi ?? []} />}
            {exercise.outline && exercise.outline.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {exercise.outline.map((o) => (
                  <li key={o.part_vi} className="rounded-[10px] bg-blue-soft px-2.5 py-1.5 text-xs leading-5">
                    <span className="font-semibold">{o.part_vi}</span>
                    {o.chars && <span className="font-semibold text-ink-2"> · {o.chars}</span>}
                    <Rich as="p" text={o.content_vi} className="text-ink-2" />
                  </li>
                ))}
              </ul>
            )}
            {exercise.patterns_vi && exercise.patterns_vi.length > 0 && (
              <BulletList items={exercise.patterns_vi} />
            )}
          </Disclosure>
        </div>
      )}

      <div className="mt-3">
        <label htmlFor={`${exercise.id}-essay`} className="text-[13px] font-bold">
          Bài viết của bạn
        </label>
        <textarea
          id={`${exercise.id}-essay`}
          ref={taRef}
          lang="en"
          rows={exercise.limits.max <= 50 ? 4 : exercise.limits.max <= 150 ? 8 : 12}
          autoCapitalize="sentences"
          spellCheck={true}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            writeLocal(draftKey, e.target.value);
          }}
          placeholder={exercise.limits.max <= 60 ? "Viết câu của bạn ở đây…" : "Viết bài của bạn ở đây…"}
          className="mt-1 block w-full resize-y rounded-[14px] border border-line bg-card p-3 text-[16px] leading-7 outline-none focus-visible:ring-2 focus-visible:ring-blue"
        />
        <p
          role="status"
          className={cn(
            "mt-1.5 flex items-center gap-1.5 text-xs font-semibold",
            status === "ok" ? "text-green" : status === "long" ? "text-danger" : "text-ink-2",
          )}
        >
          {status === "ok" ? (
            <CheckCircle2 size={14} strokeWidth={2.6} />
          ) : status === "long" || status === "short" ? (
            <AlertCircle size={14} strokeWidth={2.6} />
          ) : null}
          <span className="tabular-nums">{count}</span> từ · yêu cầu {exercise.limits.min}–
          {exercise.limits.max} · {STATUS_TEXT[status]}
          {status === "short" && ` ${exercise.limits.min - count} từ`}
          {status === "long" && ` ${count - exercise.limits.max} từ`}
        </p>
        <span
          aria-hidden="true"
          className="mt-1 block h-1.5 overflow-hidden rounded-full bg-progress"
        >
          <span
            className={cn(
              "block h-1.5 rounded-full",
              status === "ok" ? "bg-green" : status === "long" ? "bg-danger" : "bg-blue",
            )}
            style={{ width: `${Math.min(100, Math.round((count / Math.max(1, exercise.limits.max)) * 100))}%` }}
          />
        </span>
        {exercise.checklist_vi && exercise.checklist_vi.length > 0 && (
          <section aria-label="Danh sách tự kiểm tra" className="mt-3 rounded-[14px] border border-line bg-card p-3">
            <h4 className="text-[13px] font-bold">Kiểm tra khi viết xong</h4>
            <ul className="mt-1.5 space-y-0.5">
              {exercise.checklist_vi.map((c, i) => (
                <li key={i}>
                  <label className="flex min-h-10 cursor-pointer items-start gap-2.5 py-1 text-[14px] leading-5">
                    <input
                      type="checkbox"
                      checked={checks.has(i)}
                      onChange={() =>
                        setChecks((s) => {
                          const n = new Set(s);
                          if (n.has(i)) n.delete(i);
                          else n.add(i);
                          return n;
                        })
                      }
                      className="mt-0.5 h-5 w-5 shrink-0 accent-blue"
                    />
                    <Rich text={c} className="text-ink" />
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}
        {detectors.length > 0 && <PatternsUsed detectors={detectors} found={found} />}
        {belowText}
        {prev && !revealed && (
          <p className="mt-1 text-[12px] font-semibold text-ink-2">
            Lần trước tự chấm: {prev.answer ?? (prev.correct ? "đạt" : "chưa đạt")}
          </p>
        )}
      </div>

      <EssayAiCheck
        lessonId={lessonId}
        exerciseId={exercise.id}
        text={text}
        onScored={(score, points) => {
          const ok = selfPassed(score, points);
          setPassed(ok);
          onAnswer({
            exerciseId: exercise.id,
            questionId: exercise.id,
            correct: ok,
            answer: `${score}/${points} (Haru chấm)`,
          });
        }}
      />

      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-expanded={revealed}
        className="hit-area mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-[13.5px] font-semibold text-blue-deep underline underline-offset-4 active:scale-[0.97]"
      >
        {revealed ? <EyeOff size={16} strokeWidth={2.4} /> : <Eye size={16} strokeWidth={2.4} />}
        {revealed
          ? hasModel
            ? "Ẩn bài mẫu"
            : "Ẩn phần tự chấm"
          : !hasModel
            ? "Tự chấm bài của bạn"
            : count === 0
              ? "Xem bài mẫu (nên tự viết trước)"
              : "Xem bài mẫu & tự chấm"}
      </button>

      {revealed && (
        <div className="mt-3 space-y-3 animate-in duration-200 fade-in motion-reduce:animate-none">
          {!hasModel && (
            <p className="rounded-[12px] bg-yellow-soft px-3 py-2 text-xs font-semibold leading-5">
              Đề này để tự luyện, chưa có bài mẫu — hãy đối chiếu bài viết của bạn với khung, dàn ý
              và mẫu câu ở trên.
            </p>
          )}
          {hasModel && (
            <section
              aria-label="Bài mẫu"
              className="rounded-[16px] border border-transparent bg-green-soft p-3.5"
            >
              <h4 className="text-xs font-semibold">Bài mẫu · {modelCount} từ</h4>
              <p
                lang="ko"
                className="font-korean mt-1.5 whitespace-pre-line text-[14.5px] leading-7"
              >
                {exercise.model_answer_en}
              </p>
              {exercise.model_note_vi && (
                <Rich
                  as="p"
                  text={exercise.model_note_vi}
                  className="mt-2 text-[12px] font-semibold leading-4 text-ink-2"
                />
              )}
            </section>
          )}

          {exercise.common_errors_vi && exercise.common_errors_vi.length > 0 && (
            <Disclosure title="Lỗi hay gặp" tone="bg-yellow-soft" defaultOpen>
              <BulletList items={exercise.common_errors_vi} />
            </Disclosure>
          )}

          <SelfScore
            criteria={criteria}
            total={exercise.points}
            onSave={(score) => {
              const ok = selfPassed(score, exercise.points);
              setPassed(ok);
              onAnswer({
                exerciseId: exercise.id,
                questionId: exercise.id,
                correct: ok,
                answer: `${score}/${exercise.points}`,
              });
            }}
          />
          <GrammarLinkBox patterns={exercise.grammar} correct={passed !== false} />
        </div>
      )}

      <p className="sr-only">
        <Ko>{exercise.number}</Ko>
      </p>
    </article>
  );
}

/** The patterns a short paragraph is meant to use, ticked when the text looks like it has them.
 * The match is a regex on the text, so a tick means "looks used", not "used correctly". */
function PatternsUsed({
  detectors,
  found,
}: {
  detectors: CapstoneDetectorOut[];
  found: boolean[];
}) {
  const have = found.filter(Boolean).length;
  return (
    <div className="mt-2.5 rounded-[14px] border border-transparent bg-purple-soft p-2.5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">
        Mẫu câu đã dùng · {have}/{detectors.length}
      </p>
      <ul className="mt-1.5 space-y-1">
        {detectors.map((d, i) => {
          const on = found[i] ?? false;
          return (
            <li key={d.pattern} className="flex items-center gap-1.5">
              {on ? (
                <Check
                  size={14}
                  strokeWidth={3}
                  aria-label="đã dùng"
                  className="shrink-0 text-green"
                />
              ) : (
                <Circle
                  size={14}
                  strokeWidth={2.4}
                  aria-label="chưa dùng"
                  className="shrink-0 text-ink-2"
                />
              )}
              <Ko className={cn("text-[13px] leading-5", on ? "font-semibold" : "font-semibold")}>
                {d.label_vi ?? d.pattern}
              </Ko>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[12px] font-semibold leading-4 text-ink-2">
        Máy chỉ dò chữ trong bài, nên dấu ✓ nghĩa là “có vẻ đã dùng”, chưa chắc đã dùng đúng — hãy
        đối chiếu với bài mẫu.
      </p>
    </div>
  );
}
