import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Mic, Play, RotateCcw, SkipForward, Square } from "lucide-react";

import type {
  ExerciseResultOut,
  PracticeDataBlock,
  PracticeScene,
  SpeakOut,
} from "@/lib/api/types";
import { clock, selfPassed } from "@/lib/lesson-grade";
import { success, tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { DataBlockView } from "./DataBlock";
import { BulletList, Disclosure } from "./Disclosure";
import { ExerciseAudio } from "./ExerciseAudio";
import type { AnswerEvent } from "./McqExercise";
import { Ko, Rich } from "./Rich";
import { SceneView } from "./SceneView";
import { SelfScore } from "./SelfScore";

type Phase = "idle" | "prep" | "answer" | "done";

/** The three things TOPIK Speaking is marked on, each 0–4, scaled to the task's points. */
const SPEAK_CRITERIA = [
  { label: "과제 수행·내용", note: "Hoàn thành yêu cầu, đủ ý", max: 4 },
  { label: "언어 구사력", note: "Từ vựng, ngữ pháp, đúng cấp độ lời nói", max: 4 },
  { label: "발음·전달력", note: "Phát âm, nhịp điệu, dễ hiểu", max: 4 },
];

/** Counts down `seconds` from the moment `start` is called, from the clock rather
 * than from interval ticks, so a throttled background tab does not slow it. */
function useCountdown(onEnd: () => void) {
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const endsAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  const clear = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(
    (seconds: number) => {
      clear();
      setTotal(seconds);
      setRemaining(seconds);
      endsAt.current = Date.now() + seconds * 1000;
      timer.current = setInterval(() => {
        const left = (endsAt.current - Date.now()) / 1000;
        if (left <= 0) {
          clear();
          setRemaining(0);
          endRef.current();
        } else {
          setRemaining(left);
        }
      }, 200);
    },
    [clear],
  );

  useEffect(() => clear, [clear]);
  return { remaining, total, start, stop: clear };
}

/** Records the learner's answer on this device only (never uploaded) so they can
 * hear themselves back. The microphone is asked for when the learner starts, and
 * everything degrades quietly when it is refused or not there. */
function useLocalRecorder() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const release = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const discard = useCallback(() => {
    setUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
  }, []);

  /** Ask for the microphone (call inside the tap). Resolves false when unavailable. */
  const prepare = useCallback(async (): Promise<boolean> => {
    setError(null);
    discard();
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Trình duyệt này không hỗ trợ ghi âm — bạn vẫn luyện nói bình thường.");
      return false;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch {
      setError("Chưa được cấp quyền micro — bạn vẫn luyện nói bình thường.");
      return false;
    }
  }, [discard]);

  const begin = useCallback(() => {
    if (!stream.current) return;
    try {
      chunks.current = [];
      const rec = new MediaRecorder(stream.current);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 0) setUrl(URL.createObjectURL(blob));
        release();
      };
      rec.start();
      recorder.current = rec;
    } catch {
      setError("Không bắt đầu ghi âm được.");
      release();
    }
  }, [release]);

  const end = useCallback(() => {
    const rec = recorder.current;
    recorder.current = null;
    if (rec && rec.state !== "inactive") rec.stop();
    else release();
  }, [release]);

  useEffect(
    () => () => {
      end();
      release();
    },
    [end, release],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  return { url, error, prepare, begin, end, discard };
}

function Frames({ frames }: { frames: PracticeScene[] }) {
  if (frames.length === 0) return null;
  return (
    <div className={cn("mt-3", frames.length > 1 && "grid grid-cols-2 gap-2.5")}>
      {frames.map((f, i) => (
        <div key={i} className="relative">
          {frames.length > 1 && (
            <span className="absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-transparent bg-yellow-strong text-[11px] font-semibold">
              {i + 1}
            </span>
          )}
          <SceneView scene={f} tone={i} compact={frames.length > 1} />
        </div>
      ))}
    </div>
  );
}

/** TOPIK Speaking (S1–S6): the prompt, the picture / recording / figures it comes with,
 * a preparation countdown followed by an answer countdown, an optional on-device
 * recording to listen back to, then the sample answer, the usual mistakes and a
 * self-marking form. Practice variants swap the prompt for another situation. */
