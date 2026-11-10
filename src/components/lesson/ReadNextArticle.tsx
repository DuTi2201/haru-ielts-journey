import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Newspaper } from "lucide-react";

import { listEditorials } from "@/lib/api/editorial";
import { tap } from "@/lib/feedback";

/* From the lesson to a real news article that uses its words: the server lists the articles placed
 * after this lesson (easiest first). Shown only when there is one; a closed source or a failed
 * request simply shows nothing. */

export function ReadNextArticle({ lessonId }: { lessonId: number }) {
  const list = useQuery({
    queryKey: ["lesson-articles", lessonId],
    queryFn: () => listEditorials({ lesson_id: lessonId, limit: 2 }),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const articles = list.data ?? [];
  if (articles.length === 0) return null;
  return (
    <section
      aria-label="Đọc báo cho bài này"
      className="mt-6 rounded-[20px] border border-line bg-card p-4 shadow-elev-1"
    >
      <h3 className="flex items-center gap-2 text-[15px] font-bold">
        <Newspaper size={16} strokeWidth={2.4} aria-hidden="true" />
        Đọc báo cho bài này
      </h3>
      <p className="mt-0.5 text-xs font-medium leading-5 text-ink-2">
        Bài báo thật dùng đúng những từ bạn vừa học.
      </p>
      <ul className="mt-2 divide-y divide-line">
        {articles.map((a) => (
          <li key={a.id}>
            <Link
              to="/reading/$id"
              params={{ id: a.id }}
              onClick={() => tap()}
              className="hit-area flex min-h-11 items-center gap-2.5 py-2.5 active:scale-[0.99]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold leading-5">
                  {a.title_ko ?? a.source_name}
                </span>
                <span className="mt-0.5 block text-[12px] font-medium leading-4 text-ink-2">
                  {a.level_estimate ? `Cấp ${a.level_estimate} · ` : ""}
                  {a.unlock_hint ?? a.source_name}
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
