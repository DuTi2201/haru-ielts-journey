import { createFileRoute, Link } from "@tanstack/react-router";
import { CHATS_KEY, listChats } from "@/lib/api/chats";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  BookX,
  ChevronRight,
  ClipboardCheck,
  Ear,
  Layers,
  Library,
  MessagesSquare,
  Mic,
  PenLine,
  Presentation,
} from "lucide-react";

import { Mascot } from "@/components/mascot/Mascot";
import { TabBar } from "@/components/haru/TabBar";
import { Ko } from "@/components/lesson/Rich";
import { useAuth } from "@/hooks/use-auth";
import { getMyCompetency, getMyPlan } from "@/lib/api/content";
import { getMistakeBook } from "@/lib/api/practice";
import { useCatalog } from "@/lib/billing";
import { tap } from "@/lib/feedback";
import { writeLocal } from "@/lib/lesson-local";
import { MISTAKE_BOOK_KEY } from "@/lib/lesson-meta";

export const Route = createFileRoute("/speaking")({
  head: () => ({
    meta: [
      { title: "Luyện tập — Haru" },
      {
        name: "description",
        content: "Chọn hình thức luyện tập trong ứng dụng học tiếng Hàn Haru.",
      },
      { property: "og:title", content: "Luyện tập — Haru" },
      {
        property: "og:description",
        content: "Chọn hình thức luyện tập trong ứng dụng học tiếng Hàn Haru.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PracticeHub,
});

function PracticeHub() {
  // Luyện nghe, Đọc xã luận and Đề thi thật are closed to learners for now (their copyright is not
  // settled): they are not offered, rather than opening onto "Chưa mở cho người học"
  const auth = useAuth();
  const { catalog } = useCatalog();
  const role = auth.profile?.role;
  const open = !catalog?.private_sources || role === "editor" || role === "admin";
  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] overflow-hidden bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <div className="relative z-10">
        <header>
          <p className="text-[13px] font-semibold text-ink-2">Luyện tập</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">Luyện cho chắc bài đã học</h1>
        </header>

        <StudyingNow />

        <h2 className="mt-7 text-[15px] font-bold">Chọn kỹ năng</h2>
        {/* one row a skill, its variants as small links inside the row: four choices to scan
            instead of seven tiles */}
        <ul className="mt-3 space-y-2.5">
          <SkillRow
            to="/chat"
            icon={MessagesSquare}
            title="Hội thoại"
            hint="Nhân vật nói, bạn chọn câu đáp. Vài phút một bài, theo bài đã học."
          />
          <SkillRow
            to="/talk"
            icon={Mic}
            title="Nói"
            hint="Trò chuyện bằng giọng nói theo bài đang học. Không có micro thì gõ phím."
            more={[
              { to: "/talk/present", label: "Trình bày" },
              { to: "/talk/debate", label: "Tranh luận" },
            ]}
          />
          <SkillRow
            to="/writing/drill"
            icon={PenLine}
            title="Viết 51–52"
            hint="Điền câu vào chỗ trống từ các cụm bạn đang học."
          />
          {open && (
            <SkillRow
              to="/listening"
              icon={Ear}
              title="Nghe & đọc"
              hint="Câu mẫu từ phim giọng Seoul; xã luận cho câu 54."
              more={[{ to: "/reading", label: "Đọc xã luận" }]}
            />
          )}
          {open && (
            <SkillRow
              to="/exam/real"
              icon={ClipboardCheck}
              title="Đề thi thật"
              hint="Từng câu TOPIK II theo dạng và trình độ, có giải thích."
            />
          )}
          <SkillRow
            to="/vocab-bank"
            icon={Library}
            title="Kho từ TOPIK"
            hint="Từ trung, cao cấp theo chủ đề, thêm vào ôn tập mỗi ngày."
          />
        </ul>

        <aside className="mt-7 flex items-end gap-2.5">
          <Mascot mood="cheer" className="h-14 w-14 shrink-0" />
          <p className="mb-1 rounded-[18px_18px_18px_4px] border border-line bg-card px-4 py-3 text-xs font-semibold leading-5 shadow-elev-1">
            Mỗi ngày một chút, đừng dồn hết vào cuối tuần nhé!
          </p>
        </aside>
      </div>
      <TabBar />
    </main>
  );
}

type HubPath =
  | "/chat"
  | "/talk"
  | "/talk/present"
  | "/talk/debate"
  | "/writing/drill"
  | "/listening"
  | "/reading"
  | "/exam/real"
  | "/vocab-bank";

function SkillRow({
  to,
  icon: Icon,
  title,
  hint,
  more = [],
}: {
  to: HubPath;
  icon: typeof Mic;
  title: string;
  hint: string;
  more?: { to: HubPath; label: string }[];
}) {
  return (
    <li className="rounded-[18px] border border-line bg-card shadow-elev-1">
      <Link
        to={to}
        onClick={() => tap()}
        className="flex items-center gap-3 px-4 py-3 active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-blue-soft text-blue-deep">
          <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block text-[12px] font-medium leading-4 text-ink-2">{hint}</span>
        </span>
        <ChevronRight size={18} strokeWidth={2.2} className="shrink-0 text-ink-2" />
      </Link>
      {more.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2">
          {more.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              onClick={() => tap()}
              className="inline-flex min-h-9 items-center rounded-full bg-fill px-3 text-[12px] font-semibold text-ink"
            >
              {m.label}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}

/** What ties the Luyện tab to the lessons: the lesson being studied (talk or present about it),
 * what is waiting today (cards due, wrong answers to read again), and the weakest patterns with
 * the lesson that teaches them. Signed out: nothing here, the skills below are open to try. */
function StudyingNow() {
  const auth = useAuth();
  const on = auth.isAuthenticated;
  const plan = useQuery({
    queryKey: ["me", "plan"],
    queryFn: getMyPlan,
    enabled: on,
    staleTime: 60_000,
  });
  const mistakes = useQuery({
    queryKey: MISTAKE_BOOK_KEY,
    queryFn: getMistakeBook,
    enabled: on,
    staleTime: 60_000,
  });
  const competency = useQuery({
    queryKey: ["me", "competency"],
    queryFn: getMyCompetency,
    enabled: on,
    staleTime: 5 * 60_000,
  });
  const chats = useQuery({
    queryKey: CHATS_KEY,
    queryFn: listChats,
    enabled: on,
    staleTime: 60_000,
  });
  if (!on) return null;

  const lessonTask = plan.data?.tasks.find((t) => t.kind === "vocab_review" && t.lesson_id);
  const review = plan.data?.tasks.find((t) => t.kind === "review" && t.status !== "done");
  // the dialogue of the lesson being studied, else the next one open
  const chat =
    chats.data?.find((c) => c.open && c.lesson_id === lessonTask?.lesson_id) ??
    chats.data?.find((c) => c.open && !c.done);
  const toRead =
    mistakes.data?.lessons.reduce(
      (n, l) => n + l.mistakes.filter((m) => !m.understood).length,
      0,
    ) ?? 0;
  const titles = new Map<number, string>();
  for (const t of competency.data?.topics ?? [])
    for (const l of t.lessons) titles.set(l.lesson_id, l.title);
  const weak = (competency.data?.topics ?? []).flatMap((t) => t.weakest).slice(0, 3);
  if (!lessonTask && !review && !toRead && !weak.length) return null;

  return (
    <div className="mt-5 space-y-3">
      {lessonTask?.lesson_id && (
        <section className="rounded-[20px] bg-blue p-4 text-primary-foreground shadow-elev-2">
          <p className="text-[12px] font-semibold opacity-85">Đang học</p>
          <p className="mt-0.5 text-[16px] font-bold leading-snug">{lessonTask.title}</p>
          {chat && (
            <Link
              to="/chat/$id"
              params={{ id: chat.id }}
              onClick={() => tap()}
              className="mt-3 flex min-h-11 items-center gap-2 rounded-[14px] bg-white/15 px-3 text-[13px] font-semibold active:scale-[0.98]"
            >
              <MessagesSquare size={15} strokeWidth={2.4} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">Hội thoại: {chat.title_vi}</span>
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          )}
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              {
                to: "/talk" as const,
                search: { lesson: lessonTask.lesson_id },
                icon: Mic,
                label: "Nói",
              },
              {
                to: "/talk/present" as const,
                search: { lesson: lessonTask.lesson_id },
                icon: Presentation,
                label: "Trình bày",
              },
            ].map((a) => (
              <Link
                key={a.label}
                to={a.to}
                search={a.search}
                onClick={() => tap()}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] bg-white/15 text-[13px] font-semibold active:scale-[0.97]"
              >
                <a.icon size={15} strokeWidth={2.4} aria-hidden="true" /> {a.label}
              </Link>
            ))}
            <Link
              to="/lesson/$id"
              params={{ id: String(lessonTask.lesson_id) }}
              onClick={() => tap()}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] bg-white text-[13px] font-semibold text-blue-deep active:scale-[0.97]"
            >
              <BookOpen size={15} strokeWidth={2.4} aria-hidden="true" /> Mở bài
            </Link>
          </div>
        </section>
      )}

      {(review || toRead > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {review && (
            <Link to="/review" onClick={() => tap()} className="block active:scale-[0.97]">
              <div className="h-full rounded-[18px] border border-line bg-card p-3.5 shadow-elev-1">
                <Layers size={19} strokeWidth={2.2} className="text-blue" aria-hidden="true" />
                <p className="mt-1.5 text-[14px] font-semibold">Ôn thẻ</p>
                <p className="text-[12px] font-semibold text-ink-2">{review.subtitle}</p>
              </div>
            </Link>
          )}
          {toRead > 0 && (
            <Link to="/mistakes" onClick={() => tap()} className="block active:scale-[0.97]">
              <div className="h-full rounded-[18px] border border-line bg-card p-3.5 shadow-elev-1">
                <BookX size={19} strokeWidth={2.2} className="text-danger" aria-hidden="true" />
                <p className="mt-1.5 text-[14px] font-semibold">Câu sai</p>
                <p className="text-[12px] font-semibold text-ink-2">{toRead} câu cần đọc lại</p>
              </div>
            </Link>
          )}
        </div>
      )}

      {weak.length > 0 && (
        <section className="rounded-[18px] border border-line bg-card p-3.5 shadow-elev-1">
          <h2 className="text-[14px] font-bold">Mẫu câu còn yếu</h2>
          <ul className="mt-1 divide-y divide-line">
            {weak.map((w) => (
              <li key={w.grammar_id}>
                <Link
                  to="/lesson/$id"
                  params={{ id: String(w.lesson_id) }}
                  onClick={() => {
                    tap();
                    writeLocal(`step:${w.lesson_id}`, "grammar"); // open the lesson on its patterns
                  }}
                  className="flex min-h-12 items-center gap-2 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <Ko className="block text-[14px] font-semibold">{w.pattern}</Ko>
                    <span className="block truncate text-[12px] text-ink-2">
                      {titles.get(w.lesson_id) ?? "Mở bài"} · {w.why}
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-ink-2" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
