import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import type { EditorialPracticeItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/* Right after reading: a few questions that use the article's own words and patterns, then one
 * question to say something about the learner's own life. Graded here, nothing is sent. */

type Mcq = Extract<EditorialPracticeItem, { type: "mcq" }>;
const SKILL: Record<Mcq["skill"], string> = {
  reading: "Hiểu bài",
  vocab: "Từ vựng",
  grammar: "Ngữ pháp",
};

function McqCard({
  item,
  index,
  picked,
  onPick,
}: {
  item: Mcq;
  index: number;
  picked: number | undefined;
  onPick: (i: number) => void;
}) {
  const done = picked !== undefined;
  return (
    <li className="rounded-[16px] border border-line bg-card p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">
        {index}. {SKILL[item.skill]}
      </p>
      <p lang="ko" className="mt-1 whitespace-pre-line text-[15px] font-semibold leading-6">
        {item.prompt_en}
      </p>
      <div className="mt-2 grid gap-1.5">
        {item.options.map((opt, i) => {
          const right = i === item.answer_index;
          return (
            <button
              key={i}
              type="button"
              disabled={done}
              onClick={() => onPick(i)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-[12px] border px-3 py-2 text-left text-[14px] font-medium",
                !done && "border-line bg-card active:scale-[0.99]",
                done && right && "border-green bg-green-soft",
                done && !right && picked === i && "border-danger bg-danger-soft",
                done && !right && picked !== i && "border-line opacity-60",
              )}
            >
              <span lang="ko" className="min-w-0 flex-1">
                {opt}
              </span>
              {done && right && <CheckCircle2 size={16} aria-hidden="true" />}
              {done && !right && picked === i && <XCircle size={16} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {done && (
        <p className="mt-2 rounded-[12px] bg-blue-soft px-3 py-2 text-[13px] font-medium leading-5">
          {item.explanation_vi}
        </p>
      )}
    </li>
  );
}

export function ArticlePractice({ items }: { items: EditorialPracticeItem[] }) {
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [draft, setDraft] = useState("");
  const [shown, setShown] = useState(false);
  if (items.length === 0) return null;
  const mcq = items.map((it, i) => [it, i] as const).filter(([it]) => it.type === "mcq");
  const apply = items.find((it) => it.type === "apply");
  const answered = mcq.filter(([, i]) => picks[i] !== undefined).length;
  const right = mcq.filter(([it, i]) => it.type === "mcq" && picks[i] === it.answer_index).length;
  return (
    <section className="mt-6" aria-labelledby="article-practice">
      <h2 id="article-practice" className="text-lg font-semibold">
        Luyện tập sau khi đọc
      </h2>
      <p className="mt-0.5 text-xs font-medium leading-5 text-ink-2">
        Dùng chính từ và mẫu câu của bài để kiểm tra mình hiểu và nhớ.
      </p>
      <ul className="mt-3 grid gap-3">
        {mcq.map(([it, i], n) =>
          it.type === "mcq" ? (
            <McqCard
              key={i}
              item={it}
              index={n + 1}
              picked={picks[i]}
              onPick={(p) => setPicks((s) => ({ ...s, [i]: p }))}
            />
          ) : null,
        )}
      </ul>
      {mcq.length > 0 && answered === mcq.length && (
        <p className="mt-3 text-[13px] font-semibold" role="status">
          Đúng {right}/{mcq.length} câu.
        </p>
      )}
      {apply && apply.type === "apply" && (
        <div className="mt-4 rounded-[16px] border border-line bg-card p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">
            Áp dụng vào chính bạn
          </p>
          <p className="mt-1 text-[14px] font-semibold leading-6">{apply.prompt_vi}</p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            lang="ko"
            rows={3}
            placeholder="Viết 2–3 câu tiếng Hàn…"
            className="mt-2 w-full rounded-[12px] border border-line bg-card px-3 py-2 text-[14px]"
          />
          {!shown ? (
            <button
              type="button"
              onClick={() => setShown(true)}
              className="hit-area mt-2 min-h-11 rounded-[12px] bg-ink px-4 text-[13px] font-semibold text-card"
            >
              Xem câu mẫu
            </button>
          ) : (
            <p
              lang="ko"
              className="mt-2 whitespace-pre-line rounded-[12px] bg-blue-soft px-3 py-2 text-[14px] leading-6"
            >
              {apply.model_en}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
