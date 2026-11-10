import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Check,
  Headphones,
  Lightbulb,
  Loader2,
  MessageSquareText,
  Mic,
  Newspaper,
  Scale,
  Sparkles,
  X,
} from "lucide-react";

import { ArticleAudioPlayer } from "@/components/haru/ArticleAudioPlayer";
import { ArticleReader } from "@/components/haru/ArticleReader";
import { Mascot } from "@/components/mascot/Mascot";
import { PodcastPlayer } from "@/components/haru/PodcastPlayer";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/haru/states";
import { StudyOverview } from "@/components/haru/StudyOverview";
import { TabBar } from "@/components/haru/TabBar";
import { WordSheet } from "@/components/haru/WordSheet";
import { useReadMode } from "@/hooks/use-read-mode";
import { useVocabAudio } from "@/hooks/use-vocab-audio";
import { ApiError, errorMessage } from "@/lib/api/client";
import { GrammarCards } from "@/components/lesson/GrammarCards";
import { VocabList } from "@/components/lesson/VocabList";
import { MarkReadButton } from "@/components/haru/MarkReadButton";
import { ReadingGuide } from "@/components/haru/ReadingGuide";
import { ArticlePractice } from "@/components/haru/ArticlePractice";
import { recordItemReview } from "@/lib/api/content";
import { miss, success, tap } from "@/lib/feedback";
import {
  getEditorial,
  getEditorialOutline,
  presentEditorial,
  submitEditorialOutline,
} from "@/lib/api/editorial";
import type { EditorialModelOutline, VocabItemOut } from "@/lib/api/types";
import type { SpokenPos } from "@/lib/read-along";

