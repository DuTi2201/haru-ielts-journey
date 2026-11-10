import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Library } from "lucide-react";

import { listBankDecks } from "@/lib/api/bank";
import { tap } from "@/lib/feedback";

/* From the lesson to the «Kho từ TOPIK» decks that extend it (the server maps decks to lessons).
 * Shown only when a deck exists; a failed request simply shows nothing. */

export function BankDeckNext({ lessonId }: { lessonId: number }) {
  const list = useQuery({
    queryKey: ["lesson-bank-decks", lessonId],
    queryFn: () => listBankDecks({ lesson_id: lessonId }),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const decks = (list.data ?? []).slice(0, 2);
  if (decks.length === 0) return null;
  return (
    <section
      aria-label="Mở rộng vốn từ"
      className="mt-4 rounded-[20px] border border-line bg-card p-4 shadow-elev-1"
    >
      <h3 className="flex items-center gap-2 text-[15px] font-bold">
        <Library size={16} strokeWidth={2.4} aria-hidden="true" />
        Mở rộng vốn từ
      </h3>
      <p className="mt-0.5 text-xs font-medium leading-5 text-ink-2">
        Từ mới cùng chủ đề, vài từ mỗi ngày trong phần ôn của bạn.
      </p>
      <ul className="mt-2 divide-y divide-line">
        {decks.map((d) => (
          <li key={d.key}>
            <Link
              to="/vocab-bank/$key"
              params={{ key: d.key }}
              onClick={() => tap()}
              className="hit-area flex min-h-11 items-center gap-2.5 py-2.5 active:scale-[0.99]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold leading-5">{d.title_vi}</span>
                <span className="mt-0.5 block text-[12px] font-medium leading-4 text-ink-2">
                  {d.grade_vi} · {d.words} từ{d.added ? " · đã thêm" : ""}
                </span>
              </span>
              <ChevronRight size={16} strokeWidth={2.6} aria-hidden="true" className="shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
