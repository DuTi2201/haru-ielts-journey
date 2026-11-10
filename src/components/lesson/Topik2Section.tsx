import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Lock, Rocket } from "lucide-react";

import { useStartSet } from "@/components/exam/use-start-set";
import { useAuth } from "@/hooks/use-auth";
import { getRealExamLesson } from "@/lib/api/real-exam";
import type { RxLessonPickOut } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Ko, Rich } from "./Rich";

const TIER_LABEL: Record<number, string> = { 1: "Câu dễ", 2: "Câu vừa" };
const STATUS: Record<RxLessonPickOut["status"], { label: string; tone: string }> = {
  new: { label: "Chưa thử", tone: "bg-card text-ink-2" },
  solid: { label: "Đã làm tốt", tone: "bg-green-soft" },
  aided: { label: "Làm được nhờ gợi ý", tone: "bg-yellow-soft" },
  wrong: { label: "Cần xem lại", tone: "bg-yellow-soft" },
};

/** The end of a lesson's practice: a few real TOPIK II questions that share its topic, optional,
 * each with a short primer of the words and forms the learner has not met yet, so the real exam
 * is met early and in small pieces. Real exam material is for signed-in learners only. */
export function Topik2Section({ lessonId }: { lessonId: number }) {
  const auth = useAuth();
  const picks = useQuery({
    queryKey: ["real-exam", "lesson", lessonId],
    queryFn: () => getRealExamLesson(lessonId),
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
  });
  const start = useStartSet();

  const items = picks.data?.picks ?? [];
  if (!auth.isAuthenticated || items.length === 0) return null;

  return (
    <details className="group rounded-[16px] border border-line bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
        <Rocket size={18} strokeWidth={2.4} aria-hidden="true" className="shrink-0 text-blue" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            Thử sức TOPIK II{" "}
            <span className="text-xs font-semibold text-ink-2">
              · {items.length} câu · không bắt buộc
            </span>
          </span>
          <span className="block text-[12px] font-semibold leading-4 text-ink-2">
            Câu đề thật cùng chủ đề bài này, có giải thích trước từ và mẫu câu mới.
          </span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2.6}
          aria-hidden="true"
          className="shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="space-y-3 border-t border-line px-3.5 pb-3.5 pt-3">
        <p className="text-xs font-medium leading-5 text-ink-2">
          Đề TOPIK II khá dài và khó, nên ở đây chỉ chọn vài câu <b>ngắn, dễ</b> hợp với bài này.
          Đọc phần “Làm quen trước” rồi thử. Chưa làm được cũng không sao: sau này học các chủ đề
          khó hơn, gặp lại bạn sẽ hiểu sâu hơn.
        </p>
        {items.map((p) => (
          <PickCard
            key={p.qid}
            pick={p}
            busy={start.isPending}
            onStart={() => start.mutate({ qids: [p.qid] })}
          />
        ))}
      </div>
    </details>
  );
}

function PickCard({
  pick,
  busy,
  onStart,
}: {
  pick: RxLessonPickOut;
  busy: boolean;
  onStart: () => void;
}) {
  const st = STATUS[pick.status];
  return (
    <article
      aria-label={`${pick.exam_title}, câu ${pick.n}`}
      className="rounded-[14px] border border-line bg-paper p-3"
    >
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
        <span>
          {pick.exam_title} · {pick.sec === "L" ? "Nghe" : "Đọc"} câu {pick.n}
        </span>
        <span className="rounded-full bg-blue-soft px-2 py-0.5 text-blue-deep">
          {TIER_LABEL[pick.tier] ?? `Bậc ${pick.tier}`}
        </span>
        <span className={cn("rounded-full px-2 py-0.5", st.tone)}>
          {pick.status === "solid" && (
            <Check size={11} strokeWidth={3.2} aria-hidden="true" className="mr-0.5 inline" />
          )}
          {st.label}
        </span>
      </div>
      <p className="mt-0.5 text-[12px] font-semibold text-ink-2">{pick.type_name_vi}</p>
      <Rich as="p" text={pick.why_vi} className="mt-1.5 text-[13px] leading-5" />

      {(pick.words.length > 0 || pick.forms.length > 0) && (
        <details className="group/primer mt-2 rounded-[12px] bg-yellow-soft">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-xs font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex-1">Làm quen trước · từ và mẫu câu trong câu này</span>
            <ChevronDown
              size={15}
              strokeWidth={2.6}
              aria-hidden="true"
              className="shrink-0 transition-transform duration-200 group-open/primer:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="space-y-2 px-3 pb-2.5">
            {pick.forms.length > 0 && (
              <ul className="space-y-1.5">
                {pick.forms.map((f) => (
                  <li key={f.k} className="text-xs leading-5">
                    <Ko className="text-[13px] font-semibold">{f.k}</Ko>
                    <Rich as="p" text={f.vi} className="font-medium text-ink-2" />
                  </li>
                ))}
              </ul>
            )}
            {pick.words.length > 0 && (
              <ul className="grid gap-1 sm:grid-cols-2">
                {pick.words.map((w) => (
                  <li key={w.ko} className="flex items-baseline gap-2 text-xs">
                    <Ko className="text-[13px] font-semibold">{w.ko}</Ko>
                    <span className="font-medium text-ink-2">{w.vi}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}

      <div className="mt-2.5 flex items-center justify-end gap-2">
        {pick.resting && (
          <span className="mr-auto flex items-center gap-1 text-[12px] font-semibold text-ink-2">
            <Lock size={12} strokeWidth={2.6} aria-hidden="true" /> Vừa làm xong, đang nghỉ vài ngày
          </span>
        )}
        <button
          type="button"
          onClick={onStart}
          disabled={busy || pick.resting}
          className="hit-area flex min-h-10 items-center gap-1.5 rounded-full border border-transparent bg-blue px-4 text-xs font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
        >
          {pick.status === "new" ? "Thử câu này" : "Làm lại câu này"}
        </button>
      </div>
    </article>
  );
}
