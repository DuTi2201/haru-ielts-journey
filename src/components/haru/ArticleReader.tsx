import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Minus, Plus, X } from "lucide-react";

import { SentenceSheet } from "@/components/haru/SentenceSheet";
import type { ReadMode } from "@/hooks/use-read-mode";
import { prefersReducedMotion } from "@/lib/motion";
import { scrollSpokenIntoView, type SpokenPos } from "@/lib/read-along";
import type { ArticleImageOut, StudyPackOut, StudyStatus, VocabItemOut } from "@/lib/api/types";

// ------------------------------------------------------------ reader prefs --
const SIZES = [15, 17, 19, 21] as const;
const PREFS_KEY = "haru.reader.prefs.v1";

interface ReaderPrefs {
  size: number; // index into SIZES
  serif: boolean;
  showVocab: boolean;
}

const DEFAULT_PREFS: ReaderPrefs = { size: 1, serif: true, showVocab: true };

/** Font size / serif / vocab-highlight choices, remembered per device.
 * Read after mount (not in the initial state) so server and client renders
 * agree; storage can throw in private mode, so every access is guarded. */
function useReaderPrefs() {
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
      setPrefs({
        size:
          typeof parsed.size === "number" && parsed.size >= 0 && parsed.size < SIZES.length
            ? parsed.size
            : DEFAULT_PREFS.size,
        serif: typeof parsed.serif === "boolean" ? parsed.serif : DEFAULT_PREFS.serif,
        showVocab:
          typeof parsed.showVocab === "boolean" ? parsed.showVocab : DEFAULT_PREFS.showVocab,
      });
    } catch {
      /* no saved prefs — defaults are fine */
    }
  }, []);

  function update(patch: Partial<ReaderPrefs>) {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* not persisted — still applies for this visit */
      }
      return next;
    });
  }

  return { prefs, update };
}

const MODES: { id: ReadMode; label: string; hint: string }[] = [
  { id: "original", label: "Bản gốc", hint: "Bài báo nguyên văn" },
  { id: "bilingual", label: "Song ngữ", hint: "Nguyên văn + dịch tiếng Việt từng đoạn" },
  { id: "easy", label: "Bản dễ", hint: "Tiếng Hàn đơn giản (cấp 1–2)" },
];

// ------------------------------------------------------------ vocab tapping --
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface VocabMatcher {
  pattern: RegExp;
  byHangul: Map<string, VocabItemOut>;
}

/** Index of every known vocab word/phrase so each can be tapped inline.
 * Matches the LONGEST hangul first so e.g. "인구 감소" isn't shadowed by a
 * shorter "인구" also in the list; a word already consumed by an earlier
 * match is skipped (non-overlapping).
 *
 * Verbs/adjectives are extracted in dictionary form ("소외되다") but real
 * running text is conjugated ("소외되지", "소외된다"…), so a plain substring
 * match would silently miss almost every verb. Pragmatic fix (proper
 * morphological analysis is out of scope): any dictionary form ending in
 * "다" is also indexed by its stem (minus the final "다"), which still
 * catches the regular conjugations that keep the stem intact. Irregular
 * contractions (하다 → 했다) stay unmatched. Stems of ≤2 characters are
 * skipped to avoid over-matching common short syllables. */
function buildVocabMatcher(vocab: VocabItemOut[]): VocabMatcher | null {
  const byHangul = new Map<string, VocabItemOut>();
  for (const v of vocab) {
    const key = v.hangul.trim();
    if (!key) continue;
    if (!byHangul.has(key)) byHangul.set(key, v);
    if (key.length > 3 && key.endsWith("다")) {
      const stem = key.slice(0, -1);
      if (!byHangul.has(stem)) byHangul.set(stem, v);
    }
  }
  const keys = [...byHangul.keys()].sort((a, b) => b.length - a.length);
  if (keys.length === 0) return null;
  return { pattern: new RegExp(`(${keys.map(escapeRegExp).join("|")})`, "g"), byHangul };
}

