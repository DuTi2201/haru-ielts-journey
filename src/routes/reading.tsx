import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, ChevronRight, Newspaper } from "lucide-react";

import { Mascot } from "@/components/mascot/Mascot";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { TabBar } from "@/components/haru/TabBar";
import { errorMessage } from "@/lib/api/client";
import { listEditorials } from "@/lib/api/editorial";

export const Route = createFileRoute("/reading")({
  head: () => ({
    meta: [
      { title: "Đọc xã luận — Haru" },
      {
        name: "description",
        content: "Luyện đọc xã luận/chuyên mục báo tiếng Hàn và luyện dàn ý cho câu 54.",
      },
      { property: "og:title", content: "Đọc xã luận — Haru" },
      {
        property: "og:description",
        content: "Luyện đọc xã luận/chuyên mục báo tiếng Hàn và luyện dàn ý cho câu 54.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReadingListScreen,
});

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

/** Article photo for the list card. A hotlink-blocked/removed photo simply
 * disappears (no broken-image icon) and the card falls back to text only. */
function CoverThumb({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-[72px] w-[72px] shrink-0 rounded-[12px] border border-line bg-progress object-cover"
    />
  );
}

function ReadingListScreen() {
  const [level, setLevel] = useState<number | null>(null);
  const query = useQuery({
    queryKey: ["editorials", level],
    queryFn: () => listEditorials({ level: level ?? undefined, limit: 20 }),
  });
  const items = query.data ?? [];

  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] overflow-hidden bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <div className="relative z-10">
        <header>
          <p className="text-[13px] font-semibold text-ink-2">Luyện đọc</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold leading-tight">
            <Newspaper size={22} strokeWidth={2.2} className="text-blue" /> Xã luận &amp; chuyên mục
          </h1>
          <p className="mt-1 text-xs font-medium text-ink-2">
            Đọc bài, học từ vựng/ngữ pháp, rồi luyện dàn ý cho câu 54.
          </p>
        </header>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setLevel(null)}
            className={`rounded-full border border-line px-3 py-1.5 text-xs font-semibold ${level === null ? "bg-blue text-primary-foreground" : "bg-card text-ink-2"}`}
          >
            Tất cả
          </button>
          {LEVELS.map((lv) => (
            <button
              key={lv}
              onClick={() => setLevel(lv)}
              className={`rounded-full border border-line px-3 py-1.5 text-xs font-semibold ${level === lv ? "bg-blue text-primary-foreground" : "bg-card text-ink-2"}`}
            >
              Cấp {lv}
            </button>
          ))}
        </div>

        {query.isLoading && (
          <LoadingBlocks
            className="mt-6"
            blocks={["h-24", "h-24", "h-24"]}
            label="Đang tải danh sách bài"
          />
        )}

        {query.isError && (
          <ErrorState
            className="mt-6"
            title="Không tải được danh sách bài."
            error={query.error}
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isRefetching}
          />
        )}

        {query.isSuccess && items.length === 0 && (
          <EmptyState
            title="Chưa có bài xã luận nào ở cấp độ này."
            hint="Vào Studio để thêm bài mới hoặc duyệt ứng viên RSS."
          />
        )}

        {items.length > 0 && (
          <ul className="mt-4 space-y-3">
            {items.map((article) => (
              <li key={article.id}>
                <Link
                  to="/reading/$id"
                  params={{ id: article.id }}
                  className="block rounded-[18px] border border-line bg-card p-4 shadow-elev-1 active:scale-[0.97] "
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-ink-2">{article.source_name}</p>
                      <p className="font-korean mt-0.5 line-clamp-2 break-keep text-sm font-semibold leading-snug">
                        {article.title_en || "(Chưa có tiêu đề)"}
                      </p>
                    </div>
                    {article.cover_image_url ? (
                      <CoverThumb url={article.cover_image_url} />
                    ) : (
                      <ChevronRight
                        size={18}
                        strokeWidth={2.4}
                        className="mt-1 shrink-0 text-ink-2"
                      />
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {article.level_estimate && (
                      <span className="rounded-full bg-teal-soft px-2.5 py-1 text-[12px] font-semibold text-teal">
                        Cấp {article.level_estimate}
                      </span>
                    )}
                    {article.topic_tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-blue-soft px-2.5 py-1 text-[12px] font-semibold text-blue-deep"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <aside className="mt-7 flex items-end gap-2.5">
          <Mascot mood="reading" className="h-14 w-14 shrink-0" />
          <p className="mb-1 rounded-[18px_18px_18px_4px] border border-line bg-card px-4 py-3 text-xs font-semibold leading-5 shadow-elev-1">
            <BookOpen size={13} strokeWidth={2.4} className="mr-1 inline" />
            Đọc kỹ rồi thử tự viết dàn ý trước khi xem gợi ý nhé!
          </p>
        </aside>
      </div>
      <TabBar />
    </main>
  );
}
