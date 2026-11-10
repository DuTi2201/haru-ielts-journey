import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Tags,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
  ADMIN_KEY,
  ADMIN_TABS,
  type AdminGo,
  type AdminSearch,
  type AdminTab,
  type SetAdminSearch,
} from "@/components/admin/admin-kit";
import { Pill } from "@/components/admin/admin-ui";
import { AbuseTab } from "@/components/admin/AbuseTab";
import { ClaimsTab } from "@/components/admin/ClaimsTab";
import { GrantForm } from "@/components/admin/GrantForm";
import { LearnerDialog } from "@/components/admin/LearnerDialog";
import { LearnersTab } from "@/components/admin/LearnersTab";
import { OrdersTab } from "@/components/admin/OrdersTab";
import { OverviewTab } from "@/components/admin/OverviewTab";
import { SalesTab } from "@/components/admin/SalesTab";
import { Mascot } from "@/components/mascot/Mascot";
import { LoadingBlocks } from "@/components/haru/states";
import { BTN } from "@/components/haru/studio-kit";
import { GlassPanel, PanelTitle } from "@/components/haru/studio-ui";
import { HaruLogo } from "@/components/site/HaruLogo";
import { useAuth } from "@/hooks/use-auth";
import * as authApi from "@/lib/api/auth";
import { getAdminOverview } from "@/lib/api/admin";
import { cn } from "@/lib/utils";

const text = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Quản trị — Haru" },
      { name: "description", content: "Quản lý tài khoản, học viên và thanh toán của Haru." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): AdminSearch => {
    const tab = ADMIN_TABS.find((t) => t.id === search["tab"])?.id ?? "overview";
    return {
      tab,
      learner: text(search["learner"]),
      q: text(search["q"]),
      f: text(search["f"]),
    };
  },
  component: AdminScreen,
});

function CenteredPanel({ children }: { children: ReactNode }) {
  return (
    <main className="mesh-backdrop mx-auto flex min-h-dvh max-w-[390px] flex-col justify-center px-5 text-ink">
      <div className="glass-card flex flex-col items-center gap-3 rounded-[28px] p-6 text-center">
        <Mascot mood="wave" className="h-16 w-16" />
        {children}
      </div>
    </main>
  );
}

function AdminScreen() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <main className="mesh-backdrop mx-auto min-h-dvh max-w-[390px] px-5 pt-24">
        <LoadingBlocks
          blocks={["h-40 rounded-[24px]", "h-24 rounded-[24px]"]}
          label="Đang kiểm tra đăng nhập…"
        />
      </main>
    );
  }
  if (!auth.isAuthenticated) {
    return (
      <CenteredPanel>
        <h1 className="text-lg font-bold">Cần đăng nhập</h1>
        <p className="text-xs font-medium leading-5 text-ink-2">
          Trang quản trị chỉ dành cho tài khoản admin. Đăng nhập ở mục Tài khoản rồi quay lại đây.
        </p>
        <Link to="/support-language" className={cn(BTN.primary, "w-full")}>
          Đến trang đăng nhập
        </Link>
      </CenteredPanel>
    );
  }
  if (auth.profile?.role !== "admin") {
    return (
      <CenteredPanel>
        <h1 className="text-lg font-bold">Không có quyền vào trang quản trị</h1>
        <p className="text-xs font-medium leading-5 text-ink-2">
          Tài khoản này có vai trò “{auth.profile?.role ?? "learner"}”. Trang này chỉ dành cho
          admin.
        </p>
        <div className="flex w-full gap-2">
          <Link to="/support-language" className={cn(BTN.primary, "flex-1")}>
            <ArrowLeft size={14} strokeWidth={2.4} /> Về ứng dụng
          </Link>
          {auth.profile?.role === "editor" && (
            <Link to="/studio" className={cn(BTN.soft, "flex-1")}>
              Vào Studio
            </Link>
          )}
        </div>
      </CenteredPanel>
    );
  }
  return <AdminDashboard />;
}

