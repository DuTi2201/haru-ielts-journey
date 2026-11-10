import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { LogIn, Lock } from "lucide-react";

import { PayDialog } from "@/components/billing/PayDialog";
import { useAuth } from "@/hooks/use-auth";
import type { BillingProductOut } from "@/lib/api/types";
import { formatVnd, productsFor, useCatalog } from "@/lib/billing";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

/** One product the learner can buy: what it opens, its price, and the button to pay. */
export function ProductRow({
  product,
  onBuy,
  disabled,
  owned,
  badge,
}: {
  product: BillingProductOut;
  onBuy: (p: BillingProductOut) => void;
  disabled?: boolean | undefined;
  owned?: boolean | undefined;
  /** A word that makes this the one to pick ("Lợi nhất"). */
  badge?: string | undefined;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-[16px] border bg-card p-3 shadow-elev-1",
        badge && !owned ? "border-2 border-blue" : "border-line",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold leading-snug">
          {product.title_vi}
          {badge && !owned && (
            <span className="rounded-full bg-blue px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
              {badge}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[12px] font-medium leading-4 text-ink-2">{product.blurb_vi}</p>
        {!owned && product.compare_at && product.compare_at > product.amount && (
          <p className="mt-1 text-[11px] font-semibold text-green">
            <span className="text-ink-2 line-through">{formatVnd(product.compare_at)}</span> · tiết
            kiệm {Math.round((1 - product.amount / product.compare_at) * 100)}%
          </p>
        )}
      </div>
      {owned ? (
        <span className="shrink-0 rounded-full bg-green-soft px-3 py-1 text-[12px] font-semibold text-green">
          Đã mở
        </span>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            tap();
            onBuy(product);
          }}
          className="hit-area shrink-0 rounded-[12px] border border-transparent bg-blue px-3 py-2 text-xs font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-60"
        >
          {formatVnd(product.amount)}
        </button>
      )}
    </li>
  );
}

/**
 * "This needs a purchase": the products that open it, with the pay button. Used where a locked
 * lesson, the exam practice or a 402 answer stops the learner. `unlockWith` is the list the server
 * gave (cheapest first); for an exam pass without one, every pass is offered.
 */
export function UnlockPanel({
  unlockWith,
  needs,
  className,
}: {
  unlockWith?: readonly string[] | null | undefined;
  needs?: "lesson_pack" | "exam_pass" | "feature_pass" | null | undefined;
  className?: string;
}) {
  const auth = useAuth();
  const { catalog, isLoading } = useCatalog();
  const [buying, setBuying] = useState<BillingProductOut | null>(null);

  const offered = !catalog
    ? []
    : unlockWith && unlockWith.length > 0
      ? productsFor(catalog, unlockWith)
      : needs === "exam_pass" || needs === "feature_pass"
        ? catalog.products.filter((p) => p.kind === needs)
        : [];

  if (isLoading) {
    return <div aria-hidden="true" className={cn("shimmer h-24 rounded-[18px]", className)} />;
  }

  return (
    <section
      aria-label="Mở khoá"
      className={cn("rounded-[20px] border border-transparent bg-yellow-soft p-4", className)}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Lock size={16} strokeWidth={2.4} aria-hidden="true" /> Phần này cần mở khoá
      </h2>
      {offered.length > 0 && (
        <ul className="mt-3 space-y-2">
          {offered.map((p) => (
            <ProductRow
              key={p.code}
              product={p}
              onBuy={setBuying}
              disabled={!auth.isAuthenticated || !catalog?.purchasable}
            />
          ))}
        </ul>
      )}
      {!auth.isLoading && !auth.isAuthenticated && (
        <Link
          to="/support-language"
          className="hit-area mt-3 flex min-h-10 items-center justify-center gap-1.5 rounded-[14px] border border-line bg-card px-4 text-xs font-semibold shadow-elev-1"
        >
          <LogIn size={14} strokeWidth={2.4} aria-hidden="true" /> Đăng nhập để mua
        </Link>
      )}
      {catalog && !catalog.purchasable && (
        <p className="mt-3 text-xs font-semibold leading-5">
          Thanh toán chưa sẵn sàng. Bạn quay lại sau nhé
          {catalog.support_url ? (
            <>
              {" "}
              hoặc{" "}
              <a
                href={catalog.support_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-deep underline"
              >
                nhắn hỗ trợ
              </a>
            </>
          ) : null}
          .
        </p>
      )}
      <Link
        to="/pricing"
        onClick={() => tap()}
        className="hit-area mt-3 inline-flex min-h-9 items-center text-xs font-semibold text-blue-deep underline"
      >
        Xem tất cả gói
      </Link>
      <PayDialog
        open={buying !== null}
        onOpenChange={(o) => {
          if (!o) setBuying(null);
        }}
        product={buying}
        supportUrl={catalog?.support_url}
      />
    </section>
  );
}
