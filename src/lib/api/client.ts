import { deviceId } from "@/lib/device-id";

import type { ProblemDetail, TokenPair } from "./types";

export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

/** Where the session lives (security audit, November 2026):
 * - the REFRESH token is an HttpOnly cookie set by the API; no script can read it;
 * - the ACCESS token (60 minutes) is kept in memory only, never in web storage;
 * - localStorage holds just a flag ("a session probably exists"), so a new tab or a reload knows
 *   to ask the API for an access token before it calls anything. */
const SESSION_KEY = "haru.session";
const LEGACY_KEYS = ["haru.access_token", "haru.refresh_token"];

let accessToken: string | null = null;

/** set()/clear() dispatch this event so useAuth (via useSyncExternalStore) reacts at once, in this
 * tab, without a page reload. */
const AUTH_CHANGED_EVENT = "haru:auth-changed";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

// tokens an older build left in web storage are removed the first time this build runs
for (const key of LEGACY_KEYS) {
  try {
    storage()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const tokenStore = {
  /** The access token, if this tab holds one right now. */
  get(): string | null {
    return accessToken;
  },
  /** True when the browser should have a session (this tab may still need to fetch its token). */
  hasSession(): boolean {
    return accessToken !== null || storage()?.getItem(SESSION_KEY) === "1";
  },
  set(pair: TokenPair) {
    accessToken = pair.access_token;
    try {
      storage()?.setItem(SESSION_KEY, "1");
    } catch {
      /* private mode: the session lasts as long as this tab */
    }
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  },
  clear() {
    accessToken = null;
    try {
      storage()?.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  },
  /** Subscribe to any set()/clear() call, in this tab or another (the storage event covers the
   * other tabs: signing out in one drops the token held by the rest). */
  subscribe(callback: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== SESSION_KEY) return;
      if (storage()?.getItem(SESSION_KEY) !== "1") accessToken = null;
      callback();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, callback);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, callback);
      window.removeEventListener("storage", onStorage);
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
const NO_REFRESH_PATHS = [
  "/api/v1/auth/login",
  "/api/v1/auth/signup",
  "/api/v1/auth/refresh",
  "/api/v1/auth/logout",
];

// Concurrent 401s (e.g. a poll tick + a user action firing at once) must
// share ONE refresh call, not race each other into minting two rotated
// token pairs where the second invalidates the first's refresh_token.
let refreshPromise: Promise<void> | null = null;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function refreshOnce(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      // The refresh token is the HttpOnly cookie: the browser attaches it, nothing is sent in the body.
      const call = () => rawFetch<TokenPair>("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin" });
      let pair: TokenPair;
      try {
        pair = await call();
      } catch (e) {
        // A refresh token is good once. Another tab may have redeemed it a moment ago; the cookie
        // it got back is ours too, so one more try settles it.
        if (!(e instanceof ApiError) || e.status !== 401) throw e;
        await wait(600);
        pair = await call();
      }
      tokenStore.set(pair);
    })()
      .catch((e) => {
        // A 401 means the session is over: drop it so the app shows its signed-out state. A network
        // failure or a 5xx says nothing about the session, so it is kept for the next try.
        if (e instanceof ApiError && e.status === 401) tokenStore.clear();
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
  // A new tab or a reload: the session exists (cookie) but this tab holds no access token yet.
  // Fetch one first, or a route that also answers anonymous callers would answer as if signed out.
  if (!tokenStore.get() && tokenStore.hasSession() && !NO_REFRESH_PATHS.includes(path)) {
    try {
      await refreshOnce();
    } catch {
      /* signed out, or offline: the request below says which */
    }
  }
  try {
    return await rawFetch<T>(path, init);
  } catch (e) {
    // "invalid_token": the access token ran out or was refused. "unauthenticated" while a session
    // was expected: the token is missing or the account behind it is gone. Either way the session
    // may still be redeemable, or is dead, and then it must be dropped.
    const sessionRejected =
      e instanceof ApiError &&
      e.status === 401 &&
      (e.problem.code === "invalid_token" || e.problem.code === "unauthenticated");
    if (!sessionRejected || NO_REFRESH_PATHS.includes(path)) throw e;
    if (!tokenStore.hasSession()) throw e;
    try {
      await refreshOnce();
    } catch {
      throw e; // surface the original 401 (refreshOnce cleared the session if it is over)
    }
    return rawFetch<T>(path, init);
  }
}
