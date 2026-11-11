import { cn } from "@/lib/utils";

/** The sets of book exercises number their items in the title: «… (3/8)». The number is progress,
 * not part of the name, so it is taken out of the title and shown as progress. */
export function splitProgress(title: string): { name: string; n: number | null; total: number | null } {
  const m = /\s*\((\d+)\/(\d+)\)\s*$/.exec(title);
  if (!m) return { name: title, n: null, total: null };
  return { name: title.slice(0, m.index).trim(), n: Number(m[1]), total: Number(m[2]) };
}

/** What a learner needs in five seconds: what kind of task this is, where they are in the set,
 * and — in the largest type of the card — what to do. The longer explanation is smaller, below. */
export function ExerciseHead({
  chip,
  n,
  total,
  task,
  detail,
  className,
}: {
  chip?: string | null | undefined;
  n?: number | null | undefined;
  total?: number | null | undefined;
  task: string;
  detail?: string | null | undefined;
  className?: string | undefined;
}) {
  const hasStep = n != null && total != null && total > 0;
  return (
    <header className={className}>
      {(chip || hasStep) && (
        <div className="flex items-center gap-2">
          {chip && (
            <span className="rounded-full bg-blue-soft px-2.5 py-0.5 text-[12px] font-bold text-blue-deep">
              {chip}
            </span>
          )}
          {hasStep && (
            <>
              <span className="text-[12px] font-semibold tabular-nums text-ink-2">
                <span className="sr-only">Câu </span>
                {n}/{total}
              </span>
              <span
                aria-hidden="true"
                className="h-1 min-w-8 max-w-24 flex-1 overflow-hidden rounded-full bg-progress"
              >
                <span
                  className="block h-1 rounded-full bg-blue"
                  style={{ width: `${Math.round(((n as number) / (total as number)) * 100)}%` }}
                />
              </span>
            </>
          )}
        </div>
      )}
      <h3 className={cn("text-[17px] font-bold leading-6 text-ink", (chip || hasStep) && "mt-2")}>
        {task}
      </h3>
      {detail && <p className="mt-1 text-[13.5px] leading-5 text-ink-2">{detail}</p>}
    </header>
  );
}

/** First sentence of a longer Vietnamese instruction, and the rest. */
export function firstSentence(text: string | null | undefined): { head: string; rest: string } {
  const t = (text ?? "").trim();
  const m = /^(.+?[.!?:])(\s+|$)/.exec(t);
  if (!m || (m[1]?.length ?? 0) > 110) return { head: t, rest: "" };
  return { head: m[1]?.replace(/[:]$/, "") ?? t, rest: t.slice(m[0].length).trim() };
}
