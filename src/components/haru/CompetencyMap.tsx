import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ClipboardCheck } from "lucide-react";

import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { Ko } from "@/components/lesson/Rich";
import { errorMessage } from "@/lib/api/client";
import { getMyCompetency } from "@/lib/api/content";
import type {
  CompetencyNextOut,
  CompetencyOut,
  CompetencySummaryOut,
  CompetencyTopicOut,
  PlacementSummaryOut,
} from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { writeLocal } from "@/lib/lesson-local";
import { cn } from "@/lib/utils";

const LEVEL_TONE = ["bg-blue-soft", "bg-blue/50", "bg-blue", "bg-green"] as const;

/** "Bản đồ năng lực": per topic, how many grammar cards the learner has met, how far they can use
 * them (the highest rung of the ladder reached), how many they still remember, which are weak, and
 * what to do next. It counts what the learner did; it does not predict an exam score. */
export function CompetencyMap({ enabled }: { enabled: boolean }) {
  const query = useQuery({
    queryKey: ["me", "competency"],
    queryFn: getMyCompetency,
    enabled,
    staleTime: 30_000,
  });
  if (!enabled) return null;
  return (
    <section aria-label="Bản đồ năng lực" className="mt-7">
      <h2 className="text-base font-semibold">Bản đồ năng lực</h2>
      <p className="mt-0.5 text-[12px] font-medium leading-4 text-ink-2">
        Số mẫu ngữ pháp đã gặp, dùng được và còn nhớ ở từng chủ đề. Không phải điểm thi dự đoán.
      </p>
      <div className="mt-3 space-y-3">
        {query.isLoading && (
          <LoadingBlocks label="Đang tải bản đồ năng lực" blocks={["h-24", "h-40"]} />
        )}
        {query.isError && (
          <ErrorState
            title="Không tải được bản đồ năng lực."
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isRefetching}
          />
        )}
        {query.data && <MapBody data={query.data} />}
      </div>
    </section>
  );
}

function MapBody({ data }: { data: CompetencyOut }) {
  return (
    <>
      <PlacementCard placement={data.placement} />
      {data.topics.length === 0 ? (
        <p className="rounded-[18px] border border-dashed border-line p-4 text-xs font-semibold leading-5 text-ink-2">
          Chưa có chủ đề nào có dữ liệu. Học vài thẻ ngữ pháp hoặc làm bài luyện tập, bản đồ sẽ hiện
          ở đây.
        </p>
      ) : (
        data.topics.map((t, i) => (
          <TopicCard
            key={t.topic}
            topic={t}
            rungs={data.rungs}
            // a topic not started yet suggests nothing, except the first one: a learner on
            // Nền tảng 1 is not sent to Viết 54 from here
            suggest={t.summary.cards - t.summary.unseen > 0 || i === firstFresh(data)}
          />
        ))
      )}
    </>
  );
}

function PlacementCard({ placement }: { placement: PlacementSummaryOut | null }) {
  return (
    <Link
      to="/placement"
      onClick={() => tap()}
      className="flex items-center gap-3 rounded-[18px] border border-line bg-card p-4 shadow-elev-1 transition-transform active:scale-[0.97]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
        <ClipboardCheck size={20} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-5">Tìm bài bắt đầu</h3>
        <p className="mt-0.5 text-xs font-semibold leading-5 text-ink-2">
          {placement
            ? `Trình độ ước lượng: ${placement.start_label} · xem lộ trình`
            : "Khoảng 2 phút · Haru tìm bài bắt đầu và xếp lịch học cho bạn."}
        </p>
      </div>
      <ChevronRight size={20} strokeWidth={2.2} className="shrink-0 text-ink-2" />
    </Link>
  );
}

/** The first topic the learner has not started (its index in the map), or -1. */
function firstFresh(data: CompetencyOut): number {
  return data.topics.findIndex((t) => t.summary.cards - t.summary.unseen === 0);
}

