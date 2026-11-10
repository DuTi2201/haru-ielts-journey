import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, HelpCircle, Languages, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { Mascot } from "@/components/mascot/Mascot";
import { CHAT_DONE_DAY, localDay } from "@/lib/today-session";
import { useTextAudio } from "@/hooks/use-text-audio";
import { CHATS_KEY, finishChat, getChat, listChats, type Chat } from "@/lib/api/chats";
import { errorMessage } from "@/lib/api/client";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chat_/$id")({
  head: () => ({ meta: [{ title: "Hội thoại — Haru" }] }),
  component: ChatScreen,
});

function ChatScreen() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["chat", id], queryFn: () => getChat(id), staleTime: Infinity });
  if (q.isLoading)
    return (
      <Frame title="Hội thoại">
        <LoadingBlocks
          className="mt-6"
          label="Đang mở hội thoại"
          blocks={["h-16", "h-16", "h-40"]}
        />
      </Frame>
    );
  if (q.isError || !q.data)
    return (
      <Frame title="Hội thoại">
        <ErrorState
          className="mt-8"
          title="Không mở được hội thoại."
          message={errorMessage(q.error)}
          onRetry={() => void q.refetch()}
          retrying={q.isRefetching}
        />
      </Frame>
    );
  return <ChatPlay key={q.data.id} chat={q.data} />;
}

/** The chat: the other speaker's lines come one by one (voiced); at each of the learner's lines the
 * screen asks, in Vietnamese, what to say, and offers four lines. A wrong pick shakes and stays
 * open for another try; the right one is said aloud and the chat goes on. */
