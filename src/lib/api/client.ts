import { deviceId } from "@/lib/device-id";

import type { ProblemDetail, TokenPair } from "./types";

export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

const ACCESS_KEY = "haru.access_token";
const REFRESH_KEY = "haru.refresh_token";

/** localStorage writes don't trigger a React re-render on their own (that's
 * why login/signup used to "do nothing" visibly: the token was saved, but
 * no component ever found out). set()/clear() dispatch this event so
 * useAuth (via useSyncExternalStore) can react to it immediately, in this
 * tab, without needing a page reload. */
const AUTH_CHANGED_EVENT = "haru:auth-changed";

export const tokenStore = {
  get(): string | null {
    return typeof window === "undefined" ? null : window.localStorage.getItem(ACCESS_KEY);
  },
  getRefresh(): string | null {
    return typeof window === "undefined" ? null : window.localStorage.getItem(REFRESH_KEY);
  },
  set(pair: TokenPair) {
    window.localStorage.setItem(ACCESS_KEY, pair.access_token);
    window.localStorage.setItem(REFRESH_KEY, pair.refresh_token);
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  },
  clear() {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  },
  /** Subscribe to any set()/clear() call, in this tab or another (storage
   * event covers cross-tab). Returns an unsubscribe function, matching
   * useSyncExternalStore's expected shape. */
  subscribe(callback: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    window.addEventListener(AUTH_CHANGED_EVENT, callback);
    window.addEventListener("storage", callback);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, callback);
      window.removeEventListener("storage", callback);
    };
  },
};

export class ApiError extends Error {
  readonly problem: ProblemDetail;
  constructor(problem: ProblemDetail) {
    super(problem.detail || problem.title || "Đã có lỗi xảy ra");
    this.name = "ApiError";
    this.problem = problem;
  }
  get status() {
    return this.problem.status;
  }
}

/** 402: the lesson / feature is behind a purchase (see lib/billing.ts for what to offer). */
export function isPaymentRequired(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 402;
}

/** One place answers a 402: every 402 from an action (any method but GET) is announced with this
 * event, and the paywall sheet in the root layout (components/billing/PaywallHost) offers the
 * products that open it. A screen that loads something locked (a GET) shows its own preview /
 * GateNotice inline instead, so the same refusal is never shown twice. */
export const PAYMENT_REQUIRED_EVENT = "haru:payment-required";

function announcePaymentRequired(problem: ProblemDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ProblemDetail>(PAYMENT_REQUIRED_EVENT, { detail: problem }));
}

/** User-facing message: detail, then title, then a generic fallback. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.problem.detail || err.problem.title;
  if (err instanceof Error) return err.message;
  return "Đã có lỗi xảy ra";
}

async function toProblem(res: Response): Promise<ProblemDetail> {
  try {
    const body = (await res.json()) as Partial<ProblemDetail>;
    if (body && typeof body === "object" && ("title" in body || "detail" in body)) {
      return {
        type: body.type ?? "about:blank",
        title: body.title ?? res.statusText,
        status: body.status ?? res.status,
        detail: body.detail ?? null,
        code: body.code ?? null,
        retryable: body.retryable ?? null,
        needs: body.needs ?? null,
        unlock_with: Array.isArray(body.unlock_with) ? body.unlock_with : null,
      };
    }
  } catch {
    /* non-JSON body */
  }
  return { type: "about:blank", title: res.statusText || "Lỗi máy chủ", status: res.status };
}

async function rawFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const h = new Headers(headers);
  const token = tokenStore.get();
  if (token) h.set("Authorization", `Bearer ${token}`);
  const device = deviceId();
  if (device) h.set("X-Haru-Device", device);
  if (json !== undefined) h.set("Content-Type", "application/json");
  h.set("Accept", "application/json, application/problem+json");

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: h,
      body: json !== undefined ? JSON.stringify(json) : (rest.body ?? null),
    });
  } catch {
    throw new ApiError({
      type: "network",
      title: "Không kết nối được máy chủ",
      status: 0,
      retryable: true,
    });
  }
  if (!res.ok) {
    const problem = await toProblem(res);
    if (problem.status === 402 && (rest.method ?? "GET").toUpperCase() !== "GET") {
      announcePaymentRequired(problem);
    }
    throw new ApiError(problem);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Endpoints that must never trigger a refresh-and-retry themselves — login/
// signup never carry a token to begin with, and refresh's own 401 IS the
// signal that the refresh token itself is dead (retrying it would loop).
const NO_REFRESH_PATHS = ["/api/v1/auth/login", "/api/v1/auth/signup", "/api/v1/auth/refresh"];

// Concurrent 401s (e.g. a poll tick + a user action firing at once) must
// share ONE refresh call, not race each other into minting two rotated
// token pairs where the second invalidates the first's refresh_token.
let refreshPromise: Promise<void> | null = null;

async function refreshOnce(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = tokenStore.getRefresh();
      if (!refreshToken) throw new Error("no refresh token");
      const pair = await rawFetch<TokenPair>("/api/v1/auth/refresh", {
        method: "POST",
        json: { refresh_token: refreshToken },
      });
      tokenStore.set(pair);
    })()
      .catch((e) => {
        // Refresh token is itself dead (expired/invalid/missing) — nothing
        // left to try; clear so the app falls back to its logged-out state
        // instead of re-sending a request that will 401 forever.
        tokenStore.clear();
        throw e;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Access tokens are short-lived (JWT_ACCESS_TTL_MIN on the backend, 60
 * min) by design, so hitting an expired one mid-session is normal, not
 * exceptional — this is what used to surface as a hard-to-explain
 * "Invalid or expired token" on whatever the user happened to be doing
 * next (e.g. replaying an already-cached podcast recording via GET
 * /jobs/{id}), even though nothing was actually wrong with that request.
 * On that error shape (401 + code "invalid_token", or "unauthenticated"
 * when the account behind the token is gone; with no refresh token at all
 * it is just logged out and not retried), silently redeem the refresh token
 * for a new pair and replay the original request once before giving up. */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  try {
    return await rawFetch<T>(path, init);
  } catch (e) {
    // "invalid_token": the access token ran out or was refused. "unauthenticated" while a token
    // was sent: the account behind it is not there (a database that was moved or reset). Either
    // way the session may still be redeemable — or is dead, and then it must be dropped, or every
    // screen keeps asking with it, getting 401 and asking again.
    const sessionRejected =
      e instanceof ApiError &&
      e.status === 401 &&
      (e.problem.code === "invalid_token" || e.problem.code === "unauthenticated");
    if (!sessionRejected || NO_REFRESH_PATHS.includes(path)) throw e;
    if (!tokenStore.getRefresh()) {
      // nothing to redeem; a token that was sent and refused is dead weight
      if (tokenStore.get()) tokenStore.clear();
      throw e;
    }
    try {
      await refreshOnce();
    } catch {
      throw e; // surface the original 401 — refreshOnce already cleared tokens
    }
    return rawFetch<T>(path, init);
  }
}
