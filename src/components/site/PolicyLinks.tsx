import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

export const POLICY_LINKS = [
  { to: "/pricing", label: "Bảng giá" },
  { to: "/terms", label: "Điều khoản sử dụng" },
  { to: "/refund", label: "Chính sách hoàn tiền" },
  { to: "/privacy", label: "Chính sách bảo mật" },
  { to: "/contact", label: "Liên hệ & hỗ trợ" },
] as const;

/** The policy links every page that sells should show (buyers and payment gateways look for them). */
export function PolicyLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Chính sách" className={cn("flex flex-wrap gap-x-4 gap-y-1.5", className)}>
      {POLICY_LINKS.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className="text-[12px] font-semibold text-ink-2 hover:text-blue-deep"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
