import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Minus, Plus } from "lucide-react";

import { TabBar } from "@/components/haru/TabBar";
import { BankDeckPractice } from "@/components/lesson/BankDeckPractice";
import { VocabList } from "@/components/lesson/VocabList";
import { useAuth } from "@/hooks/use-auth";
import { addBankDeck, getBankDeck, removeBankDeck } from "@/lib/api/bank";
import { errorMessage } from "@/lib/api/client";

export const Route = createFileRoute("/vocab-bank_/$key")({
  head: () => ({ meta: [{ title: "Kho từ TOPIK — Haru" }] }),
  component: BankDeck,
});

function BankDeck() {
  const { key } = Route.useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const deck = useQuery({
    queryKey: ["bank", "deck", key, auth.isAuthenticated],
    queryFn: () => getBankDeck(key),
    staleTime: 60_000,
  });
  const toggle = useMutation({
    mutationFn: (on: boolean) => (on ? addBankDeck(key) : removeBankDeck(key)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bank"] });
      void queryClient.invalidateQueries({ queryKey: ["me", "review-queue"] });
    },
  });
  const d = deck.data;

  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <Link
        to="/vocab-bank"
        className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-ink-2"
      >
        <ChevronLeft size={16} strokeWidth={2.4} /> Kho từ TOPIK
      </Link>
      {deck.isLoading && <p className="mt-4 text-sm text-ink-2">Đang tải…</p>}
      {deck.isError && (
        <p role="alert" className="mt-4 text-sm font-semibold text-danger">
          {errorMessage(deck.error)}
        </p>
      )}
      {d && (
        <>
          <header className="mt-1">
            <p className="text-[13px] font-semibold text-ink-2">{d.grade_vi}</p>
            <h1 className="mt-0.5 text-2xl font-bold leading-tight">{d.title_vi}</h1>
            <p className="mt-1 text-[13px] font-medium text-ink-2">{d.words.length} từ</p>
          </header>

          {auth.isAuthenticated ? (
            <button
              type="button"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate(!d.added)}
              className={
                d.added
                  ? "hit-area mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-semibold shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
                  : "hit-area mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-blue px-4 text-sm font-semibold text-white shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
              }
            >
              {d.added ? (
                <Minus size={16} strokeWidth={2.4} />
              ) : (
                <Plus size={16} strokeWidth={2.4} />
              )}
              {d.added ? "Thôi thêm từ mới của bộ này" : "Thêm bộ này vào ôn tập"}
            </button>
          ) : (
            <p className="mt-4 rounded-[12px] bg-blue-soft px-3 py-2 text-xs font-semibold leading-5">
              Đăng nhập để thêm bộ từ này vào phần ôn tập hằng ngày.
            </p>
          )}
          {d.added && (
            <p className="mt-2 text-[12px] font-semibold leading-4 text-ink-2">
              Mỗi ngày vài từ của bộ này vào phần thẻ mới ở «Ôn tập». Từ đã bắt đầu vẫn được ôn tiếp
              nếu bạn thôi thêm bộ.
            </p>
          )}
          {toggle.isError && (
            <p role="alert" className="mt-2 text-xs font-semibold text-danger">
              {errorMessage(toggle.error)}
            </p>
          )}

          {auth.isAuthenticated && d.added && <BankDeckPractice deckKey={key} />}

          <div className="mt-5">
            <VocabList vocab={d.words} />
          </div>
        </>
      )}
      <TabBar />
    </main>
  );
}
