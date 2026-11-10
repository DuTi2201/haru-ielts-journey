import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { ADMIN_KEY } from "@/components/admin/admin-kit";
import { BTN, BTN_SM } from "@/components/haru/studio-kit";
import { reconcileNow } from "@/lib/api/admin";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/** Asks payOS now about every unpaid order of the last 24 hours (the server does it every 5 minutes
 * by itself; this is for "the learner is waiting and I do not want to wait"). */
export function ReconcileButton({ disabled = false }: { disabled?: boolean }) {
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: reconcileNow,
    onSuccess: (r) => {
      toast.success(
        `Đã hỏi payOS ${r.checked} đơn, mở khoá ${r.unlocked}${r.failed ? `, lỗi ${r.failed}` : ""}`,
      );
      void qc.invalidateQueries({ queryKey: ADMIN_KEY });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <button
      type="button"
      className={cn(BTN.soft, BTN_SM)}
      disabled={disabled || run.isPending}
      onClick={() => run.mutate()}
      title={disabled ? "payOS chưa được cấu hình trên máy chủ" : undefined}
    >
      <RefreshCw size={13} strokeWidth={2.4} className={run.isPending ? "animate-spin" : ""} />
      Hỏi payOS ngay
    </button>
  );
}
