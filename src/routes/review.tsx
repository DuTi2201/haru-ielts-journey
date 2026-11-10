import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  Coffee,
  Headphones,
  Loader2,
  LogIn,
  Newspaper,
  RotateCcw,
  X,
} from "lucide-react";

import { ChunkDetails, ContrastList, FamilyChip } from "@/components/haru/ChunkDetails";
import { Mascot } from "@/components/mascot/Mascot";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { TabBar } from "@/components/haru/TabBar";
import { GrammarBadge } from "@/components/lesson/GrammarBadge";
import { useAuth } from "@/hooks/use-auth";
import { useVocabAudio } from "@/hooks/use-vocab-audio";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  getReviewQueue,
  markKnown,
  recordItemReview,
  setReviewOnly,
  unmarkKnown,
} from "@/lib/api/content";
import type { ReviewQueueItem } from "@/lib/api/types";
import { miss, success, tap } from "@/lib/feedback";
import { Rich } from "@/components/lesson/Rich";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Ôn tập hôm nay — Haru" },
      { name: "description", content: "Ôn từ vựng và ngữ pháp đến hạn trên Haru." },
      { property: "og:title", content: "Ôn tập hôm nay — Haru" },
      { property: "og:description", content: "Ôn từ vựng và ngữ pháp đến hạn trên Haru." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // ?focus=weak: only the cards the learner keeps forgetting ("Ôn thẻ hay sai").
  validateSearch: (search: Record<string, unknown>): { focus?: "weak" | undefined } =>
    search["focus"] === "weak" ? { focus: "weak" } : {},
  component: ReviewScreen,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] overflow-hidden bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <div className="relative z-10">{children}</div>
      <TabBar />
    </main>
  );
}

function BackToToday() {
  return (
    <Link
      to="/today"
      onClick={() => tap()}
      className="hit-area -ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-semibold text-blue-deep active:scale-95"
    >
      <ArrowLeft size={15} strokeWidth={2.6} /> Hôm nay
    </Link>
  );
}

function BackToProgress() {
  return (
    <Link
      to="/progress"
      onClick={() => tap()}
      className="hit-area -ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-semibold text-blue-deep active:scale-95"
    >
      <ArrowLeft size={15} strokeWidth={2.6} /> Tiến bộ
    </Link>
  );
}

/** One card in the sitting. A card answered wrong comes back once at the end,
 * marked `retry`, so it is asked again before the learner leaves. */
interface Card {
  key: string;
  item: ReviewQueueItem;
  retry: boolean;
}

const cardKey = (item: ReviewQueueItem, retry: boolean) =>
  `${item.item_type}:${item.item_id}${retry ? ":again" : ""}`;

function title(item: ReviewQueueItem): string {
  return item.vocab?.headword ?? item.grammar?.pattern ?? "";
}

function meaning(item: ReviewQueueItem): string {
  return item.vocab?.meaning_vi ?? item.grammar?.meaning_vi ?? "";
}

function kindLabel(card: Card): string {
  if (card.retry) return "Làm lại";
  if (card.item.is_new) return "Thẻ mới";
  if (card.item.mode === "cloze") return "Điền từ";
  return card.item.lapses > 0 ? "Đã quên trước đây" : "Ôn lại";
}

/** How a right answer went: `hard` = "Chưa chắc" (a guess); `responseMs` = how long it took. */
interface AnswerExtra {
  chosen?: string | undefined;
  hard?: boolean | undefined;
  responseMs?: number | undefined;
}

/** A right answer slower than this counts as "chưa chắc" (the server applies the same rule). */
const SLOW_MS = 8000;

interface AnswerProps {
  /** Records the answer (right or wrong); the card stays on screen. `chosen` is
   * the option a wrong fill-in-the-blank picked. */
  onResult: (correct: boolean, extra?: AnswerExtra) => void;
  /** Moves on to the next card. */
  onNext: () => void;
}

