import { useMemo, useState } from "react";
import { Check, Circle, PenLine } from "lucide-react";

import type { CapstoneOut, ExerciseResultOut, SpeakOut, WriteEssayOut } from "@/lib/api/types";
import { readLocal, writeLocal } from "@/lib/lesson-local";
import { detect, essayDraftKey, speakTickKey } from "@/lib/review";
import { cn } from "@/lib/utils";
import { Ko } from "../Rich";
import type { AnswerEvent } from "../McqExercise";
import { SpeakTask } from "../SpeakTask";
import { WriteEssay } from "../WriteEssay";

function Meter({ have, need, total }: { have: number; need: number; total: number }) {
  const ok = have >= need;
  return (
    <p
      role="status"
      className={cn("text-xs font-semibold tabular-nums", ok ? "text-green" : "text-ink-2")}
    >
      {ok && <Check size={13} strokeWidth={3} aria-hidden="true" className="mr-1 inline" />}
      Đã dùng {have}/{total} mẫu · cần ít nhất {need}
    </p>
  );
}

/** The list of patterns the piece must use. In the essay a regex tells which ones show up (a
 * tick means “looks used”); for the spoken answer the learner ticks them off themselves. */
function Checklist({
  capstone,
  flags,
  onToggle,
  label,
}: {
  capstone: CapstoneOut;
  flags: boolean[];
  onToggle?: ((i: number) => void) | undefined;
  label: string;
}) {
  const have = flags.filter(Boolean).length;
  return (
    <div className="mt-2.5 rounded-[14px] border border-transparent bg-purple-soft p-2.5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">{label}</p>
      <ul className="mt-1.5 space-y-1">
        {capstone.required.map((r, i) => {
          const on = flags[i] ?? false;
          const body = (
            <>
              {on ? (
                <Check
                  size={14}
                  strokeWidth={3}
                  aria-hidden="true"
                  className="shrink-0 text-green"
                />
              ) : (
                <Circle
                  size={14}
                  strokeWidth={2.4}
                  aria-hidden="true"
                  className="shrink-0 text-ink-2"
                />
              )}
              <Ko className={cn("text-[13px] leading-5", on ? "font-semibold" : "font-semibold")}>
                {r.label_vi ?? r.pattern}
              </Ko>
            </>
          );
          return (
            <li key={r.pattern}>
              {onToggle ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => onToggle(i)}
                  className="hit-area flex min-h-8 w-full items-center gap-2 text-left"
                >
                  {body}
                </button>
              ) : (
                <span
                  className="flex min-h-7 items-center gap-2"
                  aria-label={`${r.label_vi ?? r.pattern}: ${on ? "đã dùng" : "chưa dùng"}`}
                >
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-1.5">
        <Meter have={have} need={capstone.min_required} total={capstone.required.length} />
      </div>
    </div>
  );
}

/** Step 3 of the topic review: one Viết 54 essay and one Nói S6 answer that have to use the
 * topic's patterns, the extension ones above all. Everything is self-marked, like the practice
 * sets: the model answer and the rubric open once the learner has tried. */
export function Capstone({
  lessonId,
  capstone,
  essay,
  speak,
  previous,
  onAnswer,
}: {
  lessonId: number;
  capstone: CapstoneOut;
  essay: WriteEssayOut | undefined;
  speak: SpeakOut | undefined;
  previous: Record<string, ExerciseResultOut>;
  onAnswer: (a: AnswerEvent) => void;
}) {
  const [text, setText] = useState(() =>
    readLocal<string>(essayDraftKey(lessonId, capstone.essay_id), ""),
  );
  const flags = useMemo(() => detect(text, capstone.required), [text, capstone.required]);
  const [ticks, setTicks] = useState<number[]>(() =>
    readLocal<number[]>(speakTickKey(lessonId), []),
  );
  const speakFlags = capstone.required.map((_, i) => ticks.includes(i));

  return (
    <section aria-label="Viết và Nói tổng hợp" className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <PenLine size={20} strokeWidth={2.4} aria-hidden="true" className="text-blue" />
          Viết & Nói tổng hợp
        </h2>
        <p className="mt-0.5 text-xs font-medium leading-5 text-ink-2">
          Một bài Viết 54 và một bài Nói S6 về cùng chủ đề. Mỗi bài phải dùng ít nhất{" "}
          <b>{capstone.min_required}</b> trong <b>{capstone.required.length}</b> mẫu bên dưới (chủ
          yếu là kiến thức mở rộng 🟣) — dùng đúng chỗ, đừng nhồi cho đủ.
        </p>
      </div>

      {essay && (
        <WriteEssay
          lessonId={lessonId}
          exercise={essay}
          previous={previous}
          onAnswer={onAnswer}
          onTextChange={setText}
          belowText={
            <Checklist
              capstone={capstone}
              flags={flags}
              label="Mẫu cần dùng · tự nhận diện trong bài của bạn"
            />
          }
        />
      )}

      {speak && (
        <div>
          <SpeakTask
            lessonId={lessonId}
            exercise={speak}
            previous={previous}
            once={false}
            onAnswer={onAnswer}
          />
          <Checklist
            capstone={capstone}
            flags={speakFlags}
            label="Sau khi nói: tick những mẫu bạn đã dùng"
            onToggle={(i) =>
              setTicks((t) => {
                const next = t.includes(i) ? t.filter((x) => x !== i) : [...t, i];
                writeLocal(speakTickKey(lessonId), next);
                return next;
              })
            }
          />
        </div>
      )}
    </section>
  );
}
