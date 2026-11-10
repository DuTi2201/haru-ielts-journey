import { Link, useRouterState } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Mascot } from "@/components/mascot/Mascot";
import { LoadingBlocks } from "@/components/haru/states";
import { TabBar } from "@/components/haru/TabBar";
import { useAuth } from "@/hooks/use-auth";

/** Every screen of the "Luyện" tab (the same paths the tab bar lights up for). */
export const PRACTICE_PATHS = ["/speaking", "/talk", "/reading", "/listening", "/writing", "/exam"];

export function isPracticePath(pathname: string) {
  return PRACTICE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The practice tab needs an account (owner decision): signed-out learners get a sign-in screen
 * instead of the page. Until the browser has read the saved session (the server cannot see it),
 * a placeholder is shown, so a signed-in learner never sees the sign-in screen flash by. */
export function PracticeGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const auth = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isPracticePath(pathname)) return <>{children}</>;
  if (!mounted || auth.isLoading) {
    return (
      <main className="mx-auto min-h-dvh max-w-[390px] bg-paper px-6 pt-[max(28px,env(safe-area-inset-top))]">
        <LoadingBlocks
          label="Đang tải"
          blocks={["h-8 w-40", "h-28", "h-28"]}
          className="space-y-4"
        />
        <TabBar />
      </main>
    );
  }
  if (!auth.isAnonymous) return <>{children}</>;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[390px] flex-col bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <section className="mt-16 rounded-[20px] border border-line bg-card p-6 text-center shadow-elev-2">
        <Mascot mood="wave" className="mx-auto h-16 w-16" />
        <h1 className="mt-3 text-lg font-semibold leading-snug">Đăng nhập để luyện tập</h1>
        <p className="mt-1.5 text-xs font-semibold leading-5 text-ink-2">
          Phần Luyện tập — nói với Haru, nghe, đọc, viết và đề thi — cần tài khoản để lưu bài làm,
          lỗi sai và tiến bộ của bạn.
        </p>
        <Link
          to="/support-language"
          className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-transparent bg-blue py-2.5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
        >
          <LogIn size={16} strokeWidth={2.4} /> Đăng nhập / Tạo tài khoản
        </Link>
      </section>
      <TabBar />
    </main>
  );
}
