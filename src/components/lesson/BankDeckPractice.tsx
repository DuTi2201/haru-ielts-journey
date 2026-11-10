import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mic, PenLine, Scale } from "lucide-react";
import { useState } from "react";

import { ApiError, errorMessage } from "@/lib/api/client";
import { listBankDecks, presentBankDeck } from "@/lib/api/bank";
import { tap } from "@/lib/feedback";

/* "Dùng từ của bộ này": once a few words of the deck have been answered right twice, the learner
 * can put them to work — write sentences with them, give a 2-minute talk or argue a side about the
 * deck's topic. The same practice screens as everywhere else; only the words come from the deck. */

const MIN_WORDS = 3;

export function BankDeckPractice({ deckKey }: { deckKey: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"present" | "debate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decks = useQuery({ queryKey: ["bank", "decks", true], queryFn: () => listBankDecks(), staleTime: 30_000 });
  const practiced = decks.data?.find((d) => d.key === deckKey)?.practiced ?? 0;
  const ready = practiced >= MIN_WORDS;

  async function talk(kind: "present" | "debate") {
    tap();
    setBusy(kind);
    setError(null);
    try {
      const round = await presentBankDeck(deckKey, kind);
      void navigate({ to: "/talk/present", search: { session: round.id } });
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? "Đăng nhập để luyện nhé." : errorMessage(e));
      setBusy(null);
    }
  }

  const button =
    "hit-area card-soft flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-[16px] px-3 py-2.5 text-[13px] font-semibold transition-transform active:scale-95 disabled:opacity-50";
  return (
    <section className="mt-5 rounded-[20px] border border-line bg-card p-4 shadow-elev-1" aria-labelledby="bank-practice">
      <h2 id="bank-practice" className="text-[15px] font-bold">
        Dùng từ của bộ này
      </h2>
      <p className="mt-0.5 text-xs font-medium leading-5 text-ink-2">
        {ready
          ? `Bạn đã nhớ ${practiced} từ của bộ. Dùng chúng để viết câu và nói, đừng chỉ lật thẻ.`
          : `Ôn đúng ít nhất 2 lần ${MIN_WORDS} từ của bộ (hiện ${practiced}) rồi viết câu và nói bằng chính những từ đó.`}
      </p>
      <div className="mt-3 flex gap-2">
        {ready ? (
          <Link
            to="/writing/drill"
            search={{ deck: deckKey }}
            onClick={() => tap()}
            className={button}
          >
            <PenLine size={16} strokeWidth={2.4} aria-hidden="true" /> Viết câu
          </Link>
        ) : (
          <button type="button" disabled className={button}>
            <PenLine size={16} strokeWidth={2.4} aria-hidden="true" /> Viết câu
          </button>
        )}
        <button type="button" disabled={!ready || busy !== null} onClick={() => void talk("present")} className={button}>
          <Mic size={16} strokeWidth={2.4} aria-hidden="true" /> Trình bày
        </button>
        <button type="button" disabled={!ready || busy !== null} onClick={() => void talk("debate")} className={button}>
          <Scale size={16} strokeWidth={2.4} aria-hidden="true" /> Phản biện
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
