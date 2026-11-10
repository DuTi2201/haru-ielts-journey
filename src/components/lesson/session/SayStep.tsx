/** "Nói thử": the sentences the sitting just taught (its cards' examples, then its words'), one at
 * a time: hear it, say it aloud, tick it. Nothing is recorded and nothing is graded here — the point
 * is to get the sentence out of the mouth while it is fresh; pronunciation scoring lives elsewhere. */
import { Check, Loader2, Mic, Volume2 } from "lucide-react";
import { useState } from "react";

import { Ko } from "@/components/lesson/Rich";
import { useTextAudio } from "@/hooks/use-text-audio";
import { success, tap } from "@/lib/feedback";
import type { SayLine } from "@/lib/lesson-sessions";
import { cn } from "@/lib/utils";

export function SayStep({ lines }: { lines: SayLine[] }) {
  const audio = useTextAudio();
  const [said, setSaid] = useState<ReadonlySet<number>>(new Set());
  const left = lines.length - said.size;

  return (
    <section aria-label="Nói thử" className="space-y-2.5">
      <p className="text-[13px] leading-5 text-ink-2">
        Đây đúng là những câu bạn vừa học. Bấm nghe, nhìn câu rồi <b>nói to</b> theo, sau đó tự đánh
        dấu. Không cần ghi âm.
      </p>
      <ol className="space-y-2">
        {lines.map((line, i) => {
          const done = said.has(i);
          const busy = audio.activeText === line.ko && audio.state === "loading";
          const playing = audio.activeText === line.ko && audio.state === "playing";
          return (
            <li
              key={line.ko}
              className={cn(
                "rounded-[16px] border p-3 transition-colors",
                done ? "border-green/40 bg-green-soft" : "border-line bg-card",
              )}
            >
              <Ko className="block text-[19px] font-bold leading-snug">{line.ko}</Ko>
              {line.vi && <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{line.vi}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    tap();
                    void audio.play(line.ko);
                  }}
                  className="hit-area inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-fill px-3 text-[13px] font-semibold active:scale-[0.97]"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Volume2 size={16} aria-hidden="true" />
                  )}
                  {playing ? "Đang phát" : "Nghe"}
                </button>
                <button
                  type="button"
                  aria-pressed={done}
                  onClick={() => {
                    const next = new Set(said);
                    if (done) next.delete(i);
                    else {
                      next.add(i);
                      if (next.size === lines.length) success();
                      else tap();
                    }
                    setSaid(next);
                  }}
                  className={cn(
                    "hit-area inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[12px] px-3 text-[13px] font-semibold active:scale-[0.97]",
                    done ? "bg-green text-primary-foreground" : "bg-blue text-primary-foreground",
                  )}
                >
                  {done ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Mic size={16} aria-hidden="true" />
                  )}
                  {done ? "Đã nói" : "Tôi đã nói"}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {audio.error && <p className="text-[12px] font-medium text-danger">{audio.error}</p>}
      <p className="text-center text-[12px] font-medium text-ink-2" aria-live="polite">
        {left === 0 ? "Xong rồi. Sang bước tiếp theo nhé." : `Còn ${left} câu.`}
      </p>
    </section>
  );
}
