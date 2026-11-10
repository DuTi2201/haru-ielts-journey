import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  NotebookPen,
  Trash2,
  Volume2,
} from "lucide-react";
import { useState } from "react";

import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { TabBar } from "@/components/haru/TabBar";
import { TalkInsightsCard } from "@/components/talk/TalkInsightsCard";
import { clock, scoreTone, TalkTabs, talkDate } from "@/components/talk/TalkParts";
import { useTextAudio } from "@/hooks/use-text-audio";
import {
  deleteTalkNote,
  getTalkInsights,
  listTalkNotes,
  listTalkSessions,
  updateTalkNote,
  type TalkNote,
} from "@/lib/api/conversation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/talk_/history")({
  head: () => ({ meta: [{ title: "Lịch sử trò chuyện — Haru" }] }),
  component: TalkHistory,
});

function TalkHistory() {
  const sessions = useQuery({
    queryKey: ["talk", "sessions"],
    queryFn: () => listTalkSessions(50),
  });
  const insights = useQuery({ queryKey: ["talk", "insights"], queryFn: getTalkInsights });

  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <Link
        to="/speaking"
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-deep"
      >
        <ArrowLeft size={16} strokeWidth={2.4} /> Luyện tập
      </Link>
      <TalkTabs active="history" />

      {(sessions.isLoading || insights.isLoading) && (
        <LoadingBlocks className="mt-5" blocks={["h-40", "h-24", "h-20"]} />
      )}
      {sessions.isError && (
        <ErrorState
          className="mt-5"
          title="Không tải được lịch sử."
          onRetry={() => void sessions.refetch()}
        />
      )}

      {sessions.data && sessions.data.length === 0 && (
        <p className="mt-6 rounded-[18px] border border-dashed border-line p-5 text-center text-[13px] font-semibold leading-5 text-ink-2">
          Chưa có buổi trò chuyện nào. Nói với Haru một buổi, nhận xét và điểm phát âm sẽ được lưu ở
          đây.
        </p>
      )}

      {insights.data && insights.data.sessions > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-[15px] font-semibold">Tiến bộ khi nói</h2>
          <TalkInsightsCard data={insights.data} />
        </div>
      )}

      <Notebook />

      {sessions.data && sessions.data.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[15px] font-semibold">Các buổi trò chuyện</h2>
          <ul className="space-y-2.5">
            {sessions.data.map((s) => (
              <li key={s.id}>
                <Link
                  to="/talk/history/$id"
                  params={{ id: s.id }}
                  className="flex items-center gap-3 rounded-[18px] border border-line bg-card p-3.5 shadow-elev-1 active:scale-[0.98]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-ink-2">
                      {talkDate(s.started_at)} · {clock(s.seconds)}
                      {s.band != null && ` · mức ${s.band}/5`}
                    </p>
                    <p className="truncate text-[14px] font-semibold">
                      {s.topics_vi.length
                        ? s.topics_vi.join(", ")
                        : (s.lesson_title ?? "Trò chuyện")}
                    </p>
                    {s.headline_vi && (
                      <p className="line-clamp-2 text-[12px] leading-4 text-ink-2">
                        {s.headline_vi}
                      </p>
                    )}
                  </div>
                  {s.pron_avg != null && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums",
                        scoreTone(s.pron_avg),
                      )}
                    >
                      {Math.round(s.pron_avg)}
                    </span>
                  )}
                  <ChevronRight size={18} className="shrink-0 text-ink-2" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <TabBar />
    </main>
  );
}

/** Sổ trò chuyện: words and sentences kept with "Đưa vào ôn tập", to practise and tick off. */
function Notebook() {
  const qc = useQueryClient();
  const notes = useQuery({ queryKey: ["talk", "notes"], queryFn: listTalkNotes });
  const sample = useTextAudio();
  const [busy, setBusy] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  if (!notes.data || notes.data.length === 0) return null;
  const open = notes.data.filter((n) => !n.done);
  const done = notes.data.filter((n) => n.done);

  async function act(n: TalkNote, what: "toggle" | "delete") {
    setBusy(n.id);
    try {
      if (what === "toggle") await updateTalkNote(n.id, !n.done);
      else await deleteTalkNote(n.id);
      await qc.invalidateQueries({ queryKey: ["talk", "notes"] });
    } finally {
      setBusy(null);
    }
  }

  const row = (n: TalkNote) => (
    <li key={n.id} className="flex items-start gap-2 py-2">
      <button
        type="button"
        onClick={() => void act(n, "toggle")}
        disabled={busy === n.id}
        aria-label={n.done ? "Đánh dấu chưa thuộc" : "Đánh dấu đã thuộc"}
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
          n.done ? "border-transparent bg-green text-primary-foreground" : "border-line-strong",
        )}
      >
        {n.done && <Check size={14} strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          lang="ko"
          className={cn("text-[14px] font-semibold leading-5", n.done && "text-ink-2 line-through")}
        >
          {n.ko}
        </p>
        {n.kind === "sentence" && (
          <p className="text-[11px] font-semibold text-green">Câu Haru đã sửa đúng</p>
        )}
        {n.vi && <p className="text-[12px] leading-4 text-ink-2">{n.vi}</p>}
        {n.in_review && (
          <p className="text-[11px] font-semibold text-blue-deep">Đang có trong thẻ ôn</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void sample.play(n.ko)}
        aria-label={`Nghe: ${n.ko}`}
        className="hit-area shrink-0 rounded-full p-1 text-blue"
      >
        {sample.state === "loading" && sample.activeText === n.ko ? (
          <Loader2 size={17} className="animate-spin" />
        ) : (
          <Volume2 size={17} />
        )}
      </button>
      <button
        type="button"
        onClick={() => void act(n, "delete")}
        disabled={busy === n.id}
        aria-label={`Xoá: ${n.ko}`}
        className="hit-area shrink-0 rounded-full p-1 text-ink-2"
      >
        <Trash2 size={16} />
      </button>
    </li>
  );

  return (
    <section className="mt-6">
      <h2 className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold">
        <NotebookPen size={17} className="text-blue" /> Sổ trò chuyện
        <span className="text-[12px] font-medium text-ink-2">· {open.length} cần luyện</span>
      </h2>
      <div className="rounded-[18px] border border-line bg-card px-4 py-1 shadow-elev-1">
        {open.length > 0 ? (
          <ul className="divide-y divide-line">{open.map(row)}</ul>
        ) : (
          <p className="py-3 text-[12px] font-semibold text-ink-2">Đã luyện hết — giỏi lắm!</p>
        )}
        {done.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="w-full border-t border-line py-2 text-left text-[12px] font-semibold text-ink-2"
          >
            {showDone ? "Ẩn" : "Xem"} {done.length} mục đã thuộc
          </button>
        )}
        {showDone && <ul className="divide-y divide-line">{done.map(row)}</ul>}
      </div>
      <p className="mt-1.5 text-[11px] font-medium leading-4 text-ink-2">
        Sổ chỉ giữ từ Haru gợi ý và câu Haru đã sửa đúng, không giữ câu bạn tự nói. Haru sẽ khéo tạo
        dịp để bạn nói lại các câu này trong những buổi sau.
      </p>
    </section>
  );
}
