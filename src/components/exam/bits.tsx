import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BookMarked,
  Check,
  ChevronDown,
  Languages,
  Lightbulb,
  Sparkles,
  Target,
} from "lucide-react";

import { Ko, Rich } from "@/components/lesson/Rich";
import { fetchExamImage } from "@/lib/api/real-exam";
import type { RxCardOut, RxFitOut, RxGuideOut, RxPointOut, RxResult } from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export const MARKS = ["①", "②", "③", "④"] as const;

export const TIER_NAME: Record<number, string> = {
  1: "Bậc 1 · ăn chắc",
  2: "Bậc 2 · trung bình",
  3: "Bậc 3 · thử thách",
};

const TIER_HINT: Record<number, string> = {
  1: "Những câu không được phép mất điểm.",
  2: "Câu giữa đề: cần hiểu chắc ngữ pháp và từ.",
  3: "Câu khó, dành khi bậc dưới đã vững.",
};

export function tierHint(tier: number): string {
  return TIER_HINT[tier] ?? "";
}

/** The paper prints `«…»` where the exam underlines a phrase. */
export function ExamText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(«[^»]*»)/);
  return (
    <span lang="ko" className={cn("font-korean", className)}>
      {parts.map((part, i) =>
        part.startsWith("«") && part.endsWith("»") ? (
          <u key={i} className="underline decoration-2 underline-offset-4">
            {part.slice(1, -1)}
          </u>
        ) : (
          part
        ),
      )}
    </span>
  );
}

export function TierChip({ tier }: { tier: number }) {
  return (
    <span
      title={tierHint(tier)}
      className={cn(
        "inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-[12px] font-semibold",
        tier === 1 ? "bg-green-soft" : tier === 2 ? "bg-yellow-soft" : "bg-purple-soft",
      )}
    >
      {TIER_NAME[tier] ?? `Bậc ${tier}`}
    </span>
  );
}

export function FitChip({ fit }: { fit: RxFitOut }) {
  const text =
    fit.status === "ready"
      ? fit.new > 0
        ? `Dùng điều bạn đã học · ${fit.new} điểm mới`
        : "Dùng đúng điều bạn đã học"
      : fit.status === "stretch"
        ? `${fit.upcoming} điểm ở bài chưa học — vẫn làm được, có gợi ý`
        : `${fit.upcoming} điểm ở bài chưa học — nên để sau`;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-[12px] font-semibold",
        fit.status === "ready" ? "bg-blue-soft" : "bg-card",
      )}
    >
      {text}
    </span>
  );
}

export const RESULT_TEXT: Record<RxResult, string> = {
  solid: "Vững — làm không cần gợi ý",
  aided: "Đúng, nhờ gợi ý",
  wrong: "Chưa đúng",
  pending: "Chờ bạn tự chấm",
};

export function ResultChip({ result, className }: { result: RxResult; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-[12px] font-semibold",
        result === "solid"
          ? "bg-green-soft"
          : result === "aided"
            ? "bg-yellow-soft"
            : result === "wrong"
              ? "bg-danger-soft"
              : "bg-card",
        className,
      )}
    >
      {RESULT_TEXT[result]}
    </span>
  );
}

export function Meter({
  value,
  total,
  label,
  tone = "green",
}: {
  value: number;
  total: number;
  label: string;
  tone?: "green" | "blue";
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      className="h-1.5 overflow-hidden rounded-full bg-progress"
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none",
          tone === "green" ? "bg-green" : "bg-blue",
        )}
        style={{ width: `${total ? (value ? Math.max((value / total) * 100, 4) : 0) : 0}%` }}
      />
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-2">{children}</h3>;
}

/** What a question type asks, three steps to do it, the traps and what it is for. */
export function GuideCard({
  guide,
  defaultOpen = false,
}: {
  guide: RxGuideOut;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-[16px] border border-transparent bg-purple-soft shadow-elev-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          tap();
          setOpen((v) => !v);
        }}
        className="hit-area flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Target size={16} strokeWidth={2.4} className="shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-sm font-semibold">
          Cách làm dạng này
          <span className="block text-[12px] font-semibold text-ink-2">{guide.name_vi}</span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2.6}
          aria-hidden="true"
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-dashed border-line px-3 pb-3 pt-2.5">
          <p className="text-xs font-semibold leading-5">
            <Rich text={guide.asks_vi} />
          </p>
          <div>
            <SectionTitle>3 bước</SectionTitle>
            <ol className="mt-1 space-y-1">
              {guide.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs font-semibold leading-5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-card text-[12px] font-semibold">
                    {i + 1}
                  </span>
                  <Rich text={s} />
                </li>
              ))}
            </ol>
          </div>
          <div>
            <SectionTitle>Bẫy hay gặp</SectionTitle>
            <ul className="mt-1 space-y-1">
              {guide.traps.map((s, i) => (
                <li key={i} className="flex gap-1.5 text-xs font-semibold leading-5">
                  <AlertTriangle
                    size={13}
                    strokeWidth={2.4}
                    className="mt-1 shrink-0"
                    aria-hidden="true"
                  />
                  <Rich text={s} />
                </li>
              ))}
            </ul>
          </div>
          <p className="flex gap-1.5 text-xs font-semibold leading-5">
            <Lightbulb size={13} strokeWidth={2.4} className="mt-1 shrink-0" aria-hidden="true" />
            <Rich text={guide.tips.join(" ")} />
          </p>
          <p className="rounded-[12px] bg-card px-2.5 py-1.5 text-[12px] font-semibold leading-4">
            Bạn nhận được: <Rich text={guide.gain_vi} />
          </p>
        </div>
      )}
    </section>
  );
}

