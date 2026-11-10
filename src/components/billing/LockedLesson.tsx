import { BookOpen, Eye } from "lucide-react";

import { UnlockPanel } from "@/components/billing/UnlockPanel";
import { LessonImage } from "@/components/lesson/LessonImage";
import { BackToLessons, Shell } from "@/components/lesson/LessonShell";
import { Ko, Rich } from "@/components/lesson/Rich";
import type { LessonOut } from "@/lib/api/types";
import { TRACK_LABEL, TRACK_TONE } from "@/lib/lesson-meta";
import { cn } from "@/lib/utils";

/** "120 từ vựng · 8 mẫu ngữ pháp · 40 câu luyện" — what the whole lesson holds, a part of zero left out. */
function holds(lesson: LessonOut): string {
  const parts: string[] = [];
  const t = lesson.totals;
  if (t && t.vocab > 0) parts.push(`${t.vocab} từ vựng`);
  if (t && t.grammar > 0) parts.push(`${t.grammar} mẫu ngữ pháp`);
  if (t && t.notes > 0) parts.push(`${t.notes} ghi chú`);
  const questions = lesson.practice?.questions ?? 0;
  if (questions > 0) parts.push(`${questions} câu luyện`);
  return parts.join(" · ");
}

/**
 * A lesson the learner has not unlocked: the server sends only a preview (the goal, the first
 * words, the totals). This shows it and the way to open the rest; nothing here pretends to be
 * the lesson, so there is no stepper and no practice.
 */
export function LockedLessonView({ lesson }: { lesson: LessonOut }) {
  const track = lesson.track ?? null;
  const goal = lesson.notes?.find((n) => n.kind === "goal") ?? null;
  const total = holds(lesson);
  return (
    <Shell>
      <header>
        <BackToLessons topic={lesson.topics[0]?.name ?? null} track={track} />
        <div className="mt-2 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {track && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                    TRACK_TONE[track],
                  )}
                >
                  {TRACK_LABEL[track]}
                </span>
              )}
              <span className="rounded-full bg-progress px-2.5 py-0.5 text-[12px] font-semibold text-ink-2">
                Xem trước
              </span>
            </div>
            {lesson.title_en && (
              <Ko className="mt-2 block text-[13px] font-semibold text-ink-2">{lesson.title_en}</Ko>
            )}
            <h1 className="mt-0.5 flex items-start gap-2 text-2xl font-bold leading-tight">
              <BookOpen size={22} strokeWidth={2.2} className="mt-1 shrink-0 text-blue" />
              <span className="min-w-0 break-words">{lesson.title}</span>
            </h1>
          </div>
          <LessonImage src={lesson.image_url} eager className="h-[68px] w-24" />
        </div>
        {lesson.summary && (
          <Rich as="p" text={lesson.summary} className="mt-2 text-[13px] leading-5 text-ink-2" />
        )}
        {total && <p className="mt-2 text-xs font-semibold text-ink-2">Bài đầy đủ có {total}.</p>}
      </header>

      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <div className="space-y-5">
          {goal && (
            <section className="rounded-[18px] border border-line bg-card p-4 shadow-elev-1">
              <h2 className="text-xs font-semibold text-blue-deep">
                {goal.title || "Mục tiêu bài học"}
              </h2>
              <Rich as="p" text={goal.body} className="mt-1.5 text-[13px] leading-6" />
            </section>
          )}

          {lesson.vocab.length > 0 && (
            <section aria-label="Vài từ đầu bài">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Eye size={15} strokeWidth={2.4} aria-hidden="true" className="text-blue" />
                Vài từ đầu bài
              </h2>
              <ul className="mt-2.5 space-y-2">
                {lesson.vocab.map((v) => (
                  <li key={v.id} className="rounded-[14px] border border-line bg-card px-3.5 py-3">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <Ko className="text-lg font-semibold">{v.headword}</Ko>
                      {v.pos && (
                        <span className="text-[12px] font-semibold text-ink-2">{v.pos}</span>
                      )}
                    </p>
                    <p className="text-[13px] font-semibold leading-5">{v.meaning_vi}</p>
                    {v.example_en && (
                      <p className="mt-1.5 border-l-2 border-blue pl-2.5">
                        <Ko className="block text-[13px] leading-6">{v.example_en}</Ko>
                        {v.example_vi && (
                          <span className="block text-[11.5px] font-medium leading-5 text-ink-2">
                            {v.example_vi}
                          </span>
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <UnlockPanel unlockWith={lesson.unlock_with} className="mt-5 lg:mt-0 lg:sticky lg:top-6" />
      </div>
    </Shell>
  );
}
