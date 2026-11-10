import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, KeyRound, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  ADMIN_KEY,
  formatDateTime,
  ORDER_LABEL,
  ORDER_STATUSES,
  ORDER_TONE,
  type AdminSearch,
  type SetAdminSearch,
} from "@/components/admin/admin-kit";
import { Pill } from "@/components/admin/admin-ui";
import { ReconcileButton } from "@/components/admin/ReconcileButton";
import { useDebounced } from "@/components/admin/use-debounced";
import { BTN, BTN_SM } from "@/components/haru/studio-kit";
import {
  ConfirmDialog,
  Field,
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "@/components/haru/studio-ui";
import {
  getOrderPayments,
  grantAccess,
  listAdminOrders,
  markOrderReviewed,
  type OrderFilter,
} from "@/lib/api/admin";
import { errorMessage } from "@/lib/api/client";
import type { AdminOrderOut, OrderStatus } from "@/lib/api/types";
import { formatVnd } from "@/lib/billing";
import { cn } from "@/lib/utils";

const CHIPS: { id: string; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "review", label: "Cần xem" },
  ...(["PENDING", "UNDERPAID", "PAID", "EXPIRED", "CANCELLED"] as OrderStatus[]).map((s) => ({
    id: s,
    label: ORDER_LABEL[s],
  })),
];

function filterFor(f: string, email: string): OrderFilter {
  return {
    limit: 100,
    ...(email.trim() ? { email: email.trim() } : {}),
    ...(f === "review" ? { needs_review: true } : {}),
    ...((ORDER_STATUSES as string[]).includes(f) ? { status: f } : {}),
  };
}