export const Route = createFileRoute("/reading_/$id")({
  head: () => ({
    meta: [
      { title: "Đọc xã luận — Haru" },
      {
        name: "description",
        content: "Đọc bài xã luận và luyện dàn ý cho câu 54 trong ứng dụng Haru.",
      },
      { property: "og:title", content: "Đọc xã luận — Haru" },
      {
        property: "og:description",
        content: "Đọc bài xã luận và luyện dàn ý cho câu 54 trong ứng dụng Haru.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReadingDetailScreen,
});

const OUTLINE_FIELDS = [
  {
    key: "phenomenon_text" as const,
    label: "Hiện tượng (현상)",
    placeholder: "Bài nói về hiện tượng gì?",
  },
  {
    key: "cause_text" as const,
    label: "Nguyên nhân (원인)",
    placeholder: "Vì sao hiện tượng này xảy ra?",
  },
  {
    key: "consequence_text" as const,
    label: "Kết quả / ảnh hưởng (결과)",
    placeholder: "Nó gây ra hậu quả gì?",
  },
  {
    key: "solution_text" as const,
    label: "Giải pháp (해결 방안)",
    placeholder: "Bạn đề xuất giải pháp nào?",
  },
];

type OutlineForm = Record<(typeof OUTLINE_FIELDS)[number]["key"], string>;

const EMPTY_FORM: OutlineForm = {
  phenomenon_text: "",
  cause_text: "",
  consequence_text: "",
  solution_text: "",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] overflow-hidden bg-paper px-6 pb-[calc(8rem+var(--player-bar-h,0px))] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <div className="relative z-10">{children}</div>
      <TabBar />
    </main>
  );
}

type ReviewState = "unreviewed" | "known" | "unknown";

/** Article vocab/grammar are real VocabItem/GrammarPoint rows (Gemini
 * extracts them the same way it would for a lesson — see
 * build_editorial_prompt — just with lesson_id left null), so marking one
 * "đã nhớ/chưa nhớ" here goes through the exact same POST
 * /progress/reviews as the lesson screen's flashcards, and counts toward
 * the same streak_days/readiness_pct on /me/plan. Without this, an
 * article's vocab was just a read-only glossary with no way to actually
 * connect back into the learner's SRS progress. */
function useVocabGrammarReview() {
  const [reviewed, setReviewed] = useState<Record<string, ReviewState>>({});
  const [notice, setNotice] = useState<string | null>(null);

  async function review(
    itemType: "vocab_item" | "grammar_point",
    itemId: number,
    correct: boolean,
  ) {
    const key = `${itemType}:${itemId}`;
    setReviewed((r) => ({ ...r, [key]: correct ? "known" : "unknown" }));
    try {
      await recordItemReview({ item_type: itemType, item_id: itemId, correct });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setNotice("Đăng nhập để lưu tiến độ ôn từ vựng/ngữ pháp vào bài này.");
      }
    }
  }

  return { reviewed, notice, review };
}

function ReviewButtons({
  state,
  onReview,
}: {
  state: ReviewState;
  onReview: (correct: boolean) => void;
}) {
  if (state !== "unreviewed") {
    return (
      <p
        className={`mt-2 flex items-center gap-1 text-[12px] font-semibold ${state === "known" ? "text-teal" : "text-ink-2"}`}
      >
        {state === "known" ? (
          <Check size={13} strokeWidth={2.6} />
        ) : (
          <X size={13} strokeWidth={2.6} />
        )}
        {state === "known" ? "Đã ghi nhận: đã nhớ" : "Đã ghi nhận: chưa nhớ"}
      </p>
    );
  }
  return (
    <div className="mt-2.5 flex gap-2">
      <button
        type="button"
        onClick={() => {
          miss();
          onReview(false);
        }}
        className="hit-area flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-line bg-card text-xs font-semibold active:scale-[0.97]"
      >
        <X size={14} strokeWidth={2.6} /> Chưa nhớ
      </button>
      <button
        type="button"
        onClick={() => {
          success();
          onReview(true);
        }}
        className="hit-area flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-transparent bg-green-soft text-xs font-semibold active:scale-[0.97]"
      >
        <Check size={14} strokeWidth={2.6} /> Đã nhớ
      </button>
    </div>
  );
}

/** The end of the article: say it out loud. Both open a Trình bày round built from the article
 * (its title, outline, key terms and grammar) on the Trình bày screen. */
function TalkAboutArticle({ articleId }: { articleId: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"present" | "debate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(kind: "present" | "debate") {
    tap();
    setBusy(kind);
    setError(null);
    try {
      const round = await presentEditorial(articleId, kind);
      void navigate({ to: "/talk/present", search: { session: round.id } });
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? "Đăng nhập để luyện nói về bài này nhé."
          : errorMessage(e),
      );
      setBusy(null);
    }
  }

  const button =
    "hit-area card-soft flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-[16px] px-3 py-2.5 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-60";
  return (
    <section className="mt-7" aria-labelledby="talk-about-article">
      <h2 id="talk-about-article" className="text-base font-semibold">
        Nói về bài này
      </h2>
      <p className="mt-1 text-xs font-semibold leading-5 text-ink-2">
        Đọc xong rồi, thử nói lại bằng tiếng Hàn: tóm tắt và nêu ý kiến của bạn, hoặc phản biện quan
        điểm của bài. Haru dùng dàn ý, thuật ngữ và ngữ pháp của bài để gợi ý cho bạn.
      </p>
      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void start("present")}
          className={`${button} bg-blue text-primary-foreground`}
        >
          {busy === "present" ? (
            <Loader2 size={16} strokeWidth={2.6} className="animate-spin" />
          ) : (
            <Mic size={16} strokeWidth={2.4} />
          )}
          Trình bày 2 phút
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void start("debate")}
          className={`${button} bg-card`}
        >
          {busy === "debate" ? (
            <Loader2 size={16} strokeWidth={2.6} className="animate-spin" />
          ) : (
            <Scale size={16} strokeWidth={2.4} />
          )}
          Phản biện
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function ReadingDetailScreen() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["editorial", id], queryFn: () => getEditorial(id) });
  const { reviewed, notice: reviewNotice, review } = useVocabGrammarReview();
  const vocabAudio = useVocabAudio();
  const [activeVocabId, setActiveVocabId] = useState<number | null>(null);
  const [tappedWord, setTappedWord] = useState<VocabItemOut | null>(null);

  function playVocabAudio(vocabId: number, hangul: string) {
    setActiveVocabId(vocabId);
    void vocabAudio.play(vocabId, hangul);
  }

  // An article imported before photos existed has none stored yet: the first
  // open makes the server fetch them in the background (images_pending).
  // Re-check a few times so the photos appear without a manual refresh.
  const [mode, setMode] = useReadMode();
  // Read along: which sentence the audio is reading, and whether the page
  // should scroll after it (on by default; scrolling by hand while it plays
  // switches it off, the locate button switches it back on).
  const [track, setTrack] = useState<{ spoken: SpokenPos | null; playing: boolean }>({
    spoken: null,
    playing: false,
  });
  const [follow, setFollow] = useState(true);
  const [watchImages, setWatchImages] = useState(false);
  const imagesPending = query.data?.images_pending === true;
  const hasImages = (query.data?.images?.length ?? 0) > 0;
  useEffect(() => {
    if (imagesPending) setWatchImages(true);
  }, [imagesPending]);
  useEffect(() => {
    if (!watchImages || hasImages) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      void queryClient.invalidateQueries({ queryKey: ["editorial", id] });
      if (tries >= 5) clearInterval(timer);
    }, 4000);
    return () => clearInterval(timer);
  }, [watchImages, hasImages, id, queryClient]);

  // The beginner study pack (summary, translation, simple Korean) is generated
  // once in the background on an article's first read; re-check until it lands.
  const studyPending = query.data?.study_status === "pending";
  useEffect(() => {
    if (!studyPending) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      void queryClient.invalidateQueries({ queryKey: ["editorial", id] });
      if (tries >= 60) clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [studyPending, id, queryClient]);
  const outlineQuery = useQuery({
    queryKey: ["editorialOutline", id],
    queryFn: () => getEditorialOutline(id),
    retry: false,
  });

  const [form, setForm] = useState<OutlineForm>(EMPTY_FORM);
  const [modelOutline, setModelOutline] = useState<EditorialModelOutline | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Real Gemini analysis of what the learner actually wrote (NOT
  // modelOutline, the static reference) — see grade_editorial_outline.
  // "pending" right after a save, so this screen polls the outline GET
  // endpoint every few seconds until Gemini's pass finishes.
  const [feedbackStatus, setFeedbackStatus] = useState<"none" | "pending" | "ready" | "failed">(
    "none",
  );
  const [feedbackText, setFeedbackText] = useState<string | null>(null);

  useEffect(() => {
    if (outlineQuery.data && !hydrated) {
      setForm({
        phenomenon_text: outlineQuery.data.phenomenon_text ?? "",
        cause_text: outlineQuery.data.cause_text ?? "",
        consequence_text: outlineQuery.data.consequence_text ?? "",
        solution_text: outlineQuery.data.solution_text ?? "",
      });
      setModelOutline(outlineQuery.data.model_outline);
      setFeedbackStatus(outlineQuery.data.feedback_status);
      setFeedbackText(outlineQuery.data.feedback_text);
      setHydrated(true);
    }
  }, [outlineQuery.data, hydrated]);

  useEffect(() => {
    if (feedbackStatus !== "pending") return;
    const timer = setInterval(async () => {
      try {
        const fresh = await getEditorialOutline(id);
        setFeedbackStatus(fresh.feedback_status);
        setFeedbackText(fresh.feedback_text);
      } catch {
        /* keep polling — a transient error here isn't worth surfacing */
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [feedbackStatus, id]);

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    try {
      const result = await submitEditorialOutline(id, form);
      setModelOutline(result.model_outline);
      setFeedbackStatus(result.feedback_status);
      setFeedbackText(result.feedback_text);
      setNotice("Đã lưu dàn ý của bạn — Gemini đang phân tích, xem nhận xét bên dưới.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setNotice('Đăng nhập ở tab "Tôi" để lưu dàn ý của bạn.');
      } else {
        setNotice(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  if (query.isLoading) {
    return (
      <Shell>
        <LoadingBlocks
          className="mt-10"
          label="Đang tải bài báo"
          blocks={["h-6 w-2/3 rounded-full", "h-4 w-1/2 rounded-full", "h-40"]}
        />
      </Shell>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Shell>
        {notFound ? (
          <EmptyState className="mt-10" title="Không tìm thấy bài xã luận này." />
        ) : (
          <ErrorState
            className="mt-10"
            title="Không tải được bài báo."
            error={query.error}
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isRefetching}
          />
        )}
      </Shell>
    );
  }

  const article = query.data!;
  // "Nghe" follows the reading mode: in Bản dễ the learner hears the simple
  // Korean they are reading (only once that version exists).
  const audioVariant = mode === "easy" && article.study ? "easy" : "original";

  return (
    <Shell>
      <header>
        <p className="text-[13px] font-semibold text-ink-2">{article.source_name}</p>
        <h1 className="font-korean mt-1 break-keep text-[22px] font-bold leading-snug [overflow-wrap:anywhere]">
          {article.title_ko || "(Chưa có tiêu đề)"}
        </h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {article.level_estimate && (
            <span className="rounded-full bg-teal-soft px-2.5 py-1 text-[12px] font-semibold text-teal">
              Cấp {article.level_estimate}
            </span>
          )}
          {article.topic_tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-blue-soft px-2.5 py-1 text-[12px] font-semibold text-blue-deep"
            >
              {t}
            </span>
          ))}
        </div>
      </header>

      {article.body_ko.trim().length > 0 && (
        <StudyOverview
          study={article.study ?? null}
          status={article.study_status ?? "none"}
          levelEstimate={article.level_estimate}
        />
      )}

      {article.body_ko.trim().length > 0 && (
        <ArticleAudioPlayer
          articleId={article.id}
          variant={audioVariant}
          title={article.title_ko}
          source={article.source_name}
          follow={follow}
          onFollowChange={setFollow}
          onTrack={setTrack}
        />
      )}

      <ReadingGuide level={article.level_estimate} />

      <section className="mt-4 rounded-[18px] border border-line bg-card p-4 shadow-elev-1">
        <div className="mb-3 flex items-center gap-2">
          <Newspaper size={16} strokeWidth={2.2} className="text-blue" />
          <h2 className="text-sm font-semibold">Toàn văn bài viết</h2>
        </div>
        {article.body_ko.trim().length > 0 ? (
          <ArticleReader
            body={article.body_ko}
            vocab={article.vocab}
            images={article.images ?? []}
            sourceUrl={article.source_url}
            study={article.study ?? null}
            studyStatus={article.study_status ?? "none"}
            mode={mode}
            onModeChange={setMode}
            activeVocabId={tappedWord?.id ?? null}
            onTapWord={setTappedWord}
            onSentenceOpen={() => setTappedWord(null)}
            spoken={track.spoken}
            playing={track.playing}
            follow={follow}
            onFollowChange={setFollow}
          />
        ) : (
          <p className="text-xs font-medium leading-5 text-ink-2">
            Bài này chưa có nội dung văn bản.
          </p>
        )}
        {imagesPending && !hasImages && (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
            <Loader2 size={12} strokeWidth={2.6} className="animate-spin" /> Đang lấy ảnh của bài
            viết…
          </p>
        )}
      </section>

      {(article.vocab.length > 0 || article.grammar.length > 0) && (
        <div className="mt-5">
          <PodcastPlayer kind="article" ownerId={article.id} />
        </div>
      )}

      {article.vocab.length > 0 && (
        <section className="mt-7" aria-labelledby="article-vocab">
          <h2 id="article-vocab" className="text-lg font-semibold">
            Từ vựng <span className="text-ink-2">· {article.vocab.length}</span>
          </h2>
          <p className="mt-0.5 text-[12px] font-medium leading-5 text-ink-2">
            Chạm vào từ để xem nghĩa Hán Việt, cách dùng và cụm hay đi cùng. Những từ này sẽ vào phần
            ôn tập hằng ngày của bạn.
          </p>
          <div className="mt-2">
            <VocabList vocab={article.vocab} grouped={false} />
          </div>
        </section>
      )}

      {article.grammar.length > 0 && (
        <section className="mt-7" aria-labelledby="article-grammar">
          <h2 id="article-grammar" className="text-lg font-semibold">
            Ngữ pháp <span className="text-ink-2">· {article.grammar.length}</span>
          </h2>
          <GrammarCards
            grammar={article.grammar}
            context="article"
            onReviewed={(id, correct) => review("grammar_point", id, correct)}
          />
        </section>
      )}

      {reviewNotice && (
        <p className="mt-2 text-center text-[12px] font-semibold text-ink-2">{reviewNotice}</p>
      )}
      {vocabAudio.state === "error" && (
        <p className="mt-2 text-center text-[12px] font-semibold text-ink-2">
          {vocabAudio.usedFallback
            ? "Đang phát bằng giọng đọc của thiết bị (không tạo được giọng từ máy chủ)."
            : vocabAudio.error || "Không tạo được giọng đọc, thử lại nhé."}
        </p>
      )}

      <ArticlePractice items={article.practice ?? []} />
      <MarkReadButton articleId={article.id} />

      {(article.level_estimate ?? 3) <= 2 ? (
        <details className="mt-5 rounded-[18px] border border-line bg-card p-4">
          <summary className="hit-area min-h-11 cursor-pointer text-[14px] font-bold">
            Thử thách thêm: tự viết dàn ý (không bắt buộc)
          </summary>
      <section className="mt-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={18} strokeWidth={2.2} className="text-yellow" />
          <h2 className="text-lg font-semibold">Luyện dàn ý — câu 54</h2>
        </div>
        {article.thinking_guide_text && (
          <p className="font-korean mt-2 whitespace-pre-line rounded-[16px] border border-transparent bg-yellow-soft p-3.5 text-xs font-semibold leading-5">
            {article.thinking_guide_text}
          </p>
        )}

        <div className="mt-3 space-y-3">
          {OUTLINE_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="text-xs font-semibold text-ink-2">{field.label}</label>
              <textarea
                value={form[field.key]}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                rows={2}
                className="font-korean mt-1 w-full rounded-[14px] border border-line bg-card px-3.5 py-2.5 text-sm font-medium placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-blue"
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-3 w-full rounded-[14px] border border-transparent bg-blue py-2.5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu dàn ý"}
        </button>
        {notice && (
          <p className="mt-2 text-center text-[12px] font-semibold text-ink-2">{notice}</p>
        )}

        {feedbackStatus !== "none" && (
          <div className="mt-4 rounded-[18px] border border-transparent bg-blue-soft p-4 shadow-elev-2">
            <div className="flex items-center gap-2">
              <MessageSquareText size={16} strokeWidth={2.2} className="text-blue-deep" />
              <h3 className="text-sm font-semibold">Gemini nhận xét dàn ý của bạn</h3>
            </div>
            {feedbackStatus === "pending" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                <Loader2 size={13} strokeWidth={2.6} className="animate-spin" /> Đang phân tích…
              </p>
            )}
            {feedbackStatus === "ready" && feedbackText && (
              <p className="mt-2 whitespace-pre-line text-xs font-medium leading-6 text-ink">
                {feedbackText}
              </p>
            )}
            {feedbackStatus === "failed" && (
              <p className="mt-2 text-xs font-semibold text-ink-2">
                Không phân tích được dàn ý lần này, thử lưu lại nhé.
              </p>
            )}
          </div>
        )}

        {modelOutline && (
          <div className="mt-4 rounded-[18px] border border-transparent bg-green-soft p-4 shadow-elev-2">
            <div className="flex items-center gap-2">
              <Sparkles size={16} strokeWidth={2.2} />
              <h3 className="text-sm font-semibold">Dàn ý mẫu để so sánh</h3>
            </div>
            <div className="mt-2 space-y-2 text-xs font-semibold leading-5">
              <p>
                <span className="font-semibold">Hiện tượng:</span>{" "}
                <span className="font-korean">{modelOutline.phenomenon}</span>
              </p>
              <p>
                <span className="font-semibold">Nguyên nhân:</span>{" "}
                <span className="font-korean">{modelOutline.cause}</span>
              </p>
              <p>
                <span className="font-semibold">Kết quả:</span>{" "}
                <span className="font-korean">{modelOutline.consequence}</span>
              </p>
              <p>
                <span className="font-semibold">Giải pháp:</span>{" "}
                <span className="font-korean">{modelOutline.solution}</span>
              </p>
            </div>
          </div>
        )}
      </section>
        </details>
      ) : (
      <section className="mt-5">
        <div className="flex items-center gap-2">
          <Lightbulb size={18} strokeWidth={2.2} className="text-yellow" />
          <h2 className="text-lg font-semibold">Luyện dàn ý — câu 54</h2>
        </div>
        {article.thinking_guide_text && (
          <p className="font-korean mt-2 whitespace-pre-line rounded-[16px] border border-transparent bg-yellow-soft p-3.5 text-xs font-semibold leading-5">
            {article.thinking_guide_text}
          </p>
        )}

        <div className="mt-3 space-y-3">
          {OUTLINE_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="text-xs font-semibold text-ink-2">{field.label}</label>
              <textarea
                value={form[field.key]}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                rows={2}
                className="font-korean mt-1 w-full rounded-[14px] border border-line bg-card px-3.5 py-2.5 text-sm font-medium placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-blue"
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-3 w-full rounded-[14px] border border-transparent bg-blue py-2.5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu dàn ý"}
        </button>
        {notice && (
          <p className="mt-2 text-center text-[12px] font-semibold text-ink-2">{notice}</p>
        )}

        {feedbackStatus !== "none" && (
          <div className="mt-4 rounded-[18px] border border-transparent bg-blue-soft p-4 shadow-elev-2">
            <div className="flex items-center gap-2">
              <MessageSquareText size={16} strokeWidth={2.2} className="text-blue-deep" />
              <h3 className="text-sm font-semibold">Gemini nhận xét dàn ý của bạn</h3>
            </div>
            {feedbackStatus === "pending" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                <Loader2 size={13} strokeWidth={2.6} className="animate-spin" /> Đang phân tích…
              </p>
            )}
            {feedbackStatus === "ready" && feedbackText && (
              <p className="mt-2 whitespace-pre-line text-xs font-medium leading-6 text-ink">
                {feedbackText}
              </p>
            )}
            {feedbackStatus === "failed" && (
              <p className="mt-2 text-xs font-semibold text-ink-2">
                Không phân tích được dàn ý lần này, thử lưu lại nhé.
              </p>
            )}
          </div>
        )}

        {modelOutline && (
          <div className="mt-4 rounded-[18px] border border-transparent bg-green-soft p-4 shadow-elev-2">
            <div className="flex items-center gap-2">
              <Sparkles size={16} strokeWidth={2.2} />
              <h3 className="text-sm font-semibold">Dàn ý mẫu để so sánh</h3>
            </div>
            <div className="mt-2 space-y-2 text-xs font-semibold leading-5">
              <p>
                <span className="font-semibold">Hiện tượng:</span>{" "}
                <span className="font-korean">{modelOutline.phenomenon}</span>
              </p>
              <p>
                <span className="font-semibold">Nguyên nhân:</span>{" "}
                <span className="font-korean">{modelOutline.cause}</span>
              </p>
              <p>
                <span className="font-semibold">Kết quả:</span>{" "}
                <span className="font-korean">{modelOutline.consequence}</span>
              </p>
              <p>
                <span className="font-semibold">Giải pháp:</span>{" "}
                <span className="font-korean">{modelOutline.solution}</span>
              </p>
            </div>
          </div>
        )}
      </section>
      )}

      <TalkAboutArticle articleId={article.id} />

      <aside className="mt-7 flex items-end gap-2.5">
        <Mascot mood="reading" className="h-14 w-14 shrink-0" />
        <p className="mb-1 rounded-[18px_18px_18px_4px] border border-line bg-card px-4 py-3 text-xs font-semibold leading-5 shadow-elev-1">
          Tự viết dàn ý trước, đừng xem gợi ý ngay — vậy mới nhớ lâu!
        </p>
      </aside>

      {tappedWord && (
        <WordSheet
          word={tappedWord}
          onClose={() => setTappedWord(null)}
          onListen={() => playVocabAudio(tappedWord.id, tappedWord.hangul)}
          listening={vocabAudio.state === "loading" && activeVocabId === tappedWord.id}
          footer={
            <ReviewButtons
              state={reviewed[`vocab_item:${tappedWord.id}`] ?? "unreviewed"}
              onReview={(correct) => review("vocab_item", tappedWord.id, correct)}
            />
          }
        />
      )}
    </Shell>
  );
}
