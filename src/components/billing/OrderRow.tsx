import type { BillingOrderOut, OrderStatus } from "@/lib/api/types";
import { formatVnd } from "@/lib/billing";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  EXPIRED: "Hết hạn",
  CANCELLED: "Đã huỷ",
  UNDERPAID: "Mới trả một phần",
  NEEDS_REVIEW: "Đang được kiểm tra",
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-soft text-ink",
  PAID: "bg-green-soft text-green",
  EXPIRED: "bg-progress text-ink-2",
  CANCELLED: "bg-progress text-ink-2",
  UNDERPAID: "bg-yellow-soft text-ink",
  NEEDS_REVIEW: "bg-yellow-soft text-ink",
};

export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("vi-VN");
};

const dateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

/** One order in a list: what, how much (with the discount), when, its state, and the way back in. */
export function OrderRow({
  order,
  onOpen,
  detailed = false,
}: {
  order: BillingOrderOut;
  onOpen: (id: string) => void;
  detailed?: boolean;
}) {
  const waiting = order.status === "PENDING" || order.status === "UNDERPAID";
  const canOpen = waiting || order.status === "NEEDS_REVIEW" || order.status === "EXPIRED";
  return (
    <li className="rounded-[14px] border border-line bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-snug">{order.product_title}</p>
          <p className="mt-0.5 text-[12px] font-medium text-ink-2">
            {formatVnd(order.amount)}
            {order.discount ? (
              <span className="text-green"> (đã giảm {formatVnd(order.discount)})</span>
            ) : null}{" "}
            · {detailed ? dateTime(order.created_at) : shortDate(order.created_at)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold",
            STATUS_TONE[order.status],
          )}
        >
          {STATUS_LABEL[order.status]}
        </span>
        {canOpen && (
          <button
            type="button"
            onClick={() => {
              tap();
              onOpen(order.id);
            }}
            className="hit-area shrink-0 rounded-[12px] border border-line bg-card px-3 py-2 text-xs font-semibold shadow-elev-1 active:scale-[0.97]"
          >
            {waiting ? "Tiếp tục" : "Xem"}
          </button>
        )}
      </div>
      {detailed && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-line pt-2 text-[11px] font-semibold text-ink-2">
          <dt>Mã đơn</dt>
          <dd className="text-right tabular-nums text-ink">{order.order_code}</dd>
          {order.list_amount != null && order.discount ? (
            <>
              <dt>Giá gói</dt>
              <dd className="text-right tabular-nums">{formatVnd(order.list_amount)}</dd>
              <dt>Mã giảm giá</dt>
              <dd className="text-right">{order.coupon_code}</dd>
            </>
          ) : null}
          {order.paid_at && (
            <>
              <dt>Thanh toán lúc</dt>
              <dd className="text-right">{dateTime(order.paid_at)}</dd>
            </>
          )}
          {order.status === "UNDERPAID" && (
            <>
              <dt>Đã nhận</dt>
              <dd className="text-right tabular-nums">{formatVnd(order.paid_amount)}</dd>
            </>
          )}
        </dl>
      )}
    </li>
  );
}
