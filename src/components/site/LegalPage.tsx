import type { ReactNode } from "react";

import { PublicShell } from "@/components/site/PublicShell";

export interface LegalSection {
  title: string;
  body: ReactNode;
}

/** A policy page: title, when it took effect, numbered sections. */
export function LegalPage({
  title,
  intro,
  effective,
  sections,
}: {
  title: string;
  intro?: ReactNode;
  effective: string;
  sections: LegalSection[];
}) {
  return (
    <PublicShell>
      <article className="pt-8">
        <h1 className="text-[28px] font-bold leading-9">{title}</h1>
        <p className="mt-1 text-[12px] font-semibold text-ink-2">Hiệu lực từ {effective}</p>
        {intro && <div className="mt-4 text-[15px] leading-7">{intro}</div>}
        <nav aria-label="Mục lục" className="mt-6 rounded-[18px] border border-line bg-card p-4">
          <p className="text-[12px] font-bold text-ink-2">Mục lục</p>
          <ol className="mt-1.5 grid gap-1 text-[13px] font-semibold sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.title}>
                <a href={`#muc-${i + 1}`} className="text-blue-deep hover:underline">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {sections.map((s, i) => (
          <section key={s.title} id={`muc-${i + 1}`} className="mt-8 scroll-mt-20">
            <h2 className="text-[19px] font-bold leading-7">
              {i + 1}. {s.title}
            </h2>
            <div className="legal mt-2 space-y-3 text-[15px] leading-7 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1">
              {s.body}
            </div>
          </section>
        ))}
      </article>
    </PublicShell>
  );
}
