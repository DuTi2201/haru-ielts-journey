import { Link } from "@tanstack/react-router";
import { Layers, Repeat } from "lucide-react";

import type { GrammarRefOut } from "@/lib/api/types";
import { writeLocal } from "@/lib/lesson-local";
import { Ko } from "./Rich";

/** One earlier or later card, as a link to its lesson's grammar tab. */
function RefLink({ r, lessonId }: { r: GrammarRefOut; lessonId: number | null }) {
  const body = (
    <>
      <Ko className="font-semibold">{r.pattern}</Ko>
      {r.lesson_id !== lessonId && (
        <span className="block text-[10.5px] font-semibold text-ink-2">Bài “{r.lesson_title}”</span>
      )}
    </>
  );
  const className =
    "hit-area block rounded-[10px] bg-card px-2.5 py-1.5 text-[12px] leading-4 text-ink active:scale-[0.98]";
  if (r.lesson_id === lessonId) return <span className={className}>{body}</span>;
  return (
    <Link
      to="/lesson/$id"
      params={{ id: String(r.lesson_id) }}
      onClick={() => writeLocal(`step:${r.lesson_id}`, "grammar")}
      className={className}
    >
      {body}
    </Link>
  );
}

/** "Xây trên": the earlier cards this one is put together from, each a link to where it was
 * taught. Intermediate grammar is mostly primary grammar combined; this shows the parts, so the
 * learner sees which of the old cards to revisit when a new one will not stick. */
export function BuiltFrom({
  refs,
  lessonId,
}: {
  refs: GrammarRefOut[] | undefined;
  lessonId: number | null;
}) {
  if (!refs || refs.length === 0) return null;
  return (
    <div className="mt-3 rounded-[14px] border border-dashed border-line px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-2">
        <Layers size={13} strokeWidth={2.6} aria-hidden="true" /> Xây trên những thẻ đã học
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {refs.map((r) => (
          <li key={r.pattern}>
            <RefLink r={r} lessonId={lessonId} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Được dùng lại": the later cards that are made of this one. Folded away: it is for the
 * learner who wonders why a basic card matters. */
export function BuiltInto({
  refs,
  lessonId,
}: {
  refs: GrammarRefOut[] | undefined;
  lessonId: number | null;
}) {
  if (!refs || refs.length === 0) return null;
  return (
    <details className="group mt-2.5 rounded-[14px] bg-card/70">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold text-blue-deep [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">Mẫu này còn nằm trong {refs.length} mẫu khác về sau</span>
      </summary>
      <ul className="flex flex-wrap gap-1.5 px-3 pb-3 pt-0.5">
        {refs.map((r) => (
          <li key={`${r.lesson_id}-${r.pattern}`}>
            <RefLink r={r} lessonId={lessonId} />
          </li>
        ))}
      </ul>
    </details>
  );
}

/** «Ôn lại»: this card teaches an earlier one again after other lessons (spaced review), so it is
 * met as a second, deeper pass; the link goes back to the first teaching. */
export function Revisits({ card: r, lessonId }: { card: GrammarRefOut | null | undefined; lessonId: number | null }) {
  if (!r) return null;
  return (
    <div className="mb-1.5 rounded-[14px] bg-yellow-soft px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink">
        <Repeat size={13} strokeWidth={2.6} aria-hidden="true" /> Ôn lại · lần gặp thứ hai
      </p>
      <p className="mt-1 text-[12.5px] leading-5 text-ink">
        Bạn đã học ý này ở bài “{r.lesson_title}”. Quên rồi cũng không sao: xem lại thẻ gốc rồi làm tiếp.
      </p>
      <div className="mt-1.5">
        <RefLink r={r} lessonId={lessonId} />
      </div>
    </div>
  );
}
