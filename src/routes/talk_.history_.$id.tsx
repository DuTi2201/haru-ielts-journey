import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useState } from "react";

import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { TabBar } from "@/components/haru/TabBar";
import {
  BandNote,
  clock,
  PronunciationCard,
  ReportCards,
  SaveToReview,
  talkDate,
} from "@/components/talk/TalkParts";
import { getTalkSession } from "@/lib/api/conversation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/talk_/history_/$id")({
  head: () => ({ meta: [{ title: "Buổi trò chuyện — Haru" }] }),
  component: TalkSessionScreen,
});

function TalkSessionScreen() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["talk", "session", id], queryFn: () => getTalkSession(id) });
  const [showTranscript, setShowTranscript] = useState(false);
  const s = q.data;

  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <Link
        to="/talk/history"
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-deep"
      >
        <ArrowLeft size={16} strokeWidth={2.4} /> Lịch sử trò chuyện
      </Link>

      {q.isLoading && <LoadingBlocks className="mt-5" blocks={["h-16", "h-28", "h-40"]} />}
      {q.isError && (
        <ErrorState
          className="mt-5"
          title="Không tải được buổi này."
          onRetry={() => void q.refetch()}
        />
      )}

      {s && (
        <section className="mt-4 space-y-3">
          <header>
            <p className="text-[12px] font-semibold text-ink-2">
              {talkDate(s.started_at)} · {clock(s.seconds)} · {s.learner_turns} lượt bạn nói
              {s.band != null && ` · mức ${s.band}/5`}
            </p>
            <h1 className="text-xl font-bold leading-tight">
              {s.topics_vi.length ? s.topics_vi.join(", ") : "Nhận xét của Haru"}
            </h1>
            {s.lesson_title && (
              <p className="text-[12px] font-medium text-ink-2">Bài lúc đó: {s.lesson_title}</p>
            )}
          </header>

          {s.report ? (
            <ReportCards report={s.report} />
          ) : (
            <p className="rounded-[18px] border border-line bg-card p-4 text-[13px] font-semibold leading-5">
              Buổi này chưa có nhận xét (nói ít quá hoặc lúc đó chưa làm được nhận xét).
            </p>
          )}
          {s.band_note_vi && <BandNote text={s.band_note_vi} />}
          {s.pronunciation && <PronunciationCard data={s.pronunciation} />}
          {s.report && (
            <SaveToReview
              sessionId={s.id}
              saved={s.saved}
              onSaved={() => void qc.invalidateQueries({ queryKey: ["talk"] })}
            />
          )}

          {s.turns.length > 0 && (
            <div className="rounded-[18px] border border-line bg-card shadow-elev-1">
              <button
                type="button"
                onClick={() => setShowTranscript((v) => !v)}
                aria-expanded={showTranscript}
                className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-semibold"
              >
                Lời hai bên đã nói ({s.turns.length} lượt)
                <ChevronDown
                  size={17}
                  className={cn("transition-transform", showTranscript && "rotate-180")}
                />
              </button>
              {showTranscript && (
                <div className="space-y-2 px-4 pb-4">
                  {s.turns.map((t, i) => (
                    <div
                      key={i}
                      className={cn("flex", t.role === "learner" ? "justify-end" : "justify-start")}
                    >
                      <p
                        lang="ko"
                        className={cn(
                          "max-w-[85%] rounded-[16px] px-3 py-1.5 text-[14px] leading-5",
                          t.role === "learner" ? "bg-blue-soft" : "bg-fill",
                        )}
                      >
                        {t.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
      <TabBar />
    </main>
  );
}
