import { apiFetch } from "./client";
import type {
  AdminProductOut,
  BillingQuoteOut,
  CouponIn,
  CouponOut,
  FeatureRuleOut,
  ProductSettingIn,
  TrialOut,
  MerchantAdminOut,
  MerchantIn,
  SupportAdminOut,
  SupportIn,
  BillingCatalogOut,
  BillingClaimOut,
  BillingClaimResultOut,
  BillingOrderOut,
  EntitlementsOut,
} from "./types";

/** Public: the price list, and whether anything is sold yet (`enabled`). */
export const getBillingCatalog = () => apiFetch<BillingCatalogOut>("/api/v1/billing/catalog");

/** What the signed-in learner holds. */
export const getMyEntitlements = () => apiFetch<EntitlementsOut>("/api/v1/me/entitlements");

/** Buy a product: the server prices it from its own catalogue and makes the payOS payment link.
 * Pressing twice returns the same pending order. */
export const createOrder = (productCode: string, couponCode?: string | null) =>
  apiFetch<BillingOrderOut>("/api/v1/billing/orders", {
    method: "POST",
    json: { product_code: productCode, coupon_code: couponCode || null },
  });

/** The checkout summary: list price, the discount code checked on the server, the total. */
export const getQuote = (productCode: string, couponCode?: string | null) =>
  apiFetch<BillingQuoteOut>("/api/v1/billing/quote", {
    method: "POST",
    json: { product_code: productCode, coupon_code: couponCode || null },
  });

export const listOrders = () => apiFetch<BillingOrderOut[]>("/api/v1/billing/orders");

/** The paying screen polls this: while the order waits, the server asks payOS too. */
export const getOrder = (orderId: string) =>
  apiFetch<BillingOrderOut>(`/api/v1/billing/orders/${encodeURIComponent(orderId)}`);

export const cancelOrder = (orderId: string) =>
  apiFetch<BillingOrderOut>(`/api/v1/billing/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
  });

/** "Tôi đã thanh toán nhưng chưa mở khoá": the server checks payOS again first. */
export const createClaim = (body: { order_id?: string; note: string; bank_ref?: string }) =>
  apiFetch<BillingClaimResultOut>("/api/v1/billing/claims", { method: "POST", json: body });

export const listClaims = () => apiFetch<BillingClaimOut[]>("/api/v1/billing/claims");

// ---- admin: prices, feature rules, discount codes
export const adminProducts = () => apiFetch<AdminProductOut[]>("/api/v1/admin/billing/products");
export const adminSetProduct = (code: string, body: ProductSettingIn) =>
  apiFetch<AdminProductOut[]>(`/api/v1/admin/billing/products/${encodeURIComponent(code)}`, {
    method: "PUT",
    json: body,
  });
export const adminResetProduct = (code: string) =>
  apiFetch<AdminProductOut[]>(`/api/v1/admin/billing/products/${encodeURIComponent(code)}`, {
    method: "DELETE",
  });
export const adminFeatures = () => apiFetch<FeatureRuleOut[]>("/api/v1/admin/billing/features");
export const adminSetFeature = (feature: string, body: { mode: FeatureRuleOut["mode"] }) =>
  apiFetch<FeatureRuleOut[]>(`/api/v1/admin/billing/features/${encodeURIComponent(feature)}`, {
    method: "PUT",
    json: body,
  });
export const adminTrial = () => apiFetch<TrialOut>("/api/v1/admin/billing/trial");
export const adminSetTrial = (body: TrialOut) =>
  apiFetch<TrialOut>("/api/v1/admin/billing/trial", { method: "PUT", json: body });
export const adminCoupons = () => apiFetch<CouponOut[]>("/api/v1/admin/billing/coupons");
export const adminCreateCoupon = (body: CouponIn) =>
  apiFetch<CouponOut>("/api/v1/admin/billing/coupons", { method: "POST", json: body });
export const adminUpdateCoupon = (
  code: string,
  body: {
    active?: boolean;
    max_uses?: number | null;
    ends_at?: string | null;
    note?: string | null;
  },
) =>
  apiFetch<CouponOut>(`/api/v1/admin/billing/coupons/${encodeURIComponent(code)}`, {
    method: "PATCH",
    json: body,
  });

export const adminMerchant = () => apiFetch<MerchantAdminOut>("/api/v1/admin/billing/merchant");
export const adminSetMerchant = (body: MerchantIn) =>
  apiFetch<MerchantAdminOut>("/api/v1/admin/billing/merchant", { method: "PUT", json: body });
export const adminSupport = () => apiFetch<SupportAdminOut>("/api/v1/admin/billing/support");
export const adminSetSupport = (body: SupportIn) =>
  apiFetch<SupportAdminOut>("/api/v1/admin/billing/support", { method: "PUT", json: body });
