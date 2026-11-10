import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookMarked, Compass, HelpCircle, Mountain } from "lucide-react";

import type { PracticeSupportOut } from "@/lib/api/types";
import type { Level, LevelChoice } from "@/lib/adaptive-practice";
import { writeLocal } from "@/lib/lesson-local";
import { cn } from "@/lib/utils";
import { Ko, Rich } from "./Rich";

const MARKS = ["①", "②", "③", "④", "⑤"] as const;
const FIRST_WORDS = 6;
const FIRST_GRAMMAR = 3;

function More({ hidden, onClick }: { hidden: number; onClick: () => void }) {
  if (hidden <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="hit-area mt-1 inline-flex min-h-8 items-center text-xs font-semibold text-blue-deep underline"
    >
      Xem thêm {hidden}
    </button>
  );
}

/** The first time the course uses a question type: what it is and how to do it, in one line. */
export function TypeIntro({ name, how }: { name: string; how: string }) {
  return (
    <aside className="flex gap-2.5 rounded-[14px] border border-transparent bg-blue-soft px-3 py-2.5">
      <Compass size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-blue-deep" />
      <p className="text-xs font-semibold leading-5">
        <span className="text-blue-deep">Dạng mới · {name}</span>
        <br />
        <Rich text={how} />
      </p>
    </aside>
  );
}

/** Where the long, exam-style items of a skill begin. */
/** Marks one hard item mixed in among the easier ones. */
export function ChallengeTag() {
  return (
    <p className="flex items-center gap-1.5 pt-2 text-xs font-semibold text-ink-2">
      <Mountain size={14} strokeWidth={2.4} aria-hidden="true" />
      Thử thách TOPIK · đoạn dài kiểu đề thi, có từ bạn chưa học
    </p>
  );
}

const LEVEL_CHOICES: { id: LevelChoice; label: string }[] = [
  { id: "auto", label: "Tự động" },
  { id: "support", label: "Nhẹ" },
  { id: "steady", label: "Vừa" },
  { id: "stretch", label: "Nhiều thử thách" },
];
const LEVEL_NOTE: Record<Level, string> = {
  support: "Đang xen ít thử thách, ưu tiên câu vừa sức.",
  steady: "Câu vừa sức, thỉnh thoảng có một bài thử thách.",
  stretch: "Bạn đang làm tốt: thử thách xuất hiện nhiều hơn.",
};