function OrderCard({ order, onOpenLearner }: { order: AdminOrderOut; onOpenLearner: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const payments = useQuery({
    queryKey: [...ADMIN_KEY, "order-payments", order.id],
    queryFn: () => getOrderPayments(order.id),
    enabled: open,
  });
  const done = () => void qc.invalidateQueries({ queryKey: ADMIN_KEY });
  const reviewed = useMutation({
    mutationFn: () => markOrderReviewed(order.id, note.trim()),
    onSuccess: () => {
      toast.success("Đã bỏ khỏi hàng chờ xem");
      setNote("");
      done();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const unlock = useMutation({
    mutationFn: () =>
      grantAccess({
        profile_id: order.profile_id,
        product_code: order.product_code,
        order_id: order.id,
        note: `Cấp tay theo đơn ${order.order_code}`,
      }),
    onSuccess: () => {
      toast.success(`Đã mở khoá cho ${order.email}`);
      done();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <li className="glass-row rounded-[16px] px-3.5 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{order.product_title}</p>
          <button
            type="button"
            onClick={onOpenLearner}
            className="block max-w-full truncate text-left text-[12px] font-semibold text-blue-deep underline-offset-2 hover:underline"
          >
            {order.email}
          </button>
          <p className="mt-0.5 text-[12px] font-medium text-ink-2">
            {formatDateTime(order.created_at)} · mã {order.order_code}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Pill tone={ORDER_TONE[order.status]}>{ORDER_LABEL[order.status]}</Pill>
          {order.needs_review && <Pill tone="bad">Cần xem</Pill>}
          <span className="text-xs font-semibold tabular-nums">
            {formatVnd(order.paid_amount)}
            <span className="font-medium text-ink-2"> / {formatVnd(order.amount)}</span>
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-ink-2"
      >
        {open ? (
          <ChevronUp size={14} strokeWidth={2.4} />
        ) : (
          <ChevronDown size={14} strokeWidth={2.4} />
        )}
        {open ? "Ẩn chi tiết" : "Chi tiết và xử lý"}
      </button>

      {open && (
        <div className="mt-2 space-y-3 border-t border-glass-edge pt-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
            <dt className="font-semibold text-ink-2">Hết hạn</dt>
            <dd className="font-medium">{formatDateTime(order.expires_at)}</dd>
            <dt className="font-semibold text-ink-2">Trả lúc</dt>
            <dd className="font-medium">{formatDateTime(order.paid_at)}</dd>
            <dt className="font-semibold text-ink-2">Mã ngân hàng</dt>
            <dd className="break-all font-medium">{order.provider_ref ?? "—"}</dd>
          </dl>
          {order.note ? (
            <p className="whitespace-pre-wrap break-words rounded-[12px] bg-yellow-soft/60 px-3 py-2 text-[12px] font-medium leading-4">
              {order.note}
            </p>
          ) : null}

          <div>
            <p className="mb-1 text-[12px] font-semibold">Tiền payOS đã báo về</p>
            {payments.isLoading && <PanelLoading rows={1} label="Đang tải…" />}
            {payments.isError && (
              <PanelError
                message={errorMessage(payments.error)}
                onRetry={() => void payments.refetch()}
                retrying={payments.isRefetching}
              />
            )}
            {payments.data && payments.data.length === 0 && (
              <p className="text-[12px] font-medium text-ink-2">Chưa có khoản nào.</p>
            )}
            {payments.data && payments.data.length > 0 && (
              <ul className="space-y-1">
                {payments.data.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-[12px]">
                    <span className="min-w-0 flex-1 break-all font-medium text-ink-2">
                      {formatDateTime(p.created_at)} · {p.reference}
                    </span>
                    <Pill tone="info">{p.source}</Pill>
                    <span className="w-[72px] shrink-0 text-right font-semibold tabular-nums">
                      {formatVnd(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {order.needs_review && (
            <div className="space-y-2">
              <Field
                label="Ghi chú khi xem xong"
                maxLength={500}
                placeholder="Ghi chú (đã hoàn tiền dư…)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                type="button"
                className={cn(BTN.ok, BTN_SM)}
                disabled={reviewed.isPending}
                onClick={() => reviewed.mutate()}
              >
                Đã xem xong, bỏ khỏi hàng chờ
              </button>
              <p className="text-[12px] font-medium leading-4 text-ink-2">
                Việc này không mở khoá và không đụng tới tiền.
              </p>
            </div>
          )}

          {order.status !== "PAID" && (
            <div>
              <button
                type="button"
                className={cn(BTN.warn, BTN_SM)}
                disabled={unlock.isPending}
                onClick={() => setConfirming(true)}
              >
                <KeyRound size={13} strokeWidth={2.4} /> Mở khoá theo đơn này
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Mở khoá theo đơn này?"
        description={`Đơn sẽ được đánh dấu đã thanh toán và ${order.email} mở được “${order.product_title}”. Chỉ làm khi bạn đã thấy tiền về tài khoản ngân hàng. Làm nhầm thì thu hồi ở trang học viên.`}
        confirmLabel="Mở khoá"
        tone="warn"
        onConfirm={() => unlock.mutate()}
      />
    </li>
  );
}

export function OrdersTab({
  search,
  setSearch,
}: {
  search: AdminSearch;
  setSearch: SetAdminSearch;
}) {
  const [text, setText] = useState(search.q ?? "");
  const settled = useDebounced(text, 300);
  const f = search.f ?? "all";

  useEffect(() => {
    if ((search.q ?? "") !== settled.trim()) setSearch({ q: settled.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  const filter = filterFor(f, settled);
  const list = useQuery({
    queryKey: [...ADMIN_KEY, "orders", filter],
    queryFn: () => listAdminOrders(filter),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            strokeWidth={2.4}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-2"
          />
          <Field
            label="Lọc đơn theo email"
            type="search"
            placeholder="Lọc theo email…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="pl-10"
          />
        </div>
        <ReconcileButton />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Lọc đơn">
        {CHIPS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={f === x.id}
            onClick={() => setSearch({ f: x.id === "all" ? undefined : x.id })}
            className={cn(
              "hit-area shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue/50",
              f === x.id
                ? "border-transparent bg-blue text-primary-foreground"
                : "border-glass-edge bg-glass-row text-ink-2",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      {list.isLoading && <PanelLoading rows={4} label="Đang tải đơn hàng…" />}
      {list.isError && (
        <PanelError
          message={errorMessage(list.error)}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      )}
      {list.data && list.data.length === 0 && (
        <PanelEmpty
          title="Không có đơn nào"
          hint={
            f === "all" && !settled.trim()
              ? "Chưa ai tạo đơn. Khi bật thu phí, đơn sẽ hiện ở đây."
              : "Thử bỏ bộ lọc hoặc đổi email."
          }
        />
      )}
      {list.data && list.data.length > 0 && (
        <>
          <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0 2xl:grid-cols-3">
            {list.data.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onOpenLearner={() => setSearch({ learner: o.profile_id })}
              />
            ))}
          </ul>
          {list.data.length >= 100 && (
            <p className="text-center text-[12px] font-medium text-ink-2">
              Đang hiện 100 đơn mới nhất. Lọc theo email để thấy các đơn cũ hơn.
            </p>
          )}
        </>
      )}
    </div>
  );
}