function AdminDashboard() {
  const auth = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin" });

  const setSearch: SetAdminSearch = (patch) => {
    void navigate({
      search: (prev) => ({ ...prev, ...patch }),
      // opening a learner's page is a step forward (Back closes it); typing / filtering is not
      replace: !("learner" in patch && patch.learner !== undefined),
    });
  };
  const go: AdminGo = (tab, opts) => {
    void navigate({ search: { tab, q: opts?.q, f: opts?.f, learner: undefined } });
  };

  // the same query the overview tab reads: the counts on the tabs cost nothing extra
  const overview = useQuery({
    queryKey: [...ADMIN_KEY, "overview"],
    queryFn: getAdminOverview,
    refetchInterval: 60_000,
  });
  const badge: Partial<Record<AdminTab, number>> = {
    orders: overview.data?.queue.needs_review ?? 0,
    claims: overview.data?.queue.open_claims ?? 0,
  };

  function logout() {
    authApi.logout();
    auth.refresh();
    toast("Đã đăng xuất");
  }

  const claimStatus = search.f === "resolved" || search.f === "rejected" ? search.f : "open";

  const TAB_ICON: Record<AdminTab, typeof LayoutDashboard> = {
    overview: LayoutDashboard,
    learners: Users,
    orders: Receipt,
    claims: LifeBuoy,
    grant: Gift,
    sales: Tags,
    abuse: ShieldAlert,
  };
  const current = ADMIN_TABS.find((t) => t.id === search.tab);

  return (
    <main className="mesh-backdrop min-h-dvh text-ink lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      {/* laptop: a sidebar that stays put; phone: the bar on top */}
      <aside
        aria-label="Điều hướng quản trị"
        className="glass-panel sticky top-0 hidden h-dvh flex-col gap-1 rounded-none border-r border-line/60 px-3 py-4 lg:flex"
      >
        <div className="mb-3 flex items-center gap-2 px-2">
          <HaruLogo bold className="h-11 w-auto" />
          <div>
            <p className="text-[15px] font-bold leading-5">Quản trị</p>
            <p className="text-[11px] font-semibold text-ink-2">{auth.profile?.email}</p>
          </div>
        </div>
        <div
          role="tablist"
          aria-label="Các mục quản trị"
          aria-orientation="vertical"
          className="flex flex-col gap-0.5"
        >
          {ADMIN_TABS.map((t) => {
            const Icon = TAB_ICON[t.id];
            const active = search.tab === t.id;
            const n = badge[t.id] ?? 0;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={active}
                aria-controls="admin-panel"
                onClick={() => go(t.id)}
                className={cn(
                  "flex min-h-10 items-center gap-2.5 rounded-[12px] px-3 text-left text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue/50",
                  active
                    ? "bg-blue text-primary-foreground shadow-elev-1"
                    : "text-ink-2 hover:bg-glass-row hover:text-ink",
                )}
              >
                <Icon size={16} strokeWidth={2.3} aria-hidden="true" />
                <span className="flex-1">{t.label}</span>
                {n > 0 && (
                  <span className="rounded-full bg-danger px-1.5 text-[11px] font-semibold leading-4 text-primary-foreground">
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-auto flex flex-col gap-0.5 border-t border-line/60 pt-3">
          <Link
            to="/support-language"
            className="flex min-h-9 items-center gap-2.5 rounded-[12px] px-3 text-[13px] font-semibold text-ink-2 hover:bg-glass-row"
          >
            <ArrowLeft size={15} strokeWidth={2.4} /> Về ứng dụng
          </Link>
          <Link
            to="/studio"
            className="flex min-h-9 items-center gap-2.5 rounded-[12px] px-3 text-[13px] font-semibold text-ink-2 hover:bg-glass-row"
          >
            <ShieldCheck size={15} strokeWidth={2.4} /> Studio
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex min-h-9 items-center gap-2.5 rounded-[12px] px-3 text-left text-[13px] font-semibold text-ink-2 hover:bg-glass-row"
          >
            <LogOut size={15} strokeWidth={2.4} /> Đăng xuất
          </button>
        </div>
      </aside>

      <div className="mx-auto w-full max-w-[760px] px-5 pb-24 pt-[max(16px,env(safe-area-inset-top))] lg:max-w-[1320px] lg:px-8 lg:pt-6">
        <nav
          aria-label="Điều hướng quản trị"
          className="glass-panel sticky top-[max(8px,env(safe-area-inset-top))] z-30 -mx-1 mb-4 rounded-[22px] px-3 py-2 lg:hidden"
        >
          <div className="flex items-center justify-between gap-2">
            <Link
              to="/support-language"
              className="hit-area flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-2"
            >
              <ArrowLeft size={15} strokeWidth={2.4} /> Về ứng dụng
            </Link>
            <Link
              to="/studio"
              className="hit-area flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-2"
            >
              <ShieldCheck size={15} strokeWidth={2.4} /> Studio
            </Link>
            <span className="shrink-0 rounded-full bg-yellow-soft px-2 py-0.5 text-[11px] font-semibold text-ink">
              Admin
            </span>
            <button
              type="button"
              onClick={logout}
              className="hit-area flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-2"
            >
              <LogOut size={15} strokeWidth={2.4} /> Đăng xuất
            </button>
          </div>
          <div
            role="tablist"
            aria-label="Các mục quản trị"
            className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5"
          >
            {ADMIN_TABS.map((t) => {
              const active = search.tab === t.id;
              const n = badge[t.id] ?? 0;
              return (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  id={`admin-tab-${t.id}`}
                  aria-selected={active}
                  aria-controls="admin-panel"
                  onClick={() => go(t.id)}
                  className={cn(
                    "hit-area inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue/50",
                    active
                      ? "border-transparent bg-blue text-primary-foreground"
                      : "border-glass-edge bg-glass-row text-ink-2",
                  )}
                >
                  {t.label}
                  {n > 0 && (
                    <span className="rounded-full bg-danger px-1.5 text-[11px] font-semibold leading-4 text-primary-foreground">
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <header className="flex items-center gap-3 px-1">
          <HaruLogo bold className="h-12 w-auto lg:hidden" />
          <div>
            <h1 className="text-xl font-bold lg:text-2xl">
              <span className="lg:hidden">Quản trị</span>
              <span className="hidden lg:inline">{current?.label ?? "Quản trị"}</span>
            </h1>
            <p className="text-xs font-medium text-ink-2">
              Tài khoản, học viên và thanh toán của Haru.
            </p>
          </div>
        </header>

        <div
          id="admin-panel"
          role="tabpanel"
          aria-labelledby={`admin-tab-${search.tab}`}
          className="mt-5"
        >
          {search.tab === "overview" && <OverviewTab go={go} />}
          {search.tab === "sales" && <SalesTab />}
          {search.tab === "abuse" && <AbuseTab setSearch={setSearch} />}
          {search.tab === "learners" && <LearnersTab search={search} setSearch={setSearch} />}
          {search.tab === "orders" && <OrdersTab search={search} setSearch={setSearch} />}
          {search.tab === "claims" && (
            <ClaimsTab status={claimStatus} setSearch={setSearch} go={go} />
          )}
          {search.tab === "grant" && (
            <GlassPanel className="lg:max-w-[720px]">
              <PanelTitle>Cấp quyền cho một học viên</PanelTitle>
              <p className="mb-3 mt-1 text-xs font-medium leading-5 text-ink-2">
                Dùng khi tặng bài, nhận thiếu tiền, bù cho lỗi thanh toán hoặc cho dùng thử. Mỗi lần
                cấp đều ghi lại ai cấp và vì sao; thu hồi ở trang của học viên.
              </p>
              <GrantForm onGranted={(row) => setSearch({ learner: row.profile_id })} />
            </GlassPanel>
          )}
        </div>

        {search.learner && (
          <LearnerDialog
            id={search.learner}
            go={go}
            onClose={() => setSearch({ learner: undefined })}
          />
        )}
      </div>
    </main>
  );
}
