import { useQuery } from "@tanstack/react-query";
import { CircleAlert, CircleCheck } from "lucide-react";

import { ADMIN_KEY, type AdminGo } from "@/components/admin/admin-kit";
import { Pill, StatTile } from "@/components/admin/admin-ui";
import { ReconcileButton } from "@/components/admin/ReconcileButton";
import { MerchantPanel } from "@/components/admin/MerchantPanel";
import { SupportPanel } from "@/components/admin/SupportPanel";
import { GlassPanel, PanelError, PanelLoading, PanelTitle } from "@/components/haru/studio-ui";
import { getAdminOverview } from "@/lib/api/admin";
import { errorMessage } from "@/lib/api/client";
import { formatVnd } from "@/lib/billing";

/** People, money and what is waiting for the admin, on one screen. */
export function OverviewTab({ go }: { go: AdminGo }) {
  const overview = useQuery({
    queryKey: [...ADMIN_KEY, "overview"],
    queryFn: getAdminOverview,
    refetchInterval: 60_000,
  });

  if (overview.isLoading) return <PanelLoading rows={3} label="Đang tải tổng quan…" />;
  if (overview.isError || !overview.data) {
    return (
      <PanelError
        message={errorMessage(overview.error)}
        onRetry={() => void overview.refetch()}
        retrying={overview.isRefetching}
      />
    );
  }
  const d = overview.data;
  const waiting = d.queue.open_claims + d.queue.needs_review;

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      <GlassPanel className="lg:col-span-2">
        <PanelTitle
          icon={
            d.billing_enabled ? (
              <CircleCheck size={16} className="text-green" />
            ) : (
              <CircleAlert size={16} className="text-ink-2" />
            )
          }
          aside={<ReconcileButton disabled={!d.billing_configured} />}
        >
          Thu phí: {d.billing_enabled ? "đang bật" : "chưa bật"}
        </PanelTitle>
        <p className="mt-2 text-xs font-medium leading-5 text-ink-2">
          {d.billing_enabled
            ? "Bài từ số 9 trở đi cần mở khoá. "
            : "Mọi bài đều đang mở cho mọi người (biến BILLING_ENABLED trên máy chủ đang tắt). "}
          {d.billing_configured
            ? "payOS đã được cấu hình."
            : "payOS chưa được cấu hình nên chưa tạo được đơn."}
        </p>
      </GlassPanel>

      <GlassPanel>
        <PanelTitle
          aside={
            waiting > 0 ? (
              <Pill tone="bad">{waiting} việc chờ bạn</Pill>
            ) : (
              <Pill tone="ok">Không có việc chờ</Pill>
            )
          }
        >
          Việc cần xử lý
        </PanelTitle>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatTile
            label="Yêu cầu “đã thanh toán nhưng chưa mở”"
            value={d.queue.open_claims}
            tone={d.queue.open_claims > 0 ? "alert" : undefined}
            onClick={() => go("claims")}
          />
          <StatTile
            label="Đơn cần xem (dư, thiếu, nạp muộn)"
            value={d.queue.needs_review}
            tone={d.queue.needs_review > 0 ? "alert" : undefined}
            onClick={() => go("orders", { f: "review" })}
          />
          <StatTile
            label="Trả thiếu tiền"
            value={d.queue.underpaid}
            onClick={() => go("orders", { f: "UNDERPAID" })}
          />
          <StatTile
            label="Chờ thanh toán"
            value={d.queue.waiting_orders}
            onClick={() => go("orders", { f: "PENDING" })}
          />
        </div>
      </GlassPanel>

      <GlassPanel>
        <PanelTitle>Học viên</PanelTitle>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatTile
            label="Tổng tài khoản"
            value={d.learners.total}
            hint={`${d.learners.learner} học viên · ${d.learners.editor} biên tập · ${d.learners.admin} admin`}
            onClick={() => go("learners")}
          />
          <StatTile
            label="Đăng ký mới 7 ngày"
            value={d.learners.new_7d}
            hint={`${d.learners.new_30d} trong 30 ngày`}
          />
          <StatTile
            label="Có học trong 7 ngày"
            value={d.learners.active_7d}
            hint={`${d.learners.active_30d} trong 30 ngày`}
          />
          <StatTile
            label="Đã trả phí"
            value={d.learners.paying}
            onClick={() => go("learners", { f: "paying" })}
          />
          {(d.learners.locked ?? 0) > 0 && (
            <StatTile
              label="Đang bị khoá"
              value={d.learners.locked}
              onClick={() => go("learners", { f: "locked" })}
            />
          )}
        </div>
      </GlassPanel>

      <GlassPanel>
        <PanelTitle>Tiền đã thu</PanelTitle>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          <StatTile
            label="Tổng"
            className="col-span-2 md:col-span-1"
            value={formatVnd(d.money.paid_total)}
            hint={`${d.money.paid_orders} đơn`}
          />
          <StatTile label="30 ngày" value={formatVnd(d.money.paid_30d)} />
          <StatTile label="7 ngày" value={formatVnd(d.money.paid_7d)} />
        </div>
        {d.money.by_product.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {d.money.by_product.map((p) => (
              <li
                key={p.product_code}
                className="glass-row flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-semibold">{p.title}</span>
                <span className="shrink-0 font-medium text-ink-2">{p.orders} đơn</span>
                <span className="w-[84px] shrink-0 text-right font-semibold tabular-nums">
                  {formatVnd(p.revenue)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs font-medium text-ink-2">Chưa có đơn nào được thanh toán.</p>
        )}
        <p className="mt-3 text-[12px] font-medium leading-4 text-ink-2">
          Số tiền là tiền payOS báo đã nhận trên các đơn “Đã thanh toán”. Đơn bạn cấp tay không có
          tiền thì tính 0đ.
        </p>
      </GlassPanel>

      <SupportPanel />
      <MerchantPanel />
    </div>
  );
}
