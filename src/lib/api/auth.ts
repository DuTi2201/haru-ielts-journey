import { apiFetch, tokenStore } from "./client";
import type { ChangePasswordIn, ProfileOut, TokenPair } from "./types";

export interface Credentials {
  email: string;
  password: string;
}

export async function signup(body: Credentials & { display_name?: string }): Promise<TokenPair> {
  const pair = await apiFetch<TokenPair>("/api/v1/auth/signup", { method: "POST", json: body });
  tokenStore.set(pair);
  return pair;
}

export async function login(body: Credentials): Promise<TokenPair> {
  const pair = await apiFetch<TokenPair>("/api/v1/auth/login", { method: "POST", json: body });
  tokenStore.set(pair);
  return pair;
}

/** POST /auth/change-password — the learner's own password (also how a temporary one is replaced).
 * Every older session ends; the answer carries a fresh pair for this one, which is stored. */
export async function changePassword(body: ChangePasswordIn): Promise<TokenPair> {
  const pair = await apiFetch<TokenPair>("/api/v1/auth/change-password", {
    method: "POST",
    json: body,
  });
  tokenStore.set(pair);
  return pair;
}

export function logout() {
  tokenStore.clear();
}

/** GET /auth/me — throws ApiError(401) if the stored access token is
 * missing/expired; callers treat that as "not logged in", not a fatal
 * error (see useAuth's react-query config: retry: false). */
export const me = () => apiFetch<ProfileOut>("/api/v1/auth/me");
