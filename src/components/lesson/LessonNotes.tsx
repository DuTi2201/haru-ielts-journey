import { useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Landmark,
  MessageSquareText,
  PenLine,
  Target,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { LessonNoteKind, LessonNoteOut } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Disclosure } from "./Disclosure";
import { ExamChip } from "./ExamChip";
import { Rich } from "./Rich";
import { ReadingSteps, VocabSteps } from "./HowToCards";

/** The lesson's notes, grouped by what they are for. A lesson used to show every note as the
 * same open yellow card, one long uniform scroll; now the goal comes first as a plain panel,
 * and each kind of note has its own heading and colour and stays folded until it is wanted. */
const KINDS: Record<
  LessonNoteKind,
  { label: string; hint?: string; icon: LucideIcon; tone: string }
> = {
  goal: { label: "Mục tiêu của bài", icon: Target, tone: "bg-blue-soft" },
  language: { label: "Mẫu câu & ngữ pháp ôn", icon: MessageSquareText, tone: "bg-card" },
  sample: { label: "Hội thoại & bài đọc mẫu", icon: MessageSquareText, tone: "bg-card" },
  fact: {
    label: "Đời sống Hàn Quốc",
    hint: "Để hiểu bối cảnh — không cần thuộc số liệu.",
    icon: Landmark,
    tone: "bg-green-soft",
  },
  writing: {
    label: "Luyện viết TOPIK",
    hint: "Thử tự điền trước, rồi mới xem đáp án mẫu.",
    icon: PenLine,
    tone: "bg-purple-soft",
  },
  pitfall: { label: "Lỗi người Việt hay mắc", icon: TriangleAlert, tone: "bg-yellow-soft" },
};
const ORDER: LessonNoteKind[] = ["goal", "language", "sample", "fact", "writing", "pitfall"];

/** Short lessons (a note or two) are shown open; the long ones start folded. */
const OPEN_ALL_BELOW = 900;

// ① ㉠ … : the circled Hangul that numbers the blanks of a Viết 51/52 model text
const BLANK = /\*\*\(([㉠-㉿])\s+(.+?)\)\*\*/g;
const ANSWER_LINE = /^\s*\*{1,2}(?:Bản dịch|Ghi chú)/;

export function hasBlanks(body: string): boolean {
  return new RegExp(BLANK.source).test(body);
}

/** The model text with its answers hidden: each `(㉠ answer)` becomes `(㉠ ＿＿＿＿＿)`, and the
 * translation / grammar-note lines (which would give the answers away) are left out. */