/** "✓ Đã biết" on a new card: the learner already knows it, so it is not studied. */
function KnownButton({ onKnown }: { onKnown: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        tap();
        onKnown();
      }}
      className="hit-area mx-auto mt-3 flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-ink-2 active:scale-95"
    >
      <Check size={14} strokeWidth={2.6} /> Đã biết, bỏ qua thẻ này
    </button>
  );
}

function ListenButton({
  item,
  audio,
}: {
  item: ReviewQueueItem;
  audio: ReturnType<typeof useVocabAudio>;
}) {
  if (!item.vocab) return null;
  const vocab = item.vocab;
  return (
    <button
      type="button"
      onClick={() => void audio.play(vocab.id, vocab.headword)}
      disabled={audio.state === "loading"}
      className="hit-area card-soft flex min-h-9 items-center gap-1.5 rounded-full bg-blue-soft px-3 text-xs font-semibold text-blue-deep active:scale-95 disabled:opacity-60"
    >
      {audio.state === "loading" ? (
        <Loader2 size={14} strokeWidth={2.6} className="animate-spin" />
      ) : (
        <Headphones size={14} strokeWidth={2.6} />
      )}
      Nghe
    </button>
  );
}

/** Flip the card, then judge yourself. The answer buttons only appear after the
 * flip: judging a card you have not looked at would be a guess. */
