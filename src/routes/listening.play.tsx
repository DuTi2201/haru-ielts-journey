import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Ear, RotateCcw, SlidersHorizontal } from "lucide-react";

import { Mascot } from "@/components/mascot/Mascot";
import { ListeningPlayer } from "@/components/haru/ListeningPlayer";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { TabBar } from "@/components/haru/TabBar";
import { useCorpusAudio, type CorpusAudio } from "@/hooks/use-corpus-audio";
import { errorMessage } from "@/lib/api/client";
import { browseCorpus, getCorpusFacets } from "@/lib/api/content";
import type { CorpusPageOut } from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import {
  describeFilter,
  formatCount,
  newSeed,
  parseFilter,
  type ListeningFilter,
} from "@/lib/listening-filters";
import { cn } from "@/lib/utils";

/** Sentences per round — short enough to finish on a bus ride, long enough to
 * settle in. The learner can always ask for the next round. */
const ROUND_SIZE = 10;

type PlaySearch = ListeningFilter & {
  /** Fixes the order of this session; the same seed never repeats a sentence. */
  seed?: string | undefined;
  /** Where this round starts in the (seed-ordered) set. */
  offset?: number | undefined;
};

export const Route = createFileRoute("/listening/play")({
  validateSearch: (raw: Record<string, unknown>): PlaySearch => {
    const offset = Number(raw["offset"]);
    return {
      ...parseFilter(raw),
      seed:
        typeof raw["seed"] === "string" && /^[a-z0-9]{1,40}$/i.test(raw["seed"])
          ? raw["seed"]
          : undefined,
      offset: Number.isInteger(offset) && offset > 0 ? offset : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Luyện nghe — Haru" },
      { name: "description", content: "Nghe câu thoại phim bằng giọng đọc chuẩn Seoul." },
      { property: "og:title", content: "Luyện nghe — Haru" },
      { property: "og:description", content: "Nghe câu thoại phim bằng giọng đọc chuẩn Seoul." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ListeningPlayScreen,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] overflow-hidden bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <div className="relative z-10">{children}</div>
      <TabBar />
    </main>
  );
}

function RoundDone({
  heard,
  remaining,
  onNext,
  onAgain,
  onShuffle,
}: {
  heard: number;
  remaining: number;
  onNext: () => void;
  onAgain: () => void;
  onShuffle: () => void;
}) {
  return (
    <section
      role="status"
      className="card-soft mt-4 animate-in rounded-[24px] bg-green-soft p-5 text-center duration-300 fade-in zoom-in-95 motion-reduce:animate-none"
    >
      <Mascot mood="celebrate" className="mx-auto h-14 w-14" />
      <p className="mt-2 text-base font-semibold">Xong {heard} câu!</p>
      <p className="mt-1 text-xs font-medium leading-5 text-ink-2">
        {remaining > 0
          ? `Bộ này còn ${formatCount(remaining)} câu bạn chưa nghe.`
          : "Bạn đã nghe hết các câu của bộ này."}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {remaining > 0 ? (
          <button
            type="button"
            onClick={onNext}
            className="card-soft flex min-h-12 items-center justify-center rounded-[16px] bg-blue text-sm font-semibold text-primary-foreground active:scale-95"
          >
            Nghe tiếp {Math.min(ROUND_SIZE, remaining)} câu
          </button>
        ) : (
          <button
            type="button"
            onClick={onShuffle}
            className="card-soft flex min-h-12 items-center justify-center gap-1.5 rounded-[16px] bg-blue text-sm font-semibold text-primary-foreground active:scale-95"
          >
            <RotateCcw size={16} strokeWidth={2.4} /> Nghe lại, thứ tự mới
          </button>
        )}
        <button
          type="button"
          onClick={onAgain}
          className="card-soft flex min-h-11 items-center justify-center rounded-[16px] bg-card text-sm font-semibold active:scale-95"
        >
          Nghe lại {heard} câu vừa rồi
        </button>
        <Link
          to="/listening"
          onClick={() => tap()}
          className="card-soft flex min-h-11 items-center justify-center gap-1.5 rounded-[16px] bg-card text-sm font-semibold active:scale-95"
        >
          <SlidersHorizontal size={15} strokeWidth={2.4} /> Đổi bộ lọc
        </Link>
      </div>
    </section>
  );
}

/** One round (a page of sentences). Mounted per (seed, offset), so moving on to
 * the next round starts from a clean slate. */
function Round({
  page,
  audio,
  onNextRound,
  onShuffle,
}: {
  page: CorpusPageOut;
  audio: CorpusAudio;
  onNextRound: () => void;
  onShuffle: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [done, setDone] = useState(false);

  const items = page.items;
  const current = items[index];
  const next = items[index + 1];
  const { prefetch, stop } = audio;

  // Warm up this sentence and the next, so tapping play answers at once.
  useEffect(() => {
    if (current) void prefetch(current.id, current.text_ko);
    if (next) void prefetch(next.id, next.text_ko);
  }, [current, next, prefetch]);

  // A new round must not keep talking over the old one.
  useEffect(() => () => stop(), [stop]);

  function go(delta: 1 | -1) {
    const target = index + delta;
    if (target < 0) return;
    tap();
    stop();
    setRevealed(false);
    if (target >= items.length) {
      setDone(true);
      return;
    }
    setDirection(delta === 1 ? "next" : "prev");
    setIndex(target);
  }

  if (done) {
    return (
      <RoundDone
        heard={items.length}
        remaining={Math.max(0, page.total - (page.offset + items.length))}
        onNext={onNextRound}
        onShuffle={onShuffle}
        onAgain={() => {
          tap();
          setDone(false);
          setDirection("prev");
          setIndex(0);
        }}
      />
    );
  }

  if (!current) return null;
  return (
    <ListeningPlayer
      item={current}
      position={index + 1}
      total={items.length}
      audio={audio}
      revealed={revealed}
      direction={direction}
      isLast={index + 1 >= items.length}
      onToggleReveal={() => {
        tap();
        setRevealed((v) => !v);
      }}
      onPrev={index > 0 ? () => go(-1) : null}
      onNext={() => go(1)}
    />
  );
}

function ListeningPlayScreen() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/listening/play" });
  const audio = useCorpusAudio();

  const filter = parseFilter(search);
  const seed = search.seed;
  const offset = search.offset ?? 0;

  // A link without a seed (typed, or from an old bookmark) gets its own order.
  useEffect(() => {
    if (!seed) void navigate({ search: (prev) => ({ ...prev, seed: newSeed() }), replace: true });
  }, [seed, navigate]);

  const facets = useQuery({
    queryKey: ["corpusFacets"],
    queryFn: getCorpusFacets,
    staleTime: 5 * 60_000,
  });
  const query = useQuery({
    queryKey: ["corpusPage", filter, seed, offset],
    queryFn: () => browseCorpus({ ...filter, seed, offset, limit: ROUND_SIZE }),
    enabled: Boolean(seed),
    staleTime: 5 * 60_000,
  });
  const page = query.data;
  const rounds = page ? Math.max(1, Math.ceil(page.total / ROUND_SIZE)) : 0;

  return (
    <Shell>
      <header>
        <Link
          to="/listening"
          onClick={() => tap()}
          className="hit-area -ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-semibold text-blue-deep active:scale-95"
        >
          <ArrowLeft size={15} strokeWidth={2.6} /> Chọn bộ câu
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold leading-tight">
          <Ear size={22} strokeWidth={2.2} className="text-blue" /> Luyện nghe
        </h1>
        <p className="mt-1 text-xs font-medium text-ink-2">
          {describeFilter(filter, facets.data)}
          {page && page.total > 0 && (
            <>
              {" · "}
              {formatCount(page.total)} câu · lượt {Math.floor(offset / ROUND_SIZE) + 1}/{rounds}
            </>
          )}
        </p>
      </header>

      {(query.isLoading || !seed) && (
        <LoadingBlocks className="mt-6" blocks={["h-64 rounded-[24px]"]} label="Đang tải câu mẫu" />
      )}

      {query.isError && (
        <ErrorState
          className="mt-6"
          title="Không tải được câu mẫu."
          error={query.error}
          message={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      )}

      {page && page.items.length === 0 && (
        <EmptyState
          title={
            page.total === 0 ? "Chưa có câu nào khớp bộ lọc này." : "Không còn câu nào ở lượt này."
          }
          hint="Thử bỏ bớt bộ lọc hoặc chọn bộ khác nhé."
          action={
            <Link
              to="/listening"
              className="card-soft mt-4 inline-flex min-h-11 items-center rounded-full bg-blue px-5 text-sm font-semibold text-primary-foreground"
            >
              Chọn bộ câu
            </Link>
          }
        />
      )}

      {page && page.items.length > 0 && (
        <section className="mt-3">
          <Round
            key={`${seed}:${offset}`}
            page={page}
            audio={audio}
            onNextRound={() =>
              void navigate({ search: (prev) => ({ ...prev, offset: offset + ROUND_SIZE }) })
            }
            onShuffle={() =>
              void navigate({
                search: (prev) => ({ ...prev, seed: newSeed(), offset: undefined }),
              })
            }
          />
        </section>
      )}

      <aside className={cn("mt-7 flex items-end gap-2.5", !page?.items.length && "hidden")}>
        <Mascot mood="listening" className="h-14 w-14 shrink-0" />
        <p className="mb-1 rounded-[18px_18px_18px_4px] border border-line bg-card px-4 py-3 text-xs font-semibold leading-5 shadow-elev-1">
          Nghe trước, thử đoán nghĩa, rồi mới mở đáp án — nhớ lâu hơn đó!
        </p>
      </aside>
    </Shell>
  );
}
