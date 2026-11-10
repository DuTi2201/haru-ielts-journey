import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  LifeBuoy,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  TicketPercent,
} from "lucide-react";
import { toast } from "sonner";

import { QrCode } from "@/components/billing/QrCode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cancelOrder, createClaim, createOrder, getOrder, getQuote } from "@/lib/api/billing";
import { errorMessage } from "@/lib/api/client";
import type { BillingOrderOut, BillingProductOut } from "@/lib/api/types";
import { bankName, formatVnd, ORDERS_KEY, refreshAfterPurchase, timeLeft } from "@/lib/billing";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const POLL_MS = 3000;

const primaryButton =
  "hit-area inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[14px] border border-transparent bg-blue px-4 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-60";
const quietButton =
  "hit-area inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[14px] border border-line bg-card px-3 text-xs font-semibold shadow-elev-1 active:scale-[0.97] disabled:opacity-60";

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Đã chép ${what}`);
  } catch {
    toast.error("Không chép được, hãy chọn và chép thủ công.");
  }
}

function Row({
  label,
  value,
  copyText,
  strong,
}: {
  label: string;
  value: string;
  copyText?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-ink-2">{label}</p>
        <p
          className={cn(
            "break-all text-[13px] leading-5",
            strong ? "font-semibold" : "font-semibold",
          )}
        >
          {value}
        </p>
      </div>
      {copyText !== undefined && (
        <button
          type="button"
          onClick={() => void copy(copyText, label.toLowerCase())}
          className="hit-area flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card active:scale-[0.97]"
          aria-label={`Chép ${label.toLowerCase()}`}
        >
          <Copy size={14} strokeWidth={2.4} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** "Tôi đã thanh toán nhưng chưa mở khoá": the server looks at payOS again first; only if the
 * money is still not found does it keep a note for the owner. */
function ClaimForm({
  order,
  onUnlocked,
  supportUrl,
}: {
  order: BillingOrderOut;
  onUnlocked: () => void;
  supportUrl?: string | null | undefined;
}) {
  const [note, setNote] = useState("");
  const [bankRef, setBankRef] = useState("");
  const claim = useMutation({
    mutationFn: () =>
      createClaim({
        order_id: order.id,
        note: note.trim(),
        ...(bankRef.trim() ? { bank_ref: bankRef.trim() } : {}),
      }),
    onSuccess: (res) => {
      if (res.unlocked) onUnlocked();
    },
  });

  if (claim.data && !claim.data.unlocked) {
    const support = claim.data.support_url ?? supportUrl;
    return (
      <div className="rounded-[14px] border border-transparent bg-yellow-soft p-3 text-xs font-semibold leading-5">
        <p>
          Chưa thấy khoản tiền của đơn này. Mình đã ghi nhận yêu cầu của bạn và sẽ kiểm tra thủ
          công, bài học sẽ được mở ngay khi xác nhận được.
        </p>
        {support && (
          <a
            href={support}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-semibold text-blue-deep underline"
          >
            <LifeBuoy size={13} strokeWidth={2.4} aria-hidden="true" /> Nhắn hỗ trợ
          </a>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-2 rounded-[14px] border border-line bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (note.trim()) claim.mutate();
      }}
    >
      <label htmlFor="claim-note" className="block text-xs font-semibold">
        Bạn đã chuyển khoản thế nào?
      </label>
      <Textarea
        id="claim-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        required
        placeholder="Ví dụ: chuyển lúc 21:05 từ app Vietcombank, số tiền 29.000đ"
        className="min-h-[72px] rounded-[12px] border border-line bg-paper text-xs font-semibold"
      />
      <input
        value={bankRef}
        onChange={(e) => setBankRef(e.target.value)}
        maxLength={80}
        placeholder="Mã giao dịch ngân hàng (nếu có)"
        aria-label="Mã giao dịch ngân hàng"
        className="w-full rounded-[12px] border border-line bg-paper px-3 py-2 text-xs font-semibold"
      />
      {claim.isError && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {errorMessage(claim.error)}
        </p>
      )}
      <button type="submit" disabled={claim.isPending || !note.trim()} className={primaryButton}>
        {claim.isPending ? "Đang kiểm tra lại…" : "Kiểm tra lại và gửi yêu cầu"}
      </button>
    </form>
  );
}

function Waiting({
  order,
  supportUrl,
}: {
  order: BillingOrderOut;
  supportUrl?: string | null | undefined;
}) {
  const queryClient = useQueryClient();
  const now = useNow(true);
  const left = timeLeft(order.expires_at, now);
  const [claiming, setClaiming] = useState(false);
  const cancel = useMutation({
    mutationFn: () => cancelOrder(order.id),
    onSuccess: (o) => {
      queryClient.setQueryData(["billing", "order", o.id], o);
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
  const t = order.transfer;
  const bank = bankName(t?.bank_bin);

  return (
    <div className="space-y-3">
      {t?.qr_code && (
        <div className="mx-auto w-full max-w-[220px]">
          <QrCode value={t.qr_code} label={`Mã QR thanh toán ${formatVnd(order.amount)}`} />
        </div>
      )}
      <p className="text-center text-xs font-semibold leading-5 text-ink-2">
        Mở app ngân hàng, chọn quét mã QR. Nếu đang dùng điện thoại này, bấm “Mở trang thanh toán”.
      </p>

      <div className="divide-y divide-line rounded-[14px] border border-line bg-card px-3">
        {bank && <Row label="Ngân hàng" value={bank} />}
        {t?.account_number && (
          <Row label="Số tài khoản" value={t.account_number} copyText={t.account_number} />
        )}
        {t?.account_name && <Row label="Chủ tài khoản" value={t.account_name} />}
        <Row
          label="Số tiền"
          value={formatVnd(order.amount)}
          copyText={String(order.amount)}
          strong
        />
        {t?.description && <Row label="Nội dung" value={t.description} copyText={t.description} />}
      </div>
      <p className="text-xs font-semibold leading-5 text-danger">
        Giữ nguyên số tiền và nội dung chuyển khoản. Sửa nội dung thì hệ thống không nhận ra khoản
        tiền.
      </p>

      {order.checkout_url && (
        <a
          href={order.checkout_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => tap()}
          className={primaryButton}
        >
          <ExternalLink size={15} strokeWidth={2.4} aria-hidden="true" /> Mở trang thanh toán
        </a>
      )}

      <p
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-deep"
      >
        <LoaderCircle
          size={14}
          strokeWidth={2.6}
          className="animate-spin motion-reduce:animate-none"
        />
        Đang chờ thanh toán{left ? ` · còn ${left}` : ""}
      </p>
      {order.status === "UNDERPAID" && (
        <p className="rounded-[12px] bg-yellow-soft px-3 py-2 text-xs font-semibold leading-5">
          {order.message_vi}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate()}
          className={quietButton}
        >
          Huỷ đơn
        </button>
        <button type="button" onClick={() => setClaiming((v) => !v)} className={quietButton}>
          Tôi đã thanh toán nhưng chưa mở khoá
        </button>
      </div>
      {cancel.isError && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {errorMessage(cancel.error)}
        </p>
      )}
      {claiming && (
        <ClaimForm
          order={order}
          supportUrl={supportUrl}
          onUnlocked={() => {
            refreshAfterPurchase(queryClient);
            toast.success("Đã tìm thấy khoản thanh toán, bài học đã được mở khoá.");
          }}
        />
      )}
    </div>
  );
}

/**
 * The paying screen. `product` starts a new order (the server returns the one already waiting if
 * there is one); `resumeOrderId` reopens an existing one (the page payOS sends the learner back to).
 * The order is polled until it is paid, expired or cancelled; the server also asks payOS, so a slow
 * webhook does not leave the learner looking at a QR for money that already arrived.
 */
/** What the product gives, in one line ("Dùng mãi", "30 ngày, không tự gia hạn"). */
export function productTerm(p: BillingProductOut): string {
  if (p.kind === "lesson_pack") return "Mua một lần, dùng mãi";
  if (p.kind === "combo")
    return "Bài học dùng mãi; các pass tính ngày từ khi thanh toán (cộng nối nếu đang còn hạn), không tự gia hạn";
  return `${p.days ?? 30} ngày kể từ khi thanh toán (cộng nối nếu đang còn hạn), không tự gia hạn`;
}

/** Step one: the order summary — price, discount code, total — and the consent, before any order
 * exists. The server prices it (POST /billing/quote); nothing here decides an amount. */
function Checkout({
  product,
  onConfirm,
  supportUrl,
}: {
  product: BillingProductOut;
  onConfirm: (couponCode: string | null) => void;
  supportUrl?: string | null | undefined;
}) {
  const [typed, setTyped] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const quote = useQuery({
    queryKey: ["billing", "quote", product.code, applied],
    queryFn: () => getQuote(product.code, applied),
    staleTime: 0,
  });
  const q = quote.data;
  const couponOk = !!q?.coupon_code && !q.coupon_error_vi;
  const total = q?.total ?? product.amount;
  const was = product.compare_at && product.compare_at > (q?.list_amount ?? product.amount);

  return (
    <div className="space-y-3">
      <div className="rounded-[16px] border border-line bg-card p-3.5">
        <p className="text-[13px] font-semibold leading-snug">{product.title_vi}</p>
        <p className="mt-0.5 text-[12px] font-medium leading-4 text-ink-2">{product.blurb_vi}</p>
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-ink-2">
          <ShieldCheck size={12} strokeWidth={2.4} aria-hidden="true" /> {productTerm(product)}
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(typed.trim() || null);
        }}
      >
        <label className="sr-only" htmlFor="coupon">
          Mã giảm giá
        </label>
        <div className="relative min-w-0 flex-1">
          <TicketPercent
            size={15}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-2"
          />
          <input
            id="coupon"
            value={typed}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            maxLength={32}
            placeholder="Mã giảm giá"
            autoComplete="off"
            className="min-h-10 w-full rounded-[12px] border border-line bg-card pl-8 pr-3 text-sm font-semibold uppercase placeholder:normal-case placeholder:font-medium placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-blue"
          />
        </div>
        <button
          type="submit"
          disabled={!typed.trim() || quote.isFetching}
          className="hit-area min-h-10 rounded-[12px] border border-line bg-card px-3.5 text-xs font-semibold shadow-elev-1 disabled:opacity-50"
        >
          Áp dụng
        </button>
      </form>
      {q?.coupon_error_vi && (
        <p role="alert" className="text-[12px] font-semibold text-danger">
          {q.coupon_error_vi}
        </p>
      )}

      <dl className="space-y-1.5 rounded-[16px] bg-fill p-3.5 text-[13px] font-semibold">
        <div className="flex justify-between">
          <dt className="text-ink-2">Giá gói</dt>
          <dd className="tabular-nums">
            {was && (
              <span className="mr-1.5 text-ink-2 line-through">
                {formatVnd(product.compare_at!)}
              </span>
            )}
            {formatVnd(q?.list_amount ?? product.amount)}
          </dd>
        </div>
        {couponOk && (
          <div className="flex justify-between text-green">
            <dt>
              {q!.coupon_label_vi} ({q!.coupon_code})
            </dt>
            <dd className="tabular-nums">−{formatVnd(q!.discount)}</dd>
          </div>
        )}
        {!!q?.credit && (
          <div className="flex justify-between text-green">
            <dt>Trừ gói bạn đã mua</dt>
            <dd className="tabular-nums">−{formatVnd(q.credit)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-1.5 text-[15px]">
          <dt>Tổng thanh toán</dt>
          <dd className="tabular-nums">
            {quote.isLoading ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              formatVnd(total)
            )}
          </dd>
        </div>
      </dl>

      {quote.isError && (
        <p role="alert" className="text-[12px] font-semibold text-danger">
          {errorMessage(quote.error)}
        </p>
      )}
      {q?.owned ? (
        <p className="rounded-[12px] bg-green-soft px-3 py-2 text-[13px] font-semibold text-green">
          Bạn đã có gói này rồi.
        </p>
      ) : (
        <>
          <label className="flex items-start gap-2.5 text-[12px] font-semibold leading-5">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-blue)]"
            />
            <span>
              Tôi đã đọc và đồng ý{" "}
              <a href="/terms" target="_blank" rel="noopener" className="text-blue-deep underline">
                Điều khoản sử dụng
              </a>{" "}
              và{" "}
              <a href="/refund" target="_blank" rel="noopener" className="text-blue-deep underline">
                Chính sách hoàn tiền
              </a>
              .
            </span>
          </label>
          <button
            type="button"
            disabled={!agreed || !q || !q.purchasable || quote.isFetching}
            onClick={() => {
              tap();
              onConfirm(couponOk ? q!.coupon_code! : null);
            }}
            className={primaryButton}
          >
            Thanh toán {formatVnd(total)}
          </button>
          {q && !q.purchasable && (
            <p className="text-[12px] font-semibold text-ink-2">
              Thanh toán chưa sẵn sàng, bạn quay lại sau nhé.
            </p>
          )}
          <p className="text-[11px] font-medium leading-4 text-ink-2">
            Bước tiếp theo: quét mã QR để chuyển khoản. Gói mở ngay khi tiền về, không lưu thông tin
            thẻ hay tài khoản của bạn.
          </p>
        </>
      )}
      {supportUrl && (
        <a
          href={supportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-blue-deep"
        >
          <LifeBuoy size={14} aria-hidden="true" /> Cần hỗ trợ? Nhắn cho Haru
        </a>
      )}
    </div>
  );
}

export function PayDialog({
  open,
  onOpenChange,
  product,
  resumeOrderId,
  supportUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: BillingProductOut | null | undefined;
  resumeOrderId?: string | null | undefined;
  supportUrl?: string | null | undefined;
}) {
  const queryClient = useQueryClient();
  const [orderId, setOrderId] = useState<string | null>(null);
  // a new purchase first shows the summary (Checkout); the order is made only on "Thanh toán"
  const [coupon, setCoupon] = useState<string | null | undefined>(undefined);
  const started = useRef<string | null>(null);

  const create = useMutation({
    mutationFn: ({ code, couponCode }: { code: string; couponCode: string | null }) =>
      createOrder(code, couponCode),
    onSuccess: (o) => {
      queryClient.setQueryData(["billing", "order", o.id], o);
      setOrderId(o.id);
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });

  // one order per opening: closing the dialog forgets it (a waiting order is found again by the server)
  useEffect(() => {
    if (!open) {
      started.current = null;
      setOrderId(null);
      setCoupon(undefined);
      create.reset();
      return;
    }
    if (resumeOrderId) {
      setOrderId(resumeOrderId);
      return;
    }
    if (product && coupon !== undefined && started.current !== product.code) {
      started.current = product.code;
      create.mutate({ code: product.code, couponCode: coupon });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.code, resumeOrderId, coupon]);

  const order = useQuery({
    queryKey: ["billing", "order", orderId],
    queryFn: () => getOrder(orderId!),
    enabled: open && orderId !== null,
    refetchInterval: (q) =>
      q.state.data?.status === "PENDING" || q.state.data?.status === "UNDERPAID" ? POLL_MS : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const data = order.data;
  const paidNotified = useRef<string | null>(null);
  useEffect(() => {
    if (data?.status === "PAID" && paidNotified.current !== data.id) {
      paidNotified.current = data.id;
      refreshAfterPurchase(queryClient);
    }
  }, [data?.status, data?.id, queryClient]);

  const title = data?.product_title ?? product?.title_vi ?? "Thanh toán";
  const retry = () => {
    started.current = null;
    setOrderId(null);
    create.reset();
    if (product) {
      started.current = product.code;
      create.mutate({ code: product.code, couponCode: coupon ?? null });
    }
  };
  const confirming = !!product && !resumeOrderId && coupon === undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-[400px] overflow-y-auto rounded-[20px] border border-line bg-paper p-5 text-ink shadow-elev-2">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="text-base font-semibold leading-snug">
            {confirming ? "Xác nhận thanh toán" : title}
          </DialogTitle>
          <DialogDescription className="text-xs font-semibold text-ink-2">
            {confirming
              ? "Kiểm tra đơn hàng trước khi chuyển khoản."
              : `${data ? formatVnd(data.amount) : product ? formatVnd(product.amount) : ""} · chuyển khoản qua mã QR, mở khoá ngay khi tiền về.`}
          </DialogDescription>
        </DialogHeader>

        {confirming && product && (
          <Checkout product={product} supportUrl={supportUrl} onConfirm={(c) => setCoupon(c)} />
        )}

        {create.isError && (
          <div role="alert" className="space-y-2">
            <p className="text-sm font-semibold text-danger">{errorMessage(create.error)}</p>
            <button type="button" onClick={retry} className={primaryButton}>
              <RefreshCw size={14} strokeWidth={2.4} aria-hidden="true" /> Thử lại
            </button>
          </div>
        )}

        {!confirming && !create.isError && !data && (
          <p
            role="status"
            className="flex items-center justify-center gap-2 py-8 text-xs font-semibold text-ink-2"
          >
            <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" />
            {order.isError ? errorMessage(order.error) : "Đang tạo đơn…"}
          </p>
        )}

        {data?.status === "PAID" && (
          <div className="space-y-3 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-transparent bg-green-soft text-green">
              <Check size={28} strokeWidth={3} aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold">{data.message_vi}</p>
            <button type="button" onClick={() => onOpenChange(false)} className={primaryButton}>
              Học ngay
            </button>
          </div>
        )}

        {data && (data.status === "PENDING" || data.status === "UNDERPAID") && (
          <Waiting order={data} supportUrl={supportUrl} />
        )}

        {data && (data.status === "EXPIRED" || data.status === "CANCELLED") && (
          <div className="space-y-3">
            <p className="text-sm font-semibold leading-6">{data.message_vi}</p>
            {product && (
              <button type="button" onClick={retry} className={primaryButton}>
                Tạo đơn mới
              </button>
            )}
            {data.status === "EXPIRED" && (
              <ClaimForm
                order={data}
                supportUrl={supportUrl}
                onUnlocked={() => refreshAfterPurchase(queryClient)}
              />
            )}
          </div>
        )}

        {data?.status === "NEEDS_REVIEW" && (
          <p className="rounded-[12px] bg-yellow-soft px-3 py-2 text-sm font-semibold leading-6">
            {data.message_vi}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
