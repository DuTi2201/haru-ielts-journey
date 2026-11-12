/** A lesson's lecture as slides that follow the voice: one thing on screen at a time, shown when it
 * is said (a word's meaning only after the gap in which the learner tries to remember and say it),
 * a «Nói theo» cue in every gap made for repeating, and the option to stop in each gap until the
 * learner has said it. Tapping something already on a slide plays that part again; the review
 * slide hides the meanings until tapped.
 *
 * The slides and their cues come from the server (lib/lecture-slides.ts); the recording says when
 * each part starts. An older recording without that is followed by an estimate (marked ≈). */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Headphones, Loader2, LogIn, Mic, Pause, Play, RotateCcw, Hand } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { LectureControls } from "@/components/haru/PodcastPlayer";
import { LiquidBar } from "@/components/haru/studio-ui";
import { LessonImage } from "@/components/lesson/LessonImage";
import { StoryIcon, storyIconForWord } from "@/components/lesson/lecture/StoryArt";
import { Ko, Rich, RichBlock } from "@/components/lesson/Rich";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { usePodcast } from "@/hooks/use-podcast-audio";
import { usePrefetchSittings } from "@/hooks/use-prefetch-sittings";
import { getLectureSlides } from "@/lib/api/audio";
import { tap } from "@/lib/feedback";
import { track } from "@/lib/telemetry";
import {
  estimateTimeline,
  lineOf,
  lineStart,
  locate,
  sayAlongEnds,
  scriptLines,
  slideChapters,
  stateAt,
  type LectureSlide,
  type LectureSlidesOut,
  type RunStart,
  type SlideState,
} from "@/lib/lecture-slides";
import { readLocal, writeLocal } from "@/lib/lesson-local";
import { cn } from "@/lib/utils";

import { Scene } from "./LectureScenes";
import { hasPositionArt } from "./PositionArt";

const WAIT_HINT =
  "Lần đầu mất vài phút, những lần sau nghe ngay. Bạn có thể rời trang rồi quay lại.";

type Ex = { ko: string; vi: string | null };

/** The Studio pictures a lecture can show: the lesson banner, a picture per word and per grammar
 * point (the same ones the lesson cards use). A slide without one keeps its icon. */
export interface LecturePictures {
  banner: string | null;
  /** the lesson's Korean title, for slides whose own title has no Korean point */
  titleKo: string | null;
  /** the first words of the lesson: the title slide shows them when there is no banner */
  words: string[];
  vocab: Record<string, string>;
  grammar: Record<string, string>;
}

export function lecturePictures(lesson: {
  image_url?: string | null | undefined;
  title_en?: string | null | undefined;
  vocab: { headword: string; image_url?: string | null | undefined }[];
  grammar: { pattern: string; image_url?: string | null | undefined }[];
}): LecturePictures {
  const vocab: Record<string, string> = {};
  for (const v of lesson.vocab) if (v.image_url) vocab[v.headword] = v.image_url;
  const grammar: Record<string, string> = {};
  for (const g of lesson.grammar) if (g.image_url) grammar[g.pattern] = g.image_url;
  return {
    banner: lesson.image_url ?? null,
    titleKo: lesson.title_en ?? null,
    words: lesson.vocab.slice(0, 6).map((v) => v.headword),
    vocab,
    grammar,
  };
}

/** Each kind of slide has its own colour, so a lecture is not one dark panel from start to end. */
const TONE: Record<string, [string, string]> = {
  title: ["oklch(0.3 0.1 285)", "oklch(0.42 0.17 305)"],
  end: ["oklch(0.3 0.1 285)", "oklch(0.42 0.17 305)"],
  section: ["oklch(0.3 0.09 260)", "oklch(0.4 0.13 235)"],
  word: ["oklch(0.3 0.09 295)", "oklch(0.4 0.15 350)"],
  grammar: ["oklch(0.28 0.08 265)", "oklch(0.38 0.1 205)"],
  note: ["oklch(0.3 0.08 285)", "oklch(0.4 0.1 60)"],
  review: ["oklch(0.3 0.09 285)", "oklch(0.4 0.12 255)"],
  recap: ["oklch(0.3 0.09 285)", "oklch(0.4 0.12 255)"],
  scene: ["oklch(0.27 0.08 250)", "oklch(0.37 0.1 195)"],
};

