import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LogIn, Receipt } from "lucide-react";

import { OrderRow } from "@/components/billing/OrderRow";
import { PayDialog } from "@/components/billing/PayDialog";
import { SupportButton } from "@/components/billing/SupportButton";
import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { Shell } from "@/components/lesson/LessonShell";
import { PolicyLinks } from "@/components/site/PolicyLinks";
import { useAuth } from "@/hooks/use-auth";
import { listOrders } from "@/lib/api/billing";
import { errorMessage } from "@/lib/api/client";
import { ORDERS_KEY, useCatalog } from "@/lib/billing";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Đơn hàng của tôi — Haru" }] }),
  component: Orders,
});

function Orders() {
  const auth = useAuth();
  const { catalog } = useCatalog();
  const orders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: listOrders,
    enabled: auth.isAuthenticated,
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const list = orders.data ?? [];
  const paidTotal = list.filter((o) => o.status === "PAID").reduce((n, o) => n + o.amount, 0);

  return (
    <Shell>
      <header>
        <Link to="/pricing" className="text-[13px] font-semibold text-blue-deep">
          ← Bảng giá
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold leading-tight">
          <Receipt size={22} strokeWidth={2.2} aria-hidden="true" className="text-blue" /> Đơn hàng
          của tôi
        </h1>
        <p className="mt-1 text-xs font-medium leading-5 text-ink-2">
          Mọi đơn bạn đã tạo. Đơn chờ thanh toán mở lại được; đơn đã hết hạn mà bạn đã chuyển tiền
          thì bấm “Xem” → “Tôi đã thanh toán nhưng chưa mở khoá”.
        </p>
      </header>

      {!auth.isLoading && !auth.isAuthenticated && (
        <Link
          to="/support-language"
          className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-blue py-2.5 text-sm font-semibold text-primary-foreground shadow-elev-1"
        >
          <LogIn size={16} aria-hidden="true" /> Đăng nhập để xem đơn hàng
        </Link>
      )}
      {orders.isLoading && <LoadingBlocks className="mt-6" blocks={["h-16", "h-16", "h-16"]} />}
      {orders.isError && (
        <ErrorState
          className="mt-6"
          title="Không tải được đơn hàng."
          message={errorMessage(orders.error)}
          onRetry={() => void orders.refetch()}
        />
      )}
      {orders.data && list.length === 0 && (
        <p className="mt-6 rounded-[18px] border border-dashed border-line p-5 text-center text-[13px] font-semibold text-ink-2">
          Bạn chưa có đơn hàng nào.{" "}
          <Link to="/pricing" className="text-blue-deep underline">
            Xem các gói
          </Link>
        </p>
      )}
      {list.length > 0 && (
        <>
          <p className="mt-5 text-[12px] font-semibold text-ink-2">
            {list.length} đơn · đã thanh toán tổng cộng {paidTotal.toLocaleString("vi-VN")}đ
          </p>
          <ul className="mt-2 space-y-2">
            {list.map((o) => (
              <OrderRow key={o.id} order={o} onOpen={setOpenId} detailed />
            ))}
          </ul>
        </>
      )}

      <div className="mt-8 space-y-3 border-t border-line pt-5">
        <SupportButton label="Cần hỗ trợ về đơn hàng?" />
        <PolicyLinks />
      </div>

      <PayDialog
        open={openId !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        resumeOrderId={openId}
        supportUrl={catalog?.support_url}
      />
    </Shell>
  );
}
