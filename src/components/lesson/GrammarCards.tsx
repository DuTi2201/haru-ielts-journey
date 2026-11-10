import { useEffect, useRef, useState, type ReactNode } from "react";
import type { StageProfile } from "@/lib/lesson-stage";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, ChevronDown, HelpCircle, Volume2 } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { recordItemReview } from "@/lib/api/content";
import type { GrammarPointOut } from "@/lib/api/types";
import { speakKorean } from "@/lib/audio-playback";
import { miss, success, tap } from "@/lib/feedback";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ExamChip } from "./ExamChip";
import { BuiltFrom, BuiltInto, Revisits } from "./BuiltOn";
import { GrammarBadge } from "./GrammarBadge";
import { ImportanceChip } from "./ImportanceChip";
import { LessonImage } from "./LessonImage";
import { Ko, Rich, RichBlock } from "./Rich";

/** Marks a card the learner answered right in the entry diagnostic. */
function KnownChip() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-transparent bg-green-soft px-2 py-0.5 text-[12px] font-semibold">
      <Check size={11} strokeWidth={3} aria-hidden="true" /> Đã biết
    </span>
  );
}

/** "Several examples are one per line, example_vi aligned line by line". */
function examplePairs(g: GrammarPointOut): { ko: string; vi: string | null }[] {
  const ko = (g.example_ko ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const vi = (g.example_vi ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return ko.map((k, i) => ({ ko: k, vi: vi[i] ?? null }));
}

/** A part the learner opens when they want more (native <details>: keyboard and
 * screen-reader behaviour for free). Keeps the card short on a phone. */
function More({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <details className="group mt-2.5 rounded-[14px] bg-card/70">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold text-blue-deep [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{title}</span>
        <ChevronDown
          size={15}
          strokeWidth={2.6}
          className="shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="space-y-2.5 px-3 pb-3 pt-0.5">{children}</div>
    </details>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">{children}</p>;
}

/** How to build it and when to use it first; the longer "why this one" reasoning and the
 * link with the lesson fold away. An older server sends one block of text: show that. */
function UsageBlock({
  g,
  skipForm = false,
  context = "lesson",
}: {
  g: GrammarPointOut;
  skipForm?: boolean;
  context?: "lesson" | "article";
}) {
  // «Trong bài này» talks about the lesson the pattern came from: out of place on a news article
  const sections = context === "article" ? g.usage_sections?.filter((x) => x.key !== "lesson") : g.usage_sections;
  if (!sections || sections.length === 0) {
    if (!g.usage_context_vi) return null;
    return (
      <div className="mt-3">
        <SectionLabel>Ý nghĩa & cách dùng</SectionLabel>
        <RichBlock
          text={g.usage_context_vi}
          className="mt-0.5 text-[14px] leading-[23px] text-ink"
        />
      </div>
    );
  }
  const main = sections.filter(
    (x) => x.key !== "why" && x.key !== "lesson" && x.key !== "level" && !(skipForm && x.key === "form"),
  );
  const more = sections.filter((x) => x.key === "why" || x.key === "lesson" || x.key === "level");
  const onlyOne = main.length === 1 && main[0]?.label == null;
  return (
    <div className="mt-3 space-y-2.5">
      {main.map((x, i) => (
        <div key={`${x.key}-${i}`}>
          <SectionLabel>{x.label ?? (onlyOne ? "Ý nghĩa & cách dùng" : "Cách dùng")}</SectionLabel>
          <RichBlock text={x.body_vi} className="mt-1 text-[14px] leading-[23px] text-ink" />
        </div>
      ))}
      {more.length > 0 && (
        <More title="Vì sao chọn mẫu này · liên hệ với bài học">
          {more.map((x) => (
            <div key={x.key}>
              <p className="text-[11.5px] font-semibold leading-5 text-ink">
                <Rich text={x.label ?? ""} />
              </p>
              <RichBlock text={x.body_vi} className="mt-0.5 text-[13px] leading-5 text-ink-2" />
            </div>
          ))}
        </More>
      )}
    </div>
  );
}

/** Everything that explains a pattern — how it is built, when it is used, how it differs from its
 * look-alikes, the usual mistakes, the exam tip, where it comes from — behind one button: the card
 * shows the pattern, its meaning and the examples first, and the learner opens the «why» when they
 * want it (and the lecture says it all). */
function WhyBox({ pattern, children }: { pattern: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          tap();
          setOpen((v) => !v);
        }}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[14px] bg-card px-3.5 text-left text-[13px] font-semibold text-blue-deep shadow-elev-1 active:scale-[0.99]"
      >
        <span className="flex items-center gap-1.5">
          <HelpCircle size={16} strokeWidth={2.4} aria-hidden="true" />
          {open ? "Thu gọn" : "Vì sao? Cách dùng, so sánh & lỗi hay mắc"}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2.4}
          aria-hidden="true"
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div
          className="mt-2 animate-in fade-in duration-300 motion-reduce:animate-none"
          aria-label={`Giải thích ${pattern}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** For a beginner, how the pattern is built stays on the card («Cấu tạo»): without it the examples
 * cannot be copied. The rest of the explanation is behind «Vì sao?». */
function FormOnCard({ g }: { g: GrammarPointOut }) {
  const form = g.usage_sections?.find((x) => x.key === "form");
  if (!form) return null;
  return (
    <div className="mt-3 rounded-[14px] bg-card px-3 py-2.5">
      <SectionLabel>{form.label ?? "Cấu tạo"}</SectionLabel>
      <RichBlock text={form.body_vi} className="mt-1 text-[14px] leading-[23px] text-ink" />
    </div>
  );
}

/** An example's meaning: shown, or — for an advanced learner, who should read the Korean first —
 * one tap away. */
function ExampleMeaning({ text, hidden }: { text: string; hidden: boolean }) {
  const [open, setOpen] = useState(!hidden);
  if (open) return <Rich as="p" text={text} className="text-xs leading-5 text-ink-2" />;
  return (
    <button
      type="button"
      onClick={() => {
        tap();
        setOpen(true);
      }}
      className="mt-0.5 text-xs font-semibold text-blue-deep underline decoration-dotted underline-offset-2"
    >
      Xem nghĩa
    </button>
  );
}

/** "Lỗi người Việt hay mắc": one line per mistake, with room to breathe. */
function MistakesBox({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <div className="mt-3 rounded-l-[3px] rounded-r-[12px] border-l-4 border-danger/60 bg-danger-soft/25 px-3 py-2.5">
      {lines.map((l, i) => (
        <Rich
          key={i}
          as="p"
          text={i === 0 ? `⚠️ ${l}` : l}
          className={cn("text-xs leading-5 text-ink", i === 0 ? "font-semibold" : "mt-1.5")}
        />
      ))}
    </div>
  );
}

/** One grammar pattern: what it means and when it is used, how it differs from the
 * patterns it is confused with, the examples (with a device-voice play button) and
 * a self-check that goes into the learner's spaced-review schedule — the same
 * schedule as the vocabulary cards. */
export function GrammarCards({
  grammar,
  onReviewed,
  placement,
  verdicts,
  profile,
  context = "lesson",
}: {
  grammar: GrammarPointOut[];
  /** "article": on a news article, so the link with the pattern's source lesson is left out. */
  context?: "lesson" | "article";
  /** How far along the learner is (lib/lesson-stage): a beginner sees how a pattern is built on the
   * card; an advanced learner reads the examples in Korean first. */
  profile?: Pick<StageProfile, "structureOnCard" | "examplesInVietnamese"> | undefined;
  /** Called with the card's id and the verdict each time the learner marks one. */
  onReviewed?: (id: number, correct: boolean) => void;
  /** What the learner marked before (kept on the server): true = "Đã hiểu", false = "Chưa chắc".
   * This session's own choice wins over it. */
  verdicts?: Readonly<Record<number, boolean>> | undefined;
  /** The learner's entry-diagnostic result: cards answered right (`known`) get a chip, and those
   * answered right on a sentence to build or a blank to fill (`solid`) are folded away. */
  placement?: { known: ReadonlySet<number>; solid: ReadonlySet<number> } | undefined;
}) {
  const navigate = useNavigate();
  const [judged, setJudged] = useState<Record<number, boolean>>({});
  const loginHintShown = useRef(false);
  const scrolledToOpen = useRef(false);

  const verdictOf = (id: number): boolean | undefined => judged[id] ?? verdicts?.[id];
  const judgedCount = grammar.filter((g) => verdictOf(g.id) !== undefined).length;
  const unsureCount = grammar.filter((g) => verdictOf(g.id) === false).length;
  // the first card still to mark (a card folded away by the entry diagnostic counts as known)
  const firstOpen = grammar.find(
    (g) => verdictOf(g.id) === undefined && !(placement?.solid.has(g.id) ?? false),
  );
  const firstOpenId = firstOpen?.id ?? null;
  const hasRecord = verdicts !== undefined && grammar.some((g) => verdicts[g.id] !== undefined);

  const showCard = (id: number) =>
    document
      .getElementById(`grammar-card-${id}`)
      ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });

  // Coming back to a lesson: land on the first card not marked yet instead of the top. Once,
  // and only while the learner has not started marking here (never pull the page from under them).
  useEffect(() => {
    if (scrolledToOpen.current || !hasRecord || firstOpenId === null) return;
    if (Object.keys(judged).length > 0) return;
    scrolledToOpen.current = true;
    setTimeout(() => showCard(firstOpenId), 150);
  }, [hasRecord, firstOpenId, judged]);

  if (grammar.length === 0) {
    return <p className="mt-3 text-sm font-medium text-ink-2">Bài này chưa có điểm ngữ pháp.</p>;
  }

  function judge(g: GrammarPointOut, correct: boolean) {
    if (correct) success();
    else miss();
    setJudged((j) => ({ ...j, [g.id]: correct }));
    onReviewed?.(g.id, correct);
    recordItemReview({ item_type: "grammar_point", item_id: g.id, correct }).catch((err) => {
      if (err instanceof ApiError && err.status === 401 && !loginHintShown.current) {
        loginHintShown.current = true;
        toast("Đăng nhập để lưu tiến độ ngữ pháp.", {
          id: "grammar-progress-login",
          action: { label: "Đăng nhập", onClick: () => void navigate({ to: "/support-language" }) },
        });
      }
    });
  }

  const labelled = grammar.some((g) => g.importance);
  const linked = grammar.some((g) => (g.built_from?.length ?? 0) > 0);
  return (
    <>
      {(labelled || linked) && (
        <p className="mt-3 rounded-[14px] bg-card/70 px-3 py-2 text-[11.5px] font-medium leading-5 text-ink-2">
          {labelled && (
            <>
              <strong className="font-semibold text-ink">Bắt buộc</strong>: phải nhớ chắc, vì các
              mẫu sau xây trên nó. <strong className="font-semibold text-ink">Bổ trợ</strong>: nên
              biết, có thể để sau.{" "}
            </>
          )}
          {linked && (
            <>
              Ngữ pháp trung cấp phần lớn là ghép các mẫu sơ cấp, nên thẻ nào ghép từ thẻ cũ sẽ chỉ
              rõ là ghép từ thẻ nào: bấm vào để ôn lại phần nền.
            </>
          )}
        </p>
      )}
      {judgedCount > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] bg-card/70 px-3 py-2 text-[11.5px] font-medium leading-5 text-ink-2">
          <span>
            Bạn đã đánh dấu{" "}
            <strong className="font-semibold text-ink">
              {judgedCount}/{grammar.length}
            </strong>{" "}
            mẫu
            {unsureCount > 0 ? ` · ${unsureCount} mẫu đang “Chưa chắc”` : ""}.
          </span>
          {firstOpen && (
            <button
              type="button"
              onClick={() => {
                tap();
                showCard(firstOpen.id);
              }}
              className="hit-area min-h-9 font-semibold text-blue-deep underline underline-offset-2"
            >
              Tới mẫu chưa đánh dấu
            </button>
          )}
        </p>
      )}
      <ul className="mt-3 space-y-3.5">
        {grammar.map((g) => {
          const pairs = examplePairs(g);
          const verdict = verdictOf(g.id);
          const folded = placement?.solid.has(g.id) ?? false;
          const known = placement?.known.has(g.id) ?? false;
          const body = (
            <>
              {known && !folded && (
                <p className="mb-1.5">
                  <KnownChip />
                </p>
              )}
              <p lang="ko" className="font-korean text-lg font-semibold leading-7">
                {g.pattern}
              </p>
              <Rich
                as="p"
                text={g.meaning_vi}
                className="mt-0.5 text-[13px] font-semibold leading-5 text-blue-deep"
              />

              {profile?.structureOnCard && <FormOnCard g={g} />}

              {/* the situation the examples are about, right above them */}
              <LessonImage src={g.image_url} className="mt-3 aspect-[4/3] w-full max-w-[260px]" />

              {pairs.length > 0 && (
                <div className="mt-2.5">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">
                    Ví dụ
                  </p>
                  <ul className="mt-1 space-y-2">
                    {pairs.map((p, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 rounded-[12px] bg-card px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <Ko className="block text-[13.5px] font-semibold leading-6">{p.ko}</Ko>
                          {p.vi && (
                            <ExampleMeaning
                              text={p.vi}
                              hidden={profile ? !profile.examplesInVietnamese : false}
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            tap();
                            speakKorean(p.ko);
                          }}
                          aria-label={`Nghe câu ví dụ ${i + 1}`}
                          className="hit-area flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue-deep active:scale-90"
                        >
                          <Volume2 size={16} strokeWidth={2.4} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <WhyBox pattern={g.pattern}>
                {(g.tier === "extension" || g.exam || g.importance) && (
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    {g.tier === "extension" && (
                      <GrammarBadge tier={g.tier} useLevel={g.use_level} className="bg-card" />
                    )}
                    <ImportanceChip importance={g.importance} />
                    <ExamChip tag={g.exam} className="bg-card" />
                  </div>
                )}
                <Revisits card={g.revisit_of} lessonId={g.lesson_id} />
                <BuiltFrom refs={g.built_from} lessonId={g.lesson_id} />

                <UsageBlock g={g} skipForm={!!profile?.structureOnCard} context={context} />

                {g.contrasts && g.contrasts.length > 0 && (
                  <div className="mt-3 rounded-[14px] bg-card/80 px-3 py-2.5">
                    <SectionLabel>
                      {g.contrast_group ? `Phân biệt · ${g.contrast_group}` : "Khác biệt"}
                    </SectionLabel>
                    <ul className="mt-1.5 space-y-2.5">
                      {g.contrasts.map((c) => (
                        <li
                          key={c.pattern}
                          className="border-l-2 border-line pl-2.5 text-xs leading-5"
                        >
                          <Ko className="font-semibold text-ink">{c.pattern}</Ko>
                          <Rich as="p" text={c.diff_vi} className="mt-0.5 text-ink-2" />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <BuiltInto refs={g.built_into} lessonId={g.lesson_id} />

                {g.note_vi && <MistakesBox text={g.note_vi} />}
                {g.topik_tip_vi && (
                  <More title="💡 Mẹo cho bài thi TOPIK">
                    <Rich as="p" text={g.topik_tip_vi} className="text-xs leading-5 text-ink-2" />
                  </More>
                )}

                {g.source_note_vi && (
                  <Rich
                    as="p"
                    text={`ⓘ Nguồn: ${g.source_note_vi}`}
                    className="mt-3 text-[10.5px] leading-4 text-ink-2/80"
                  />
                )}
              </WhyBox>

              <div
                className="mt-3 flex items-center gap-2"
                role="group"
                aria-label={`Tự đánh giá ${g.pattern}`}
              >
                <button
                  type="button"
                  onClick={() => judge(g, false)}
                  aria-pressed={verdict === false}
                  className={cn(
                    "hit-area flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[14px] border border-line px-2 text-xs font-semibold active:scale-95",
                    verdict === false ? "bg-yellow-strong" : "bg-card",
                  )}
                >
                  <HelpCircle size={15} strokeWidth={2.4} /> Chưa chắc
                </button>
                <button
                  type="button"
                  onClick={() => judge(g, true)}
                  aria-pressed={verdict === true}
                  className={cn(
                    "hit-area flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[14px] border border-line px-2 text-xs font-semibold active:scale-95",
                    verdict === true ? "bg-green-soft" : "bg-card",
                  )}
                >
                  <Check size={15} strokeWidth={2.6} /> Đã hiểu
                </button>
              </div>
              {verdict !== undefined && (
                <p role="status" className="mt-1.5 text-[12px] font-semibold text-ink-2">
                  {verdict
                    ? "Đã ghi — mẫu này sẽ quay lại ôn theo lịch giãn cách."
                    : "Đã ghi — mẫu này sẽ được nhắc lại sớm hơn."}
                </p>
              )}
            </>
          );
          return folded ? (
            <li key={g.id} id={`grammar-card-${g.id}`} className="scroll-mt-28">
              <details className="group card-soft rounded-[22px] bg-purple-soft p-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    <Ko className="block text-base font-semibold leading-6">{g.pattern}</Ko>
                    <Rich
                      as="p"
                      text={g.meaning_vi}
                      className="text-xs font-semibold leading-5 text-ink-2"
                    />
                  </span>
                  <KnownChip />
                  <ChevronDown
                    size={16}
                    strokeWidth={2.6}
                    aria-hidden="true"
                    className="shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <div className="mt-2">{body}</div>
              </details>
            </li>
          ) : (
            <li
              key={g.id}
              id={`grammar-card-${g.id}`}
              className="card-soft scroll-mt-28 rounded-[22px] bg-purple-soft p-4"
            >
              {body}
            </li>
          );
        })}
      </ul>
    </>
  );
}