export function SlideLecture({
  lessonId,
  sitting,
  onPlay,
  onSkip,
  onNext,
  autoStart,
  pictures,
}: {
  lessonId: number;
  /** What follows the lecture. When it ends, a panel offers it at once, or after a countdown. */
  onNext?: { label: string; go: () => void; seconds?: number };
  /** Start playing as soon as this lecture is mounted (the learner just chose to go on to it). */
  autoStart?: boolean;
  /** Studio pictures for the slides (the lesson's own); without them the slides show icons. */
  pictures?: LecturePictures;
  /** The lecture of this sitting (buổi, 1-based) alone; without it, the whole lesson's. */
  sitting?: number;
  /** Called when the learner starts the lecture (not on a resume after pause). */
  onPlay?: () => void;
  /** A way on when the lecture cannot be made now: the lesson goes on without it. */
  onSkip?: { label: string; go: () => void };
}) {
  const auth = useAuth();
  const podcast = usePodcast("lesson");
  const slides = useQuery({
    queryKey: ["lecture-slides", lessonId, sitting ?? 0],
    queryFn: () => getLectureSlides(lessonId, sitting),
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const data = slides.data;
  const lines = useMemo(() => (data ? scriptLines(data.script) : []), [data]);

  // the recording must be of the script the slides were built for
  const loaded = podcast.duration > 0 && !!podcast.scriptText;
  // this sitting's lecture is here: make the rest of the lesson's sittings ready behind it
  usePrefetchSittings(lessonId, loaded && sitting !== undefined);
  const matches = !!data && loaded && podcast.scriptText === data.script;
  const exact = matches && !!podcast.timeline?.length;
  const timeline: RunStart[] = useMemo(() => {
    if (!data || !loaded) return [];
    if (exact) return podcast.timeline as RunStart[];
    return estimateTimeline(podcast.scriptText ?? data.script, podcast.duration);
  }, [data, loaded, exact, podcast.timeline, podcast.scriptText, podcast.duration]);

  const ms = podcast.time * 1000;
  const at = matches || (data && loaded) ? locate(timeline, ms) : null;
  const state: SlideState | null = data ? stateAt(data, at, lines) : null;
  const tone = TONE[String(data?.slides[state?.slide ?? 0]?.kind ?? "title")] ?? TONE["title"]!;

  // «Tự dừng để nói theo»: pause where each repeat gap ends, until the learner taps
  const [stopToSay, setStopToSay] = useState(() =>
    readLocal<boolean>("lecture-stop-to-say", false),
  );
  const [waiting, setWaiting] = useState(false);
  const stops = useMemo(
    () => (exact ? sayAlongEnds(timeline, lines, data?.shadow) : []),
    [exact, timeline, lines, data?.shadow],
  );
  const lastMs = useRef(0);
  useEffect(() => {
    const prev = lastMs.current;
    lastMs.current = ms;
    if (!stopToSay || podcast.state !== "playing" || ms < prev || ms - prev > 1500) return;
    // a stop crossed during normal play (not a seek): wait there
    if (stops.some((s) => s > prev && s <= ms)) {
      podcast.pause();
      setWaiting(true);
    }
  }, [ms, stopToSay, stops, podcast]);

  const isBusy = podcast.state === "loading";
  const isPlaying = podcast.state === "playing";
  const started = loaded && (isPlaying || podcast.state === "paused");

  function toggle() {
    if (auth.isAnonymous) return;
    tap();
    setWaiting(false);
    if (isPlaying) podcast.pause();
    else if (podcast.state === "paused") podcast.resume();
    else {
      void podcast.play(lessonId, "template", sitting);
      onPlay?.();
    }
  }

  /** Jump the voice to where a slide's piece is said. */
  function replay(slide: number, show: string) {
    if (!data || !started) return;
    const line = lineOf(data, slide, show);
    const start = line >= 0 ? lineStart(timeline, line) : null;
    if (start === null) return;
    tap();
    setWaiting(false);
    track({
      type: "lecture_replay",
      payload: { lesson_id: lessonId, session: sitting ?? 0, step: String(data.slides[slide]?.kind ?? "") },
    });
    podcast.seek(start / 1000);
    if (podcast.state === "paused") podcast.resume();
  }

  const started0 = useRef(false);
  useEffect(() => {
    if (!autoStart || started0.current || auth.isAnonymous || !data) return;
    started0.current = true;
    void podcast.play(lessonId, "template", sitting);
  }, [autoStart, auth.isAnonymous, data, podcast, lessonId, sitting]);

  // the recording has played to its end: offer what comes next
  const ended =
    loaded && podcast.state === "idle" && podcast.duration > 0 && podcast.time >= podcast.duration - 1;

  // heard to the last slide: counted once per recording
  const lastSlide = !!data && !!state && state.slide === data.slides.length - 1;
  const counted = useRef(false);
  useEffect(() => {
    if (!lastSlide || !exact || counted.current) return;
    counted.current = true;
    track({
      type: "lecture_complete",
      value: Math.round(podcast.duration),
      payload: { lesson_id: lessonId, session: sitting ?? 0 },
    });
  }, [lastSlide, exact, podcast.duration, lessonId, sitting]);

  const chapters = useMemo(
    () => (data && exact ? slideChapters(data, timeline) : undefined),
    [data, exact, timeline],
  );

  return (
    <section aria-label="Bài giảng" className="space-y-3">
      <div
        className="relative overflow-hidden rounded-[24px] text-[oklch(0.98_0.01_285)] shadow-elev-2 [--ring:white]"
        style={{
          backgroundImage: `linear-gradient(155deg, ${tone[0]}, ${tone[1]})`,
        }}
      >
        {data && state && (
          <p className="sr-only" aria-live="polite">
            Slide {state.slide + 1}/{data.slides.length}
          </p>
        )}
        {data && state && (
          <div
            role="progressbar"
            aria-label="Vị trí slide"
            aria-valuemin={1}
            aria-valuemax={data.slides.length}
            aria-valuenow={state.slide + 1}
            aria-valuetext={`Slide ${state.slide + 1}/${data.slides.length}`}
            className="absolute inset-x-0 top-0 z-10 h-1 bg-white/10"
          >
            <div
              className="h-full rounded-r-full bg-white/70 transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${((state.slide + 1) / data.slides.length) * 100}%` }}
            />
            <SwanMark
              className="absolute top-1.5 h-4 w-6 -translate-x-full transition-[left] duration-500 motion-reduce:transition-none"
              style={{
                left: `clamp(28px, ${((state.slide + 1) / data.slides.length) * 100}%, calc(100% - 20px))`,
              }}
            />
          </div>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[oklch(0.55_0.17_285/0.35)] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-12 h-60 w-60 rounded-full bg-[oklch(0.6_0.13_240/0.3)] blur-3xl"
        />
        <div className="relative flex min-h-[360px] flex-col p-5 sm:min-h-[400px] sm:p-7">
          {data && state ? (
            <SlideView
              key={state.slide}
              slide={data.slides[state.slide]!}
              index={state.slide}
              state={state}
              started={started}
              onReplay={replay}
              pictures={pictures}
            />
          ) : (
            <div className="m-auto text-center opacity-80">
              <Headphones size={28} className="mx-auto" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold">Bài giảng của bài</p>
            </div>
          )}

          <div className="mt-auto flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={toggle}
              disabled={isBusy || auth.isAnonymous}
              data-busy={isBusy}
              aria-label={isPlaying ? "Tạm dừng bài giảng" : "Nghe bài giảng"}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[oklch(0.97_0.01_285)] text-[oklch(0.3_0.08_285)] shadow-elev-2 active:scale-95 disabled:opacity-60 disabled:data-[busy=true]:opacity-100"
            >
              {isBusy ? (
                <Loader2 size={22} className="animate-spin text-[oklch(0.45_0.17_285)]" />
              ) : isPlaying ? (
                <Pause size={22} strokeWidth={2.4} />
              ) : (
                <Play size={22} strokeWidth={2.4} className="translate-x-0.5" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              {waiting ? (
                <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <Hand size={15} aria-hidden="true" /> Nói xong thì chạm ▶ để nghe tiếp
                </p>
              ) : state?.sayAlong && isPlaying ? (
                <p className="lecture-say flex items-center gap-1.5 text-[13px] font-semibold">
                  <Mic size={15} aria-hidden="true" /> Nói theo
                </p>
              ) : (
                <p className="text-[12px] font-medium leading-snug opacity-80">
                  {isBusy
                    ? (podcast.step ?? "Đang chuẩn bị bài giảng…")
                    : started
                      ? exact
                        ? "Chạm vào từ hay câu trên slide để nghe lại."
                        : "≈ Slide theo ước lượng (bản ghi cũ)."
                      : "Nghe và nhìn: mỗi thứ hiện đúng lúc được nói."}
                </p>
              )}
            </div>
          </div>
          {isBusy && podcast.progress > 0 && (
            <div className="mt-3" aria-live="polite">
              <LiquidBar
                pct={Math.round(podcast.progress * 100)}
                label="Tiến độ tạo bài giảng"
                animated={false}
              />
              <p className="mt-1.5 text-[11px] font-medium opacity-75">{WAIT_HINT}</p>
            </div>
          )}
        </div>
      </div>

      {ended && onNext && (
        <EndedPanel
          key={`${lessonId}-${sitting ?? 0}`}
          next={onNext}
          onAgain={() => {
            podcast.seek(0);
            void podcast.play(lessonId, "template", sitting);
          }}
        />
      )}

      {auth.isAnonymous && (
        <Link
          to="/support-language"
          className="hit-area flex items-center gap-2.5 rounded-[14px] bg-yellow-soft px-3 py-2.5 text-xs font-semibold leading-5"
        >
          <LogIn size={15} strokeWidth={2.4} className="shrink-0" />
          Đăng nhập để nghe bài giảng (mỗi trình duyệt phải đăng nhập riêng).
        </Link>
      )}

      {podcast.state === "error" && (
        <div role="alert" className="rounded-[14px] bg-card px-3 py-2.5">
          <p className="text-[13px] font-semibold">Bài giảng chưa sẵn sàng lúc này.</p>
          <p className="mt-0.5 text-[12px] font-medium text-danger">{podcast.error}</p>
          <p className="mt-0.5 text-[12px] font-medium leading-5 text-ink-2">
            Trong lúc chờ, vẫn học được: bấm nút loa ở từng từ và câu ví dụ bên dưới.
          </p>
          <button
            type="button"
            onClick={toggle}
            className="hit-area mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-blue px-4 text-xs font-semibold text-primary-foreground"
          >
            <RotateCcw size={14} strokeWidth={2.6} aria-hidden="true" /> Thử lại
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip.go}
              className="hit-area ml-2 mt-2 inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 text-xs font-semibold"
            >
              {onSkip.label}
            </button>
          )}
        </div>
      )}

      {started && (
        <LectureControls
          podcast={podcast}
          kind="lesson"
          ownerId={lessonId}
          exactChapters={chapters}
        />
      )}
      {(started || !loaded) && (
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[14px] bg-card px-3 py-2">
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold">Tự dừng để nói theo</span>
            <span className="block text-[12px] font-medium leading-4 text-ink-2">
              Dừng sau mỗi câu cần nhắc lại, chờ bạn nói xong.
            </span>
          </span>
          <Switch
            checked={stopToSay}
            disabled={started && !exact}
            onCheckedChange={(v) => {
              setStopToSay(v);
              writeLocal("lecture-stop-to-say", v);
              if (!v) setWaiting(false);
            }}
            aria-label="Tự dừng để nói theo"
          />
        </label>
      )}
    </section>
  );
}

// ------------------------------------------------------------------------------- the slides --
export function SlideView({
  slide,
  index,
  state,
  started,
  onReplay,
  pictures,
}: {
  slide: LectureSlide;
  index: number;
  state: SlideState;
  started: boolean;
  onReplay: (slide: number, show: string) => void;
  pictures: LecturePictures | undefined;
}) {
  const has = (k: string) => state.shown.has(k);
  const again = (show: string) => () => onReplay(index, show);
  const s = slide as Record<string, unknown>;
  const fade = "animate-in fade-in slide-in-from-bottom-1 duration-500 motion-reduce:animate-none";

  switch (slide.kind) {
    case "title": {
      const t = splitTitle(String(s["title"]));
      const ko = t.ko ?? (s["title_en"] ? String(s["title_en"]) : (pictures?.titleKo ?? null));
      const what =
        t.sitting?.what &&
        !t.sitting.what.toLowerCase().startsWith(t.main.toLowerCase().slice(0, 6))
          ? t.sitting.what
          : null;
      const own = Array.isArray(s["words"]) ? (s["words"] as string[]) : null;
      const words = own ?? pictures?.words ?? [];
      return (
        <div className="my-auto grid gap-4 sm:grid-cols-[1.1fr_1fr] sm:items-center sm:gap-7">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/18 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]">
                {t.course ?? "Bài giảng"}
              </span>
              {t.sitting && (
                <span className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold">
                  Buổi {t.sitting.n}
                </span>
              )}
            </p>
            <h2 className="mt-3 text-balance text-[clamp(24px,7.5vw,32px)] font-extrabold leading-[1.1] tracking-tight sm:text-[40px]">
              {t.main}
            </h2>
            {ko && (
              <Ko className="mt-2 block text-[17px] font-bold text-[oklch(0.88_0.1_95)] sm:text-[20px]">
                {ko}
              </Ko>
            )}
            {s["hook"] ? (
              <p className="mt-3 max-w-[30ch] text-balance text-[17px] font-bold leading-snug text-[oklch(0.88_0.13_90)]">
                {String(s["hook"])}
              </p>
            ) : (
              what && (
                <p className="mt-2 max-w-[38ch] text-[14px] font-medium leading-5 opacity-90">
                  {what}
                </p>
              )
            )}
            {(has("counts") || !started) && (
              <p className={cn("mt-4 flex flex-wrap gap-1.5 text-[12px] font-semibold", fade)}>
                <Chip>{Number(s["vocab"])} từ</Chip>
                {Number(s["grammar"]) > 0 && <Chip>{Number(s["grammar"])} mẫu ngữ pháp</Chip>}
                {Number(s["notes"]) > 0 && <Chip>{Number(s["notes"])} lưu ý</Chip>}
              </p>
            )}
          </div>
          <TitleArt banner={pictures?.banner ?? null} words={words} />
        </div>
      );
    }
    case "section": {
      const isVocab = String(s["title"]) === "Từ vựng";
      const preview = isVocab ? (pictures?.words ?? []).slice(0, Number(s["count"]) || 8) : [];
      return (
        <div className="my-auto">
          <div className="flex items-center gap-4">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px] bg-white/95 shadow-elev-2">
              <Illus id={UI_ICON[isVocab ? "vocab" : "grammar"]} size={52} />
            </span>
            <p className="font-display text-[64px] font-bold leading-none tabular-nums text-[oklch(0.88_0.1_95)]">
              0{Number(s["n"])}
            </p>
          </div>
          <h2 className="mt-4 text-[30px] font-extrabold leading-tight">{String(s["title"])}</h2>
          <p className="mt-1 text-[14px] font-semibold opacity-85">{Number(s["count"])} mục</p>
          {preview.length > 0 && (
            <p aria-hidden="true" className="mt-4 flex flex-wrap gap-2">
              {preview.map((w, n) => (
                <span
                  key={w}
                  lang="en"
                  className={cn(
                    "rounded-[14px] bg-white/92 px-3 py-1.5 text-[18px] font-bold text-[oklch(0.3_0.08_285)] shadow-elev-1",
                    n % 2 === 0 ? "-rotate-2" : "rotate-1",
                  )}
                >
                  {w}
                </span>
              ))}
            </p>
          )}
        </div>
      );
    }
    case "word": {
      const ex = (s["examples"] as Ex[]) ?? [];
      return (
        <div className="flex flex-1 flex-col">
          <SlideEyebrow>
            Từ vựng · {Number(s["index"]) + 1}/{Number(s["of"])}
          </SlideEyebrow>
          <div className="my-auto py-4 text-center">
            <WordPicture
              id={typeof s["icon"] === "string" ? s["icon"] : null}
              src={pictures?.vocab[String(s["headword"])] ?? null}
              word={String(s["headword"])}
            />
            <button
              type="button"
              onClick={again("word")}
              aria-label={`${String(s["headword"])}, nghe lại`}
              className="text-[44px] font-bold leading-tight tracking-tight sm:text-[52px]"
              lang="en"
            >
              {String(s["headword"])}
            </button>
            {(s["pos"] || s["pron"]) ? (
              <p className="mt-1 flex items-center justify-center gap-2 text-[13px] opacity-80">
                {s["pos"] ? (
                  <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-bold">
                    {POS_VI[String(s["pos"])] ?? String(s["pos"])}
                  </span>
                ) : null}
                {s["pron"] ? (
                  <span lang="en-fonipa" className="font-medium tracking-wide">
                    {String(s["pron"])}
                  </span>
                ) : null}
              </p>
            ) : null}
            <p
              className={cn(
                "mt-2 text-[17px] font-semibold transition-opacity duration-500",
                state.meaningOut ? "opacity-95" : "opacity-0",
              )}
              aria-hidden={!state.meaningOut}
            >
              {String(s["meaning"])}
            </p>
            {has("note") && s["note"] ? (
              <Rich
                as="p"
                text={String(s["note"])}
                className={cn("mx-auto mt-2 max-w-[34ch] text-[13px] leading-5 opacity-75", fade)}
              />
            ) : null}
          </div>
          <ExampleList examples={ex} has={has} onReplay={(k) => onReplay(index, `ex${k}`)} />
        </div>
      );
    }
    case "review": {
      const words = (s["words"] as { headword: string; meaning: string }[]) ?? [];
      const current = state.latest?.startsWith("w") ? Number(state.latest.slice(1)) : -1;
      return (
        <div className="flex flex-1 flex-col">
          <SlideEyebrow>Ôn lại · nghe và nhắc lại</SlideEyebrow>
          <p className="mt-1 text-[13px] font-medium opacity-85">Chạm vào từ để xem nghĩa.</p>
          <ul className="mt-3 flex max-h-[250px] flex-wrap gap-2 overflow-y-auto pr-1">
            {words.map((w, i) => (
              <ReviewChip key={i} w={w} on={i === current} done={i < current} />
            ))}
          </ul>
        </div>
      );
    }
    case "grammar":
      return (
        <GrammarSlide
          s={s}
          index={index}
          state={state}
          onReplay={onReplay}
          picture={pictures?.grammar[String(s["pattern"])] ?? null}
        />
      );
    case "scene":
      return (
        <div className="flex flex-1 flex-col">
          <SlideEyebrow>{String(s["eyebrow"] ?? "")}</SlideEyebrow>
          <h3 className="mb-3 mt-1 text-balance text-[21px] font-extrabold leading-tight">
            {String(s["title"] ?? "")}
          </h3>
          <Scene
            visual={String(s["visual"])}
            data={(s["data"] as Record<string, unknown>) ?? {}}
            has={has}
            latest={state.latest}
            onReplay={(k) => onReplay(index, k)}
          />
        </div>
      );
    case "note":
      return (
        <div className="flex flex-1 flex-col">
          <SlideEyebrow>Lưu ý</SlideEyebrow>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white/95 shadow-elev-1">
              <Illus id={UI_ICON.note} size={32} />
            </span>
            {s["title"] ? (
              <h3 className="text-[19px] font-extrabold leading-snug text-[oklch(0.9_0.1_95)]">
                {String(s["title"])}
              </h3>
            ) : null}
          </div>
          <div className="mt-3 max-h-[250px] overflow-y-auto rounded-[18px] border-l-[6px] border-[oklch(0.82_0.15_85)] bg-white p-3.5 text-[oklch(0.25_0.04_285)] shadow-elev-2">
            <RichBlock text={String(s["body"] ?? "")} className="text-[14px] leading-6" />
          </div>
        </div>
      );
    case "recap": {
      const ex = (s["examples"] as Ex[]) ?? [];
      const current = state.latest?.startsWith("ex") ? Number(state.latest.slice(2)) : -1;
      return (
        <div className="flex flex-1 flex-col">
          <SlideEyebrow>Nghe rồi nói lại</SlideEyebrow>
          <ol className="mt-3 max-h-[260px] space-y-2 overflow-y-auto pr-1">
            {ex.map((e, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onReplay(index, `ex${i}`)}
                  className={cn(
                    "w-full rounded-[14px] border-l-[5px] px-3 py-2 text-left transition-colors",
                    i === current
                      ? "border-[oklch(0.85_0.15_90)] bg-white text-[oklch(0.25_0.06_285)] shadow-elev-2"
                      : i < current
                        ? "border-transparent bg-white/90 text-[oklch(0.3_0.06_285)]"
                        : "border-transparent bg-white/16",
                  )}
                >
                  <Ko className="block text-[16px] font-bold">{e.ko}</Ko>
                  {e.vi && <span className="block text-[13px] font-medium opacity-80">{e.vi}</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
      );
    }
    case "end":
      return (
        <div className="my-auto text-center">
          <span className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-[30px] bg-white/95 shadow-elev-2">
            <Illus id={UI_ICON.end} size={64} />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[oklch(0.88_0.1_95)]">
            Hết bài
          </p>
          <h2 className="mt-2 text-balance text-[26px] font-extrabold leading-tight">
            {String(s["title"])}
          </h2>
          <p className="mx-auto mt-2 max-w-[34ch] text-[14px] font-medium leading-5 opacity-90">
            {s["next"]
              ? String(s["next"])
              : "Mai quay lại ôn vài phút, Haru sẽ nhắc những gì sắp quên."}
          </p>
          <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-[16px] bg-white/14 px-3.5 py-1.5 text-left text-[12px] font-semibold">
            <SwanMark className="h-5 w-7" /> Làm tiếp các bước còn lại để gom lông thiên nga
          </p>
        </div>
      );
    default:
      return null;
  }
}

function GrammarSlide({
  s,
  index,
  state,
  onReplay,
  picture,
}: {
  s: Record<string, unknown>;
  index: number;
  state: SlideState;
  onReplay: (slide: number, show: string) => void;
  picture: string | null;
}) {
  const sections = (s["sections"] as { key: string; label: string | null; body: string }[]) ?? [];
  const contrasts = (s["contrasts"] as { pattern: string; diff: string }[]) ?? [];
  const examples = (s["examples"] as Ex[]) ?? [];
  const latest = state.latest ?? "";
  // the one piece in front: the latest section, contrast, note or example
  let focus: React.ReactNode = null;
  const exMatch = /^ex(\d+)/.exec(latest);
  if (exMatch) {
    const k = Number(exMatch[1]);
    const e = examples[k];
    if (e) {
      focus = (
        <div key={`ex${k}`} className="rounded-[16px] bg-white/10 p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">
            Ví dụ {k + 1}/{examples.length}
          </p>
          <button
            type="button"
            onClick={() => onReplay(index, `ex${k}`)}
            className="mt-1 block w-full"
          >
            <Chunks text={e.ko} />
          </button>
          {state.shown.has(`ex${k}_vi`) && e.vi && (
            <p className="mt-1 text-[14px] opacity-85">{e.vi}</p>
          )}
          {latest === `ex${k}_say` && (
            <p className="lecture-say mx-auto mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">
              <Mic size={13} aria-hidden="true" /> Nhắc lại
            </p>
          )}
        </div>
      );
    }
  } else if (/^s\d+$/.test(latest)) {
    const x = sections[Number(latest.slice(1))];
    if (x)
      focus = (
        <div key={latest} className="rounded-[16px] bg-card p-3 text-ink shadow-elev-1">
          {x.label && (
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">{x.label}</p>
          )}
          <div className="mt-1 max-h-[210px] overflow-y-auto">
            <RichBlock text={x.body} className="text-[14px] leading-6 " />
          </div>
        </div>
      );
  } else if (/^c\d+$/.test(latest)) {
    const c = contrasts[Number(latest.slice(1))];
    if (c)
      focus = (
        <div key={latest} className="rounded-[16px] bg-card p-3 text-ink shadow-elev-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">So với</p>
          <Rich as="p" text={`\`${c.pattern}\``} className="mt-0.5 font-semibold" />
          <Rich as="p" text={c.diff} className="mt-1 text-[14px] leading-6 " />
        </div>
      );
  } else if (latest === "note" && s["note"]) {
    focus = (
      <div
        key="note"
        className="rounded-[16px] border-l-4 border-danger/70 bg-card p-3 text-ink shadow-elev-1"
      >
        <div className="max-h-[210px] overflow-y-auto">
          <RichBlock text={String(s["note"])} className="text-[13.5px] leading-6 " />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>
        Ngữ pháp · {Number(s["index"]) + 1}/{Number(s["of"])}
      </SlideEyebrow>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
        {picture && (
          <LessonImage
            src={picture}
            eager
            className="aspect-[4/3] w-24 shrink-0 rounded-[16px] border-0 bg-white/10 shadow-elev-2 sm:w-28"
          />
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onReplay(index, "pattern")}
            className="rounded-[14px] bg-white/16 px-3.5 py-2 text-left"
          >
            <span
              lang="en"
              className="text-[clamp(22px,7vw,30px)] font-bold leading-tight [word-break:keep-all]"
            >
              {String(s["pattern"])}
            </span>
          </button>
          {state.shown.has("meaning") && (
            <p className="mt-2 text-[16px] font-semibold opacity-95 animate-in fade-in duration-500">
              {String(s["meaning"])}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 animate-in fade-in duration-500" key={latest}>
        {focus}
      </div>
    </div>
  );
}

function ExampleList({
  examples,
  has,
  onReplay,
}: {
  examples: Ex[];
  has: (k: string) => boolean;
  onReplay: (k: number) => void;
}) {
  const shown = examples.map((e, k) => ({ e, k })).filter(({ k }) => has(`ex${k}`));
  if (shown.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {shown.map(({ e, k }) => (
        <li
          key={k}
          className="animate-in fade-in duration-500 rounded-[12px] bg-white/10 px-3 py-2"
        >
          <button type="button" onClick={() => onReplay(k)} className="block w-full text-left">
            <Ko className="block text-[15px] font-semibold leading-snug">{e.ko}</Ko>
            {has(`ex${k}_vi`) && e.vi && (
              <span className="mt-0.5 block text-[12.5px] opacity-80">{e.vi}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ReviewChip({
  w,
  on,
  done,
}: {
  w: { headword: string; meaning: string };
  on: boolean;
  done: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "rounded-[14px] px-3.5 py-2 text-left text-[17px] font-bold transition-colors",
          on
            ? "bg-[oklch(0.9_0.14_95)] text-[oklch(0.25_0.06_285)] shadow-elev-1"
            : done
              ? "bg-white/90 text-[oklch(0.3_0.06_285)]"
              : "bg-white/16",
        )}
      >
        <Ko>{w.headword}</Ko>
        {open && <span className="ml-1.5 text-[13px] font-semibold opacity-80">· {w.meaning}</span>}
      </button>
    </li>
  );
}

const POS_VI: Record<string, string> = { N: "danh từ", V: "động từ", A: "tính từ", X: "cụm từ" };

const UI_ICON = {
  title: "1F393",
  vocab: "1F4D6",
  grammar: "1F9E9",
  note: "1F4A1",
  review: "1F501",
  recap: "1F3A7",
  end: "1F389",
} as const;

/** A small decorative vector (public/illus/<id>.svg); nothing is shown if it cannot load. */
function Illus({ id, size, className }: { id: string; size: number; className?: string }) {
  const [bad, setBad] = useState(false);
  if (bad) return null;
  return (
    <img
      src={`/illus/${id}.svg`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      decoding="async"
      onError={() => setBad(true)}
      style={{ width: size, height: size }}
      className={cn("drop-shadow-sm", className)}
    />
  );
}

/** An example sentence cut into its words (spaces), each on its own soft block, so the learner
 * sees how the sentence is built. */
function Chunks({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span className="flex flex-wrap justify-center gap-1.5" lang="en">
      {words.map((w, i) => (
        <span
          key={i}
          className={cn(
            "rounded-[10px] px-2 py-0.5 text-[20px] font-bold leading-snug",
            i % 2 === 0 ? "bg-white/18" : "bg-white/8",
          )}
        >
          {w}
        </span>
      ))}
    </span>
  );
}

/** The picture of a word: the Studio picture when there is one, else its small icon, both on a
 * white tile so the slide is not a wall of dark. It stays out of the way when missing or slow:
 * the word is never held back by its picture. */
function WordPicture({ id, src, word }: { id: string | null; src: string | null; word: string }) {
  const [bad, setBad] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => {
    setBad(false);
    setPhotoFailed(false);
  }, [id, src]);
  const tile =
    "mx-auto mb-3 flex h-36 w-36 items-center justify-center overflow-hidden rounded-[30px] bg-white/95 shadow-elev-2 animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none";
  if ((src || hasPositionArt(word)) && (!photoFailed || hasPositionArt(word))) {
    return (
      <div className={tile}>
        <LessonImage
          src={src}
          word={word}
          eager
          onFail={() => setPhotoFailed(true)}
          className="h-full w-full rounded-none border-0"
        />
      </div>
    );
  }
  const story = storyIconForWord(word);
  if (story) {
    return (
      <div className={tile}>
        <StoryIcon name={story} on size={104} />
      </div>
    );
  }
  if (!id || bad) return null;
  return (
    <div className={tile}>
      <img
        key={id}
        src={`/illus/${id}.svg`}
        alt=""
        width={96}
        height={96}
        loading="lazy"
        decoding="async"
        onError={() => setBad(true)}
        className="h-24 w-24"
      />
    </div>
  );
}

/** "Nền tảng 1.1 · Tôi là…: 이에요/예요 & 은/는, buổi 1: Tôi là … (câu giới thiệu đầu tiên)" read as
 * a course tag (Nền tảng 1.1), the lesson's name, its Korean point, and what this sitting does. */
function splitTitle(title: string) {
  let rest = title.trim();
  let course: string | null = null;
  const dot = rest.indexOf(" · ");
  if (dot > 0 && dot < 24) {
    course = rest.slice(0, dot);
    rest = rest.slice(dot + 3);
  }
  let sitting: { n: string; what: string } | null = null;
  const m = /,\s*buổi\s+(\d+)\s*:?\s*(.*)$/i.exec(rest);
  if (m) {
    sitting = { n: m[1]!, what: (m[2] ?? "").trim() };
    rest = rest.slice(0, m.index);
  }
  let main = rest;
  let ko: string | null = null;
  const colon = rest.indexOf(": ");
  const tail = colon > 0 ? rest.slice(colon + 2).trim() : "";
  // only a Korean tail is the yellow "point" line; a Vietnamese one stays part of the name
  if (colon > 0 && /[\u3130-\u318f\uac00-\ud7a3]/.test(tail)) {
    main = rest.slice(0, colon);
    ko = tail;
  }
  return { course, main: main.trim(), ko, sitting };
}

/** The right of the title slide: the lesson's banner, else its first words on tilted tiles (a row on
 * a phone, a grid on a wider screen), else an icon. A banner that fails falls back the same way. */
function TitleArt({ banner, words }: { banner: string | null; words: string[] }) {
  const [failed, setFailed] = useState(false);
  if (banner && !failed) {
    return (
      <LessonImage
        src={banner}
        eager
        onFail={() => setFailed(true)}
        className="aspect-[16/9] w-full rounded-[22px] border-0 bg-white/10 shadow-elev-2 sm:order-last"
      />
    );
  }
  if (words.length === 0) {
    return (
      <div
        aria-hidden="true"
        className="hidden aspect-[16/9] w-full items-center justify-center rounded-[22px] bg-white/10 sm:order-last sm:flex"
      >
        <Illus id={UI_ICON.title} size={72} />
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        // tiles are as wide as their word and wrap: a long word ("permanent") never spills out of its tile
        "flex flex-wrap gap-2 sm:order-last sm:w-full sm:grid sm:gap-2.5",
        words.length <= 2 ? "sm:grid-cols-1" : "sm:grid-cols-2",
      )}
    >
      {words.map((w, n) => (
        <span
          key={w}
          lang="en"
          className={cn(
            "flex shrink-0 items-center justify-center whitespace-nowrap rounded-[14px] bg-white/92 px-3 py-2 text-center text-[15px] font-bold text-[oklch(0.3_0.08_285)] shadow-elev-1 sm:rounded-[18px] sm:px-2 sm:py-2.5 sm:text-[clamp(16px,2vw,22px)]",
            n % 3 === 0 ? "-rotate-2" : "rotate-1",
          )}
        >
          {w}
        </span>
      ))}
    </div>
  );
}

/** A small swan, the mark of Hành trình thiên nga: it swims along the lecture's progress line. */
function SwanMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 32 24" aria-hidden="true" className={className} style={style}>
      <path
        d="M10 16 C5 13 7 5 12.5 5.5"
        fill="none"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <ellipse cx="17.5" cy="17" rx="10.5" ry="5.2" fill="#fff" />
      <circle cx="12.8" cy="5.6" r="2.5" fill="#fff" />
      <path d="M14.8 4.8 L19 6 L14.9 7.2 Z" fill="#ffb347" />
      <path
        d="M15 17 Q20 13.8 25 17"
        fill="none"
        stroke="#24305e"
        strokeOpacity="0.3"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function SlideEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{children}</p>;
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/12 px-2.5 py-1">{children}</span>;
}

export type { LectureSlidesOut };

/** After the last word: what to do next, with a visible countdown (as a "skip" bar on a video
 * player) so the learner can go on at once, wait, or stay and hear it again. */
function EndedPanel({
  next,
  onAgain,
}: {
  next: { label: string; go: () => void; seconds?: number };
  onAgain: () => void;
}) {
  const total = next.seconds ?? 10;
  const [left, setLeft] = useState<number | null>(next.seconds === 0 ? null : total);
  const go = useRef(next.go);
  go.current = next.go;
  useEffect(() => {
    if (left === null) return;
    if (left <= 0) {
      go.current();
      return;
    }
    const t = window.setTimeout(() => setLeft((v) => (v === null ? v : v - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return (
    <div
      role="status"
      className="relative overflow-hidden rounded-[18px] border border-line bg-card p-3.5 shadow-elev-1 animate-in fade-in slide-in-from-bottom-1 duration-500 motion-reduce:animate-none"
    >
      {left !== null && (
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-fill">
          <div
            className="h-full bg-blue transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
            style={{ width: `${(left / total) * 100}%` }}
          />
        </div>
      )}
      <p className="text-[14px] font-bold">Nghe xong rồi.</p>
      <p className="mt-0.5 text-[12.5px] font-medium leading-5 text-ink-2">
        {left !== null ? `Tự chuyển sau ${left} giây: ${next.label}.` : next.label}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => next.go()}
          className="hit-area inline-flex min-h-11 items-center rounded-full bg-blue px-5 text-[13px] font-semibold text-primary-foreground"
        >
          Chuyển ngay
        </button>
        {left !== null && (
          <button
            type="button"
            onClick={() => setLeft(null)}
            className="hit-area inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-[13px] font-semibold"
          >
            Ở lại
          </button>
        )}
        <button
          type="button"
          onClick={onAgain}
          className="hit-area inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-[13px] font-semibold"
        >
          <RotateCcw size={14} strokeWidth={2.6} aria-hidden="true" /> Nghe lại
        </button>
      </div>
    </div>
  );
}
