/** The "Cả bài" listen tab. A whole-lesson lecture is long and costly to make, so it is only played
 * when it already exists; otherwise the learner picks one sitting (buổi), whose lecture is short. */
import { useQuery } from "@tanstack/react-query";
import { useState, type ComponentProps } from "react";
import { getLectureStatus } from "@/lib/api/audio";
import { cn } from "@/lib/utils";
import { SlideLecture } from "./SlideLecture";

type Passed = Omit<ComponentProps<typeof SlideLecture>, "sitting">;

export function WholeLecture(props: Passed) {
  const status = useQuery({
    queryKey: ["lecture-status", props.lessonId],
    queryFn: () => getLectureStatus(props.lessonId),
    staleTime: 60_000,
    retry: 1,
  });
  const [picked, setPicked] = useState<number | null>(null);

  if (status.isPending) {
    return (
      <div
        className="h-40 animate-pulse rounded-2xl bg-muted"
        aria-label="Đang kiểm tra bài giảng"
      />
    );
  }
  if (status.data?.whole.ready) return <SlideLecture {...props} />;

  const sittings = status.data?.sittings ?? [];
  // status unknown or a one-sitting lesson: the lecture of sitting 1 is the lesson's lecture
  if (sittings.length <= 1) return <SlideLecture {...props} sitting={1} />;

  const n = picked ?? sittings.find((s) => !s.ready)?.n ?? 1;
  return (
    <div className="space-y-3">
      <p className="text-[13px] font-semibold">Nghe bài giảng theo từng buổi</p>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Chọn buổi để nghe">
        {sittings.map((s) => (
          <button
            key={s.n}
            type="button"
            role="tab"
            aria-selected={n === s.n}
            onClick={() => setPicked(s.n)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[13px] font-semibold",
              n === s.n
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-ink-2",
            )}
          >
            Buổi {s.n}
            {s.ready ? " ✓" : ""}
          </button>
        ))}
      </div>
      <SlideLecture key={n} {...props} sitting={n} />
    </div>
  );
}
