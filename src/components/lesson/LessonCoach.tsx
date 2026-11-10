import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ClipboardList } from "lucide-react";

import type { CoachOut, CoachCheckOut } from "@/lib/api/types";
import { useGuidedMode } from "@/lib/guided-mode";
import { readLocal, writeLocal } from "@/lib/lesson-local";
import { cn } from "@/lib/utils";
import { BulletList } from "./Disclosure";
import { GuidedModeToggle } from "./GuidedModeToggle";
import { Rich } from "./Rich";

export interface CoachStep {
  id: string;
  label: string;
}

/** "Việc cần làm trong bài này": what to do in this lesson, in a few lines the learner can read in
 * ten seconds. The lesson's own advice (focus, what is easily confused, what to write down, what to
 * try without looking) comes from the lesson; the numbers beside it are counted from the lesson,
 * never typed by hand. The list of steps is the only part that belongs to the "Có hướng dẫn" mode:
 * a learner who chose "Tự do" still gets the advice, folded away until they open it. */
export function LessonCoach({
  lessonId,
  step,
  steps,
  coach,
  counts,
  goal,
}: {
  lessonId: number;
  /** The step the learner is on: each step remembers on its own whether the block was opened. */
  step: string;
  steps: CoachStep[];
  coach: CoachOut;
  counts: { vocab: number; grammar: number; questions: number };
  /** The lesson's goal note (what the learner can do afterwards): it lives here, at the top. */
  goal?: string | null | undefined;
}) {
  const [guided] = useGuidedMode();
  const storageKey = `coach-open:${lessonId}:${step}`;
  const [stored, setStored] = useState<boolean | null>(() =>
    readLocal<boolean | null>(storageKey, null),
  );
  // Open the first time on the first step only; later steps show the block folded, one line high.
  const open = stored ?? (guided && step === steps[0]?.id);
  const toggle = () => {
    writeLocal(storageKey, !open);
    setStored(!open);
  };

  const facts = [
    counts.vocab > 0 ? `${counts.vocab} từ` : null,
    counts.grammar > 0 ? `${counts.grammar} mẫu ngữ pháp` : null,
    counts.questions > 0 ? `${counts.questions} câu luyện` : null,
  ].filter((f): f is string => f !== null);

  // the goal already names the grammar, so "Trọng tâm" shows only when there is no goal text
  const goalText = goal ?? coach.goal_vi ?? null;
  const focus = goalText ? [] : (coach.focus_vi ?? []);
  const stepCount: Record<string, number> = {
    vocab: counts.vocab,
    grammar: counts.grammar,
    practice: counts.questions,
  };
  const stepUnit: Record<string, string> = { vocab: "từ", grammar: "mẫu", practice: "câu" };
  const panelId = `coach-panel-${lessonId}-${step}`;

  return (
    <section
      aria-label="Học xong bài này bạn làm được"
      className="mb-4 rounded-[18px] border border-line bg-card shadow-elev-1"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="hit-area flex min-h-12 w-full items-center gap-2.5 px-3.5 py-2 text-left"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-soft"
        >
          <ClipboardList size={15} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-5">
            Học xong bài này bạn làm được
          </span>
          {!open && facts.length > 0 && (
            <span className="block text-[12px] font-semibold leading-4 text-ink-2">
              {facts.join(" · ")}
            </span>
          )}
        </span>
        <ChevronDown
          size={17}
          strokeWidth={2.6}
          aria-hidden="true"
          className={cn(
            "shrink-0 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div id={panelId} className="space-y-3.5 border-t border-line px-3.5 pb-3.5 pt-3">
          {goalText && <Rich as="p" text={goalText} className="text-xs font-semibold leading-5" />}

          {guided && steps.length > 1 && (
            <Row title="Đi theo thứ tự">
              <ol className="flex flex-wrap gap-1.5 text-xs leading-5">
                {steps.map((s, i) => (
                  <li
                    key={s.id}
                    aria-current={s.id === step ? "step" : undefined}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 font-semibold",
                      s.id === step ? "bg-blue text-primary-foreground" : "bg-progress text-ink-2",
                    )}
                  >
                    {i + 1}. {s.label}
                    {(stepCount[s.id] ?? 0) > 0 && ` · ${stepCount[s.id]} ${stepUnit[s.id]}`}
                  </li>
                ))}
              </ol>
            </Row>
          )}

          {focus.length > 0 && (
            <Row title="Trọng tâm">
              <BulletList items={focus} />
            </Row>
          )}

          {coach.tip_vi && (
            <p className="rounded-[12px] bg-yellow-soft px-3 py-2 text-xs font-semibold leading-5">
              <Rich text={coach.tip_vi} />
            </p>
          )}

          <div className="space-y-2 border-t border-line pt-3">
            <GuidedModeToggle />
            <p className="text-[12px] font-medium leading-4 text-ink-2">
              "Tự do" ẩn các gợi ý ngắn trong bài. Phần trên vẫn mở lại được bất cứ lúc nào.{" "}
              <Link to="/how-to-learn" className="font-semibold text-blue-deep underline">
                Cách học hiệu quả
              </Link>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/** "Hay nhầm": shown under the grammar the learner is looking at, where the mistake is made. */
export function CoachWatchOut({ coach }: { coach: CoachOut | null | undefined }) {
  const items = coach?.watch_out_vi ?? [];
  if (items.length === 0) return null;
  return (
    <aside
      aria-label="Hay nhầm"
      className="rounded-[14px] border border-transparent bg-yellow-soft px-3.5 py-3"
    >
      <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-2">
        Hay nhầm
      </h3>
      <BulletList items={items} />
    </aside>
  );
}

/** "Ghi vào sổ" and "Tự kiểm tra": the end of the lesson, when there is something to write down
 * and something to try without looking. */
export function CoachWrapUp({ coach }: { coach: CoachOut | null | undefined }) {
  const notebook = coach?.notebook_vi ?? [];
  const checks = coach?.self_check ?? [];
  if (notebook.length === 0 && checks.length === 0) return null;
  return (
    <section
      aria-label="Kết thúc bài"
      className="space-y-3.5 rounded-[18px] border border-line bg-card px-3.5 py-3.5 shadow-elev-1"
    >
      {notebook.length > 0 && (
        <Row title="Ghi vào sổ">
          <BulletList items={notebook} />
        </Row>
      )}
      {checks.length > 0 && (
        <Row title="Tự kiểm tra (không nhìn bài)">
          <ul className="space-y-2">
            {checks.map((c, i) => (
              <SelfCheck key={i} check={c} />
            ))}
          </ul>
        </Row>
      )}
    </section>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-2">{title}</h3>
      {children}
    </div>
  );
}

/** One thing to try without looking; the answer is behind a button so the learner tries first. */
function SelfCheck({ check }: { check: CoachCheckOut }) {
  const [shown, setShown] = useState(false);
  return (
    <li className="flex gap-2 text-xs leading-5">
      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green" />
      <div className="min-w-0 flex-1">
        <Rich text={check.prompt_vi} className="[overflow-wrap:anywhere]" />
        {check.answer &&
          (shown ? (
            <p className="mt-1 rounded-[10px] bg-progress px-2.5 py-1.5 font-semibold [overflow-wrap:anywhere]">
              <Rich text={check.answer} />
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setShown(true)}
              className="hit-area mt-1 inline-flex min-h-8 items-center rounded-full border border-line bg-card px-3 text-[12px] font-semibold active:scale-95"
            >
              Xem đáp án
            </button>
          ))}
      </div>
    </li>
  );
}