// ------------------------------------------------------------------ images --
function ArticleFigure({
  image,
  onZoom,
  hero = false,
}: {
  image: ArticleImageOut;
  onZoom: (img: ArticleImageOut) => void;
  hero?: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  // The image may finish (or fail) before React attaches onLoad/onError —
  // e.g. served from the browser cache — so also check it once on mount, or
  // it would stay invisible forever.
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete) setStatus(el.naturalWidth > 0 ? "loaded" : "failed");
  }, []);
  // A photo that can't load (hotlink-protected, removed) is dropped
  // entirely rather than leaving a broken-image icon in the middle of text.
  if (status === "failed") return null;

  return (
    <figure className={hero ? "-mx-1" : "my-6 -mx-1"}>
      <button
        type="button"
        onClick={() => onZoom(image)}
        className={`block w-full overflow-hidden rounded-[14px] border border-line bg-progress ${status === "loading" ? "shimmer min-h-[180px]" : ""}`}
        aria-label="Phóng to ảnh"
      >
        <img
          ref={imgRef}
          src={image.url}
          alt={image.caption ?? ""}
          loading={hero ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
          className={`h-auto w-full ${status === "loaded" ? "opacity-100" : "opacity-0"} transition-opacity`}
        />
      </button>
      {image.caption && status === "loaded" && (
        <figcaption className="mt-1.5 px-1 text-[12px] font-medium leading-snug text-ink-2">
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}

function Lightbox({ image, onClose }: { image: ArticleImageOut; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ảnh phóng to"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ink/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card"
        aria-label="Đóng"
      >
        <X size={16} strokeWidth={2.6} />
      </button>
      <img
        src={image.url}
        alt={image.caption ?? ""}
        referrerPolicy="no-referrer"
        className="max-h-[80dvh] max-w-full rounded-[10px] object-contain"
      />
      {image.caption && (
        <p className="mt-3 max-w-[390px] text-center text-xs font-medium leading-snug text-paper">
          {image.caption}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------- keep text visible --
/** A floating sheet covers the lower part of the screen. When it opens (or
 * steps to the next sentence) scroll just enough that the tapped text sits in
 * the free band above it — otherwise the learner has to close the sheet to
 * see what they tapped. Does nothing when the text is already in view. */
function keepAboveSheet(target: HTMLElement | null): void {
  const sheet = document.querySelector<HTMLElement>("[data-sheet]");
  if (!target || !target.isConnected || !sheet) return;
  const bandTop = 24;
  const bandBottom = sheet.getBoundingClientRect().top - 16;
  const rect = target.getBoundingClientRect();
  if (rect.top >= bandTop && rect.bottom <= bandBottom) return;
  const bandHeight = bandBottom - bandTop;
  if (bandHeight <= 0) return;
  // Short text: aim for the upper third of the free band. Tall text: align
  // its top so the beginning of the sentence is what stays visible.
  const wanted = rect.height >= bandHeight ? bandTop : bandTop + (bandHeight - rect.height) / 3;
  window.scrollBy({ top: rect.top - wanted, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

// ------------------------------------------------------------------ reader --
/** Reading view of the article's cleaned body: real paragraphs (one per
 * line), generous type, the source's photos back at the position they had
 * in the original, and — when the study pack is ready — the beginner ladder:
 * Vietnamese translation under each paragraph, tap ANY sentence for its
 * translation / word list / grammar notes, or switch to a simple-Korean
 * rewrite. The body arrives already cleaned by the backend, so nothing here
 * filters text — it only lays it out. */
export function ArticleReader({
  body,
  vocab,
  images,
  sourceUrl,
  study,
  studyStatus,
  mode,
  onModeChange,
  activeVocabId,
  onTapWord,
  onSentenceOpen,
  spoken = null,
  playing = false,
  follow = false,
  onFollowChange,
}: {
  body: string;
  vocab: VocabItemOut[];
  images: ArticleImageOut[];
  sourceUrl?: string | null;
  study: StudyPackOut | null;
  studyStatus: StudyStatus;
  mode: ReadMode;
  onModeChange: (m: ReadMode) => void;
  activeVocabId: number | null;
  onTapWord: (v: VocabItemOut) => void;
  /** called when a sentence sheet opens, so the page can close its word sheet */
  onSentenceOpen?: () => void;
  /** read along: the sentence (or simplified paragraph) the audio is reading */
  spoken?: SpokenPos | null;
  /** the audio is playing right now */
  playing?: boolean;
  /** scroll to the spoken sentence as it changes; scrolling by hand while the
   * audio plays switches it off (onFollowChange(false)) */
  follow?: boolean;
  onFollowChange?: (next: boolean) => void;
}) {
  const { prefs, update } = useReaderPrefs();
  const [zoomed, setZoomed] = useState<ArticleImageOut | null>(null);
  // flat index of the tapped sentence across the whole article
  const [activeSentence, setActiveSentence] = useState<number | null>(null);
  const [showVi, setShowVi] = useState<Set<number>>(() => new Set());
  const [showOriginal, setShowOriginal] = useState<Set<number>>(() => new Set());
  const tappedWordEl = useRef<HTMLElement | null>(null);

  const paragraphs = useMemo(
    () =>
      body
        .split(/\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    [body],
  );
  const matcher = useMemo(() => buildVocabMatcher(vocab), [vocab]);

  // The pack only applies if it lines up paragraph for paragraph (the
  // backend guarantees it; this keeps a stale/odd response from misaligning).
  const pack = study && study.paragraphs.length === paragraphs.length ? study : null;
  const effective: ReadMode = pack ? mode : "original";

  // Flat list of every sentence, and where each paragraph's sentences start.
  const { flat, offsets } = useMemo(() => {
    const flatList: { p: number; s: number }[] = [];
    const starts: number[] = [];
    (pack?.paragraphs ?? []).forEach((para, p) => {
      starts.push(flatList.length);
      para.sentences.forEach((_, s) => flatList.push({ p, s }));
    });
    return { flat: flatList, offsets: starts };
  }, [pack]);

  // after_paragraph = number of paragraphs that precede the photo.
  const imagesAfter = useMemo(() => {
    const map = new Map<number, ArticleImageOut[]>();
    for (const img of images) {
      const at = Math.min(Math.max(img.after_paragraph ?? 0, 0), paragraphs.length);
      map.set(at, [...(map.get(at) ?? []), img]);
    }
    return map;
  }, [images, paragraphs.length]);

  const chars = paragraphs.join("").replace(/\s/g, "").length;
  const minutes = Math.max(1, Math.round(chars / 300));
  const fontPx = SIZES[prefs.size] ?? SIZES[1];
  const highlight = prefs.showVocab && matcher !== null && effective !== "easy";

  // Leaving the modes that have tappable sentences closes the sheet.
  useEffect(() => {
    if (effective === "easy") setActiveSentence(null);
  }, [effective]);

  // Bring the tapped sentence/word into the free band above the open sheet.
  useEffect(() => {
    if (activeSentence !== null) {
      keepAboveSheet(document.querySelector<HTMLElement>(`[data-sentence="${activeSentence}"]`));
    } else if (activeVocabId !== null) {
      keepAboveSheet(tappedWordEl.current);
    }
  }, [activeSentence, activeVocabId]);

  // Read along: keep the spoken sentence on screen. A sheet that is open means
  // the learner is studying a sentence, so the page stays put until it closes.
  const releasedAt = useRef(0); // when the learner last took over the scrolling
  useEffect(() => {
    if (follow) releasedAt.current = 0;
  }, [follow]);
  useEffect(() => {
    if (!follow || spoken === null || spoken.p < 0) return;
    if (activeSentence !== null || activeVocabId !== null) return;
    // The learner's scroll and a sentence change can land in the same instant,
    // before `follow` has been turned off: let the learner's scroll win.
    if (performance.now() - releasedAt.current < 1200) return;
    scrollSpokenIntoView(document.querySelector<HTMLElement>('[data-spoken="true"]'));
  }, [follow, spoken, activeSentence, activeVocabId]);

  // ... and let go of it the moment the learner takes over the scrolling (only
  // while the audio plays: scrolling before or after listening is just reading).
  useEffect(() => {
    if (!follow || !playing || !onFollowChange) return;
    const release = (e: Event) => {
      const target = e.target instanceof Element ? e.target : null;
      // dragging the seek bar or scrolling inside a sheet is not reading
      if (target?.closest("input, [data-sheet]")) return;
      releasedAt.current = performance.now();
      onFollowChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key))
        return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, select, button, [role=tab], [data-sheet]")) return;
      releasedAt.current = performance.now();
      onFollowChange(false);
    };
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", onKey);
    };
  }, [follow, playing, onFollowChange]);

  // Sentence-level highlight needs the study pack's sentences; otherwise (the
  // simplified text, or no pack yet) the whole paragraph is highlighted.
  const sentenceLevel = pack !== null && effective !== "easy";
  function isSpokenSentence(pi: number, si: number): boolean {
    return sentenceLevel && spoken !== null && spoken.p === pi && spoken.s === si;
  }
  function isSpokenParagraph(pi: number): boolean {
    if (spoken === null || spoken.p !== pi) return false;
    if (!sentenceLevel) return true;
    return (pack?.paragraphs[pi]?.sentences.length ?? 0) <= spoken.s; // no such sentence: fall back
  }

  function openSentence(index: number) {
    setActiveSentence(index);
    onSentenceOpen?.();
  }

  function toggle(setter: (fn: (prev: Set<number>) => Set<number>) => void, i: number) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function renderText(text: string) {
    if (!highlight || !matcher) return text;
    return text.split(matcher.pattern).map((part, i) => {
      const v = matcher.byHangul.get(part);
      if (!v) return <Fragment key={i}>{part}</Fragment>;
      const active = activeVocabId === v.id;
      return (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            tappedWordEl.current = e.currentTarget;
            setActiveSentence(null);
            onTapWord(v);
          }}
          className={`rounded-[3px] px-px align-baseline underline decoration-blue decoration-[1.5px] underline-offset-[5px] [text-decoration-style:dotted] ${active ? "bg-yellow-strong" : "active:bg-yellow-soft"}`}
        >
          {part}
        </button>
      );
    });
  }

  function renderOriginal(pi: number) {
    const text = paragraphs[pi] ?? "";
    if (!pack) return renderText(text);
    const sentences = pack.paragraphs[pi]?.sentences ?? [];
    if (sentences.length === 0) return renderText(text);
    return sentences.map((sent, si) => {
      const index = (offsets[pi] ?? 0) + si;
      const active = activeSentence === index;
      const reading = isSpokenSentence(pi, si);
      return (
        <Fragment key={si}>
          <span
            tabIndex={0}
            data-sentence={index}
            data-spoken={reading ? "true" : undefined}
            aria-current={reading ? "true" : undefined}
            onClick={() => openSentence(index)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openSentence(index);
              }
            }}
            className={`cursor-pointer rounded-[3px] transition-colors duration-200 [-webkit-tap-highlight-color:transparent] [box-decoration-break:clone] motion-reduce:transition-none ${active ? "bg-yellow-soft" : reading ? "bg-blue/20" : "active:bg-yellow-soft/60"}`}
          >
            {renderText(sent.ko)}
          </span>
          {si < sentences.length - 1 ? " " : null}
        </Fragment>
      );
    });
  }

  function paragraphVi(pi: number): string {
    return (pack?.paragraphs[pi]?.sentences ?? [])
      .map((s) => s.vi)
      .filter(Boolean)
      .join(" ");
  }

  const before = imagesAfter.get(0) ?? [];
  const sheetSentence = activeSentence !== null ? flat[activeSentence] : undefined;
  const sheetData = sheetSentence
    ? pack?.paragraphs[sheetSentence.p]?.sentences[sheetSentence.s]
    : undefined;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Chế độ đọc"
        className="grid grid-cols-3 gap-1 rounded-full border border-line bg-card p-1"
      >
        {MODES.map((m) => {
          const disabled = m.id !== "original" && !pack;
          const selected = effective === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              title={disabled ? "Đang chuẩn bị — vài phút nữa sẽ dùng được" : m.hint}
              onClick={() => onModeChange(m.id)}
              className={`min-h-10 rounded-full px-2 py-2 text-xs font-semibold transition-colors ${selected ? "bg-blue text-primary-foreground" : "text-ink"} ${disabled ? "opacity-40" : ""}`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      {!pack && (
        <p className="mt-1.5 text-[12px] font-medium text-ink-2">
          {studyStatus === "failed"
            ? "Chưa có bản dịch và bản dễ cho bài này — hệ thống sẽ thử lại sau."
            : "Song ngữ và Bản dễ sẽ dùng được khi phần chuẩn bị ở trên xong."}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-ink-2">
          ≈ {minutes} phút đọc · {paragraphs.length} đoạn
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => update({ size: Math.max(0, prefs.size - 1) })}
            disabled={prefs.size === 0}
            className="hit-area flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card active:scale-[0.97] disabled:opacity-40"
            aria-label="Giảm cỡ chữ"
          >
            <Minus size={15} strokeWidth={2.6} />
          </button>
          <span className="font-korean text-xs font-semibold" aria-hidden="true">
            가
          </span>
          <button
            type="button"
            onClick={() => update({ size: Math.min(SIZES.length - 1, prefs.size + 1) })}
            disabled={prefs.size === SIZES.length - 1}
            className="hit-area flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card active:scale-[0.97] disabled:opacity-40"
            aria-label="Tăng cỡ chữ"
          >
            <Plus size={15} strokeWidth={2.6} />
          </button>
          <button
            type="button"
            onClick={() => update({ serif: !prefs.serif })}
            aria-pressed={prefs.serif}
            className={`hit-area ml-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold ${prefs.serif ? "bg-blue text-primary-foreground" : "bg-card"}`}
          >
            Serif
          </button>
          {matcher && effective !== "easy" && (
            <button
              type="button"
              onClick={() => update({ showVocab: !prefs.showVocab })}
              aria-pressed={prefs.showVocab}
              className={`hit-area rounded-full border border-line px-3 py-1.5 text-xs font-semibold ${prefs.showVocab ? "bg-yellow-soft" : "bg-card"}`}
            >
              Từ vựng
            </button>
          )}
        </div>
      </div>

      {effective !== "easy" && (pack || highlight) && (
        <p className="mt-2 text-[12px] font-medium text-ink-2">
          {pack ? "Chạm vào một câu để xem dịch, từng từ và ngữ pháp." : null}
          {pack && highlight ? " " : null}
          {highlight ? "Từ gạch chân: chạm để xem nghĩa." : null}
        </p>
      )}
      {effective === "easy" && (
        <p className="mt-2 text-[12px] font-medium text-ink-2">
          Bản tiếng Hàn đơn giản. Bấm “Dịch” để xem tiếng Việt, “Bản gốc” để so với bài báo.
        </p>
      )}

      <div className="mt-4">
        {before.map((img) => (
          <ArticleFigure key={img.url} image={img} onZoom={setZoomed} hero />
        ))}
      </div>

      <article
        lang="ko"
        className={`${prefs.serif ? "font-korean-serif" : "font-korean"} mt-2 break-keep text-ink [overflow-wrap:anywhere]`}
        style={{ fontSize: `${fontPx}px`, lineHeight: 1.95 }}
      >
        {paragraphs.map((text, i) => {
          const easyText = pack?.paragraphs[i]?.easy_ko?.trim() || null;
          const easyShown = effective === "easy" && easyText !== null;
          const vi = paragraphVi(i);
          return (
            <Fragment key={i}>
              <div className={i === 0 ? "" : "mt-[1.1em]"}>
                <p
                  data-spoken={isSpokenParagraph(i) ? "true" : undefined}
                  aria-current={isSpokenParagraph(i) ? "true" : undefined}
                  className={`-mx-1.5 rounded-[8px] px-1.5 transition-colors duration-200 motion-reduce:transition-none ${isSpokenParagraph(i) ? "bg-blue/20" : ""}`}
                >
                  {easyShown ? easyText : renderOriginal(i)}
                </p>

                {effective === "bilingual" && vi && (
                  <p className="mt-1.5 border-l-[3px] border-blue pl-3 font-sans text-[0.84em] font-medium leading-[1.75] text-blue-deep">
                    {vi}
                  </p>
                )}

                {easyShown && (
                  <>
                    <div className="mt-2 flex gap-2 font-sans">
                      {vi && (
                        <button
                          type="button"
                          onClick={() => toggle(setShowVi, i)}
                          aria-pressed={showVi.has(i)}
                          className={`hit-area rounded-full border border-line px-3 py-1 text-xs font-semibold ${showVi.has(i) ? "bg-blue text-primary-foreground" : "bg-card"}`}
                        >
                          Dịch
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggle(setShowOriginal, i)}
                        aria-pressed={showOriginal.has(i)}
                        className={`hit-area rounded-full border border-line px-3 py-1 text-xs font-semibold ${showOriginal.has(i) ? "bg-blue text-primary-foreground" : "bg-card"}`}
                      >
                        Bản gốc
                      </button>
                    </div>
                    {showVi.has(i) && vi && (
                      <p className="mt-1.5 border-l-[3px] border-blue pl-3 font-sans text-[0.84em] font-medium leading-[1.75] text-blue-deep">
                        {vi}
                      </p>
                    )}
                    {showOriginal.has(i) && (
                      <p className="mt-1.5 border-l-[3px] border-line pl-3 text-[0.9em] text-ink-2">
                        {text}
                      </p>
                    )}
                  </>
                )}
              </div>
              {(imagesAfter.get(i + 1) ?? []).map((img) => (
                <ArticleFigure key={img.url} image={img} onZoom={setZoomed} />
              ))}
            </Fragment>
          );
        })}
      </article>

      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-deep underline underline-offset-2"
        >
          <ExternalLink size={12} strokeWidth={2.6} /> Xem bài gốc trên trang báo
        </a>
      )}

      {sheetData && activeSentence !== null && (
        <SentenceSheet
          sentence={sheetData}
          position={activeSentence + 1}
          total={flat.length}
          onPrev={activeSentence > 0 ? () => openSentence(activeSentence - 1) : null}
          onNext={activeSentence < flat.length - 1 ? () => openSentence(activeSentence + 1) : null}
          onClose={() => setActiveSentence(null)}
        />
      )}

      {zoomed && <Lightbox image={zoomed} onClose={() => setZoomed(null)} />}
    </div>
  );
}
