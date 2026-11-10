import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, RotateCcw, Sparkles } from "lucide-react";

import { Mascot } from "@/components/mascot/Mascot";
import { Rich } from "@/components/lesson/Rich";
import type { RxSummaryOut } from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import { CardList, Meter, PointList, ResultChip, SectionTitle, TierChip } from "./bits";
import { useStartSet } from "./use-start-set";

function Tile({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={cn("rounded-[14px] border border-line px-2 py-2 text-center", tone)}>
      <p className="text-xl font-semibold leading-6">{n}</p>
      <p className="text-[11px] font-semibold leading-4">{label}</p>
    </div>
  );
}

/** "Bạn thu được gì": what this sitting gave the learner — in words first, then question by
 * question, the new points met, the lesson cards to go back to and where each type stands now. */
export function SummaryView({ s }: { s: RxSummaryOut }) {
  const start = useStartSet();
  const redo = s.items
    .filter((i) => i.result === "wrong" || i.result === "aided")
    .map((i) => i.qid);
  return (
    <div className="space-y-5">
      <section className="rounded-[20px] border border-transparent bg-green-soft p-4 shadow-elev-1">
        <div className="flex items-start gap-3">
          <Mascot mood="cheer" className="h-12 w-12 shrink-0" />
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-6">{s.headline_vi}</p>
            <p className="mt-1.5 text-sm font-semibold leading-6">
              <Rich text={s.value_vi} />
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Tile n={s.solid} label="Vững" tone="bg-card" />
          <Tile n={s.aided} label="Nhờ gợi ý" tone="bg-yellow-soft" />
          <Tile n={s.wrong} label="Chưa đúng" tone="bg-danger-soft" />
          <Tile n={s.pending} label="Chờ tự chấm" tone="bg-card" />
        </div>
      </section>

      <section>
        <SectionTitle>Từng câu cho bạn điều gì</SectionTitle>
        <ul className="mt-2 space-y-2">
          {s.items.map((it) => (
            <li key={it.qid} className="rounded-[14px] border border-line bg-card px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold">
                  {it.exam_short} · {it.sec === "L" ? "Nghe" : it.sec === "R" ? "Đọc" : "Viết"}{" "}
                  {it.n}
                </span>
                <TierChip tier={it.tier} />
                <ResultChip result={it.result} className="ml-auto" />
              </div>
              <p className="mt-1 text-[12px] font-semibold text-ink-2">{it.type_name}</p>
              {it.take && (
                <p className="mt-1 text-xs font-semibold leading-5">
                  <Rich text={it.take} />
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {s.new_points.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} strokeWidth={2.6} aria-hidden="true" />
            <SectionTitle>Điểm kiến thức bạn vừa gặp</SectionTitle>
          </div>
          <div className="mt-2">
            <PointList points={s.new_points} />
          </div>
        </section>
      )}

      {s.to_review.length > 0 && (
        <section>
          <SectionTitle>Nên ôn lại trong bài học</SectionTitle>
          <p className="mt-0.5 text-[12px] font-semibold text-ink-2">
            Các thẻ này đã có trong bài học bạn học; câu vừa rồi cho thấy chúng chưa chắc.
          </p>
          <div className="mt-2">
            <CardList cards={s.to_review} />
          </div>
        </section>
      )}

      {s.types.length > 0 && (
        <section>
          <SectionTitle>Dạng bài này đang ở đâu</SectionTitle>
          <ul className="mt-2 space-y-2">
            {s.types.map((t) => (
              <li key={t.code} className="rounded-[14px] border border-line bg-card px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm font-semibold">{t.name_vi}</span>
                  <span className="text-[12px] font-semibold text-ink-2">
                    {t.solid}/{t.total} vững
                  </span>
                </div>
                <div className="mt-1.5">
                  <Meter value={t.solid} total={t.total} label={`${t.name_vi}: số câu vững`} />
                </div>
                <p className="mt-1.5 text-xs font-semibold leading-5 text-ink-2">{t.next_vi}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-[16px] border border-transparent bg-blue-soft px-3.5 py-3">
        <SectionTitle>Bước tiếp theo</SectionTitle>
        <p className="mt-1 text-sm font-semibold leading-6">
          <Rich text={s.next_vi} />
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {redo.length > 0 && (
            <button
              type="button"
              disabled={start.isPending}
              onClick={() => {
                tap();
                start.mutate({ qids: redo });
              }}
              className="hit-area flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-card px-5 text-sm font-semibold shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
            >
              {start.isPending ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw size={15} strokeWidth={2.6} aria-hidden="true" />
              )}
              Làm lại {redo.length} câu chưa vững ngay bây giờ
            </button>
          )}
          <button
            type="button"
            disabled={start.isPending}
            onClick={() => {
              tap();
              start.mutate({});
            }}
            className="hit-area flex min-h-12 items-center justify-center gap-2 rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
          >
            Lượt tiếp theo do Haru chọn
          </button>
          <Link
            to="/exam/real"
            onClick={() => tap()}
            className="hit-area flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold text-blue-deep active:scale-95"
          >
            <ArrowLeft size={14} strokeWidth={2.6} aria-hidden="true" />
            Về trang Luyện đề thi thật
          </Link>
        </div>
      </section>
    </div>
  );
}
