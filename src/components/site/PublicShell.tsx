import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { SupportButton } from "@/components/billing/SupportButton";
import { HaruLogo } from "@/components/site/HaruLogo";
import { PolicyLinks } from "@/components/site/PolicyLinks";
import { useAuth } from "@/hooks/use-auth";
import { useCatalog } from "@/lib/billing";
import { cn } from "@/lib/utils";

/** The public pages (the landing page, the policies, contact): a site header, no tab bar, and a
 * footer with the policies and who runs Haru. */
export function PublicShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const auth = useAuth();
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between gap-3 px-5">
          <Link to="/" aria-label="Haru — trang chủ" className="flex items-center text-ink">
            <HaruLogo bold className="h-12 w-auto" />
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              to="/pricing"
              className="hidden px-2 text-[13px] font-semibold text-ink-2 hover:text-ink sm:block"
            >
              Bảng giá
            </Link>
            {auth.isAuthenticated ? (
              <Link
                to="/today"
                className="inline-flex min-h-9 items-center rounded-full bg-blue px-4 text-[13px] font-semibold text-primary-foreground shadow-elev-1"
              >
                Vào học
              </Link>
            ) : (
              <Link
                to="/support-language"
                className="inline-flex min-h-9 items-center rounded-full border border-line bg-card px-4 text-[13px] font-semibold shadow-elev-1"
              >
                Đăng nhập
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className={cn("mx-auto px-5 pb-16", wide ? "max-w-[1080px]" : "max-w-[720px]")}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  const { catalog } = useCatalog();
  const m = catalog?.merchant;
  return (
    <footer className="border-t border-line bg-card">
      <div className="mx-auto grid max-w-[1080px] gap-6 px-5 py-8 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <p className="flex items-center gap-3 text-[15px] font-bold">
            <HaruLogo bold className="h-14 w-auto" /> Học tiếng Hàn mỗi ngày
          </p>
          <PolicyLinks />
          <div className="space-y-0.5 text-[12px] font-medium leading-5 text-ink-2">
            <p>Đơn vị vận hành: {m?.name || "đang cập nhật"}</p>
            {m?.tax_id && <p>Mã số thuế / ĐKKD: {m.tax_id}</p>}
            {m?.address && <p>Địa chỉ: {m.address}</p>}
            {(m?.email || m?.phone) && (
              <p>Liên hệ: {[m?.email, m?.phone].filter(Boolean).join(" · ")}</p>
            )}
            <p>
              Thanh toán bằng quét mã QR · Haru không lưu thông tin thẻ hay tài khoản ngân hàng.
            </p>
          </div>
        </div>
        <div className="flex items-start sm:justify-end">
          <SupportButton />
        </div>
      </div>
    </footer>
  );
}
