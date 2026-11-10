import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Play } from "lucide-react";

import {
  FitWord,
  GuideCard,
  PointList,
  SectionTitle,
  StatusChip,
  TierChip,
} from "@/components/exam/bits";
import { useStartSet } from "@/components/exam/use-start-set";
import { PracticeShell } from "@/components/haru/PracticeShell";
import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { Rich } from "@/components/lesson/Rich";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { getRealExamType } from "@/lib/api/real-exam";
import type { RxItemStatusOut } from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exam/real_/type/$code")({
  head: () => ({
    meta: [
      { title: "Dạng bài — Luyện đề thi thật — Haru" },
      { name: "description", content: "Cách làm một dạng câu hỏi TOPIK II và các câu để luyện." },
      { property: "og:title", content: "Dạng bài — Haru" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RealExamType,
});

function ItemRow({ it }: { it: RxItemStatusOut }) {
  const start = useStartSet();
  return (
    <li>
      <button
        type="button"
        disabled={start.isPending}
        onClick={() => {
          tap();
          start.mutate({ qids: [it.qid] });
        }}
        className={cn(
          "hit-area flex min-h-12 w-full items-center gap-2 rounded-[14px] border border-line bg-card px-3 py-2 text-left active:scale-[0.99]",
          !it.open && "opacity-70",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold">
            {it.exam_short} · {it.sec === "L" ? "Nghe" : it.sec === "R" ? "Đọc" : "Viết"} {it.n}
          </span>
          <FitWord fit={it.fit} />
        </span>
        <StatusChip status={it.status} />
        {start.isPending ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <Play size={14} strokeWidth={2.6} aria-hidden="true" />
        )}
      </button>
    </li>
  );
}

function RealExamType() {
  const { code } = Route.useParams();
  const auth = useAuth();
  const start = useStartSet();
  const query = useQuery({
    queryKey: ["me", "real-exam", "type", code],
    queryFn: () => getRealExamType(code),
    enabled: auth.isAuthenticated,
  });
  const d = query.data;

  return (
    <PracticeShell glyph="問">
      <header>
        <Link
          to="/exam/real"
          onClick={() => tap()}
          className="hit-area -ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-semibold text-blue-deep active:scale-95"
        >
          <ArrowLeft size={15} strokeWidth={2.6} /> Luyện đề thi thật
        </Link>
        <h1 className="mt-1 text-xl font-bold leading-tight">{d?.guide.name_vi ?? "Dạng bài"}</h1>
        {d && (
          <p className="mt-0.5 text-[12px] font-semibold text-ink-2">{d.guide.family_name_vi}</p>
        )}
      </header>

      {(auth.isLoading || (auth.isAuthenticated && query.isLoading)) && (
        <LoadingBlocks className="mt-6" blocks={["h-16", "h-40", "h-12", "h-12"]} />
      )}
      {query.isError && (
        <ErrorState
          className="mt-6"
          error={query.error}
          message={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      )}

      {d && (
        <div className="mt-4 space-y-5">
          <GuideCard guide={d.guide} defaultOpen />

          <section className="rounded-[16px] border border-line bg-card p-3.5 shadow-elev-1">
            <p className="text-xs font-semibold leading-5">
              <Rich text={d.stat.next_vi} />
            </p>
            <button
              type="button"
              disabled={start.isPending || d.stat.open === 0}
              onClick={() => {
                tap();
                start.mutate({ type: d.stat.code });
              }}
              className="hit-area mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-40"
            >
              {start.isPending ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Play size={15} strokeWidth={2.6} aria-hidden="true" />
              )}
              {d.stat.open === 0 ? "Các câu đang nghỉ" : "Luyện dạng này"}
            </button>
          </section>

          <section>
            <SectionTitle>Kiến thức dạng này hay hỏi</SectionTitle>
            <p className="mt-0.5 text-[12px] font-semibold text-ink-2">
              Gộp từ các câu của dạng, kèm chỗ bài học dạy.
            </p>
            <div className="mt-2">
              <PointList
                points={d.points.slice(0, 12)}
                emptyHint="Dạng này chủ yếu cần nghe/đọc hiểu."
              />
            </div>
          </section>

          {[1, 2, 3].map((tier) => {
            const items = d.items.filter((i) => i.tier === tier);
            if (items.length === 0) return null;
            return (
              <section key={tier}>
                <div className="flex items-center gap-2">
                  <TierChip tier={tier} />
                  <span className="text-[12px] font-semibold text-ink-2">{items.length} câu</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {items.map((it) => (
                    <ItemRow key={it.qid} it={it} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </PracticeShell>
  );
}