function ChatPlay({ chat }: { chat: Chat }) {
  const audio = useTextAudio();
  const qc = useQueryClient();
  const [at, setAt] = useState(0); // turns shown so far
  const [wrong, setWrong] = useState<string[]>([]);
  const [firstTry, setFirstTry] = useState(0);
  const [showVi, setShowVi] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const turn = chat.turns[at];
  const asking = turn?.mine ?? false;
  const done = at >= chat.turns.length;
  const total = chat.turns.filter((t) => t.mine).length;

  const finish = useMutation({
    mutationFn: () => finishChat(chat.id, firstTry, total),
    onSuccess: () => {
      try {
        localStorage.setItem(CHAT_DONE_DAY, localDay());
      } catch {
        /* private mode: the step shows the next dialogue instead */
      }
      void qc.invalidateQueries({ queryKey: CHATS_KEY });
    },
  });

  // the other speaker's lines: shown and said, then the next one
  useEffect(() => {
    if (done || asking || !turn) return;
    void audio.play(turn.ko, turn.voice);
    const t = setTimeout(() => setAt((n) => n + 1), Math.min(4500, 1200 + turn.ko.length * 90));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [at, wrong.length]);

  useEffect(() => {
    if (done && total > 0 && !finish.isSuccess && !finish.isPending) finish.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function pick(option: string) {
    if (!turn || !asking) return;
    if (option !== turn.ko) {
      tap();
      setWrong((w) => (w.includes(option) ? w : [...w, option]));
      return;
    }
    tap();
    if (wrong.length === 0) setFirstTry((n) => n + 1);
    void audio.play(turn.ko, turn.voice);
    setWrong([]);
    setAt((n) => n + 1);
  }

  const shown = chat.turns.slice(0, Math.min(at + (asking ? 0 : 1), chat.turns.length));

  return (
    <Frame title={chat.title_vi} sub={chat.title_ko}>
      {chat.scene_vi && (
        <p className="mt-2 rounded-[14px] bg-fill px-3 py-2 text-[12.5px] font-medium leading-5 text-ink-2">
          {chat.scene_vi} Bạn là <b className="text-ink">{chat.me}</b>.
        </p>
      )}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => setShowVi((v) => !v)}
          aria-pressed={showVi}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold",
            showVi ? "bg-blue-soft text-blue-deep" : "text-ink-2",
          )}
        >
          <Languages size={14} aria-hidden="true" /> Dịch
        </button>
      </div>

      <div ref={list} className="mt-1 space-y-3 pb-4" aria-live="polite">
        {shown.map((t, i) => (
          <Bubble
            key={i}
            mine={t.mine}
            name={t.speaker}
            ko={t.ko}
            vi={showVi ? t.vi : null}
            onPlay={() => void audio.play(t.ko, t.voice)}
          />
        ))}
        {asking && (
          <div className="flex justify-end">
            <span className="rounded-[18px] rounded-br-[6px] bg-blue/80 px-4 py-2 text-primary-foreground">
              <span className="lecture-say">…</span>
            </span>
          </div>
        )}
      </div>

      {asking && turn && (
        <section
          aria-label="Chọn câu bạn nói"
          className="sticky bottom-0 -mx-5 bg-paper/95 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur"
        >
          <p className="flex items-start gap-2 text-[16px] font-bold leading-snug">
            <HelpCircle size={20} className="mt-0.5 shrink-0 text-blue" aria-hidden="true" />
            {turn.vi}
          </p>
          <div className="mt-3 space-y-2">
            {turn.options.map((o) => {
              const bad = wrong.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  disabled={bad}
                  onClick={() => pick(o)}
                  lang="ko"
                  className={cn(
                    "block w-full rounded-[16px] border-2 px-4 py-3 text-left font-korean text-[15.5px] font-semibold leading-snug transition-colors active:scale-[0.99]",
                    bad
                      ? "chat-shake border-danger/70 bg-danger-soft text-danger"
                      : "border-line bg-card text-ink",
                  )}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {done && <DoneCard chat={chat} right={firstTry} total={total} />}
    </Frame>
  );
}

function Bubble({
  mine,
  name,
  ko,
  vi,
  onPlay,
}: {
  mine: boolean;
  name: string;
  ko: string;
  vi: string | null;
  onPlay: () => void;
}) {
  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && (
        <span
          aria-hidden="true"
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-soft font-korean text-[13px] font-bold text-ink"
        >
          {name.slice(0, 1)}
        </span>
      )}
      <button
        type="button"
        onClick={onPlay}
        className={cn(
          "max-w-[80%] rounded-[18px] px-4 py-2.5 text-left animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none",
          mine
            ? "rounded-br-[6px] bg-blue text-primary-foreground"
            : "rounded-bl-[6px] border border-line bg-card text-ink",
        )}
      >
        <span lang="ko" className="block font-korean text-[15.5px] leading-6">
          {ko}
        </span>
        {vi && <span className="mt-0.5 block text-[12.5px] leading-5 opacity-80">{vi}</span>}
        <Volume2 size={12} className="mt-1 opacity-50" aria-label="Nghe lại" />
      </button>
    </div>
  );
}

function DoneCard({ chat, right, total }: { chat: Chat; right: number; total: number }) {
  const chatId = chat.id;
  const navigate = useNavigate();
  const chats = useQuery({ queryKey: CHATS_KEY, queryFn: listChats, staleTime: 30_000 });
  const next = useMemo(
    () => chats.data?.find((c) => c.open && !c.done && c.id !== chatId),
    [chats.data, chatId],
  );
  return (
    <section className="mt-4 rounded-[22px] bg-green-soft p-5 text-center">
      <Mascot mood="celebrate" className="mx-auto h-20 w-20" />
      <p className="mt-1 flex items-center justify-center gap-1.5 text-lg font-bold">
        <Check size={20} strokeWidth={3} aria-hidden="true" /> Xong hội thoại!
      </p>
      <p className="mt-0.5 text-[13px] font-medium text-ink-2">
        Chọn đúng ngay lần đầu {right}/{total} câu.
      </p>
      <div className="mt-4 space-y-2">
        {next && (
          <button
            type="button"
            onClick={() => {
              tap();
              void navigate({ to: "/chat/$id", params: { id: next.id } });
            }}
            className="flex min-h-12 w-full items-center justify-center rounded-[16px] bg-blue px-4 text-sm font-semibold text-primary-foreground shadow-elev-1"
          >
            Hội thoại tiếp: {next.title_vi}
          </button>
        )}
        {chat.lesson_id && right < total && (
          <Link
            to="/lesson/$id"
            params={{ id: String(chat.lesson_id) }}
            onClick={() => tap()}
            className="flex min-h-11 w-full items-center justify-center rounded-[16px] border border-line bg-card px-4 text-[13px] font-semibold"
          >
            Ôn lại bài: {chat.lesson_title}
          </Link>
        )}
        <Link
          to="/today"
          onClick={() => tap()}
          className="flex min-h-11 w-full items-center justify-center rounded-[16px] border border-line bg-card px-4 text-[13px] font-semibold"
        >
          Về Hôm nay
        </Link>
      </div>
    </section>
  );
}

function Frame({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative mx-auto min-h-dvh max-w-[440px] bg-paper px-5 pt-[max(16px,env(safe-area-inset-top))] text-ink">
      <header className="flex items-center gap-2">
        <Link
          to="/chat"
          aria-label="Danh sách hội thoại"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-2"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-bold">{title}</h1>
          {sub && (
            <p lang="ko" className="truncate font-korean text-[12px] text-ink-2">
              {sub}
            </p>
          )}
        </div>
      </header>
      {children}
    </main>
  );
}
