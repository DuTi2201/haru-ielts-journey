import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Play } from "lucide-react";

import { FitWord, SectionTitle, StatusChip, TierChip } from "@/components/exam/bits";
import { useStartSet } from "@/components/exam/use-start-set";
import { PracticeShell } from "@/components/haru/PracticeShell";
import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { getRealExamPaper } from "@/lib/api/real-exam";
import type { RxItemStatusOut, RxSec } from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exam/real_/paper/$exam")({
  head: () => ({
    meta: [
      { title: "Đề thi — Luyện đề thi thật — Haru" },
      {
        name: "description",
        content: "Xem cả một đề TOPIK II theo từng câu và luyện câu bạn chọn.",
      },
      { property: "og:title", content: "Đề thi — Haru" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RealExamPaper,
});

const SEC_NAME: Record<RxSec, string> = { L: "Nghe", R: "Đọc", W: "Viết" };

function Cell({ it }: { it: RxItemStatusOut }) {
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
        className="hit-area flex min-h-12 w-full items-center gap-2 rounded-[14px] border border-line bg-card px-3 py-2 text-left active:scale-[0.99]"
      >
        <span className="w-8 shrink-0 text-base font-semibold">{it.n}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold">{it.type_name}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            <TierChip tier={it.tier} />
            <FitWord fit={it.fit} />
          </span>
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

function SectionStart({ exam, sec, label }: { exam: string; sec: RxSec; label: string }) {
  const start = useStartSet();
  return (
    <button
      type="button"
      disabled={start.isPending}
      onClick={() => {
        tap();
        start.mutate({ exam, sec });
      }}
      className={cn(
        "hit-area flex min-h-10 items-center gap-1 rounded-full border border-transparent bg-blue px-3.5 text-xs font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-50",
      )}
    >
      {start.isPending ? (
        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
      ) : (
        <Play size={13} strokeWidth={2.6} aria-hidden="true" />
      )}
      {label}
    </button>
  );
}

function RealExamPaper() {
  const { exam } = Route.useParams();
  const auth = useAuth();
  const query = useQuery({
    queryKey: ["me", "real-exam", "paper", exam],
    queryFn: () => getRealExamPaper(exam),
    enabled: auth.isAuthenticated,
  });
  const d = query.data;
  const sections: RxSec[] = ["L", "R", "W"];

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
        <h1 className="mt-1 text-xl font-bold leading-tight">{d?.title ?? "Đề thi"}</h1>
        {d?.note_vi && (
          <p className="mt-1 text-xs font-semibold leading-5 text-ink-2">{d.note_vi}</p>
        )}
      </header>

      {(auth.isLoading || (auth.isAuthenticated && query.isLoading)) && (
        <LoadingBlocks className="mt-6" blocks={["h-12", "h-12", "h-12", "h-12"]} />
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
          <p className="text-xs font-semibold leading-5 text-ink-2">
            Chạm vào một câu để làm riêng câu đó, hoặc bắt đầu cả phần: Haru chọn vài câu hợp với
            bạn trong phần đó.
          </p>
          {sections.map((sec) => {
            const items = d.items.filter((i) => i.sec === sec);
            if (items.length === 0) return null;
            return (
              <section key={sec}>
                <div className="flex items-center justify-between gap-2">
                  <SectionTitle>
                    {SEC_NAME[sec]} · {items.length} câu
                  </SectionTitle>
                  <SectionStart exam={d.id} sec={sec} label={`Luyện phần ${SEC_NAME[sec]}`} />
                </div>
                <ul className="mt-2 space-y-1.5">
                  {items.map((it) => (
                    <Cell key={it.qid} it={it} />
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