/** Lets the learner see, and set by hand, how often a challenge is mixed in. */
export function LevelPicker({
  choice,
  level,
  onPick,
}: {
  choice: LevelChoice;
  level: Level;
  onPick: (c: LevelChoice) => void;
}) {
  return (
    <div className="rounded-[14px] bg-blue-soft px-3 py-2.5">
      <div role="group" aria-label="Mức luyện tập" className="flex flex-wrap gap-1.5">
        {LEVEL_CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={choice === c.id}
            onClick={() => onPick(c.id)}
            className={cn(
              "hit-area min-h-9 rounded-full px-3 text-xs font-semibold transition-colors",
              choice === c.id ? "bg-blue text-primary-foreground" : "bg-card text-ink-2",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs font-semibold text-ink-2">
        {choice === "auto" ? LEVEL_NOTE[level] : "Bạn tự chọn mức; hệ thống không đổi giúp bạn."}
      </p>
    </div>
  );
}

/** Before a hard item: the words of this text, the grammar not met yet, and a hint in three steps. */
export function ItemSupport({
  support,
  questionIds,
}: {
  support: PracticeSupportOut;
  /** the item's question ids in order (several for a "2 câu hỏi" item) */
  questionIds: string[];
}) {
  const [step, setStep] = useState(0);
  // a short list first, so a long passage does not open with a wall of notes
  const [allWords, setAllWords] = useState(false);
  const [allGrammar, setAllGrammar] = useState(false);
  const words = allWords ? support.words : support.words.slice(0, FIRST_WORDS);
  const grammar = allGrammar ? support.grammar : support.grammar.slice(0, FIRST_GRAMMAR);
  const translated = Object.keys(support.options_vi).length > 0;
  const crossable = Object.keys(support.elim).length > 0;
  const labels = [
    "Nên chú ý gì",
    ...(translated ? ["Nghĩa các đáp án"] : []),
    ...(crossable ? ["Loại 1 đáp án"] : []),
  ];
  const many = questionIds.length > 1;
  const name = (qid: string) => (many ? `Câu ${questionIds.indexOf(qid) + 1}: ` : "");

  return (
    <section
      aria-label="Chuẩn bị trước khi làm"
      className="rounded-[14px] border border-dashed border-line px-3 py-2.5"
    >
      {support.words.length > 0 && (
        <>
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <BookMarked size={14} strokeWidth={2.4} aria-hidden="true" />
            Từ cần biết trong bài này
          </p>
          <ul className="mt-1.5 grid grid-cols-1 gap-x-3 gap-y-1 text-xs leading-5 sm:grid-cols-2">
            {words.map((w) => (
              <li key={w.ko}>
                <Ko className="font-semibold">{w.ko}</Ko>
                {w.seen !== w.ko && (
                  <span className="text-ink-2">
                    {" "}
                    (<Ko>{w.seen}</Ko>)
                  </span>
                )}{" "}
                — {w.vi}
              </li>
            ))}
          </ul>
          <More hidden={support.words.length - words.length} onClick={() => setAllWords(true)} />
        </>
      )}

      {support.grammar.length > 0 && (
        <>
          <p className="mt-3 text-xs font-semibold">Ngữ pháp bạn chưa học</p>
          <ul className="mt-1 space-y-1.5 text-xs leading-5">
            {grammar.map((g) => (
              <li key={g.form}>
                <Ko className="font-semibold">{g.form}</Ko> — {g.vi}{" "}
                <span className="text-ink-2">
                  (<Ko>{g.seen}</Ko>)
                </span>
                <br />
                {g.lesson_id != null ? (
                  <Link
                    to="/lesson/$id"
                    params={{ id: String(g.lesson_id) }}
                    onClick={() => writeLocal(`step:${g.lesson_id}`, "grammar")}
                    className="hit-area inline-flex min-h-7 items-center font-semibold text-blue-deep underline"
                  >
                    Học ở bài “{g.lesson_title}”
                  </Link>
                ) : (
                  <span className="text-ink-2">Chưa có bài riêng: nhớ theo nghĩa ở trên.</span>
                )}
              </li>
            ))}
          </ul>
          <More
            hidden={support.grammar.length - grammar.length}
            onClick={() => setAllGrammar(true)}
          />
        </>
      )}

      <div className="mt-3 flex items-center gap-1.5">
        <HelpCircle size={14} strokeWidth={2.4} aria-hidden="true" />
        <span className="text-xs font-semibold">Cần gợi ý?</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {labels.map((label, i) => {
          const opened = step > i;
          return (
            <button
              key={label}
              type="button"
              disabled={opened || i > step}
              onClick={() => setStep(i + 1)}
              className={cn(
                "hit-area min-h-9 rounded-full border border-line px-3 text-[12px] font-semibold active:scale-95 disabled:opacity-50",
                opened ? "bg-yellow-soft" : "bg-card",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 space-y-2 text-xs font-semibold leading-5">
        {step >= 1 && (
          <p className="rounded-[12px] bg-yellow-soft px-2.5 py-1.5">
            <Rich text={support.focus_vi} />
          </p>
        )}
        {step >= 2 && translated && (
          <div className="rounded-[12px] bg-yellow-soft px-2.5 py-1.5">
            {questionIds
              .filter((q) => support.options_vi[q])
              .map((q) => (
                <ul key={q} className={cn(many && "mt-1 first:mt-0")}>
                  {many && <li className="text-ink-2">{name(q).replace(/: $/, "")}</li>}
                  {support.options_vi[q]!.map((t, i) => (
                    <li key={i}>
                      {MARKS[i]} {t}
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        )}
        {step >= (translated ? 3 : 2) && crossable && (
          <p className="rounded-[12px] bg-yellow-soft px-2.5 py-1.5">
            {questionIds
              .filter((q) => support.elim[q])
              .map(
                (q) =>
                  `${name(q)}${many ? "đáp án" : "Đáp án"} ${MARKS[Number(support.elim[q]) - 1]} sai`,
              )
              .join(" · ")}
            .
          </p>
        )}
      </div>
    </section>
  );
}