function RecognizeCard({
  item,
  audio,
  onResult,
  onNext,
  onKnown,
}: AnswerProps & {
  item: ReviewQueueItem;
  audio: ReturnType<typeof useVocabAudio>;
  /** Shown on a new card: "Đã biết". */
  onKnown?: (() => void) | undefined;
}) {
  const [revealed, setRevealed] = useState(false);
  const { vocab, grammar } = item;

  function answer(correct: boolean, hard = false) {
    onResult(correct, { hard });
    onNext();
  }

  return (
    <div>
      <div className="card-soft rounded-[24px] bg-card px-5 pb-5 pt-6 text-center">
        <p
          lang="ko"
          className={cn(
            "font-korean font-semibold tracking-tight",
            title(item).length > 10 ? "text-2xl" : "text-4xl",
          )}
        >
          {title(item)}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          {vocab?.pos && (
            <span className="rounded-full bg-progress px-2.5 py-0.5 text-[12px] font-semibold text-ink-2">
              {vocab.pos}
            </span>
          )}
          {grammar && (
            <span className="rounded-full bg-purple-soft px-2.5 py-0.5 text-[12px] font-semibold text-ink">
              Ngữ pháp
            </span>
          )}
          {grammar?.tier === "extension" && (
            <GrammarBadge tier={grammar.tier} useLevel={grammar.use_level} />
          )}
          <FamilyChip family={vocab?.family} />
        </div>

        {revealed ? (
          <div className="mt-4 animate-in space-y-2 border-t border-line pt-4 duration-300 fade-in motion-reduce:animate-none">
            <p className="text-lg font-semibold text-blue-deep">{meaning(item)}</p>
            {vocab?.example_en && (
              <p lang="ko" className="font-korean text-[13px] leading-5 text-ink-2">
                {vocab.example_en}
              </p>
            )}
            {vocab?.sino_vietnamese && (
              <p className="text-xs text-ink-2">Hán Việt: {vocab.sino_vietnamese}</p>
            )}
            {vocab && <ChunkDetails item={vocab} className="pt-1" />}
            {grammar && <GrammarBack grammar={grammar} />}
          </div>
        ) : null}
      </div>

      {audio.state === "error" && (
        <p className="mt-1 text-center text-[11px] font-semibold text-ink-2">
          {audio.usedFallback
            ? "Đang phát bằng giọng đọc của thiết bị (không tạo được giọng từ máy chủ)."
            : audio.error || "Không tạo được giọng đọc, thử lại nhé."}
        </p>
      )}

      {/* the actions sit at the bottom, in reach of the thumb, above the tab bar */}
      {!revealed && onKnown && <KnownButton onKnown={onKnown} />}
      <div aria-hidden="true" className="h-20" />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+0.25rem)] z-30 mx-auto max-w-[390px] px-3">
        <div className="glass-panel pointer-events-auto rounded-[20px] p-1.5">
          {revealed ? (
            <div className="flex gap-2">
              <GradeButton
                tone="bg-danger-soft text-ink"
                icon={<X size={14} strokeWidth={2.6} />}
                label="Chưa nhớ"
                hint="ôn lại ngay"
                onClick={() => answer(false)}
              />
              <GradeButton
                tone="bg-yellow-soft text-ink ring-1 ring-inset ring-yellow-strong"
                icon={<CircleHelp size={14} strokeWidth={2.6} />}
                label="Chưa chắc"
                hint="quay lại sớm"
                title="Nhớ ra nhưng còn đoán: thẻ sẽ quay lại sớm hơn"
                onClick={() => answer(true, true)}
              />
              <GradeButton
                tone="bg-green-soft text-ink"
                icon={<Check size={14} strokeWidth={2.6} />}
                label="Đã nhớ"
                hint="giãn lịch ôn"
                onClick={() => answer(true)}
              />
            </div>
          ) : (
            <div className="flex gap-2">
              {vocab && (
                <button
                  type="button"
                  onClick={() => void audio.play(vocab.id, vocab.headword)}
                  disabled={audio.state === "loading"}
                  aria-label="Nghe phát âm"
                  className="flex h-12 w-14 shrink-0 items-center justify-center rounded-[16px] bg-blue-soft text-blue-deep active:scale-95 disabled:opacity-60"
                >
                  {audio.state === "loading" ? (
                    <Loader2 size={20} strokeWidth={2.4} className="animate-spin" />
                  ) : (
                    <Headphones size={20} strokeWidth={2.4} />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  tap();
                  setRevealed(true);
                }}
                className="flex min-h-12 flex-1 items-center justify-center rounded-[16px] bg-blue px-4 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
              >
                Xem nghĩa
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GradeButton({
  tone,
  icon,
  label,
  hint,
  title,
  onClick,
}: {
  tone: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? hint}
      aria-label={`${label}: ${hint}`}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center rounded-[14px] px-1 transition-transform active:scale-95",
        tone,
      )}
    >
      <span className="flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold">
        {icon}
        {label}
      </span>
    </button>
  );
}

/** Pick the word that goes with the rest: the blank question TOPIK asks. The
 * answer is marked on the spot; "Tiếp" waits so the learner can read the whole
 * phrase and what else it pairs with. */
function ClozeCard({ item, onResult, onNext }: AnswerProps & { item: ReviewQueueItem }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [unsure, setUnsure] = useState(false);
  const [tookMs, setTookMs] = useState<number | null>(null);
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now(); // the card is keyed: this is when it appeared
  }, []);
  const cloze = item.cloze;
  const vocab = item.vocab;
  if (!cloze || !vocab) return null;
  const done = picked !== null;
  const right = picked === cloze.answer;
  const slow = tookMs !== null && tookMs > SLOW_MS;

  function pick(choice: string) {
    if (picked !== null || !cloze) return;
    const correct = choice === cloze.answer;
    setPicked(choice);
    setTookMs(Date.now() - shownAt.current);
    if (correct) {
      success();
      return; // saved on "Tiếp", together with "Chưa chắc" if the learner taps it
    }
    miss();
    onResult(false, { chosen: choice });
  }

  function next() {
    tap();
    if (right) onResult(true, { hard: unsure, responseMs: tookMs ?? undefined });
    onNext();
  }

  return (
    <div>
      <div className="card-soft rounded-[24px] bg-card px-5 pb-5 pt-5 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">
          Chọn từ còn thiếu
        </p>
        <p className="mt-1 text-sm font-semibold text-blue-deep">{vocab.meaning_vi}</p>
        <p lang="ko" className="font-korean mt-3 text-3xl font-semibold tracking-tight">
          {cloze.prompt_en}
        </p>
        <FamilyChip family={vocab.family} className="mt-3" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5" role="group" aria-label="Các lựa chọn">
        {cloze.choices.map((choice) => {
          const isAnswer = choice === cloze.answer;
          const isPicked = choice === picked;
          return (
            <button
              key={choice}
              type="button"
              lang="ko"
              disabled={done}
              onClick={() => pick(choice)}
              className={cn(
                "card-soft font-korean min-h-12 rounded-[16px] px-3 py-2.5 text-lg font-semibold transition-transform active:scale-95",
                !done && "bg-card",
                done && isAnswer && "bg-green-soft ring-2 ring-green",
                done && isPicked && !isAnswer && "bg-danger-soft ring-2 ring-danger",
                done && !isAnswer && !isPicked && "bg-card opacity-60",
              )}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {done && (
        <div
          role="status"
          className="card-soft mt-3 animate-in space-y-2 rounded-[20px] bg-card p-4 duration-300 fade-in motion-reduce:animate-none"
        >
          <p className={cn("text-sm font-semibold", right ? "text-ink" : "text-danger")}>
            {right ? "Đúng rồi!" : `Chưa đúng — đáp án là ${cloze.answer}`}
          </p>
          {right && slow && (
            <p className="text-[12px] font-medium text-ink-2">
              Bạn nghĩ hơi lâu, Haru sẽ cho thẻ này quay lại sớm hơn một chút.
            </p>
          )}
          {right && !slow && (
            <button
              type="button"
              aria-pressed={unsure}
              onClick={() => {
                tap();
                setUnsure((u) => !u);
              }}
              className={cn(
                "hit-area inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold active:scale-95",
                unsure ? "bg-yellow-soft text-ink" : "bg-progress text-ink-2",
              )}
            >
              <CircleHelp size={14} strokeWidth={2.4} />
              {unsure ? "Đã ghi: chưa chắc, ôn lại sớm hơn" : "Chưa chắc? đoán trúng thôi"}
            </button>
          )}
          <p lang="ko" className="font-korean text-lg font-semibold">
            {vocab.headword}
          </p>
          <p className="text-xs font-semibold text-ink-2">{vocab.meaning_vi}</p>
          <ChunkDetails item={vocab} />
          <button
            type="button"
            onClick={next}
            className="hit-area mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-[14px] border border-transparent bg-blue px-4 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
          >
            Tiếp
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewSession({
  items,
  dueTotal,
  weak,
  onMore,
}: {
  items: ReviewQueueItem[];
  dueTotal: number;
  /** The "thẻ hay sai" sitting rather than today's due cards. */
  weak: boolean;
  onMore: () => void;
}) {
  const [deck, setDeck] = useState<Card[]>(() =>
    items.map((item) => ({ key: cardKey(item, false), item, retry: false })),
  );
  const [index, setIndex] = useState(0);
  const [tally, setTally] = useState({ right: 0, wrong: 0 });
  const [known, setKnown] = useState(0);
  const [missed, setMissed] = useState<ReviewQueueItem[]>([]);
  const audio = useVocabAudio();
  const saveFailed = useRef(false);

  const current = deck[index];
  const dueShown = items.filter((i) => !i.is_new).length;
  const newShown = items.length - dueShown;
  const articleNew = items.filter((i) => i.is_new && i.article_id).length;

  const stopAudio = audio.stop;
  useEffect(() => () => stopAudio(), [stopAudio]);

  function saveFailedOnce(err: unknown) {
    if (saveFailed.current) return;
    saveFailed.current = true;
    toast(
      err instanceof ApiError && err.status === 401
        ? "Đăng nhập để lưu tiến độ ôn tập."
        : "Chưa lưu được kết quả, kiểm tra kết nối mạng nhé.",
      { id: "review-save" },
    );
  }

  function save(item: ReviewQueueItem, correct: boolean, extra: AnswerExtra = {}) {
    // What was actually shown: a card with no fill-in-the-blank data is flipped.
    const mode = item.mode === "cloze" && item.cloze ? "cloze" : "recognize";
    // Not awaited: the next card must not wait for the network.
    recordItemReview({
      item_type: item.item_type,
      item_id: item.item_id,
      correct,
      mode,
      // Only a wrong pick says something (which word was confused with the answer).
      chosen: !correct && mode === "cloze" ? extra.chosen : undefined,
      hard: correct && extra.hard ? true : undefined,
      response_ms: correct ? extra.responseMs : undefined,
    }).catch(saveFailedOnce);
  }

  /** "Đã biết" on a new card: it leaves the sitting (and the queue) at once; "Hoàn tác" brings it
   * back at the end of the sitting. */
  function onKnown(card: Card) {
    const { item } = card;
    setKnown((n) => n + 1);
    markKnown(item.item_type, item.item_id).catch(saveFailedOnce);
    next();
    toast(`Đã đánh dấu “${title(item)}” là đã biết.`, {
      id: `known:${card.key}`,
      action: {
        label: "Hoàn tác",
        onClick: () => {
          setKnown((n) => Math.max(0, n - 1));
          unmarkKnown(item.item_type, item.item_id).catch(saveFailedOnce);
          setDeck((d) => [...d, { key: `${card.key}:back${d.length}`, item, retry: false }]);
        },
      },
    });
  }

  function onResult(card: Card, correct: boolean, extra?: AnswerExtra) {
    setTally((t) => (correct ? { ...t, right: t.right + 1 } : { ...t, wrong: t.wrong + 1 }));
    save(card.item, correct, extra);
    if (!correct && !card.retry) {
      setMissed((m) => [...m, card.item]);
      setDeck((d) => [...d, { key: cardKey(card.item, true), item: card.item, retry: true }]);
    }
  }

  function next() {
    audio.stop();
    setIndex((i) => i + 1);
  }

  if (!current) {
    const total = tally.right + tally.wrong;
    return (
      <div
        role="status"
        className="card-soft mt-4 animate-in rounded-[24px] bg-green-soft p-5 text-center duration-300 fade-in zoom-in-95 motion-reduce:animate-none"
      >
        <Mascot mood="celebrate" className="mx-auto h-14 w-14" />
        <p className="mt-2 text-sm font-semibold">
          {weak ? "Xong lượt ôn thẻ hay sai!" : "Xong lượt hôm nay!"} Nhớ {tally.right}/{total} lần
          trả lời.
        </p>
        {known > 0 && (
          <p className="mt-1 text-xs font-semibold text-ink-2">
            Bạn đã bỏ qua {known} thẻ vì đã biết — chúng không quay lại trong lượt ôn nữa.
          </p>
        )}
        {missed.length > 0 && (
          <div className="mt-3 rounded-[16px] bg-card p-3 text-left">
            <p className="text-[12px] font-semibold text-ink-2">Cần để ý thêm</p>
            <ul className="mt-1 space-y-1">
              {missed.map((m) => (
                <li key={cardKey(m, false)} className="text-xs leading-5">
                  <span lang="ko" className="font-korean font-semibold">
                    {title(m)}
                  </span>
                  <span className="text-ink-2"> — {meaning(m)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[12px] font-medium text-ink-2">
              Những thẻ này sẽ quay lại sớm hơn các thẻ khác.
            </p>
          </div>
        )}
        {!weak && dueTotal > dueShown && (
          <p className="mt-3 text-xs font-semibold text-ink-2">
            Còn {dueTotal - dueShown} thẻ đến hạn cho lượt sau.
          </p>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              tap();
              onMore();
            }}
            className="hit-area card-soft inline-flex min-h-10 items-center gap-1.5 rounded-full bg-card px-4 text-xs font-semibold active:scale-95"
          >
            <RotateCcw size={14} strokeWidth={2.4} />{" "}
            {weak ? "Kiểm tra lại thẻ hay sai" : "Kiểm tra còn thẻ nào không"}
          </button>
          <Link
            to={weak ? "/progress" : "/today"}
            onClick={() => tap()}
            className="hit-area card-soft inline-flex min-h-10 items-center gap-1.5 rounded-full bg-blue px-4 text-xs font-semibold text-primary-foreground active:scale-95"
          >
            {weak ? "Về trang Tiến bộ" : "Về trang Hôm nay"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-2">
        <span>
          Thẻ {Math.min(index + 1, deck.length)}/{deck.length} · {kindLabel(current)}
        </span>
        {current.item.mode === "cloze" && current.item.cloze && (
          <ListenButton item={current.item} audio={audio} />
        )}
      </div>
      <div
        role="progressbar"
        aria-label="Tiến độ lượt ôn"
        aria-valuemin={0}
        aria-valuemax={deck.length}
        aria-valuenow={index}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-progress"
      >
        <div
          className="h-full rounded-full bg-blue transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${(index / deck.length) * 100}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {current.item.leech && (
          <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-[12px] font-semibold text-danger">
            Hay sai
          </span>
        )}
        {current.item.article_title ? (
          <span className="inline-flex min-w-0 items-center gap-1 text-[12px] font-semibold text-ink-2">
            <Newspaper size={12} strokeWidth={2.4} className="shrink-0" />
            <span className="truncate">
              Từ bài báo: <span lang="ko">{current.item.article_title}</span>
            </span>
          </span>
        ) : current.item.bank_title ? (
          <span className="truncate text-[12px] font-semibold text-ink-2">
            {current.item.bank_title}
          </span>
        ) : (
          current.item.lesson_title && (
            <span className="text-[12px] font-semibold text-ink-2">
              Bài: {current.item.lesson_title}
            </span>
          )
        )}
      </div>

      {/* keyed by card so every new one slides in and starts unflipped */}
      <div
        key={current.key}
        className="mt-3 animate-in duration-300 fade-in slide-in-from-right-6 motion-reduce:animate-none"
      >
        {current.item.mode === "cloze" && current.item.cloze ? (
          <ClozeCard
            item={current.item}
            onResult={(correct, extra) => onResult(current, correct, extra)}
            onNext={next}
          />
        ) : (
          <RecognizeCard
            item={current.item}
            audio={audio}
            onResult={(correct, extra) => onResult(current, correct, extra)}
            onNext={next}
            onKnown={current.item.is_new && !current.retry ? () => onKnown(current) : undefined}
          />
        )}
      </div>

      {index === 0 && (
        <p className="mt-3 text-center text-[12px] font-medium text-ink-2">
          {weak
            ? `${items.length} thẻ hay quên`
            : dueShown > 0
              ? `${dueShown} thẻ đến hạn`
              : "Không có thẻ đến hạn"}
          {!weak && newShown > 0 ? ` · ${newShown} thẻ mới` : ""}
          {!weak && articleNew > 0 ? `, trong đó ${articleNew} thẻ lấy từ bài báo` : ""}
        </p>
      )}
    </div>
  );
}

/** "Hôm nay bận — chỉ ôn": today the sitting has the due cards only, no new ones. */
function ReviewOnlyToggle({ on, onChanged }: { on: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  async function flip() {
    tap();
    setBusy(true);
    try {
      await setReviewOnly(!on);
      toast(
        on
          ? "Đã bật lại thẻ mới cho hôm nay."
          : "Hôm nay chỉ ôn thẻ đến hạn, mai học thẻ mới tiếp nhé.",
        { id: "review-only" },
      );
      onChanged();
    } catch (err) {
      toast(errorMessage(err), { id: "review-only" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy}
      onClick={() => void flip()}
      className={cn(
        "hit-area card-soft mt-3 flex min-h-10 w-full items-center gap-2 rounded-[14px] px-3.5 py-2 text-left text-xs font-semibold active:scale-[0.98] disabled:opacity-60",
        on ? "bg-yellow-soft text-ink" : "bg-card text-ink-2",
      )}
    >
      {busy ? (
        <Loader2 size={15} strokeWidth={2.6} className="shrink-0 animate-spin" />
      ) : (
        <Coffee size={15} strokeWidth={2.4} className="shrink-0" />
      )}
      <span className="flex-1">
        Hôm nay bận — chỉ ôn
        <span className="block text-[11px] font-medium text-ink-2">
          {on ? "Đang bật: hôm nay không có thẻ mới." : "Bật để hôm nay chỉ ôn thẻ đến hạn."}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors motion-reduce:transition-none",
          on ? "bg-blue" : "bg-progress",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-card shadow-elev-1 transition-[left] motion-reduce:transition-none",
            on ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function AnonymousNudge() {
  return (
    <section className="mt-8 rounded-[20px] border border-line bg-card p-6 text-center shadow-elev-2">
      <Mascot mood="wave" className="mx-auto h-16 w-16" />
      <h2 className="mt-3 text-lg font-semibold leading-snug">Đăng nhập để ôn tập</h2>
      <p className="mt-1.5 text-xs font-semibold leading-5 text-ink-2">
        Haru cần biết bạn là ai để nhớ thẻ nào đến hạn và lên lịch ôn lại đúng lúc.
      </p>
      <Link
        to="/support-language"
        className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-transparent bg-blue py-2.5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
      >
        <LogIn size={16} strokeWidth={2.4} /> Đăng nhập / Tạo tài khoản
      </Link>
    </section>
  );
}

function ReviewScreen() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { focus } = Route.useSearch();
  const weak = focus === "weak";
  // Each "check again" is a new round: a new queue, a new sitting.
  const [round, setRound] = useState(0);

  const query = useQuery({
    queryKey: ["me", "review-queue", weak ? "weak" : "due", round],
    queryFn: () => getReviewQueue({ focus: weak ? "weak" : "due" }),
    enabled: auth.isAuthenticated,
    // The queue is the sitting itself: refetching it mid-way would reshuffle the cards.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // What the answers changed: today's plan and the lesson picker's progress.
  useEffect(
    () => () => {
      void queryClient.invalidateQueries({ queryKey: ["me", "plan"] });
      void queryClient.invalidateQueries({ queryKey: ["lessons"] });
      void queryClient.invalidateQueries({ queryKey: ["me", "weaknesses"] });
    },
    [queryClient],
  );

  const data = query.data;

  return (
    <Shell>
      <header>
        {weak ? <BackToProgress /> : <BackToToday />}
        <h1 className="mt-1 text-2xl font-bold leading-tight">
          {weak ? "Ôn thẻ hay sai" : "Ôn tập hôm nay"}
        </h1>
        <p className="mt-1 text-[13px] font-semibold text-ink-2">
          {weak
            ? "Những thẻ bạn đã quên gần đây, dù chưa đến hạn."
            : "Ôn đúng lúc sắp quên thì nhớ lâu hơn học dồn."}
        </p>
        {!weak && data && (
          <ReviewOnlyToggle
            on={data.review_only === true}
            onChanged={() => setRound((r) => r + 1)}
          />
        )}
      </header>

      {!auth.isLoading && !auth.isAuthenticated && <AnonymousNudge />}

      {(auth.isLoading || (auth.isAuthenticated && query.isLoading)) && (
        <LoadingBlocks
          className="mt-6"
          label="Đang chuẩn bị lượt ôn"
          blocks={["h-4 w-1/2 rounded-full", "h-48", "h-12"]}
        />
      )}

      {query.isError && (
        <ErrorState
          className="mt-6"
          title="Không tải được lượt ôn."
          message={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          className="mt-8"
          title={
            weak
              ? "Hiện không có thẻ nào bạn hay quên."
              : data.review_only
                ? "Hôm nay chỉ ôn, và bạn không còn thẻ nào đến hạn."
                : data.new_today > 0
                  ? "Hôm nay bạn đã học đủ số thẻ mới và chưa có thẻ nào đến hạn."
                  : "Chưa có thẻ nào để ôn."
          }
          hint={
            weak
              ? "Khi bạn trả lời sai một thẻ, nó sẽ hiện ở đây để ôn lại."
              : data.review_only
                ? "Nghỉ ngơi nhé! Tắt “Hôm nay bận — chỉ ôn” nếu bạn muốn học thẻ mới."
                : data.new_today > 0
                  ? "Quay lại sau, thẻ đến hạn sẽ hiện ở đây."
                  : "Chọn một bài ở tab Học để bắt đầu."
          }
          action={
            <Link
              to="/lesson"
              className="hit-area card-soft mt-4 inline-flex min-h-10 items-center rounded-full bg-card px-4 text-xs font-semibold active:scale-95"
            >
              Xem các bài học
            </Link>
          }
        />
      )}

      {data && data.items.length > 0 && (
        <ReviewSession
          key={round}
          items={data.items}
          dueTotal={data.due_total}
          weak={weak}
          onMore={() => setRound((r) => r + 1)}
        />
      )}
    </Shell>
  );
}

/** A markdown table in a note, as one plain line per row («a · b · c»): a card is too narrow for
 * a table, and the raw «|» are noise. */
function tidyTable(text: string): string {
  return text
    .split("\n")
    .filter((l) => !/^\s*\|[\s|:-]+\|\s*$/.test(l))
    .map((l) =>
      /^\s*\|/.test(l)
        ? l
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((c) => c.trim())
            .filter(Boolean)
            .join(" · ")
        : l,
    )
    .join("\n");
}

/** The back of a grammar card, light enough to read in a review: the meaning above, how it is
 * built (the first part of the note), two examples one per line and the TOPIK tip; the rest of the
 * note (when to use, why not a look-alike) and the look-alikes wait behind «Xem giải thích». */
function GrammarBack({ grammar }: { grammar: NonNullable<ReviewQueueItem["grammar"]> }) {
  const [open, setOpen] = useState(false);
  // the note is written as «**Cấu tạo:** … **Hoàn cảnh dùng:** … **Vì sao …:** …»
  const parts = (grammar.usage_context_vi ?? "")
    .split(/(?=\*\*[^*]+:\*\*)/)
    .map((t) => tidyTable(t).trim())
    .filter(Boolean);
  const [first, ...rest] = parts;
  const examples = (grammar.example_en ?? "")
    .split(/(?<=[.?!])\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const more = rest.length > 0 || examples.length > 2 || (grammar.contrasts?.length ?? 0) > 0;
  return (
    <div className="space-y-2.5 text-left">
      {first && <Rich as="p" text={first} className="text-[13px] leading-5 text-ink-2" />}
      {examples.length > 0 && (
        <ul className="space-y-1 rounded-[12px] bg-fill px-3 py-2">
          {(open ? examples : examples.slice(0, 2)).map((e) => (
            <li key={e} lang="ko" className="font-korean text-[14px] leading-6 text-ink">
              {e}
            </li>
          ))}
        </ul>
      )}
      {grammar.exam_tip_vi && (
        <Rich
          as="p"
          text={`💡 ${grammar.exam_tip_vi}`}
          className="rounded-[12px] bg-yellow-soft px-3 py-2 text-[12.5px] font-medium leading-5 text-ink"
        />
      )}
      {open && (
        <>
          {rest.map((t) => (
            <Rich key={t} as="p" text={t} className="text-[13px] leading-5 text-ink-2" />
          ))}
          <ContrastList group={grammar.contrast_group} contrasts={grammar.contrasts} />
        </>
      )}
      {more && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-h-9 text-[13px] font-semibold text-blue-deep"
        >
          {open ? "Thu gọn" : "Xem giải thích"}
        </button>
      )}
    </div>
  );
}