export function SpeakTask({
  lessonId,
  exercise,
  previous,
  once,
  onAnswer,
}: {
  lessonId: number;
  exercise: SpeakOut;
  previous: Record<string, ExerciseResultOut>;
  once: boolean;
  onAnswer: (a: AnswerEvent) => void;
}) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [wantRecord, setWantRecord] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const recorder = useLocalRecorder();

  const variant = exercise.practice?.find((p) => p.id === variantId) ?? null;
  const prompt = variant?.prompt_ko ?? exercise.prompt_ko;
  const promptVi = variant ? (variant.prompt_vi ?? null) : (exercise.prompt_vi ?? null);
  const frames = variant ? (variant.frames ?? []) : (exercise.frames ?? []);
  const data: PracticeDataBlock[] = variant ? (variant.data ?? []) : (exercise.data ?? []);
  const prev = previous[exercise.id];

  // The phase is mirrored in a ref so the clock's callback never reads a stale one.
  const phaseRef = useRef<Phase>("idle");
  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const countdown = useCountdown(() => {
    // the clock ran out: preparation hands over to the answer, the answer ends
    if (phaseRef.current === "prep") {
      go("answer");
      countdown.start(exercise.answer_sec);
      if (wantRecord) recorder.begin();
    } else if (phaseRef.current === "answer") {
      recorder.end();
      success();
      go("done");
    }
  });

  function reset(nextVariant: string | null = variantId) {
    countdown.stop();
    recorder.end();
    recorder.discard();
    go("idle");
    setVariantId(nextVariant);
  }

  async function start() {
    tap();
    if (wantRecord) await recorder.prepare();
    go("prep");
    countdown.start(exercise.prep_sec);
  }

  function skipPrep() {
    tap();
    go("answer");
    countdown.start(exercise.answer_sec);
    if (wantRecord) recorder.begin();
  }

  function finish() {
    countdown.stop();
    recorder.end();
    success();
    go("done");
  }

  const running = phase === "prep" || phase === "answer";
  const pct = countdown.total > 0 ? (countdown.remaining / countdown.total) * 100 : 0;

  return (
    <article
      aria-label={exercise.title_vi}
      className="rounded-[20px] border border-line bg-paper p-3.5 shadow-elev-1"
    >
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-blue-deep">
          {exercise.title_vi} · {exercise.max_points} điểm
        </p>
        {exercise.instruction_ko && (
          <p lang="ko" className="font-korean mt-1 text-[13px] font-semibold leading-5">
            {exercise.instruction_ko}
          </p>
        )}
      </header>

      {exercise.practice && exercise.practice.length > 0 && (
        <div role="group" aria-label="Chọn đề luyện" className="mt-2.5 flex flex-wrap gap-1.5">
          {[
            { id: null as string | null, label: "Đề gốc" },
            ...exercise.practice.map((p) => ({ id: p.id as string | null, label: p.label_vi })),
          ].map((v) => (
            <button
              key={v.id ?? "base"}
              type="button"
              aria-pressed={variantId === v.id}
              disabled={running}
              onClick={() => reset(v.id)}
              className={cn(
                "hit-area rounded-full border border-line px-3 py-1 text-[12px] font-semibold disabled:opacity-50",
                variantId === v.id ? "bg-blue text-primary-foreground" : "bg-card text-ink-2",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-[16px] border border-line bg-card p-3.5">
        <p lang="ko" className="font-korean text-[14.5px] font-semibold leading-7">
          {prompt}
        </p>
        {promptVi && (
          <Rich
            as="p"
            text={promptVi}
            className="mt-1 text-xs font-semibold leading-5 text-ink-2"
          />
        )}
        {!variant && exercise.situation_vi && (
          <Rich
            as="p"
            text={exercise.situation_vi}
            className="mt-1 text-xs font-semibold leading-5 text-ink-2"
          />
        )}
        {variant?.hint_vi && (
          <Rich
            as="p"
            text={variant.hint_vi}
            className="mt-1 text-[12px] font-semibold leading-4 text-ink-2"
          />
        )}
      </div>

      <Frames frames={frames} />

      {exercise.audio && (
        <div className="mt-3">
          <ExerciseAudio
            lessonId={lessonId}
            exerciseId={exercise.id}
            turns={exercise.audio.turns}
            once={once}
            answered={phase === "done" || revealed}
            label="Nghe hội thoại (trong lúc chuẩn bị)"
          />
        </div>
      )}

      {data.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {data.map((b, i) => (
            <DataBlockView key={i} block={b} />
          ))}
        </div>
      )}

      {/* ---- the clock ---- */}
      <section
        aria-label="Đồng hồ luyện nói"
        className={cn(
          "mt-3.5 rounded-[16px] border border-line p-3.5",
          phase === "prep"
            ? "bg-yellow-soft"
            : phase === "answer"
              ? "bg-green-soft"
              : "bg-blue-soft",
        )}
      >
        <p role="status" className="sr-only">
          {phase === "prep"
            ? "Bắt đầu thời gian chuẩn bị"
            : phase === "answer"
              ? "Bắt đầu trả lời"
              : phase === "done"
                ? "Hết giờ"
                : ""}
        </p>
        {phase === "idle" || phase === "done" ? (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold leading-5 text-ink-2">
              {phase === "done"
                ? "Hết giờ! Nghe lại bản ghi (nếu có), rồi xem bài mẫu để so sánh."
                : `Chuẩn bị ${exercise.prep_sec} giây, rồi trả lời trong ${exercise.answer_sec} giây — như thi thật.`}
            </p>
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={wantRecord}
                onChange={(e) => setWantRecord(e.target.checked)}
                className="h-4 w-4 accent-blue"
              />
              <Mic size={14} strokeWidth={2.4} /> Ghi âm để nghe lại
              <span className="font-semibold text-ink-2">(chỉ lưu trên máy bạn)</span>
            </label>
            {recorder.error && (
              <p role="alert" className="text-[12px] font-semibold text-danger">
                {recorder.error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => (phase === "done" ? reset() : void start())}
                className="hit-area flex min-h-11 items-center gap-1.5 rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] "
              >
                {phase === "done" ? (
                  <>
                    <RotateCcw size={15} strokeWidth={2.4} /> Làm lại
                  </>
                ) : (
                  <>
                    <Play size={15} strokeWidth={2.6} /> Bắt đầu
                  </>
                )}
              </button>
            </div>
            {recorder.url && (
              <div>
                <p className="text-[12px] font-semibold text-ink-2">Bản ghi của bạn</p>
                <audio controls src={recorder.url} className="mt-1 h-10 w-full" />
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-end justify-between gap-2">
              <p className="text-sm font-semibold">{phase === "prep" ? "Chuẩn bị" : "Trả lời"}</p>
              <p
                role="timer"
                aria-live="off"
                className="text-3xl font-semibold leading-none tabular-nums"
              >
                {clock(countdown.remaining)}
              </p>
            </div>
            <div
              role="progressbar"
              aria-label={
                phase === "prep" ? "Thời gian chuẩn bị còn lại" : "Thời gian trả lời còn lại"
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
              className="mt-2 h-2 overflow-hidden rounded-full bg-card"
            >
              <div className="h-full rounded-full bg-blue" style={{ width: `${pct}%` }} />
            </div>
            {phase === "answer" && wantRecord && recorder.error === null && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold">
                <span className="h-2 w-2 animate-pulse rounded-full bg-danger motion-reduce:animate-none" />
                Đang ghi âm…
              </p>
            )}
            <div className="mt-3 flex gap-2">
              {phase === "prep" ? (
                <button
                  type="button"
                  onClick={skipPrep}
                  className="hit-area flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-xs font-semibold shadow-elev-1 active:scale-[0.97] "
                >
                  <SkipForward size={14} strokeWidth={2.4} /> Trả lời luôn
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  className="hit-area flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-xs font-semibold shadow-elev-1 active:scale-[0.97] "
                >
                  <Square size={13} strokeWidth={2.6} /> Xong
                </button>
              )}
              <button
                type="button"
                onClick={() => reset()}
                className="hit-area min-h-10 rounded-full px-3 text-xs font-semibold text-ink-2 underline"
              >
                Huỷ
              </button>
            </div>
          </div>
        )}
      </section>

      {prev && !revealed && !variant && (
        <p className="mt-2 text-[12px] font-semibold text-ink-2">
          Lần trước tự chấm: {prev.answer ?? (prev.correct ? "đạt" : "chưa đạt")}
        </p>
      )}

      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-expanded={revealed}
        className="hit-area mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-semibold shadow-elev-1 active:scale-[0.97] "
      >
        {revealed ? <EyeOff size={16} strokeWidth={2.4} /> : <Eye size={16} strokeWidth={2.4} />}
        {revealed
          ? "Ẩn bài mẫu"
          : phase === "done"
            ? "Xem bài mẫu & tự chấm"
            : "Xem bài mẫu & gợi ý"}
      </button>

      {revealed && (
        <div className="mt-3 space-y-3 animate-in duration-200 fade-in motion-reduce:animate-none">
          {variant ? (
            <p className="rounded-[12px] bg-yellow-soft px-3 py-2 text-xs font-semibold leading-5">
              Đề “{variant.label_vi}” để tự luyện, chưa có bài mẫu riêng — dùng khung và mẫu câu của
              đề gốc bên dưới.
            </p>
          ) : (
            <section
              aria-label="Bài mẫu"
              className="rounded-[16px] border border-transparent bg-green-soft p-3.5"
            >
              <h4 className="text-xs font-semibold">
                Bài mẫu{exercise.syllables_vi ? ` · ${exercise.syllables_vi}` : ""}
              </h4>
              <p
                lang="ko"
                className="font-korean mt-1.5 whitespace-pre-line text-[14.5px] leading-7"
              >
                {exercise.model_answer_ko}
              </p>
            </section>
          )}

          {exercise.plan && exercise.plan.length > 0 && (
            <Disclosure title="Khung thời gian gợi ý" defaultOpen>
              <ul className="space-y-2">
                {exercise.plan.map((p) => (
                  <li
                    key={p.when_vi}
                    className="rounded-[10px] bg-blue-soft px-2.5 py-1.5 text-xs leading-5"
                  >
                    <span className="font-semibold">{p.when_vi}</span>
                    <Rich as="p" text={p.do_vi} className="text-ink-2" />
                    {p.phrases_ko && (
                      <Ko className="block text-[13px] font-semibold leading-6 text-ink">
                        {p.phrases_ko}
                      </Ko>
                    )}
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
          {exercise.patterns_vi && exercise.patterns_vi.length > 0 && (
            <Disclosure title="Mẫu câu nên dùng">
              <BulletList items={exercise.patterns_vi} />
            </Disclosure>
          )}
          {exercise.tips_vi && exercise.tips_vi.length > 0 && (
            <Disclosure title="Mẹo làm bài">
              <BulletList items={exercise.tips_vi} />
            </Disclosure>
          )}
          {exercise.common_errors_vi && exercise.common_errors_vi.length > 0 && (
            <Disclosure title="Lỗi hay gặp" tone="bg-yellow-soft">
              <BulletList items={exercise.common_errors_vi} />
            </Disclosure>
          )}
          {exercise.pronunciation_vi && exercise.pronunciation_vi.length > 0 && (
            <Disclosure title="Lưu ý phát âm">
              <ul className="space-y-1">
                {exercise.pronunciation_vi.map((p) => (
                  <li key={p} className="text-xs leading-5 text-ink-2">
                    <Ko className="font-semibold text-ink">{p}</Ko>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}

          {!variant && (
            <SelfScore
              criteria={SPEAK_CRITERIA}
              total={exercise.max_points}
              onSave={(score) =>
                onAnswer({
                  exerciseId: exercise.id,
                  questionId: exercise.id,
                  correct: selfPassed(score, exercise.max_points),
                  answer: `${score}/${exercise.max_points}`,
                })
              }
            />
          )}
        </div>
      )}
    </article>
  );
}