const STATUS_TEXT = {
  known: "Đã học",
  upcoming: "Sắp học",
  new: "Mới",
} as const;

function CardLink({ card, className }: { card: RxCardOut; className?: string }) {
  return (
    <Link
      to="/lesson/$id"
      params={{ id: String(card.lesson_id) }}
      onClick={() => tap()}
      className={cn(
        "inline-flex min-h-8 items-center gap-1 rounded-full border border-line bg-card px-2.5 py-1 text-[12px] font-semibold leading-4 active:scale-95",
        className,
      )}
    >
      <BookMarked size={11} strokeWidth={2.6} aria-hidden="true" />
      {card.lesson_title ?? `Bài ${card.lesson_id}`}
    </Link>
  );
}

/** The patterns and words a question rests on, each with where the lessons teach it. */
export function PointList({ points, emptyHint }: { points: RxPointOut[]; emptyHint?: string }) {
  if (points.length === 0) {
    return emptyHint ? <p className="text-xs font-semibold text-ink-2">{emptyHint}</p> : null;
  }
  return (
    <ul className="space-y-2">
      {points.map((p) => (
        <li
          key={`${p.kind}:${p.ko}`}
          className="rounded-[14px] border border-line bg-card px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold",
                p.kind === "grammar" ? "bg-purple-soft" : "bg-blue-soft",
              )}
            >
              {p.kind === "grammar" ? "Ngữ pháp" : "Từ"}
            </span>
            <Ko className="text-sm font-semibold">{p.ko}</Ko>
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                p.status === "known"
                  ? "bg-green-soft"
                  : p.status === "upcoming"
                    ? "bg-yellow-soft"
                    : "bg-danger-soft",
              )}
            >
              {p.status === "known" && <Check size={10} strokeWidth={3} aria-hidden="true" />}
              {p.status === "new" && <Sparkles size={10} strokeWidth={2.8} aria-hidden="true" />}
              {STATUS_TEXT[p.status]}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold leading-5 text-ink-2">
            <Rich text={p.vi} />
          </p>
          {p.cards.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-ink-2">
                {p.status === "known" ? "Ôn lại ở" : "Học ở"}
              </span>
              {p.cards.slice(0, 2).map((c) => (
                <CardLink key={`${c.kind}:${c.id}`} card={c} />
              ))}
              {p.cards.some((c) => !c.exact) && (
                <span className="text-[11px] font-semibold text-ink-2">(mẫu gần giống)</span>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function CardList({ cards }: { cards: RxCardOut[] }) {
  return (
    <ul className="space-y-1.5">
      {cards.map((c) => (
        <li
          key={`${c.kind}:${c.id}`}
          className="rounded-[12px] border border-line bg-card px-3 py-2"
        >
          <Ko className="text-sm font-semibold">{c.label}</Ko>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-ink-2">{c.meaning_vi}</p>
          <div className="mt-1.5">
            <CardLink card={c} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** An exam picture, fetched with the login token (the files sit behind login). */
export function ExamImage({ path, alt }: { path: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    setSrc(null);
    setFailed(false);
    fetchExamImage(path)
      .then((u) => {
        if (live) {
          url = u;
          setSrc(u);
        } else {
          URL.revokeObjectURL(u);
        }
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  if (failed) {
    return (
      <p role="alert" className="rounded-[12px] bg-danger-soft px-3 py-2 text-xs font-semibold">
        Không tải được hình của câu này. Thử đăng nhập lại.
      </p>
    );
  }
  if (!src) return <div aria-hidden="true" className="shimmer h-40 rounded-[14px]" />;
  return (
    <img
      src={src}
      alt={alt}
      className="w-full rounded-[14px] border border-line bg-white object-contain"
    />
  );
}

export function TranslateNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 flex gap-1.5 text-xs font-semibold leading-5 text-ink-2">
      <Languages size={13} strokeWidth={2.4} className="mt-1 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** The same idea for a question seen from a list (no counts, only the verdict). */
export function FitWord({ fit }: { fit: "ready" | "stretch" | "later" }) {
  return (
    <span className="text-[11px] font-semibold text-ink-2">
      {fit === "ready"
        ? "Hợp với bài đã học"
        : fit === "stretch"
          ? "Có 1–2 điểm chưa học"
          : "Nhiều điểm chưa học"}
    </span>
  );
}

export const STATUS_WORD: Record<"new" | "solid" | "aided" | "wrong", string> = {
  new: "Chưa làm",
  solid: "Vững",
  aided: "Nhờ gợi ý",
  wrong: "Cần làm lại",
};

export function StatusChip({ status }: { status: "new" | "solid" | "aided" | "wrong" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold",
        status === "solid"
          ? "bg-green-soft"
          : status === "aided"
            ? "bg-yellow-soft"
            : status === "wrong"
              ? "bg-danger-soft"
              : "bg-card",
      )}
    >
      {STATUS_WORD[status]}
    </span>
  );
}
