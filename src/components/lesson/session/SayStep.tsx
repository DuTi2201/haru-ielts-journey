/** "Nói thử": the sentences the sitting just taught (its cards' examples, then its words'), one at
 * a time: hear it, say it aloud, and get it scored. The recording is made on the device, sent once
 * to be measured against the sentence (Azure pronunciation assessment, lib/speech-assess.ts) and
 * kept nowhere. Where recording is not possible (no microphone, no permission, signed out) the
 * step still works as before: say it and tick it yourself.
 *
 * The number is a read-aloud score for THIS sentence (how close the sounds are to a native
 * speaker's), not an IELTS band: the screen says so. */
import { Check, Loader2, Mic, Square, Volume2 } from "lucide-react";
import { useRef, useState } from "react";

import { errorMessage } from "@/lib/api/client";
import {
  assessSpeech,
  canRecord,
  startRecording,
  toWavBase64,
  type SpeechScore,
} from "@/lib/speech-assess";
import { track } from "@/lib/telemetry";

import { Ko } from "@/components/lesson/Rich";
import { useTextAudio } from "@/hooks/use-text-audio";
import { success, tap } from "@/lib/feedback";
import type { SayLine } from "@/lib/lesson-sessions";
import { cn } from "@/lib/utils";

const LEVEL = {
  good: { label: "Rõ", tone: "bg-green-soft text-green" },
  fair: { label: "Hiểu được", tone: "bg-yellow-soft text-ink" },
  retry: { label: "Nói lại nhé", tone: "bg-fill text-danger" },
} as const;

export function SayStep({
  lines,
  lessonId,
  session,
}: {
  lines: SayLine[];
  lessonId?: number;
  session?: number;
}) {
  const audio = useTextAudio();
  const [said, setSaid] = useState<ReadonlySet<number>>(new Set());
  const left = lines.length - said.size;
  const [scores, setScores] = useState<Record<number, SpeechScore>>({});
  const [recording, setRecording] = useState<number | null>(null);
  const [scoring, setScoring] = useState<number | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const stopRef = useRef<(() => Promise<Blob>) | null>(null);
  const scored = lessonId !== undefined && canRecord();

  function mark(i: number) {
    setSaid((prev) => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      if (next.size === lines.length) success();
      return next;
    });
  }

  async function record(i: number, text: string) {
    setMicError(null);
    if (recording === i && stopRef.current) {
      const stop = stopRef.current;
      stopRef.current = null;
      setRecording(null);
      setScoring(i);
      try {
        const wav = await toWavBase64(await stop());
        const res = await assessSpeech(lessonId!, text, wav);
        setScores((s) => ({ ...s, [i]: res }));
        if (res.ok) {
          track({
            type: "say_score",
            value: res.accuracy,
            payload: { lesson_id: lessonId!, session: session ?? 0, step: String(i + 1) },
          });
          if (res.level !== "retry") mark(i);
        }
      } catch (e) {
        setMicError(errorMessage(e));
      } finally {
        setScoring(null);
      }
      return;
    }
    if (recording !== null) return;
    try {
      tap();
      const r = await startRecording();
      stopRef.current = r.stop;
      setRecording(i);
    } catch {
      setMicError("Chưa dùng được micro. Bạn vẫn có thể nói to rồi tự đánh dấu.");
    }
  }

  return (
    <section aria-label="Nói thử" className="space-y-2.5">
      <p className="text-[13px] leading-5 text-ink-2">
        Đây đúng là những câu bạn vừa học. Bấm nghe, rồi {scored ? (
          <>
            bấm <b>Ghi âm</b>, nói to cả câu và bấm <b>Dừng</b> để xem điểm từng từ.
          </>
        ) : (
          <>
            nhìn câu và <b>nói to</b> theo, sau đó tự đánh dấu.
          </>
        )}
      </p>
      <ol className="space-y-2">
        {lines.map((line, i) => {
          const done = said.has(i);
          const busy = audio.activeText === line.ko && audio.state === "loading";
          const playing = audio.activeText === line.ko && audio.state === "playing";
          return (
            <li
              key={line.ko}
              className={cn(
                "rounded-[16px] border p-3 transition-colors",
                done ? "border-green/40 bg-green-soft" : "border-line bg-card",
              )}
            >
              <Ko className="block text-[19px] font-bold leading-snug">{line.ko}</Ko>
              {line.vi && <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{line.vi}</p>}
              {scores[i] && <ScoreLine score={scores[i]!} />}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    tap();
                    void audio.play(line.ko);
                  }}
                  className="hit-area inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-fill px-3 text-[13px] font-semibold active:scale-[0.97]"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Volume2 size={16} aria-hidden="true" />
                  )}
                  {playing ? "Đang phát" : "Nghe"}
                </button>
                {scored && (
                  <button
                    type="button"
                    onClick={() => void record(i, line.ko)}
                    disabled={scoring !== null || (recording !== null && recording !== i)}
                    aria-pressed={recording === i}
                    className={cn(
                      "hit-area inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[12px] px-3 text-[13px] font-semibold text-primary-foreground active:scale-[0.97] disabled:opacity-50",
                      recording === i ? "bg-danger" : "bg-blue",
                    )}
                  >
                    {scoring === i ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : recording === i ? (
                      <Square size={14} aria-hidden="true" />
                    ) : (
                      <Mic size={16} aria-hidden="true" />
                    )}
                    {scoring === i ? "Đang chấm" : recording === i ? "Dừng" : scores[i] ? "Ghi lại" : "Ghi âm"}
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={done}
                  onClick={() => {
                    const next = new Set(said);
                    if (done) next.delete(i);
                    else {
                      next.add(i);
                      if (next.size === lines.length) success();
                      else tap();
                    }
                    setSaid(next);
                  }}
                  className={cn(
                    "hit-area inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[12px] px-3 text-[13px] font-semibold active:scale-[0.97]",
                    done
                      ? "bg-green text-primary-foreground"
                      : scored
                        ? "bg-fill"
                        : "bg-blue text-primary-foreground",
                  )}
                >
                  {done ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Mic size={16} aria-hidden="true" />
                  )}
                  {done ? "Đã nói" : "Tôi đã nói"}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {audio.error && <p className="text-[12px] font-medium text-danger">{audio.error}</p>}
      {micError && <p className="text-[12px] font-medium text-danger">{micError}</p>}
      {scored && (
        <p className="text-[11.5px] leading-4 text-ink-2">
          Điểm 0–100 do máy đo độ giống âm chuẩn của riêng câu này (Azure). Đây không phải band
          IELTS: giám khảo chấm phát âm khi bạn nói tự do, theo độ dễ hiểu, trọng âm và ngữ điệu.
        </p>
      )}
      <p className="text-center text-[12px] font-medium text-ink-2" aria-live="polite">
        {left === 0 ? "Xong rồi. Sang bước tiếp theo nhé." : `Còn ${left} câu.`}
      </p>
    </section>
  );
}

