import { useQuery, type QueryClient } from "@tanstack/react-query";

import { getBillingCatalog } from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";
import type {
  BillingCatalogOut,
  BillingProductOut,
  EntitlementsOut,
  LessonAccess,
} from "@/lib/api/types";

export const CATALOG_KEY = ["billing", "catalog"] as const;
export const ENTITLEMENTS_KEY = ["billing", "entitlements"] as const;
export const ORDERS_KEY = ["billing", "orders"] as const;

/** The price list. A failed fetch counts as "nothing is sold", so the app never gets stuck behind
 * a billing screen because of a network blip. */
export function useCatalog() {
  const query = useQuery({
    queryKey: CATALOG_KEY,
    queryFn: getBillingCatalog,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return { ...query, catalog: query.data ?? null, selling: query.data?.enabled === true };
}

/** "29.000đ" */
export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
}

/** The products of `codes`, in that order, skipping codes the catalogue does not know. */
export function productsFor(catalog: BillingCatalogOut | null, codes: readonly string[]) {
  if (!catalog) return [];
  const byCode = new Map(catalog.products.map((p) => [p.code, p]));
  return codes.flatMap((c) => byCode.get(c) ?? []);
}

/** Nothing left to buy in this product. Mirrors the server (`Access.owns`): a lesson pack is owned
 * when every lesson it covers is open, and an exam pass can always be bought again (it extends). */
export function ownsProduct(
  catalog: BillingCatalogOut | null,
  held: EntitlementsOut | null | undefined,
  product: BillingProductOut,
): boolean {
  if (!held || product.kind !== "lesson_pack") return false;
  if (held.everything) return true;
  if (!catalog) return false;
  const covered = (n: number) =>
    n <= catalog.free_lesson_max ||
    held.lesson_packs.some((code) => {
      const p = catalog.products.find((x) => x.code === code);
      return (
        !!p &&
        p.lessons.some(([lo, hi]) => lo !== undefined && hi !== undefined && n >= lo && n <= hi)
      );
    });
  return product.lessons.every(([lo, hi]) => {
    if (lo === undefined || hi === undefined) return true;
    for (let n = lo; n <= hi; n++) if (!covered(n)) return false;
    return true;
  });
}

export const isLocked = (access: LessonAccess | undefined) => access === "locked";

/** After a purchase went through, anything cached for the old access is stale: the lesson list,
 * lessons already opened as a preview, practice sets, the plan. A purchase is rare, so refresh all. */
export function refreshAfterPurchase(queryClient: QueryClient) {
  void queryClient.invalidateQueries();
}

export type GateKind = "payment" | "closed" | "limit";

/** What kind of "not for you right now" an error is, so a screen can answer it in words. */
export function gateKind(err: unknown): GateKind | null {
  if (!(err instanceof ApiError)) return null;
  if (err.status === 402) return "payment";
  if (err.problem.code === "closed_source") return "closed";
  if (err.status === 429 && err.problem.code === "daily_limit") return "limit";
  return null;
}

// The banks payOS pays into, by the BIN printed in the payment info (NAPAS codes).
const BANK_BY_BIN: Record<string, string> = {
  "970415": "VietinBank",
  "970436": "Vietcombank",
  "970418": "BIDV",
  "970407": "Techcombank",
  "970422": "MB Bank",
  "970416": "ACB",
  "970432": "VPBank",
  "970423": "TPBank",
  "970403": "Sacombank",
  "970405": "Agribank",
  "970448": "OCB",
  "970426": "MSB",
  "970441": "VIB",
  "970443": "SHB",
  "970437": "HDBank",
  "970440": "SeABank",
  "970431": "Eximbank",
  "970449": "LPBank",
};

export function bankName(bin: string | null | undefined): string | null {
  if (!bin) return null;
  return BANK_BY_BIN[bin] ?? `Ngân hàng (mã ${bin})`;
}

/** "còn 12:34" until `iso`, or null once it has passed. */
export function timeLeft(iso: string, now: number): string | null {
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
