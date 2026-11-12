import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";

import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { TabBar } from "@/components/haru/TabBar";
import { YouTubePlayer } from "@/components/pron/YouTubePlayer";
import { getPronCourse } from "@/lib/api/pronunciation";
import { tap } from "@/lib/feedback";
import { bestScores, practiceTexts, soundDone } from "@/lib/pron-progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pronunciation")({
  head: () => ({
    meta: [
      { title: "Luyện phát âm — Haru English" },
      {
        name: "description",
        content: "Xem khẩu hình trong video BBC và luyện từng âm tiếng Anh, có chấm điểm phát âm.",
      },
      { property: "og:title", content: "Luyện phát âm — Haru English" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PronunciationScreen,
});

const GROUPS = ["Nguyên âm ngắn", "Nguyên âm dài", "Nguyên âm đôi", "Nguyên âm yếu (schwa)", "Phụ âm"] as const;
const groupOf = (kind: string) => (GROUPS.find((g) => kind.startsWith(g)) ?? "Phụ âm") as (typeof GROUPS)[number];

function PronunciationScreen() {
  const q = useQuery({ queryKey: ["pron", "course"], queryFn: getPronCourse, staleTime: 3_600_000 });
  const [done, setDone] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<"sounds" | "shadow">("sounds");
  useEffect(() => {
    if (!q.data) return;
    const next: Record<string, number> = {};
    for (const s of q.data.sounds) next[s.slug] = soundDone(bestScores(s.slug), practiceTexts(s));
    setDone(next);
  }, [q.data]);

  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] overflow-hidden bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <div className="relative z-10">
        <Link to="/speaking" onClick={() => tap()} className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-ink-2">
          <ArrowLeft size={16} aria-hidden="true" /> Luyện tập
        </Link>
        <h1 className="mt-1 text-2xl font-bold leading-tight">Luyện phát âm</h1>
        <p className="mt-1 text-[13px] leading-5 text-ink-2">
          Xem khẩu hình trong video của BBC Learning English, rồi tự ghi âm. Máy chấm từng từ và từng âm
          của bạn (Azure, giọng Anh).
        </p>

        {q.isPending && <LoadingBlocks className="mt-5" blocks={["h-40", "h-16", "h-16"]} />}
        {q.isError && <ErrorState className="mt-5" error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />}
        {q.data && q.data.sounds.length === 0 && <EmptyState title="Chưa có bài phát âm." />}
        {q.data && q.data.sounds.length > 0 && (
          <>
            <div className="mt-4">
              <YouTubePlayer videoId={q.data.intro.id} title={q.data.intro.title} />
              <p className="mt-1.5 text-[12.5px] font-semibold">{q.data.intro.title}</p>
            </div>

            <div role="tablist" aria-label="Loại bài" className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-fill p-1">
              {(
                [
                  ["sounds", `44 âm`],
                  ["shadow", "Shadowing"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  role="tab"
                  type="button"
                  aria-selected={tab === k}
                  onClick={() => {
                    tap();
                    setTab(k);
                  }}
                  className={cn(
                    "min-h-10 rounded-full text-[13px] font-semibold",
                    tab === k ? "bg-card shadow-elev-1" : "text-ink-2",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "sounds" &&
              GROUPS.map((g) => {
                const items = q.data.sounds.filter((s) => groupOf(s.kind) === g);
                if (!items.length) return null;
                return (
                  <section key={g} className="mt-5" aria-label={g}>
                    <h2 className="text-[13px] font-bold text-ink-2">{g}</h2>
                    <ul className="mt-2 grid grid-cols-3 gap-2">
                      {items.map((s) => {
                        const d = done[s.slug] ?? 0;
                        return (
                          <li key={s.slug}>
                            <Link
                              to="/pronunciation/$slug"
                              params={{ slug: s.slug }}
                              onClick={() => tap()}
                              className={cn(
                                "relative flex min-h-16 flex-col items-center justify-center rounded-[16px] border px-2 py-2 active:scale-[0.97]",
                                d >= 1 ? "border-green/40 bg-green-soft" : "border-line bg-card",
                              )}
                            >
                              <span lang="en" className="text-[22px] font-bold leading-none">
                                /{s.ipa}/
                              </span>
                              <span lang="en" className="mt-1 max-w-full truncate text-[11.5px] font-medium text-ink-2">
                                {s.words[0]}
                              </span>
                              {d >= 1 && <Check size={14} className="absolute right-1.5 top-1.5 text-green" aria-label="Đã đạt" />}
                              {d > 0 && d < 1 && (
                                <span className="absolute right-1.5 top-1.5 text-[10.5px] font-bold text-ink-2">
                                  {Math.round(d * 100)}%
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}

            {tab === "shadow" && (
              <section className="mt-5 space-y-3" aria-label="Shadowing">
                <p className="text-[13px] leading-5 text-ink-2">
                  Shadowing: nghe rồi nói theo gần như cùng lúc, bắt chước nhịp và ngữ điệu. Mở tốc độ 0.75x nếu còn nhanh.
                </p>
                {q.data.shadowing.map((v) => (
                  <article key={v.slug} className="rounded-[18px] border border-line bg-card p-3 shadow-elev-1">
                    <YouTubePlayer videoId={v.video_id} title={v.title_vi} />
                    <h3 className="mt-2 text-[14px] font-bold">{v.title_vi}</h3>
                    {v.note_vi && <p className="mt-0.5 text-[12.5px] leading-5 text-ink-2">{v.note_vi}</p>}
                  </article>
                ))}
              </section>
            )}
            <p className="mt-6 text-[11.5px] leading-4 text-ink-2">{q.data.source}</p>
          </>
        )}
      </div>
      <TabBar />
    </main>
  );
}
