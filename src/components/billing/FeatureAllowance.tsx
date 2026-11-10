import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { getMyEntitlements } from "@/lib/api/billing";
import type { FeatureKey } from "@/lib/api/types";
import { ENTITLEMENTS_KEY } from "@/lib/billing";
import { cn } from "@/lib/utils";

/** "Dùng thử: còn 4/5 phút (một lần cho mỗi tài khoản)": what is left of the one-time free trial
 * of an AI speaking feature, shown only while billing is on and the learner has no pass; with a
 * Haru Nói pass sold by the minute, the minutes left of it. */
export function FeatureAllowance({
  feature,
  className,
}: {
  feature: FeatureKey;
  className?: string;
}) {
  const auth = useAuth();
  const q = useQuery({
    queryKey: ENTITLEMENTS_KEY,
    queryFn: getMyEntitlements,
    enabled: auth.isAuthenticated,
    staleTime: 15_000,
  });
  const t = q.data?.features_trial?.[feature];
  const pass = q.data?.feature_pass;
  // a Haru Nói pass sold by the minute: the minutes left of it (Trò chuyện and Tranh luận share them)
  if (
    q.data?.billing_enabled &&
    feature !== "present" &&
    pass?.active &&
    pass.minutes_total != null &&
    pass.minutes_left != null
  ) {
    return (
      <p
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[14px] px-3 py-2 text-[12px] font-semibold",
          pass.minutes_left > 0 ? "bg-blue-soft text-blue-deep" : "bg-yellow-soft text-ink",
          className,
        )}
      >
        <Sparkles size={13} aria-hidden="true" />
        {pass.minutes_left > 0
          ? `Haru Nói: còn ${pass.minutes_left}/${pass.minutes_total} phút nói (chung cho Trò chuyện và Tranh luận)`
          : "Bạn đã dùng hết số phút của gói Haru Nói"}
        {pass.minutes_left <= 10 && (
          <Link to="/pricing" className="underline">
            Mua thêm phút
          </Link>
        )}
      </p>
    );
  }
  if (!q.data?.billing_enabled || !t || t.unlimited || t.left == null) return null;
  const left = t.left;
  const shared = feature !== "present";
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[14px] px-3 py-2 text-[12px] font-semibold",
        left > 0 ? "bg-blue-soft text-blue-deep" : "bg-yellow-soft text-ink",
        className,
      )}
    >
      <Sparkles size={13} aria-hidden="true" />
      {left > 0
        ? `Dùng thử miễn phí: còn ${left}/${t.total} ${t.unit}${shared ? " (chung cho Trò chuyện và Tranh luận)" : ""}, một lần cho mỗi tài khoản`
        : "Bạn đã dùng hết phần dùng thử miễn phí"}
      <Link to="/pricing" className="underline">
        Xem gói Haru Nói
      </Link>
    </p>
  );
}