export function maskAnswers(body: string): string {
  return body
    .replace(BLANK, (_m, mark: string) => `**(${mark} ＿＿＿＿＿)**`)
    .split("\n")
    .filter((line) => !ANSWER_LINE.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Under the "Đời sống Hàn Quốc" heading a note's own "Đời sống: " prefix is redundant (the
 * prefix stays in the data: the lecture reads the title, and has no heading to go by). */
function displayTitle(note: LessonNoteOut, underHeading: boolean): string {
  const title = note.title ?? "Ghi chú của bài";
  return underHeading && note.kind === "fact" ? title.replace(/^Đời sống:\s*/, "") : title;
}

function NoteBody({
  note,
  onOpenWriting,
}: {
  note: LessonNoteOut;
  onOpenWriting?: (() => void) | undefined;
}) {
  const fillable = note.kind === "writing" && hasBlanks(note.body);
  const [shown, setShown] = useState(false);
  if (!fillable) return <Rich as="p" text={note.body} className="text-xs leading-5" />;
  return (
    <div className="space-y-2.5">
      <Rich
        as="p"
        text={shown ? note.body : maskAnswers(note.body)}
        className="text-xs leading-5"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={shown}
          onClick={() => setShown((v) => !v)}
          className="hit-area inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-xs font-semibold shadow-elev-1 active:scale-[0.97]"
        >
          {shown ? (
            <EyeOff size={14} strokeWidth={2.6} aria-hidden="true" />
          ) : (
            <Eye size={14} strokeWidth={2.6} aria-hidden="true" />
          )}
          {shown ? "Ẩn đáp án" : "Hiện đáp án, bản dịch & ghi chú"}
        </button>
        {onOpenWriting && (
          <button
            type="button"
            onClick={onOpenWriting}
            className="hit-area inline-flex min-h-10 items-center gap-1 rounded-full px-2 text-xs font-semibold text-blue-deep underline-offset-2 hover:underline"
          >
            Tự điền ở phần Luyện tập →
          </button>
        )}
      </div>
    </div>
  );
}

export function LessonNotes({
  notes,
  onOpenWriting,
}: {
  notes: LessonNoteOut[];
  /** Jumps to the Viết tab of the practice step (the model texts have exercises of their own). */
  onOpenWriting?: (() => void) | undefined;
}) {
  const [aboutOpen, setAboutOpen] = useState(false);
  // three notes are not text: the book list hides behind a small "?", the two "how to" notes are drawn
  const about = notes.find((n) => n.title?.startsWith("Bài của sách"));
  const readHow = notes.find((n) => n.title === "Cách đọc từng đoạn");
  const vocabHow = notes.find((n) => n.title?.startsWith("Cách học từ"));
  notes = notes.filter((n) => n !== about && n !== readHow && n !== vocabHow);
  const groups = useMemo(() => {
    const by = new Map<LessonNoteKind, LessonNoteOut[]>();
    for (const n of notes) {
      const k: LessonNoteKind = n.kind && n.kind in KINDS ? n.kind : "language";
      by.set(k, [...(by.get(k) ?? []), n]);
    }
    return ORDER.filter((k) => by.has(k)).map((k) => ({ kind: k, notes: by.get(k)! }));
  }, [notes]);

  const folded = notes.filter((n) => n.kind !== "goal").reduce((a, n) => a + n.body.length, 0);
  const openAll = folded < OPEN_ALL_BELOW;
  // headings earn their place only when there are enough notes to get lost in
  const headings = groups.filter((g) => g.kind !== "goal").length > 1 && notes.length >= 4;

  return (
    <div className="space-y-4">
      {readHow && <ReadingSteps text={readHow.body} />}
      {vocabHow && <VocabSteps text={vocabHow.body} />}
      {groups.map(({ kind, notes: list }) => {
        const meta = KINDS[kind];
        const Icon = meta.icon;
        if (kind === "goal") {
          return (
            <section
              key={kind}
              aria-label={meta.label}
              className={cn("rounded-[14px] border border-line px-3.5 py-3", meta.tone)}
            >
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-blue-deep">
                <Icon size={15} strokeWidth={2.6} aria-hidden="true" />
                {meta.label}
              </h3>
              {list.map((n, i) => (
                <Rich key={i} as="p" text={n.body} className="mt-1.5 text-xs leading-5" />
              ))}
            </section>
          );
        }
        return (
          <section key={kind} aria-label={meta.label}>
            {headings && (
              <div className="mb-1.5 px-0.5">
                <h3 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-2">
                  <Icon size={14} strokeWidth={2.6} aria-hidden="true" />
                  {meta.label}
                  <span className="font-semibold normal-case tracking-normal">· {list.length}</span>
                </h3>
                {meta.hint && (
                  <p className="mt-0.5 text-[12px] leading-4 text-ink-2">{meta.hint}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              {list.map((n, i) => (
                <Disclosure
                  key={i}
                  title={
                    n.exam ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span>{displayTitle(n, headings)}</span>
                        <ExamChip tag={n.exam} />
                      </span>
                    ) : (
                      displayTitle(n, headings)
                    )
                  }
                  defaultOpen={openAll}
                  tone={meta.tone}
                >
                  <NoteBody
                    note={n}
                    onOpenWriting={kind === "writing" ? onOpenWriting : undefined}
                  />
                </Disclosure>
              ))}
            </div>
          </section>
        );
      })}
      {about && (
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            aria-expanded={aboutOpen}
            aria-label="Bài của sách nằm trong app"
            onClick={() => setAboutOpen((v) => !v)}
            className="hit-area grid size-8 place-items-center rounded-full border border-line bg-card text-sm font-bold text-blue-deep shadow-elev-1 active:scale-95"
          >
            ?
          </button>
          {aboutOpen && (
            <div className="w-full rounded-[14px] border border-line bg-card px-3.5 py-3 [animation:haru-fade_0.2s_ease-out_both]">
              <Rich as="p" text={about.body} className="text-xs leading-5" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
