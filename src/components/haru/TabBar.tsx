import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Headphones, House, TrendingUp, UserRound } from "lucide-react";

import { tap } from "@/lib/feedback";

const tabs = [
  { label: "Hôm nay", to: "/today", icon: House, matches: ["/today"] },
  { label: "Học", to: "/lesson", icon: BookOpen, matches: ["/lesson"] },
  {
    label: "Luyện",
    to: "/speaking",
    icon: Headphones,
    matches: ["/speaking", "/pronunciation", "/chat", "/talk", "/reading", "/listening", "/writing", "/exam"],
  },
  { label: "Tiến bộ", to: "/progress", icon: TrendingUp, matches: ["/progress"] },
  { label: "Tôi", to: "/support-language", icon: UserRound, matches: ["/support-language"] },
] as const;

/** Bottom navigation, iOS 26 style: a floating Liquid Glass capsule (styles.css
 * `glass-panel`) that the page scrolls under. The wrapper reserves the
 * --tabbar-h strip (capsule + gap + home-indicator inset) and lets taps fall
 * through everywhere except the capsule itself. Each tab is >= 44 pt tall. */
export function TabBar({ wide = false }: { wide?: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[390px] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] ${wide ? "lg:max-w-[960px]" : ""}`}
    >
      <nav
        aria-label="Điều hướng chính"
        className="glass-panel pointer-events-auto mx-auto w-full rounded-[28px] p-1.5 lg:max-w-[440px]"
      >
        <div className="grid grid-cols-5 gap-0.5">
          {tabs.map(({ label, to, icon: Icon, matches }) => {
            const active = matches.some((path) => pathname.startsWith(path));
            return (
              <Link
                key={label}
                to={to}
                aria-current={active ? "page" : undefined}
                onClick={() => tap()}
                className={`group flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[22px] px-1 text-[11px] font-semibold leading-[13px] transition-[background-color,color,transform] duration-300 active:scale-[0.94] ${active ? "bg-blue-soft text-blue-deep" : "text-ink-2"}`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
