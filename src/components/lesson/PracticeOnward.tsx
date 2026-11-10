import { Link } from "@tanstack/react-router";
import { BookX, ChevronRight, Layers } from "lucide-react";

import { tap } from "@/lib/feedback";

export function PracticeOnward({ title }: { lessonId: number; title: string }) {
  const rows = [
    {
      to: "/review" as const,
      search: {},
      icon: Layers,
      label: "Ôn thẻ hôm nay",
      hint: "Thẻ của bài quay lại đúng lúc sắp quên.",
    },
    {
      to: "/mistakes" as const,
      search: {},
      icon: BookX,
      label: "Sổ lỗi sai",
      hint: "Xem lại các câu trả lời sai và giải thích chi tiết.",
    },
  ];
  return (
    <section
      aria-label={`Luyện tiếp với bài ${title}`}
      className="mt-6 rounded-[20px] border border-line bg-card p-4 shadow-elev-1"
    >
      <h3 className="text-[15px] font-bold">Luyện tiếp với bài này</h3>
      <ul className="mt-2 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.label}>
            <Link
              to={r.to}
              search={r.search}
              onClick={() => tap()}
              className="hit-area flex min-h-12 items-center gap-3 py-2 active:scale-[0.99]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue-deep">
                <r.icon size={17} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{r.label}</span>
                <span className="block text-[12px] text-ink-2">{r.hint}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-ink-2" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
