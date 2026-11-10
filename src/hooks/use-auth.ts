import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { me as fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { tokenStore } from "@/lib/api/client";

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

/** GET /auth/me; a locked account is signed out here and told why (its tokens would only keep
 * answering 401 "account_disabled"). */
async function fetchProfile() {
  try {
    return await fetchMe();
  } catch (e) {
    if (e instanceof ApiError && e.problem.code === "account_disabled") {
      tokenStore.clear();
      toast.error("Tài khoản đã bị khoá", {
        description: e.problem.detail ?? "Liên hệ người quản trị để mở lại.",
      });
    }
    throw e;
  }
}

function getHasTokenSnapshot() {
  return !!tokenStore.get();
}

function getHasTokenServerSnapshot() {
  return false;
}

/** Whether a learner is logged in, app-wide — a thin react-query wrapper
 * around GET /auth/me so every screen that needs it (the account screen,
 * and eventually /lesson's "đã nhớ/chưa nhớ" progress notice) shares one
 * cached answer instead of each re-checking the token separately. An
 * expired/missing token resolves to "anonymous", not an error state —
 * that's the normal, expected state before signing in.
 *
 * hasToken is read via useSyncExternalStore (subscribed to tokenStore's
 * set()/clear() event) rather than a plain inline read, so a fresh
 * login/signup is picked up as soon as it happens — not just on the next
 * unrelated re-render, which is why the account screen used to look
 * "frozen" right after signing in. */
export function useAuth() {
  const queryClient = useQueryClient();
  const hasToken = useSyncExternalStore(
    tokenStore.subscribe,
    getHasTokenSnapshot,
    getHasTokenServerSnapshot,
  );

  const query = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchProfile,
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const isAnonymous =
    !hasToken || (query.isError && query.error instanceof ApiError && query.error.status === 401);

  // While hydrating, hasToken is the server's answer (false): a profile already in the query cache
  // must not show yet, or the first client render differs from the HTML the server sent.
  const profile = hasToken ? (query.data ?? null) : null;
  return {
    profile,
    isLoading: hasToken && query.isLoading,
    isAuthenticated: !!profile,
    isAnonymous,
    /** Call after login/signup succeeds, or after logout, so every screen
     * reading useAuth() re-renders with the new state immediately. */
    refresh: () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
  };
}
