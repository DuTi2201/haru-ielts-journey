import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";

import { selfPassed } from "@/lib/lesson-grade";
import { cn } from "@/lib/utils";

export interface ScoreCriterion {
  label: string;
  note?: string | null | undefined;
  max: number;
}

/** Marking one's own writing or speaking against a few criteria. The learner moves
 * a number per criterion; the total goes to the server as "right" from 60% up, so
 * the error log and the lesson progress count it like any other answer. Nothing
 * here pretends to be an automatic score. */
export function SelfScore({
  criteria,
  total,
  onSave,
  saved,
}: {
  criteria: ScoreCriterion[];
  /** The points the whole task is worth (the criteria's maxima may be scaled to it). */
  total: number;
  onSave: (score: number) => void;
  saved?: number | null | undefined;
}) {
  const [values, setValues] = useState<number[]>(() => criteria.map(() => 0));
  const [done, setDone] = useState<number | null>(saved ?? null);

  const rawMax = criteria.reduce((n, c) => n + c.max, 0);
  const raw = values.reduce((n, v) => n + v, 0);
  const score = rawMax > 0 ? Math.round((raw / rawMax) * total * 10) / 10 : 0;

  function set(i: number, next: number) {
    setDone(null);
    setValues((vs) =>
      vs.map((v, j) => (j === i ? Math.max(0, Math.min(criteria[i]!.max, next)) : v)),
    );
  }

  return (
    <section
      aria-label="Tự chấm điểm"
      className="rounded-[16px] border border-transparent bg-blue-soft p-3.5"
    >
      <h4 className="text-sm font-semibold">Tự chấm điểm</h4>
      <p className="mt-0.5 text-[12px] font-semibold leading-4 text-ink-2">
        So bài của bạn với bài mẫu rồi cho điểm từng tiêu chí, thật lòng nhé — điểm này chỉ để bạn
        theo dõi tiến bộ.
      </p>
      <ul className="mt-2.5 space-y-2">
        {criteria.map((c, i) => (
          <li key={c.label} className="flex items-center gap-2 rounded-[12px] bg-card px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold leading-4">{c.label}</p>
              {c.note && <p className="text-[11px] font-semibold leading-4 text-ink-2">{c.note}</p>}
            </div>
            <button
              type="button"
              onClick={() => set(i, values[i]! - 1)}
              disabled={values[i] === 0}
              aria-label={`Giảm điểm ${c.label}`}
              className="hit-area flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card active:scale-95 disabled:opacity-40"
            >
              <Minus size={14} strokeWidth={2.6} />
            </button>
            <span className="min-w-[3.2rem] text-center text-sm font-semibold tabular-nums">
              {values[i]}/{c.max}
            </span>
            <button
              type="button"
              onClick={() => set(i, values[i]! + 1)}
              disabled={values[i] === c.max}
              aria-label={`Tăng điểm ${c.label}`}
              className="hit-area flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card active:scale-95 disabled:opacity-40"
            >
              <Plus size={14} strokeWidth={2.6} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          Tổng: <span className="tabular-nums">{score}</span>/{total} điểm
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(score);
            onSave(score);
          }}
          className={cn(
            "hit-area flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-xs font-semibold shadow-elev-1 active:scale-[0.97] ",
            done !== null ? "bg-green-soft" : "bg-blue text-primary-foreground",
          )}
        >
          {done !== null ? (
            <>
              <Check size={14} strokeWidth={3} /> Đã lưu
            </>
          ) : (
            "Lưu điểm"
          )}
        </button>
      </div>
      {done !== null && (
        <p role="status" className="mt-2 text-[12px] font-semibold leading-4 text-ink-2">
          {selfPassed(done, total)
            ? "Đạt từ 60% — tính là đã làm tốt phần này."
            : "Dưới 60% — phần này sẽ nằm trong sổ lỗi để bạn luyện lại."}
        </p>
      )}
    </section>
  );
}
