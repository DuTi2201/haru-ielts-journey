import type { ReactNode } from "react";

import { TabBar } from "@/components/haru/TabBar";

/** The page frame the practice screens share: the system grouped background
 * and room for the floating tab bar. (`glyph` used to draw a faint Hangul
 * watermark; Apple's "deference" rule keeps decoration out from behind the
 * content, so it is accepted and ignored.) */
export function PracticeShell({
  children,
  wide = false,
}: {
  glyph?: string;
  children: ReactNode;
  /** laptop: use the width (a screen laid out in columns) */
  wide?: boolean;
}) {
  return (
    <main
      className={`relative mx-auto min-h-dvh max-w-[390px] overflow-hidden bg-paper px-5 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(24px,env(safe-area-inset-top))] text-ink ${wide ? "max-w-[440px] lg:max-w-[1120px] lg:px-8 lg:pt-8" : ""}`}
    >
      <div className="relative z-10">{children}</div>
      <TabBar wide={wide} />
    </main>
  );
}
