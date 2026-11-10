import type {
  AdminAccessOut,
  AdminEntitlementOut,
  BillingCatalogOut,
  OrderStatus,
  Role,
} from "@/lib/api/types";

/* Small pieces shared by the admin tabs: dates, labels, pills, number tiles. */

/** Every admin query key starts with this, so one invalidate refreshes the whole page. */
export const ADMIN_KEY = ["admin"] as const;

export type AdminTab = "overview" | "learners" | "orders" | "claims" | "grant" | "sales" | "abuse";
/** What the address of the admin page holds: which tab, the learner whose page is open, a search text
 * and a filter name (each tab knows its own filter names). Kept in the address so a view can be
 * linked to and the Back button closes a learner's page instead of leaving /admin. */
export interface AdminSearch {
  tab: AdminTab;
  learner?: string | undefined;
  q?: string | undefined;
  f?: string | undefined;
}
/** Change the address of the page (a tab, a learner, the search text, the filter). */
export type SetAdminSearch = (patch: Partial<AdminSearch>) => void;
/** Jump to a tab, optionally with a search text / filter already set. */
export type AdminGo = (tab: AdminTab, opts?: { q?: string; f?: string }) => void;

export const ADMIN_TABS: readonly { id: AdminTab; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "learners", label: "Học viên" },
  { id: "orders", label: "Đơn hàng" },
  { id: "claims", label: "Yêu cầu" },
  { id: "grant", label: "Cấp quyền" },
  { id: "sales", label: "Giá & mã giảm" },
  { id: "abuse", label: "Chống lạm dụng" },
];

const pad = (n: number) => String(n).padStart(2, "0");

function parse(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 15/10/2026 */
export function formatDate(iso?: string | null): string {
  const d = parse(iso);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "—";
}

/** 15/10/2026 14:05 */
export function formatDateTime(iso?: string | null): string {
  const d = parse(iso);
  return d ? `${formatDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : "—";
}

/** "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước", then the date. */
export function ago(iso?: string | null, now: number = Date.now()): string {
  const d = parse(iso);
  if (!d) return "chưa có";
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86_400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 30 * 86_400) return `${Math.floor(s / 86_400)} ngày trước`;
  return formatDate(iso);
}

export const ORDER_LABEL: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  EXPIRED: "Hết hạn",
  CANCELLED: "Đã huỷ",
  UNDERPAID: "Trả thiếu",
  NEEDS_REVIEW: "Cần xem",
};

export const ORDER_STATUSES = Object.keys(ORDER_LABEL) as OrderStatus[];

export const ORDER_TONE: Record<OrderStatus, PillTone> = {
  PENDING: "warn",
  PAID: "ok",
  EXPIRED: "mute",
  CANCELLED: "mute",
  UNDERPAID: "warn",
  NEEDS_REVIEW: "bad",
};

export const ROLE_LABEL: Record<Role, string> = {
  learner: "Học viên",
  editor: "Biên tập viên",
  admin: "Admin",
};

export type PillTone = "ok" | "warn" | "bad" | "mute" | "info";
export const PILL: Record<PillTone, string> = {
  ok: "bg-green-soft text-green",
  warn: "bg-yellow-soft text-ink",
  bad: "bg-danger-soft text-danger",
  mute: "bg-progress text-ink-2",
  info: "bg-blue-soft text-blue-deep",
};

/** The name of a product code ("all" is the admin's gift of everything). */
export function productName(catalog: BillingCatalogOut | null, code: string): string {
  if (code === "all") return "Toàn quyền";
  return catalog?.products.find((p) => p.code === code)?.title_vi ?? code;
}

/** One short line for a list row: what this account can open. */
export function accessBrief(access: AdminAccessOut): string {
  if (access.staff) return "Toàn quyền (vai trò)";
  if (access.everything) return "Toàn quyền (được cấp)";
  const parts: string[] = [];
  if (access.lesson_packs.length) parts.push(`${access.lesson_packs.length} gói bài`);
  if (access.exam_pass) {
    parts.push(
      access.exam_pass_until
        ? `Pass luyện thi đến ${formatDate(access.exam_pass_until)}`
        : "Pass luyện thi",
    );
  }
  return parts.length ? parts.join(" · ") : "Chỉ bài miễn phí";
}

export type EntitlementState = "active" | "revoked" | "expired" | "future";

export function entitlementState(
  e: AdminEntitlementOut,
  now: number = Date.now(),
): EntitlementState {
  if (e.revoked_at) return "revoked";
  const start = parse(e.starts_at);
  if (start && start.getTime() > now) return "future";
  const end = parse(e.ends_at);
  if (end && end.getTime() <= now) return "expired";
  return "active";
}

export const ENTITLEMENT_LABEL: Record<EntitlementState, string> = {
  active: "Đang hiệu lực",
  revoked: "Đã thu hồi",
  expired: "Hết hạn",
  future: "Chưa bắt đầu",
};
export const ENTITLEMENT_TONE: Record<EntitlementState, PillTone> = {
  active: "ok",
  revoked: "bad",
  expired: "mute",
  future: "info",
};

export const SOURCE_LABEL: Record<string, string> = {
  order: "Mua qua payOS",
  admin: "Admin cấp",
  grandfather: "Tài khoản cũ",
  voucher: "Mã quà tặng",
};
