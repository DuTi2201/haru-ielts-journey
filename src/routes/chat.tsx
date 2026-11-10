import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Lock, MessagesSquare } from "lucide-react";

import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { TabBar } from "@/components/haru/TabBar";
import { useAuth } from "@/hooks/use-auth";
import { CHATS_KEY, listChats, type ChatSummary } from "@/lib/api/chats";
import { errorMessage } from "@/lib/api/client";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Hội thoại — Haru" }] }),
  component: ChatList,
});

/** The dialogues of the lessons, as chats: the ones whose words and grammar the learner has met
 * are open; the others say which lesson opens them. */
function ChatList() {
  const auth = useAuth();
  const q = useQuery({
    queryKey: CHATS_KEY,
    queryFn: listChats,
    enabled: auth.isAuthenticated,
    staleTime: 30_000,
  });
  const open = (q.data ?? []).filter((c) => c.open);
  const later = (q.data ?? []).filter((c) => !c.open);
  return (
    <main className="relative mx-auto min-h-dvh max-w-[440px] bg-paper px-5 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(24px,env(safe-area-inset-top))] text-ink">
      <header>
        <p className="text-[13px] font-semibold text-ink-2">Luyện nói</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <MessagesSquare size={22} className="text-blue" aria-hidden="true" /> Hội thoại
        </h1>
        <p className="mt-1 text-[13px] font-medium text-ink-2">
          Nhân vật nói, bạn chọn câu đáp. Mỗi hội thoại vài phút.
        </p>
      </header>
      {!auth.isAuthenticated && !auth.isLoading && (
        <p className="mt-6 rounded-[16px] bg-yellow-soft px-4 py-3 text-[13px] font-semibold">
          <Link to="/support-language" className="underline">
            Đăng nhập
          </Link>{" "}
          để mở các hội thoại theo bài bạn đã học.
        </p>
      )}
      {q.isLoading && (
        <LoadingBlocks className="mt-6" label="Đang tải" blocks={["h-20", "h-20", "h-20"]} />
      )}
      {q.isError && (
        <ErrorState
          className="mt-6"
          title="Không tải được danh sách."
          message={errorMessage(q.error)}
          onRetry={() => void q.refetch()}
          retrying={q.isRefetching}
        />
      )}
      {open.length > 0 && (
        <ul className="mt-5 space-y-2.5">
          {open.map((c) => (
            <Row key={c.id} c={c} />
          ))}
        </ul>
      )}
      {q.data && open.length === 0 && (
        <p className="mt-6 rounded-[16px] bg-fill px-4 py-3 text-[13px] font-medium leading-5 text-ink-2">
          Học xong bài đầu tiên là có hội thoại để luyện.
        </p>
      )}
      {later.length > 0 && (
        <>
          <h2 className="mt-7 text-[13px] font-semibold text-ink-2">Mở khi học tới</h2>
          <ul className="mt-2 space-y-2">
            {later.slice(0, 6).map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </ul>
        </>
      )}
      <TabBar />
    </main>
  );
}

function Row({ c }: { c: ChatSummary }) {
  const inner = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] font-korean text-lg font-bold",
          c.done
            ? "bg-green-soft text-ink"
            : c.open
              ? "bg-purple-soft text-ink"
              : "bg-fill text-ink-2",
        )}
      >
        {c.done ? (
          <Check size={20} strokeWidth={3} />
        ) : c.open ? (
          c.partner.slice(0, 1)
        ) : (
          <Lock size={16} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{c.title_vi}</span>
        <span className="block truncate text-[12px] font-medium text-ink-2">
          {c.open
            ? `Với ${c.partner} · ~${Math.max(2, Math.round(c.lines / 3))} phút`
            : `Sau bài: ${c.lesson_title}`}
        </span>
      </span>
      {c.open && <ChevronRight size={18} className="shrink-0 text-ink-2" />}
    </>
  );
  const cls =
    "flex items-center gap-3 rounded-[18px] border border-line bg-card px-3 py-3 shadow-elev-1";
  return (
    <li>
      {c.open ? (
        <Link
          to="/chat/$id"
          params={{ id: c.id }}
          onClick={() => tap()}
          className={cn(cls, "active:scale-[0.99]")}
        >
          {inner}
        </Link>
      ) : (
        <div className={cn(cls, "opacity-60 shadow-none")}>{inner}</div>
      )}
    </li>
  );
}
