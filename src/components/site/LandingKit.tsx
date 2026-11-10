import { Link } from "@tanstack/react-router";
import { ArrowRight, RotateCcw, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { useLandingVoice } from "@/lib/landing-voice";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Fades its children up the first time they scroll into view. Content that is already on screen,
 * server-rendered pages and learners who asked for less motion see it at once, never hidden. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.dataset["reveal"] = "pending";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset["reveal"] = "in";
        io.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      delete el.dataset["reveal"];
    };
  }, []);
  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "transition-[opacity,translate] duration-500 ease-spring data-[reveal=pending]:translate-y-4 data-[reveal=pending]:opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

// The recordings of these texts are made once on the server (Chirp) and only read back; keep them in
// step with LANDING_TEXTS in the backend (app/services/landing_audio.py).
const DEMO_CARDS = [
  {
    ko: "꾸준히",
    roman: "kku-ju-ni",
    vi: "Đều đặn, bền bỉ",
    note: "Trạng từ dùng nhiều khi viết và nói: 꾸준히 노력하다 (nỗ lực bền bỉ).",
  },
  {
    ko: "일석이조",
    roman: "il-sseo-gi-jo",
    vi: "Một công đôi việc",
    note: "Thành ngữ Hán-Hàn 一石二鳥: nhất thạch nhị điểu. Biết âm Hán-Việt là đoán được nghĩa.",
  },
  {
    ko: "천 리 길도 한 걸음부터",
    roman: "cheol-li gil-do han geo-reum-bu-teo",
    vi: "Đường nghìn dặm bắt đầu từ một bước",
    note: "Tục ngữ khuyên bắt đầu từ việc nhỏ, như học mỗi ngày một chút.",
  },
] as const;

/** A thirty-second taste of a lesson right on the landing page: flip three cards, hear them, then
 * carry on into lesson 1. */
export function FlashcardDemo() {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [learned, setLearned] = useState<number[]>([]);
  const voice = useLandingVoice();
  const done = learned.length === DEMO_CARDS.length;
  const card = DEMO_CARDS[i] ?? DEMO_CARDS[0];

  const flip = () => {
    setFlipped((f) => !f);
    if (!flipped) {
      voice.speak(card.ko);
      setLearned((xs) => (xs.includes(i) ? xs : [...xs, i]));
    }
  };
  const next = () => {
    setFlipped(false);
    setI((n) => (n + 1) % DEMO_CARDS.length);
  };
  const restart = () => {
    setLearned([]);
    setFlipped(false);
    setI(0);
  };

  return (
    <div className="w-full max-w-[360px] rounded-[28px] border border-line bg-card p-4 shadow-elev-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-[12px] font-bold uppercase tracking-wide text-ink-2">
          Khởi động 10 giây
        </p>
        <div
          className="flex gap-1.5"
          aria-label={`Đã học ${learned.length}/${DEMO_CARDS.length} từ`}
        >
          {DEMO_CARDS.map((c, n) => (
            <span
              key={c.ko}
              className={cn(
                "h-2 w-6 rounded-full transition-colors",
                learned.includes(n) ? "bg-green" : "bg-progress",
              )}
            />
          ))}
        </div>
      </div>

      {done && !flipped ? (
        <div className="mt-3 flex min-h-[208px] flex-col items-center justify-center rounded-[22px] bg-green-soft px-4 text-center">
          <p className="text-[32px]" aria-hidden="true">
            🎉
          </p>
          <p className="mt-1 text-[18px] font-extrabold">Bạn vừa học 3 từ và cụm từ tiếng Hàn!</p>
          <p className="mt-1 text-[13px] font-medium text-ink-2">
            Các bài đầu có thêm từ vựng, ngữ pháp, luyện nói — miễn phí.
          </p>
          <button
            type="button"
            onClick={restart}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-blue-deep"
          >
            <RotateCcw size={14} aria-hidden="true" /> Xem lại
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={flip}
          aria-label={
            flipped ? `${card.ko}: ${card.vi}. Chạm để lật lại` : `${card.ko}. Chạm để xem nghĩa`
          }
          className="group mt-3 block w-full perspective-distant focus-visible:outline-none"
        >
          <div
            className={cn(
              "relative min-h-[208px] transition-transform duration-500 ease-spring transform-3d motion-reduce:transition-none",
              flipped && "rotate-y-180",
            )}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[22px] bg-blue-soft backface-hidden group-focus-visible:ring-2 group-focus-visible:ring-blue">
              <p
                className={cn(
                  "px-4 text-center font-korean font-bold text-blue-deep [word-break:keep-all]",
                  card.ko.length > 6 ? "text-[28px] leading-tight" : "text-[40px]",
                )}
              >
                {card.ko}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-ink-2">{card.roman}</p>
              <p className="mt-4 rounded-full bg-card px-3 py-1 text-[12px] font-bold text-ink-2 shadow-elev-1">
                Chạm để lật thẻ
              </p>
            </div>
            <div className="absolute inset-0 flex rotate-y-180 flex-col items-center justify-center rounded-[22px] bg-yellow-soft px-5 text-center backface-hidden">
              <p
                className={cn(
                  "font-extrabold",
                  card.vi.length > 18 ? "text-[22px] leading-tight" : "text-[30px]",
                )}
              >
                {card.vi}
              </p>
              <p className="mt-2 text-[13px] font-medium leading-5 text-ink-2">{card.note}</p>
            </div>
          </div>
        </button>
      )}

      <div className="mt-3 flex gap-2">
        {voice.ok && !(done && !flipped) && (
          <button
            type="button"
            onClick={() => voice.speak(card.ko)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] border-2 border-line px-4 text-[13px] font-bold text-blue-deep"
          >
            <Volume2 size={16} aria-hidden="true" /> Nghe
          </button>
        )}
        {done && !flipped ? (
          <Link
            to="/lesson"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-green px-4 text-[13px] font-bold uppercase tracking-wide text-primary-foreground"
          >
            Học các bài đầu <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={next}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-blue px-4 text-[13px] font-bold uppercase tracking-wide text-primary-foreground"
          >
            Từ tiếp theo <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

/** On phones, keeps the free-trial button within thumb reach once the hero's own button has
 * scrolled away, and steps aside when the closing call is on screen. */
export function StickyCta({
  hero,
  end,
}: {
  hero: RefObject<HTMLElement | null>;
  end: RefObject<HTMLElement | null>;
}) {
  const [heroGone, setHeroGone] = useState(false);
  const [endShown, setEndShown] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero.current)
          setHeroGone(!e.isIntersecting && e.boundingClientRect.top < 0);
        if (e.target === end.current) setEndShown(e.isIntersecting);
      }
    });
    if (hero.current) io.observe(hero.current);
    if (end.current) io.observe(end.current);
    return () => io.disconnect();
  }, [hero, end]);
  const shown = heroGone && !endShown;
  return (
    <div
      aria-hidden={!shown}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] backdrop-blur transition-[translate,opacity] duration-300 ease-spring sm:hidden",
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <Link
        to="/lesson"
        tabIndex={shown ? undefined : -1}
        className="flex min-h-[50px] items-center justify-center gap-2 rounded-[16px] bg-blue text-[15px] font-bold uppercase tracking-wide text-primary-foreground shadow-[0_4px_0_0_var(--color-blue-deep)]"
      >
        Học thử miễn phí <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </div>
  );
}