function ScoreLine({ score }: { score: SpeechScore }) {
  if (!score.ok)
    return (
      <p className="mt-2 rounded-[10px] bg-fill px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2">
        {score.reason === "no_speech"
          ? "Chưa nghe thấy tiếng. Nói gần micro hơn rồi ghi lại."
          : "Chưa chấm được lần này. Ghi lại nhé."}
      </p>
    );
  const lv = LEVEL[score.level];
  return (
    <div className="mt-2 space-y-1.5" aria-live="polite">
      <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold">
        <span className={cn("rounded-full px-2.5 py-0.5 font-bold", lv.tone)}>
          {lv.label} · {Math.round(score.accuracy)}
        </span>
        {score.fluency !== null && <span className="text-ink-2">Trôi chảy {Math.round(score.fluency)}</span>}
        {score.completeness !== null && (
          <span className="text-ink-2">Đủ câu {Math.round(score.completeness)}</span>
        )}
      </p>
      <p lang="en" className="flex flex-wrap gap-1 text-[14px] font-bold">
        {score.words
          .filter((w) => w.error !== "inserted")
          .map((w, k) => (
            <span
              key={k}
              className={cn(
                "rounded-md px-1.5 py-0.5",
                w.error === "omitted"
                  ? "bg-fill text-ink-2 line-through"
                  : w.error === "mispronounced" || (w.accuracy ?? 100) < 60
                    ? "bg-fill text-danger underline decoration-2 underline-offset-2"
                    : (w.accuracy ?? 100) < 80
                      ? "bg-yellow-soft"
                      : "bg-green-soft",
              )}
            >
              {w.word}
            </span>
          ))}
      </p>
      {score.weak.length > 0 && (
        <p className="text-[12px] leading-4 text-ink-2">
          Nghe lại rồi nói riêng: <span lang="en" className="font-semibold">{score.weak.join(", ")}</span>
        </p>
      )}
    </div>
  );
}
