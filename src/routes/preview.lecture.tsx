import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { SlideView } from "@/components/lesson/lecture/SlideLecture";
import { scriptLines, stateAt, type LectureSlidesOut } from "@/lib/lecture-slides";
import raw from "@/lib/lecture-preview-data.json";

/** A look at the slides of G1 · Day 1 without the recording: step through the script one line at a
 * time and see what each line brings onto its slide. For checking the pictures (design review,
 * screenshots); the lesson itself plays them in step with the voice. Not linked from the app. */
export const Route = createFileRoute("/preview/lecture")({
  head: () => ({
    meta: [{ title: "Xem trước slide bài giảng — Haru" }, { name: "robots", content: "noindex" }],
  }),
  component: Preview,
});

const DATA = raw as unknown as Record<string, LectureSlidesOut>;

function Preview() {
  const [sitting, setSitting] = useState("1");
  const [line, setLine] = useState(0);
  const data = DATA[sitting]!;
  const lines = useMemo(() => scriptLines(data.script), [data]);
  const state = stateAt(data, { line, run: 1 }, lines);
  const go = (d: number) => setLine((l) => Math.max(0, Math.min(lines.length - 1, l + d)));
  const jump = (d: number) => {
    let l = line;
    const cur = data.lines[l]![0];
    while (l + d >= 0 && l + d < lines.length && data.lines[l]![0] === cur) l += d;
    setLine(l);
  };
  return (
    <main className="mx-auto max-w-[560px] space-y-3 p-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        {["1", "2"].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setSitting(n);
              setLine(0);
            }}
            className={`rounded-full px-3 py-1.5 ${sitting === n ? "bg-blue text-primary-foreground" : "bg-fill"}`}
          >
            Buổi {n}
          </button>
        ))}
        <span className="ml-auto tabular-nums text-ink-2">
          dòng {line + 1}/{lines.length} · slide {state.slide + 1}/{data.slides.length}
        </span>
      </div>
      <div
        className="relative overflow-hidden rounded-[24px] text-[oklch(0.98_0.01_285)] shadow-elev-2"
        style={{ backgroundImage: "linear-gradient(155deg, oklch(0.27 0.08 250), oklch(0.37 0.1 195))" }}
      >
        <div className="relative flex min-h-[400px] flex-col p-5">
          <SlideView
            key={state.slide}
            slide={data.slides[state.slide]!}
            index={state.slide}
            state={state}
            started
            onReplay={() => {}}
            pictures={undefined}
          />
        </div>
      </div>
      <p className="min-h-[60px] rounded-[14px] bg-card p-3 text-[13.5px] leading-5">
        <span className="mr-1 text-[11px] font-bold uppercase text-ink-2">Giọng đọc:</span>
        {lines[line]}
      </p>
      <div className="grid grid-cols-4 gap-2 text-[13px] font-semibold">
        <button type="button" id="prev-slide" onClick={() => jump(-1)} className="min-h-11 rounded-[12px] bg-fill">
          ◀ slide
        </button>
        <button type="button" id="prev-line" onClick={() => go(-1)} className="min-h-11 rounded-[12px] bg-fill">
          ◀ dòng
        </button>
        <button type="button" id="next-line" onClick={() => go(1)} className="min-h-11 rounded-[12px] bg-blue text-primary-foreground">
          dòng ▶
        </button>
        <button type="button" id="next-slide" onClick={() => jump(1)} className="min-h-11 rounded-[12px] bg-fill">
          slide ▶
        </button>
      </div>
    </main>
  );
}
