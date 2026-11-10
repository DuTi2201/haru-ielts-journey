import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Library } from "lucide-react";
import { useState } from "react";

import { TabBar } from "@/components/haru/TabBar";
import { listBankDecks } from "@/lib/api/bank";
import type { BankDeckOut } from "@/lib/api/types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vocab-bank")({
  head: () => ({
    meta: [
      { title: "Kho từ TOPIK — Haru" },
      {
        name: "description",
        content: "Từ vựng trung cấp và cao cấp của từ điển 한국어기초사전, chia theo chủ đề.",
      },
    ],
  }),
  component: VocabBank,
});

const GRADES = [
  { id: "mid", label: "Trung cấp", note: "TOPIK 3–4" },
  { id: "adv", label: "Cao cấp", note: "TOPIK 5–6" },
] as const;

function VocabBank() {
  const auth = useAuth();
  const [grade, setGrade] = useState<"mid" | "adv">("mid");
  const decks = useQuery({
    queryKey: ["bank", "decks", auth.isAuthenticated],
    queryFn: () => listBankDecks(),
    staleTime: 60_000,
  });
  const shown = (decks.data ?? []).filter((d) => d.grade === grade);
  const total = shown.reduce((n, d) => n + d.words, 0);
  const added = (decks.data ?? []).filter((d) => d.added);

  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <Link
        to="/speaking"
        className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-ink-2"
      >
        <ChevronLeft size={16} strokeWidth={2.4} /> Luyện tập
      </Link>
      <header className="mt-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold leading-tight">
          <Library size={24} strokeWidth={2.2} className="text-blue" /> Kho từ TOPIK
        </h1>
        <p className="mt-1.5 text-[13px] font-medium leading-5 text-ink-2">
          Từ trung cấp và cao cấp mà các bài học chưa dạy, theo chủ đề. Thêm một bộ vào ôn tập thì
          mỗi ngày vài từ của bộ đó vào phần thẻ mới.
        </p>
      </header>

      {added.length > 0 && (
        <p className="mt-4 rounded-[14px] bg-blue-soft px-3 py-2 text-xs font-semibold leading-5">
          Đang ôn {added.length} bộ · đã bắt đầu {added.reduce((n, d) => n + d.started, 0)} từ.
        </p>
      )}

      <div role="tablist" className="mt-5 grid grid-cols-2 gap-2 rounded-full bg-progress p-1">
        {GRADES.map((g) => (
          <button
            key={g.id}
            role="tab"
            type="button"
            aria-selected={grade === g.id}
            onClick={() => setGrade(g.id)}
            className={cn(
              "min-h-10 rounded-full text-sm font-semibold",
              grade === g.id ? "bg-card shadow-elev-1" : "text-ink-2",
            )}
          >
            {g.label} <span className="text-[11px] font-semibold text-ink-2">{g.note}</span>
          </button>
        ))}
      </div>

      {decks.isLoading && <p className="mt-5 text-sm text-ink-2">Đang tải…</p>}
      {decks.isError && (
        <p role="alert" className="mt-5 text-sm font-semibold text-danger">
          Chưa tải được kho từ. Hãy thử lại sau.
        </p>
      )}
      {shown.length > 0 && (
        <>
          <p className="mt-4 text-[12px] font-semibold text-ink-2">
            {shown.length} bộ · {total} từ
          </p>
          <ul className="mt-2 space-y-2">
            {shown.map((d) => (
              <DeckRow key={d.key} deck={d} />
            ))}
          </ul>
        </>
      )}

      <p className="mt-6 text-[11px] leading-4 text-ink-2">
        Nguồn: 한국어기초사전, Viện Quốc ngữ Quốc gia Hàn Quốc (국립국어원), giấy phép CC BY-SA 2.0
        KR. Nghĩa tiếng Việt là bản dịch của từ điển.
      </p>
      <TabBar />
    </main>
  );
}

function DeckRow({ deck }: { deck: BankDeckOut }) {
  return (
    <li>
      <Link
        to="/vocab-bank/$key"
        params={{ key: deck.key }}
        className="flex min-h-14 items-center gap-3 rounded-[16px] border border-line bg-card px-3.5 py-2.5 shadow-elev-1 active:scale-[0.98]"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5">{deck.title_vi}</p>
          <p className="text-[12px] font-semibold text-ink-2">
            {deck.words} từ
            {deck.added && ` · đang ôn, đã bắt đầu ${deck.started}`}
          </p>
        </div>
        {deck.added && (
          <span className="rounded-full bg-green-soft px-2 py-0.5 text-[11px] font-semibold">
            Đang ôn
          </span>
        )}
        <ChevronRight size={16} strokeWidth={2.4} className="shrink-0 text-ink-2" />
      </Link>
    </li>
  );
}
