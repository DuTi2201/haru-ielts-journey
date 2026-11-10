import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Ear, Headphones, RotateCcw } from "lucide-react";

import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { TabBar } from "@/components/haru/TabBar";
import { errorMessage } from "@/lib/api/client";
import { browseCorpus, getCorpusFacets } from "@/lib/api/content";
import { tap } from "@/lib/feedback";
import {
  REGISTER_INFO,
  describeFilter,
  formatCount,
  hasFilter,
  newSeed,
  registerLabel,
  type ListeningFilter,
} from "@/lib/listening-filters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/listening/")({
  head: () => ({
    meta: [
      { title: "Chọn bộ câu nghe — Haru" },
      {
        name: "description",
        content: "Chọn câu thoại phim để luyện nghe theo cấp độ, chủ đề và kiểu nói.",
      },
      { property: "og:title", content: "Chọn bộ câu nghe — Haru" },
      {
        property: "og:description",
        content: "Chọn câu thoại phim để luyện nghe theo cấp độ, chủ đề và kiểu nói.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ListeningHubScreen,
});

/** Topics/patterns shown before "Xem thêm" (the long tail is mostly 1-sentence). */
const COLLAPSED_COUNT = 8;

interface ChipOption<T> {
  value: T;
  label: string;
  count: number;
  korean?: boolean;
}

/** One filter row: a single choice, tap it again to clear. Counts are the number
 * of distinct sentences behind each choice. */
function ChipGroup<T extends string | number>({
  title,
  options,
  selected,
  onSelect,
  collapsible = false,
  children,
}: {
  title: string;
  options: ChipOption<T>[];
  selected: T | undefined;
  onSelect: (value: T | undefined) => void;
  collapsible?: boolean;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  if (options.length === 0) return null;
  const hidden = collapsible && !expanded ? options.length - COLLAPSED_COUNT : 0;
  // A choice that is currently selected must stay visible even when collapsed.
  const shown =
    hidden > 0 ? options.filter((o, i) => i < COLLAPSED_COUNT || o.value === selected) : options;
  return (
    <section className="mt-5" aria-label={title}>
      <h2 className="text-[13px] font-semibold text-ink-2">{title}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {shown.map((o) => {
          const on = o.value === selected;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={on}
              onClick={() => {
                tap();
                onSelect(on ? undefined : o.value);
              }}
              className={cn(
                "hit-area card-soft inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-transform active:scale-95 motion-reduce:transition-none",
                on ? "bg-blue text-primary-foreground" : "bg-card text-ink",
              )}
            >
              <span
                lang={o.korean ? "ko" : undefined}
                className={cn("truncate", o.korean && "font-korean")}
              >
                {o.label}
              </span>
              <span
                className={cn(
                  "tabular-nums text-[12px] font-semibold",
                  on ? "opacity-80" : "text-ink-2",
                )}
              >
                {formatCount(o.count)}
              </span>
            </button>
          );
        })}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="hit-area min-h-10 rounded-full px-3 text-xs font-semibold text-blue-deep active:scale-95"
          >
            Xem thêm {hidden}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function ListeningHubScreen() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ListeningFilter>({});
  const set = (patch: ListeningFilter) => setFilter((f) => ({ ...f, ...patch }));

  const facets = useQuery({
    queryKey: ["corpusFacets"],
    queryFn: getCorpusFacets,
    staleTime: 5 * 60_000,
  });
  // How many sentences the current choice holds — also tells apart "nothing matches".
  const matching = useQuery({
    queryKey: ["corpusCount", filter],
    queryFn: () => browseCorpus({ ...filter, limit: 1 }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const data = facets.data;
  const total = matching.data?.total;
  const none = total === 0;

  function start() {
    tap();
    void navigate({ to: "/listening/play", search: { ...filter, seed: newSeed() } });
  }

  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] overflow-hidden bg-paper px-6 pb-60 pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <div className="relative z-10">
        <header>
          <p className="text-[13px] font-semibold text-ink-2">Luyện nghe</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold leading-tight">
            <Ear size={22} strokeWidth={2.2} className="text-blue" /> Chọn bộ câu
          </h1>
          <p className="mt-1 text-xs font-medium leading-5 text-ink-2">
            {data
              ? `${formatCount(data.total)} câu thoại phim, mỗi câu chỉ xuất hiện một lần. `
              : ""}
            Chọn cấp độ, kiểu nói hay chủ đề bạn muốn luyện — hoặc nghe ngẫu nhiên tất cả.
          </p>
        </header>

        {facets.isLoading && (
          <LoadingBlocks
            className="mt-6"
            label="Đang tải danh mục câu"
            blocks={["h-16", "h-16", "h-24"]}
          />
        )}

        {facets.isError && (
          <ErrorState
            className="mt-6"
            title="Không tải được danh mục câu."
            error={facets.error}
            message={errorMessage(facets.error)}
            onRetry={() => void facets.refetch()}
            retrying={facets.isRefetching}
          />
        )}

        {data && data.total === 0 && (
          <EmptyState
            title="Chưa có câu nào để nghe."
            hint="Vào Studio để tải phụ đề phim lên nhé."
          />
        )}

        {data && data.total > 0 && (
          <>
            <ChipGroup
              title="Cấp độ"
              options={data.levels.map((l) => ({
                value: l.level,
                label: `Cấp ${l.level}`,
                count: l.count,
              }))}
              selected={filter.level}
              onSelect={(level) => set({ level })}
            />

            <ChipGroup
              title="Kiểu nói"
              options={data.registers.map((r) => ({
                value: r.register,
                label: registerLabel(r.register),
                count: r.count,
              }))}
              selected={filter.register}
              onSelect={(register) => set({ register })}
            >
              <p className="mt-2 text-[12px] font-medium leading-5 text-ink-2">
                {filter.register
                  ? REGISTER_INFO[filter.register]?.hint
                  : "Lịch sự (존댓말) để nói với người lớn tuổi, cấp trên; Thân mật (반말) để nói với bạn bè, người nhỏ tuổi hơn."}
              </p>
            </ChipGroup>

            <ChipGroup
              title="Chủ đề"
              collapsible
              options={data.topics.map((t) => ({ value: t.id, label: t.name, count: t.count }))}
              selected={filter.topic}
              onSelect={(topic) => set({ topic })}
            />

            <ChipGroup
              title="Mẫu ngữ pháp"
              collapsible
              options={data.grammar.map((g) => ({
                value: g.id,
                label: g.pattern,
                count: g.count,
                korean: true,
              }))}
              selected={filter.grammar}
              onSelect={(grammar) => set({ grammar })}
            />

            {data.films.length > 1 && (
              <ChipGroup
                title="Nguồn phim"
                options={data.films.map((f) => ({ value: f.id, label: f.title, count: f.count }))}
                selected={filter.film}
                onSelect={(film) => set({ film })}
              />
            )}
          </>
        )}
      </div>

      {/* The way in is always one tap away, whatever the filters' length. */}
      {data && data.total > 0 && (
        <div className="fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 mx-auto max-w-[390px] px-4 pb-2">
          <div className="glass-panel-strong rounded-[22px] p-3">
            <div className="flex items-center justify-between gap-2 px-1 text-xs font-semibold text-ink-2">
              <span className="min-w-0 truncate">{describeFilter(filter, data)}</span>
              {hasFilter(filter) && (
                <button
                  type="button"
                  onClick={() => {
                    tap();
                    setFilter({});
                  }}
                  className="hit-area inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-deep active:scale-95"
                >
                  <RotateCcw size={13} strokeWidth={2.6} /> Bỏ lọc
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={start}
              disabled={none || total === undefined}
              className="card-soft mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-blue text-sm font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-50 motion-reduce:transition-none"
            >
              <Headphones size={17} strokeWidth={2.4} />
              {none
                ? "Không có câu nào khớp"
                : total === undefined
                  ? "Đang đếm câu…"
                  : `Bắt đầu nghe · ${formatCount(total)} câu`}
            </button>
          </div>
        </div>
      )}
      <TabBar />
    </main>
  );
}
