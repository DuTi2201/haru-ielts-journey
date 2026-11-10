import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Volume2 } from "lucide-react";

import { ChunkDetails } from "@/components/haru/ChunkDetails";
import { useVocabAudio } from "@/hooks/use-vocab-audio";
import type { VocabItemOut } from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { ExamChip } from "./ExamChip";
import { LessonImage } from "./LessonImage";
import { hasPositionArt } from "./lecture/PositionArt";
import { PriorityChip } from "./PriorityChip";
import { Ko } from "./Rich";

/** pos labels are stored as Vietnamese words; this is the order they are listed in. */
const POS_ORDER = ["danh từ", "động từ", "tính từ", "khác"];
const posRank = (p: string | null) => {
  const i = POS_ORDER.indexOf((p ?? "khác").toLowerCase());
  return i === -1 ? POS_ORDER.length : i;
};

/** The lesson's whole word list at a glance: filter by part of speech, grouped by
 * the lesson's own sub-sets (e.g. "Đơn vị đếm") when it has them, each row opening
 * to its example, its note and a play button. Flashcards are the other way to study
 * the same words. */
export function VocabList({
  vocab,
  grouped = true,
}: {
  vocab: VocabItemOut[];
  /** false: no lesson-family headings (a news article mixes words from many lessons). */
  grouped?: boolean;
}) {
  const [pos, setPos] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const audio = useVocabAudio();
  const [activeId, setActiveId] = useState<number | null>(null);

  const posList = useMemo(
    () =>
      [...new Set(vocab.map((v) => (v.pos ?? "khác").toLowerCase()))].sort(
        (a, b) => posRank(a) - posRank(b),
      ),
    [vocab],
  );
  const visible = pos ? vocab.filter((v) => (v.pos ?? "khác").toLowerCase() === pos) : vocab;

  const groups = useMemo(() => {
    const hasFamilies = grouped && visible.some((v) => v.family);
    if (!hasFamilies) return [{ name: null as string | null, items: visible }];
    const map = new Map<string, VocabItemOut[]>();
    for (const v of visible) {
      const key = v.family ?? "Khác";
      map.set(key, [...(map.get(key) ?? []), v]);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  }, [visible, grouped]);

  if (vocab.length === 0) {
    return <p className="mt-3 text-sm font-medium text-ink-2">Bài này chưa có từ vựng.</p>;
  }

  return (
    <div className="mt-3">
      {posList.length > 1 && (
        <div role="group" aria-label="Lọc theo từ loại" className="flex flex-wrap gap-1.5">
          {[null, ...posList].map((p) => (
            <button
              key={p ?? "all"}
              type="button"
              aria-pressed={pos === p}
              onClick={() => setPos(p)}
              className={cn(
                "hit-area rounded-full border border-line px-3 py-1 text-[12px] font-semibold",
                pos === p ? "bg-blue text-primary-foreground" : "bg-card text-ink-2",
              )}
            >
              {p ?? "Tất cả"}
              {p === null
                ? ` · ${vocab.length}`
                : ` · ${vocab.filter((v) => (v.pos ?? "khác").toLowerCase() === p).length}`}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-4">
        {groups.map((g) => (
          <section key={g.name ?? "all"} aria-label={g.name ?? "Từ vựng"}>
            {g.name && <h3 className="mb-1.5 text-[13px] font-semibold text-ink-2">{g.name}</h3>}
            <ul className="space-y-2">
              {g.items.map((v) => {
                const open = openId === v.id;
                const loading = activeId === v.id && audio.state === "loading";
                const hasMore = !!(
                  v.image_url ||
                  hasPositionArt(v.headword) ||
                  v.example_en ||
                  v.sino_vietnamese ||
                  v.usage_note_vi ||
                  v.collocations?.length
                );
                return (
                  <li key={v.id} className="card-soft rounded-[16px] bg-card">
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => {
                          tap();
                          setOpenId(open ? null : v.id);
                        }}
                        aria-expanded={hasMore ? open : undefined}
                        disabled={!hasMore}
                        className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5 rounded-[16px] px-3.5 py-2 text-left disabled:cursor-default"
                      >
                        <LessonImage
                          src={v.image_url}
                          word={v.headword}
                          className="h-11 w-11 rounded-[10px]"
                        />
                        <span className="min-w-0 flex-1">
                          {/* the labels follow the word on its own line (and drop under it only when
                              the word is long), so the word and its meaning keep the whole row */}
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <Ko className="break-keep text-[17px] font-semibold leading-6">
                              {v.headword}
                            </Ko>
                            {v.pron_en && (
                              <Ko className="text-[13px] font-semibold text-ink-2">{v.pron_en}</Ko>
                            )}
                            <ExamChip tag={v.exam} />
                            <PriorityChip priority={v.priority} />
                            {v.pos && (
                              <span className="text-[11px] font-semibold leading-4 text-ink-2">
                                {v.pos}
                              </span>
                            )}
                          </span>
                          <span className="block break-words text-[13px] font-semibold leading-5 text-blue-deep">
                            {v.meaning_vi}
                          </span>
                        </span>
                        {hasMore && (
                          <ChevronDown
                            size={16}
                            strokeWidth={2.6}
                            aria-hidden="true"
                            className={cn(
                              "shrink-0 text-ink-2 transition-transform duration-200 motion-reduce:transition-none",
                              open && "rotate-180",
                            )}
                          />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveId(v.id);
                          void audio.play(v.id, v.headword);
                        }}
                        aria-label={`Nghe ${v.headword}`}
                        className="flex w-12 shrink-0 items-center justify-center rounded-r-[16px] text-blue-deep active:scale-90"
                      >
                        {loading ? (
                          <Loader2 size={17} strokeWidth={2.6} className="animate-spin" />
                        ) : (
                          <Volume2 size={18} strokeWidth={2.4} />
                        )}
                      </button>
                    </div>
                    {open && hasMore && (
                      <div className="space-y-1.5 border-t border-progress px-3.5 pb-3 pt-2.5">
                        <LessonImage
                          src={v.image_url}
                          word={v.headword}
                          className="mx-auto h-36 w-36 sm:h-40 sm:w-40"
                        />
                        {v.example_en && (
                          <div>
                            <Ko className="block text-[13px] leading-5">{v.example_en}</Ko>
                            {v.example_vi && (
                              <span className="block text-xs leading-5 text-ink-2">
                                {v.example_vi}
                              </span>
                            )}
                          </div>
                        )}
                        {v.sino_vietnamese && (
                          <p className="text-xs text-ink-2">Hán Việt: {v.sino_vietnamese}</p>
                        )}
                        <ChunkDetails item={v} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {audio.state === "error" && (
        <p role="status" className="mt-2 text-center text-[12px] font-semibold text-ink-2">
          {audio.usedFallback
            ? "Đang phát bằng giọng đọc của thiết bị (không tạo được giọng từ máy chủ)."
            : audio.error || "Không tạo được giọng đọc, thử lại nhé."}
        </p>
      )}
    </div>
  );
}
