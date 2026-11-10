import { Link } from "@tanstack/react-router";
import { ChevronRight, Layers, Mic, Presentation } from "lucide-react";

import { tap } from "@/lib/feedback";

/* From the lesson to the Luyện tab: the same words and patterns, used out loud. Haru talks or asks
 * a question about THIS lesson (the server checks it is open to the learner), and the day's
 * review brings its cards back before they are forgotten. */

export function PracticeOnward({ lessonId, title }: { lessonId: number; title: string }) {
  const rows = [
    {
      to: "/talk" as const,
      search: { lesson: lessonId },
      icon: Mic,
      label: "Nói về bài này với Haru",
      hint: "Haru hỏi bằng từ và mẫu câu của bài.",
    },
    {
      to: "/talk/present" as const,
      search: { lesson: lessonId },
      icon: Presentation,
      label: "Trình bày một đề của bài",
      hint: "Nói liền một mạch, Haru chấm và sửa.",
    },
    {
      to: "/review" as const,
      search: {},
      icon: Layers,
      label: "Ôn thẻ hôm nay",
      hint: "Thẻ của bài quay lại đúng lúc sắp quên.",
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
