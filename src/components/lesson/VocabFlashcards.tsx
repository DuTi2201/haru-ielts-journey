import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Check, Headphones, Loader2, RotateCcw, X } from "lucide-react";

import { ChunkDetails, FamilyChip } from "@/components/haru/ChunkDetails";
import { Mascot } from "@/components/mascot/Mascot";
import { useVocabAudio } from "@/hooks/use-vocab-audio";
import { ApiError } from "@/lib/api/client";
import { recordItemReview } from "@/lib/api/content";
import type { VocabItemOut } from "@/lib/api/types";
import { miss, success, tap } from "@/lib/feedback";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ExamChip } from "./ExamChip";
import { LessonImage } from "./LessonImage";
import { PriorityChip } from "./PriorityChip";

/** How long the answered card takes to slide away before the next one enters. */
const CARD_EXIT_MS = 220;

/** Where a deck resumes: the first word with no record yet, and how many of the words before it
 * the learner knew / did not (so the closing count still adds up). Nothing studied: the start. */
function resumePoint(vocab: VocabItemOut[], studied: ReadonlyMap<number, boolean> | undefined) {
  const start = { index: 0, known: 0, unknown: 0 };
  if (!studied || studied.size === 0) return start;
  let first = vocab.findIndex((v) => !studied.has(v.id));
  if (first === -1) first = vocab.length;
  for (const v of vocab.slice(0, first)) {
    if (studied.get(v.id)) start.known += 1;
    else start.unknown += 1;
  }
  return { ...start, index: first };
}

/** Flip-and-judge cards for a lesson's words. Each answer goes to the learner's
 * spaced-review schedule (login required; a logged-out learner is told once). A deck
 * opened again carries on from the first word that has not been answered yet. */
