import { apiFetch } from "./client";
import type {
  AbuseCluster,
  AbuseGuard,
  AbuseOverview,
  AdminClaimOut,
  AdminEntitlementOut,
  AdminGrantIn,
  AdminLearnerDetail,
  AdminLearnerPage,
  AdminLearnerRow,
  AdminOrderOut,
  AdminOverview,
  AdminPaymentEvent,
  AdminReconcileOut,
  AdminTemporaryPassword,
  LockManyOut,
  Role,
} from "./types";

/** Admin only (the server answers 403 to anyone else). Paths: app/api/routers/admin_accounts.py
 * for people, billing.py (/admin/billing) for money. */

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const getAdminOverview = () => apiFetch<AdminOverview>("/api/v1/admin/overview");

export interface LearnerFilter {
  q?: string;
  role?: Role;
  /** true: has a paid order; false: has none. */
  paying?: boolean;
  /** true: only locked accounts. */
  locked?: boolean;
  limit?: number;
  offset?: number;
}
export const listAdminLearners = (f: LearnerFilter) =>
  apiFetch<AdminLearnerPage>(`/api/v1/admin/learners${qs({ ...f })}`);

export const getAdminLearner = (id: string) =>
  apiFetch<AdminLearnerDetail>(`/api/v1/admin/learners/${encodeURIComponent(id)}`);

export const setLearnerRole = (id: string, role: Role) =>
  apiFetch<AdminLearnerRow>(`/api/v1/admin/learners/${encodeURIComponent(id)}/role`, {
    method: "POST",
    json: { role },
  });

/** Lock: the account cannot log in and every session it holds ends now; nothing is deleted. */
export const lockLearner = (id: string, reason?: string) =>
  apiFetch<AdminLearnerRow>(`/api/v1/admin/learners/${encodeURIComponent(id)}/lock`, {
    method: "POST",
    json: { reason: reason?.trim() || null },
  });

export const unlockLearner = (id: string) =>
  apiFetch<AdminLearnerRow>(`/api/v1/admin/learners/${encodeURIComponent(id)}/unlock`, {
    method: "POST",
  });

/** A new temporary password for a learner who forgot theirs (72 h; they must change it). Answered once. */
export const resetLearnerPassword = (id: string) =>
  apiFetch<AdminTemporaryPassword>(
    `/api/v1/admin/learners/${encodeURIComponent(id)}/reset-password`,
    { method: "POST" },
  );

export interface OrderFilter {
  status?: string;
  needs_review?: boolean;
  email?: string;
  limit?: number;
}
export const listAdminOrders = (f: OrderFilter) =>
  apiFetch<AdminOrderOut[]>(`/api/v1/admin/billing/orders${qs({ ...f })}`);

export const getOrderPayments = (orderId: string) =>
  apiFetch<AdminPaymentEvent[]>(
    `/api/v1/admin/billing/orders/${encodeURIComponent(orderId)}/events`,
  );

/** "I looked at it": takes the order off the review queue; opens nothing. */
export const markOrderReviewed = (orderId: string, note?: string) =>
  apiFetch<AdminOrderOut>(
    `/api/v1/admin/billing/orders/${encodeURIComponent(orderId)}/review-done`,
    { method: "POST", json: { note: note || null } },
  );

export const listAdminClaims = (status: "open" | "resolved" | "rejected") =>
  apiFetch<AdminClaimOut[]>(`/api/v1/admin/billing/claims${qs({ status })}`);

export const resolveClaim = (id: string, status: "resolved" | "rejected", resolution?: string) =>
  apiFetch<AdminClaimOut>(`/api/v1/admin/billing/claims/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
    json: { status, resolution: resolution || null },
  });

/** Gives a right by hand, with a trace (who, why). With `order_id` the order is closed as paid. */
export const grantAccess = (body: AdminGrantIn) =>
  apiFetch<AdminEntitlementOut>("/api/v1/admin/billing/grants", { method: "POST", json: body });

export const revokeEntitlement = (id: string) =>
  apiFetch<AdminEntitlementOut>(
    `/api/v1/admin/billing/entitlements/${encodeURIComponent(id)}/revoke`,
    { method: "POST" },
  );

/** Asks payOS now about every unpaid order of the last 24 h (the server also does it every 5 min). */
export const reconcileNow = () =>
  apiFetch<AdminReconcileOut>("/api/v1/admin/billing/reconcile", { method: "POST" });

/* ------------------------------------------------ anti-abuse (app/api/routers/admin_abuse.py) */

export const getAbuseOverview = () => apiFetch<AbuseOverview>("/api/v1/admin/abuse");

export const setAbuseGuard = (body: Partial<AbuseGuard>) =>
  apiFetch<AbuseGuard>("/api/v1/admin/abuse/guard", { method: "PUT", json: body });

export const getAbuseClusters = (opts: {
  days?: number;
  kind?: "all" | "device" | "ip";
  trialOnly?: boolean;
}) =>
  apiFetch<AbuseCluster[]>(
    `/api/v1/admin/abuse/clusters${qs({ days: opts.days, kind: opts.kind, trial_only: opts.trialOnly })}`,
  );

export const lockMany = (profileIds: string[], reason?: string) =>
  apiFetch<LockManyOut>("/api/v1/admin/abuse/lock", {
    method: "POST",
    json: { profile_ids: profileIds, reason: reason?.trim() || null },
  });

export const addBlockedDomain = (domain: string) =>
  apiFetch<AbuseOverview["domains"]>("/api/v1/admin/abuse/domains", {
    method: "POST",
    json: { domain },
  });

export const removeBlockedDomain = (domain: string) =>
  apiFetch<AbuseOverview["domains"]>(`/api/v1/admin/abuse/domains/${encodeURIComponent(domain)}`, {
    method: "DELETE",
  });