function TopicCard({
  topic,
  rungs,
  suggest,
}: {
  topic: CompetencyTopicOut;
  rungs: Record<string, string>;
  suggest: boolean;
}) {
  const s = topic.summary;
  const met = s.cards - s.unseen;
  if (met === 0)
    return (
      <article className="rounded-[20px] border border-line bg-card p-4 shadow-elev-1">
        <h3 className="text-[15px] font-semibold leading-5">{topic.topic}</h3>
        <p className="mt-1 text-xs font-semibold text-ink-2">
          Chưa bắt đầu · {s.cards} mẫu ngữ pháp
        </p>
        {suggest && topic.next[0] && (
          <div className="mt-3">
            <NextLink next={topic.next[0]} />
          </div>
        )}
      </article>
    );
  return (
    <article className="rounded-[20px] border border-line bg-card p-4 shadow-elev-1">
      <h3 className="text-[15px] font-semibold leading-5">{topic.topic}</h3>
      <p className="mt-1 text-xs font-semibold text-ink-2">
        Đã gặp {met}/{s.cards} mẫu ngữ pháp
      </p>
      <LevelBar summary={s} rungs={rungs} />

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Dùng được" value={`${s.goal_reached}/${met}`} hint="đạt mức cần thiết" />
        <Stat label="Còn nhớ" value={`${s.remembered}/${met}`} hint="theo lịch ôn" />
        <Stat
          label="Đến hạn ôn"
          value={String(s.due)}
          hint={s.leeches ? `${s.leeches} thẻ hay quên` : "thẻ"}
        />
      </dl>

      {topic.weakest.length > 0 && (
        <div className="mt-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">Điểm yếu</p>
          <ul className="mt-1.5 space-y-1.5">
            {topic.weakest.map((w) => (
              <li
                key={w.grammar_id}
                className="rounded-[12px] bg-yellow-soft px-3 py-2 text-xs leading-5"
              >
                <Ko className="font-semibold">{w.pattern}</Ko>
                <span className="font-semibold text-ink-2"> — {w.why}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggest && topic.next.length > 0 && (
        <div className="mt-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">
            Nên làm tiếp
          </p>
          <ol className="mt-1.5 space-y-1.5">
            {topic.next.map((n, i) => (
              <li key={`${n.kind}-${i}`}>
                <NextLink next={n} />
              </li>
            ))}
          </ol>
        </div>
      )}

      {topic.lessons.length > 0 && (
        <details className="group mt-3 rounded-[14px] bg-paper">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-xs font-semibold text-blue-deep [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">Từng bài · {topic.lessons.length}</span>
            <ChevronDown
              size={15}
              strokeWidth={2.6}
              aria-hidden="true"
              className="shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <ul className="divide-y divide-line px-3 pb-2">
            {topic.lessons.map((l) => (
              <li key={l.lesson_id} className="py-2">
                <Link
                  to="/lesson/$id"
                  params={{ id: String(l.lesson_id) }}
                  onClick={() => tap()}
                  className="flex items-baseline justify-between gap-3 text-xs"
                >
                  <span className="min-w-0 flex-1 font-semibold leading-5">{l.title}</span>
                  <span className="shrink-0 font-semibold text-ink-2">
                    {l.summary.cards - l.summary.unseen}/{l.summary.cards} đã gặp ·{" "}
                    {l.summary.goal_reached} dùng được
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[12px] bg-paper px-1.5 py-2">
      <dt className="text-[10.5px] font-semibold leading-4 text-ink-2">{label}</dt>
      <dd className="text-base font-semibold leading-6">{value}</dd>
      <dd className="text-[11px] font-semibold leading-3 text-ink-2">{hint}</dd>
    </div>
  );
}

/** A bar of the topic's cards by how far the learner has taken them, with the numbers written
 * under it (colour alone does not say it). */
function LevelBar({
  summary,
  rungs,
}: {
  summary: CompetencySummaryOut;
  rungs: Record<string, string>;
}) {
  const total = Math.max(1, summary.cards);
  const parts: { key: string; label: string; n: number; tone: string }[] = [
    { key: "unseen", label: "Chưa gặp", n: summary.unseen, tone: "bg-progress" },
    { key: "studying", label: "Mới gặp", n: summary.studying, tone: "bg-yellow-strong" },
    ...[0, 1, 2, 3].map((r) => ({
      key: `l${r}`,
      label: rungs[String(r)] ?? `Nấc ${r}`,
      n: summary.by_level[String(r)] ?? 0,
      tone: LEVEL_TONE[r] ?? "bg-blue",
    })),
  ];
  return (
    <div className="mt-2">
      <div
        role="img"
        aria-label={parts
          .filter((p) => p.n > 0)
          .map((p) => `${p.label} ${p.n}`)
          .join(", ")}
        className="flex h-2.5 overflow-hidden rounded-full border border-line bg-progress"
      >
        {parts.map((p) =>
          p.n > 0 ? (
            <span
              key={p.key}
              className={cn("h-full", p.tone)}
              style={{ width: `${(p.n / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] font-semibold text-ink-2">
        {parts
          .filter((p) => p.n > 0)
          .map((p) => (
            <li key={p.key} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className={cn("inline-block h-2 w-2 rounded-full border border-line", p.tone)}
              />
              {p.label} {p.n}
            </li>
          ))}
      </ul>
    </div>
  );
}

function NextLink({ next }: { next: CompetencyNextOut }) {
  const className =
    "hit-area flex min-h-11 items-center gap-2 rounded-[12px] border border-line bg-paper px-3 py-1.5 text-left active:scale-[0.97]";
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-5">{next.title}</span>
        <span className="block text-[12px] font-semibold leading-4 text-ink-2">
          {next.subtitle}
        </span>
      </span>
      <ChevronRight size={16} strokeWidth={2.4} className="shrink-0 text-ink-2" />
    </>
  );
  if (next.kind === "review") {
    return (
      <Link to="/review" onClick={() => tap()} className={className}>
        {body}
      </Link>
    );
  }
  if (next.kind === "weak") {
    return (
      <Link to="/review" search={{ focus: "weak" }} onClick={() => tap()} className={className}>
        {body}
      </Link>
    );
  }
  if ((next.kind === "practice" || next.kind === "learn") && next.lesson_id != null) {
    const id = next.lesson_id;
    return (
      <Link
        to="/lesson/$id"
        params={{ id: String(id) }}
        onClick={() => {
          tap();
          writeLocal(`step:${id}`, next.kind === "practice" ? "practice" : "grammar");
          if (next.kind === "practice" && next.skill) writeLocal(`skill:${id}`, next.skill);
        }}
        className={className}
      >
        {body}
      </Link>
    );
  }
  if (next.kind === "placement") {
    return (
      <Link to="/placement" onClick={() => tap()} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <Link to="/lesson" onClick={() => tap()} className={className}>
      {body}
    </Link>
  );
}