export function VocabFlashcards({
  vocab,
  onReviewed,
  onNext,
  studied,
}: {
  vocab: VocabItemOut[];
  /** Called with the word's id and whether the learner knew it, each time a card is answered. */
  onReviewed?: ((id: number, correct: boolean) => void) | undefined;
  /** Offered when the deck is finished: the next part of the lesson. */
  onNext?: { label: string; go: () => void } | undefined;
  /** The words answered before (kept on the server), id → knew it. */
  studied?: ReadonlyMap<number, boolean> | undefined;
}) {
  const navigate = useNavigate();
  const [resume, setResume] = useState(() => resumePoint(vocab, studied));
  const [index, setIndex] = useState(resume.index);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState({ known: 0, unknown: 0 });
  const answeredHere = useRef(false);
  // Which way the answered card is sliding out (null = not answering).
  const [leaving, setLeaving] = useState<"known" | "unknown" | null>(null);
  const audio = useVocabAudio();
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loginHintShown = useRef(false);
  // Has the learner used "Nghe" on this deck? Only then do we warm up the next
  // word's audio in the background (each warm-up is one server synthesis).
  const listened = useRef(false);

  const current = vocab[index];
  const next = vocab[index + 1];
  const audioFailed = audio.state === "error";

  useEffect(() => {
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, []);

  // The learner's record can arrive after the deck is on screen (a slow connection): move to
  // the first unanswered word, but never once they have started answering here.
  useEffect(() => {
    if (answeredHere.current) return;
    const r = resumePoint(vocab, studied);
    setResume(r);
    setIndex(r.index);
  }, [vocab, studied]);

  const prefetchAudio = audio.prefetch;
  useEffect(() => {
    if (!next || !listened.current || audioFailed) return;
    void prefetchAudio(next.id, next.hangul);
  }, [next, audioFailed, prefetchAudio]);

  function saveReview(item: VocabItemOut, correct: boolean) {
    answeredHere.current = true;
    onReviewed?.(item.id, correct);
    // Not awaited: the next card must not wait for the network.
    recordItemReview({ item_type: "vocab_item", item_id: item.id, correct }).catch((err) => {
      if (err instanceof ApiError && err.status === 401 && !loginHintShown.current) {
        loginHintShown.current = true;
        toast("Đăng nhập để lưu tiến độ học từ vựng.", {
          id: "vocab-progress-login",
          action: { label: "Đăng nhập", onClick: () => void navigate({ to: "/support-language" }) },
        });
      }
    });
  }

  function answer(correct: boolean) {
    if (!current || leaving) return;
    if (correct) success();
    else miss();
    setTally((t) => (correct ? { ...t, known: t.known + 1 } : { ...t, unknown: t.unknown + 1 }));
    saveReview(current, correct);
    const advance = () => {
      audio.stop();
      setRevealed(false);
      setIndex((i) => i + 1);
      setLeaving(null);
    };
    if (prefersReducedMotion()) {
      advance();
      return;
    }
    setLeaving(correct ? "known" : "unknown");
    exitTimer.current = setTimeout(advance, CARD_EXIT_MS);
  }

  if (vocab.length === 0) {
    return (
      <p className="mt-3 text-sm font-medium text-ink-2">Bài này chưa có từ vựng nào được duyệt.</p>
    );
  }

  if (!current) {
    return (
      <div
        role="status"
        className="card-soft mt-4 animate-in rounded-[24px] bg-green-soft p-5 text-center duration-300 fade-in zoom-in-95 motion-reduce:animate-none"
      >
        <Mascot mood="celebrate" className="mx-auto h-14 w-14" />
        <p className="mt-2 text-sm font-semibold">
          Xong! Nhớ {resume.known + tally.known}/{vocab.length} từ.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => {
              tap();
              audio.stop();
              answeredHere.current = true;
              setResume({ index: 0, known: 0, unknown: 0 });
              setIndex(0);
              setTally({ known: 0, unknown: 0 });
            }}
            className="hit-area card-soft inline-flex min-h-10 items-center gap-1.5 rounded-full bg-card px-4 text-xs font-semibold active:scale-95"
          >
            <RotateCcw size={14} strokeWidth={2.4} /> Ôn lại
          </button>
          {onNext && (
            <button
              onClick={() => {
                tap();
                onNext.go();
              }}
              className="hit-area card-soft inline-flex min-h-10 items-center gap-1.5 rounded-full bg-blue px-4 text-xs font-semibold text-primary-foreground active:scale-95"
            >
              {onNext.label} <ArrowRight size={14} strokeWidth={2.6} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs font-semibold text-ink-2">
        <span>
          Từ {index + 1}/{vocab.length}
        </span>
        <button
          type="button"
          onClick={() => {
            listened.current = true;
            void audio.play(current.id, current.hangul);
          }}
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
      </div>
      {resume.index > 0 && index === resume.index && tally.known + tally.unknown === 0 && (
        <p className="mt-2 rounded-[12px] bg-blue-soft px-3 py-1.5 text-[11.5px] font-semibold leading-5 text-blue-deep">
          Tiếp tục từ thẻ chưa làm: {resume.index} từ trước đó bạn đã trả lời rồi.
        </p>
      )}
      <div
        role="progressbar"
        aria-label="Tiến độ ôn từ vựng"
        aria-valuemin={0}
        aria-valuemax={vocab.length}
        aria-valuenow={index}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-progress"
      >
        <div
          className="h-full rounded-full bg-blue transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${(index / vocab.length) * 100}%` }}
        />
      </div>

      {/* keyed by word so every new card slides in */}
      <div
        key={current.id}
        className={cn(
          "mt-3 animate-in duration-300 fade-in slide-in-from-right-6 motion-reduce:animate-none",
          leaving && "transition duration-200 ease-in motion-reduce:transition-none",
          leaving === "known" && "translate-x-8 opacity-0",
          leaving === "unknown" && "-translate-x-8 opacity-0",
        )}
      >
        <button
          type="button"
          onClick={() => {
            tap();
            setRevealed((v) => !v);
          }}
          aria-expanded={revealed}
          className="card-soft relative flex min-h-[200px] w-full flex-col items-center justify-center rounded-[24px] bg-card px-6 pb-9 pt-6 text-center transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none"
        >
          <span lang="ko" className="font-korean text-4xl font-semibold tracking-tight">
            {current.hangul}
          </span>
          {current.pron_ko && (
            <span className="mt-1 text-[14px] font-semibold text-ink-2">
              đọc là{" "}
              <span lang="ko" className="font-korean text-blue-deep">
                {current.pron_ko}
              </span>
            </span>
          )}
          {current.pos && (
            <span className="mt-2 rounded-full bg-progress px-2.5 py-0.5 text-[12px] font-semibold text-ink-2">
              {current.pos}
            </span>
          )}
          <FamilyChip family={current.family} className="mt-2" />
          {current.exam && <ExamChip tag={current.exam} className="mt-2" />}
          <PriorityChip priority={current.priority} className="mt-2" />
          {/* the answer unfolds instead of popping in */}
          <span
            aria-hidden={!revealed}
            className={cn(
              "grid w-full transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
              revealed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
          >
            <span className="overflow-hidden">
              <span className="mx-auto mt-4 block h-px w-1/2 bg-ink/15" />
              <span className="mt-3 block space-y-1">
                {/* the picture belongs to the answer side: on the front it would give the word away */}
                <LessonImage
                  src={current.image_url}
                  word={current.hangul}
                  eager
                  className="mx-auto mb-2 h-32 w-32"
                />
                <span className="block text-lg font-semibold text-blue-deep">
                  {current.meaning_vi}
                </span>
                {current.example_ko && (
                  <span className="block pt-0.5">
                    <span lang="ko" className="font-korean block text-[13px] leading-5 text-ink">
                      {current.example_ko}
                    </span>
                    {current.example_vi && (
                      <span className="block text-xs leading-5 text-ink-2">
                        {current.example_vi}
                      </span>
                    )}
                  </span>
                )}
                {current.sino_vietnamese && (
                  <span className="block text-xs text-ink-2">
                    Hán Việt: {current.sino_vietnamese}
                  </span>
                )}
                <ChunkDetails item={current} className="pt-1" />
              </span>
            </span>
          </span>
          <span
            className={cn(
              "absolute inset-x-0 bottom-3 text-xs font-semibold text-ink-2 transition-opacity duration-200",
              revealed && "opacity-0",
            )}
          >
            Chạm để xem nghĩa
          </span>
        </button>
      </div>
      {audio.state === "error" && (
        <p className="mt-1 text-center text-[11px] font-semibold text-ink-2">
          {audio.usedFallback
            ? "Đang phát bằng giọng đọc của thiết bị (không tạo được giọng từ máy chủ)."
            : audio.error || "Không tạo được giọng đọc, thử lại nhé."}
        </p>
      )}
      <div className="mt-3 flex gap-3">
        <button
          onClick={() => answer(false)}
          disabled={leaving !== null}
          className="card-soft flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-[16px] bg-yellow-soft py-2.5 text-sm font-semibold transition-transform active:scale-95"
        >
          <X size={17} strokeWidth={2.4} /> Chưa nhớ
        </button>
        <button
          onClick={() => answer(true)}
          disabled={leaving !== null}
          className="card-soft flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-[16px] bg-green-soft py-2.5 text-sm font-semibold transition-transform active:scale-95"
        >
          <Check size={17} strokeWidth={2.4} /> Đã nhớ
        </button>
      </div>
    </div>
  );
}
