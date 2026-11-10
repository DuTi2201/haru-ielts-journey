import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  ADMIN_KEY,
  ago,
  formatDateTime,
  type AdminGo,
  type SetAdminSearch,
} from "@/components/admin/admin-kit";
import { Pill } from "@/components/admin/admin-ui";
import { BTN, BTN_SM } from "@/components/haru/studio-kit";
import { Field, PanelEmpty, PanelError, PanelLoading } from "@/components/haru/studio-ui";
import { listAdminClaims, resolveClaim } from "@/lib/api/admin";
import { errorMessage } from "@/lib/api/client";
import type { AdminClaimOut } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type ClaimStatus = "open" | "resolved" | "rejected";
const CHIPS: { id: ClaimStatus; label: string }[] = [
  { id: "open", label: "Chờ xử lý" },
  { id: "resolved", label: "Đã xử lý" },
  { id: "rejected", label: "Đã từ chối" },
];

function ClaimCard({
  claim,
  onOpenLearner,
  go,
}: {
  claim: AdminClaimOut;
  onOpenLearner: () => void;
  go: AdminGo;
}) {
  const qc = useQueryClient();
  const [answer, setAnswer] = useState("");
  const settle = useMutation({
    mutationFn: (status: "resolved" | "rejected") => resolveClaim(claim.id, status, answer.trim()),
    onSuccess: (_row, status) => {
      toast.success(status === "resolved" ? "Đã đánh dấu xử lý xong" : "Đã từ chối yêu cầu");
      void qc.invalidateQueries({ queryKey: ADMIN_KEY });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <li className="glass-row rounded-[16px] px-3.5 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenLearner}
            className="block max-w-full truncate text-left text-[13px] font-semibold text-blue-deep underline-offset-2 hover:underline"
          >
            {claim.email}
          </button>
          <p className="text-[12px] font-medium text-ink-2">
            {ago(claim.created_at)} · {formatDateTime(claim.created_at)}
          </p>
        </div>
        <Pill tone={claim.status === "open" ? "bad" : claim.status === "resolved" ? "ok" : "mute"}>
          {claim.status === "open"
            ? "Chờ xử lý"
            : claim.status === "resolved"
              ? "Đã xử lý"
              : "Từ chối"}
        </Pill>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-xs font-medium leading-5">
        {claim.note}
      </p>
      {claim.bank_ref ? (
        <p className="mt-1 break-all text-[12px] font-medium text-ink-2">
          Mã giao dịch học viên ghi: {claim.bank_ref}
        </p>
      ) : null}
      {claim.resolution ? (
        <p className="mt-1 text-[12px] font-medium text-ink-2">Phản hồi: {claim.resolution}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(BTN.soft, BTN_SM)}
          onClick={() => go("orders", { q: claim.email })}
        >
          Xem đơn của học viên
        </button>
      </div>

      {claim.status === "open" && (
        <div className="mt-3 space-y-2 border-t border-glass-edge pt-3">
          <Field
            label="Phản hồi cho học viên"
            maxLength={500}
            placeholder="Phản hồi (đã mở khoá, chưa thấy tiền…)"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(BTN.ok, BTN_SM, "flex-1")}
              disabled={settle.isPending}
              onClick={() => settle.mutate("resolved")}
            >
              Đã xử lý
            </button>
            <button
              type="button"
              className={cn(BTN.soft, BTN_SM, "flex-1")}
              disabled={settle.isPending}
              onClick={() => settle.mutate("rejected")}
            >
              Từ chối
            </button>
          </div>
          <p className="text-[12px] font-medium leading-4 text-ink-2">
            Các nút này chỉ đóng yêu cầu. Muốn mở khoá thì vào “Xem đơn của học viên” hoặc tab Cấp
            quyền.
          </p>
        </div>
      )}
    </li>
  );
}

export function ClaimsTab({
  status,
  setSearch,
  go,
}: {
  status: ClaimStatus;
  setSearch: SetAdminSearch;
  go: AdminGo;
}) {
  const list = useQuery({
    queryKey: [...ADMIN_KEY, "claims", status],
    queryFn: () => listAdminClaims(status),
    refetchInterval: 30_000,
  });
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Lọc yêu cầu">
        {CHIPS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={status === x.id}
            onClick={() => setSearch({ f: x.id === "open" ? undefined : x.id })}
            className={cn(
              "hit-area shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue/50",
              status === x.id
                ? "border-transparent bg-blue text-primary-foreground"
                : "border-glass-edge bg-glass-row text-ink-2",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      {list.isLoading && <PanelLoading rows={3} label="Đang tải yêu cầu…" />}
      {list.isError && (
        <PanelError
          message={errorMessage(list.error)}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      )}
      {list.data && list.data.length === 0 && (
        <PanelEmpty
          title={
            status === "open" ? "Không có yêu cầu nào đang chờ" : "Chưa có yêu cầu nào ở nhóm này"
          }
          {...(status === "open"
            ? {
                hint: "Khi học viên bấm “Tôi đã thanh toán nhưng chưa mở khoá” mà hệ thống chưa tìm thấy tiền, yêu cầu sẽ hiện ở đây.",
              }
            : {})}
        />
      )}
      {list.data && list.data.length > 0 && (
        <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
          {list.data.map((c) => (
            <ClaimCard
              key={c.id}
              claim={c}
              onOpenLearner={() => setSearch({ learner: c.profile_id })}
              go={go}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
