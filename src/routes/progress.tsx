import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { BookX, ChevronRight, ClipboardCheck, Layers, LogIn, Mic, PenLine } from "lucide-react";

import { CompetencyMap } from "@/components/haru/CompetencyMap";
import { CountUp, MascotTalk, Ring, Rise, Stage } from "@/components/haru/cinema";
import { asStage, STAGES } from "@/components/journey/assets";
import {
  CastleScene,
  ChapterTitle,
  JourneyPath,
  journeyLines,
  pickRelic,
  ROMAN,
  ShieldGlyph,
  SwanStage,
  useHour,
} from "@/components/journey/Journey";
import { HourglassRelic, RoseRelic, useDayLeft } from "@/components/journey/Relics";
import { ROMAN_CH, wearRelic, wornRelic } from "@/components/journey/feather-data";
import { Constellation, SparkleMeter } from "@/components/journey/Feathers";
import { Mascot, type MascotMood } from "@/components/mascot/Mascot";
import { PracticeShell } from "@/components/haru/PracticeShell";
import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { PresentInsightsCard } from "@/components/talk/PresentInsightsCard";
import { TalkInsightsCard } from "@/components/talk/TalkInsightsCard";
import { useAuth } from "@/hooks/use-auth";
import { getMyPlan } from "@/lib/api/content";
import { getTalkInsights } from "@/lib/api/conversation";
import { getPresentInsights } from "@/lib/api/presentation";
import { errorMessage } from "@/lib/api/client";
import { getWeaknesses } from "@/lib/api/practice";
import type { ExamAccuracyOut, JourneyOut, WeaknessesOut } from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Tiến bộ — Haru" },
      { name: "description", content: "Những chỗ hay sai và cách luyện lại trên Haru." },
      { property: "og:title", content: "Tiến bộ — Haru" },
      { property: "og:description", content: "Những chỗ hay sai và cách luyện lại trên Haru." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgressScreen,
});

/** Few answers say little: below this, an accuracy figure is shown with a caution. */
const FEW_ANSWERS = 5;

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section className="mt-7">
      <h2 className="text-base font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-[12px] font-medium leading-4 text-ink-2">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bars({ rows }: { rows: { key: string; label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  // the bars grow from nothing once on screen
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setGrown(true), 80);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-xs font-semibold">
            <span className="min-w-0 flex-1 leading-5">{r.label}</span>
            <span className="shrink-0 text-ink-2">{r.count} lần</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-progress" aria-hidden="true">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue to-purple transition-[width] duration-1000 ease-spring motion-reduce:transition-none"
              style={{ width: grown ? `${(r.count / max) * 100}%` : "0%" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ExamRow({ row }: { row: ExamAccuracyOut }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-xs">
      <span className="min-w-0 flex-1 font-semibold leading-5">{row.name}</span>
      <span className="shrink-0 text-right font-semibold text-ink-2">
        {row.correct}/{row.attempts} câu đúng
        {row.attempts < FEW_ANSWERS && (
          <span className="block text-[11px]">mới làm ít, chỉ để tham khảo</span>
        )}
      </span>
    </li>
  );
}

function PracticeActions({ data }: { data: WeaknessesOut }) {
  return (
    <section aria-label="Luyện lại" className="space-y-3">
      {data.weak_cards === 0 ? (
        <ActionBody
          icon={<Layers size={20} strokeWidth={2.2} />}
          title="Ôn thẻ hay sai"
          detail="Chưa có thẻ nào bạn hay quên."
          disabled
        />
      ) : (
        <Link
          to="/review"
          search={{ focus: "weak" }}
          onClick={() => tap()}
          className="block transition-transform active:scale-[0.97]"
        >
          <ActionBody
            icon={<Layers size={20} strokeWidth={2.2} />}
            title="Ôn thẻ hay sai"
            detail={
              data.leeches > 0
                ? `${data.weak_cards} thẻ hay quên, ${data.leeches} thẻ đã quên từ 2 lần.`
                : `${data.weak_cards} thẻ hay quên.`
            }
          />
        </Link>
      )}
      <Link
        to="/exam/real"
        onClick={() => tap()}
        className="block transition-transform active:scale-[0.97]"
      >
        <ActionBody
          icon={<ClipboardCheck size={20} strokeWidth={2.2} />}
          title="Luyện đề thi thật"
          detail="Nghe, đọc, viết từ đề TOPIK II: chọn câu theo bài bạn đã học, hiểu từng câu."
        />
      </Link>
      <Link
        to="/writing/drill"
        onClick={() => tap()}
        className="block transition-transform active:scale-[0.97]"
      >
        <ActionBody
          icon={<PenLine size={20} strokeWidth={2.2} />}
          title="Luyện viết câu 51–52"
          detail="Điền câu vào chỗ trống, soạn từ chính những cụm bạn đang học."
        />
      </Link>
    </section>
  );
}

function Report({ data }: { data: WeaknessesOut }) {
  const noErrors = data.total_errors === 0;
  const noExam = data.exam.length === 0;
  return (
    <>
      <Section
        title={`Hay sai trong ${data.days} ngày qua`}
        hint={
          noErrors
            ? undefined
            : `${data.total_errors} lần trả lời sai được ghi lại, gom theo loại lỗi.`
        }
      >
        {noErrors ? (
          <p className="rounded-[18px] border border-dashed border-line p-4 text-xs font-semibold leading-5 text-ink-2">
            Chưa ghi nhận lỗi nào. Khi bạn trả lời sai ở phần ôn tập, luyện đề hoặc luyện viết, Haru
            sẽ gom lại ở đây để bạn biết nên luyện gì.
          </p>
        ) : (
          <Bars
            rows={data.by_type
              .slice(0, 6)
              .map((t) => ({ key: `${t.skill}:${t.error_type}`, label: t.label, count: t.count }))}
          />
        )}
      </Section>

      {data.top_items.length > 0 && (
        <Section title="Thẻ hay sai" hint="Những thẻ bạn đã sai từ 2 lần trở lên.">
          <ul className="space-y-2">
            {data.top_items.map((item) => (
              <li
                key={`${item.item_type}:${item.item_id}`}
                className="card-soft flex items-center gap-3 rounded-[16px] bg-card px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p lang="ko" className="font-korean truncate text-[15px] font-semibold">
                    {item.title}
                  </p>
                  <p className="truncate text-xs font-semibold text-ink-2">{item.meaning_vi}</p>
                  {item.family && (
                    <p className="mt-1 truncate text-[12px] font-semibold text-blue-deep">
                      {item.family}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-danger-soft px-2.5 py-0.5 text-[12px] font-semibold text-danger">
                  sai {item.errors} lần
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.families.length > 0 && (
        <Section
          title="Nhóm từ hay nhầm"
          hint="Lỗi tập trung ở những nhóm này, nên ôn cả nhóm thay vì từng từ."
        >
          <ul className="flex flex-wrap gap-2">
            {data.families.map((f) => (
              <li
                key={f.family}
                className="rounded-full bg-blue-soft px-3 py-1 text-xs font-semibold text-blue-deep"
              >
                {f.family} · {f.errors}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Câu hỏi đề thi thật"
        hint="Số câu đúng ở từng dạng, không phải điểm thi dự đoán."
      >
        {noExam ? (
          <p className="rounded-[18px] border border-dashed border-line p-4 text-xs font-semibold leading-5 text-ink-2">
            Bạn chưa làm câu nào. Làm vài câu ở mục “Luyện đề thi thật” để thấy dạng nào còn yếu.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-[18px] bg-card px-4 card-soft">
            {data.exam.map((row) => (
              <ExamRow key={row.qtype_code} row={row} />
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

/** The card face the practice links share (the link wraps it). `disabled` is the
 * same face without the arrow, for a practice that is not available yet. */
function ActionBody({
  icon,
  title,
  detail,
  disabled = false,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  disabled?: boolean;
}) {
  return (
    <div
      aria-disabled={disabled || undefined}
      className={cn(
        "flex items-center gap-3 rounded-[18px] border border-line p-4 shadow-elev-1",
        disabled ? "bg-card/60" : "bg-card",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          disabled ? "bg-progress text-ink-2" : "bg-blue-soft text-blue",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-5">{title}</h3>
        <p className="mt-0.5 text-xs font-semibold leading-5 text-ink-2">{detail}</p>
      </div>
      {!disabled && <ChevronRight size={20} strokeWidth={2.2} className="shrink-0 text-ink-2" />}
    </div>
  );
}

function AnonymousNudge() {
  return (
    <section className="mt-8 rounded-[20px] border border-line bg-card p-6 text-center shadow-elev-2">
      <Mascot mood="wave" className="mx-auto h-16 w-16" />
      <h2 className="mt-3 text-lg font-semibold leading-snug">Đăng nhập để xem tiến bộ</h2>
      <p className="mt-1.5 text-xs font-semibold leading-5 text-ink-2">
        Haru ghi lại những chỗ bạn hay sai để gợi ý đúng bài luyện.
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

function heroMood(readiness: number | null): MascotMood {
  if (readiness === null) return "thinking";
  if (readiness >= 70) return "celebrate";
  if (readiness >= 35) return "cheer";
  return "reading";
}

function heroLines(readiness: number | null, w: WeaknessesOut | undefined): string[] {
  const out: string[] = [];
  if (w && w.weak_cards > 0)
    out.push(`Có ${w.weak_cards} thẻ hay quên. Ôn 5 phút là nhớ lại ngay!`);
  if (w && w.by_type[0])
    out.push(`Lỗi hay gặp nhất: ${w.by_type[0].label.toLowerCase()}. Mình luyện chỗ này nhé.`);
  if (readiness !== null && readiness >= 70) out.push("Độ nhớ của bạn rất tốt, giữ nhịp này nha!");
  if (w && w.total_errors === 0) out.push("Chưa thấy lỗi nào. Làm thêm bài để mình đo kỹ hơn!");
  out.push("Sai là cách nhanh nhất để nhớ. Đừng ngại nhé!");
  return out;
}

/** The summary on the stage: how much sticks, the streak, what is weak, and Haru's word on it. */
function ProgressHero({ data }: { data: WeaknessesOut | undefined }) {
  const plan = useQuery({ queryKey: ["me", "plan"], queryFn: getMyPlan, staleTime: 60_000 });
  const readiness = plan.data?.readiness_pct ?? null;
  const streak = plan.data?.streak_days ?? 0;
  const tiles = [
    { k: "Ngày liên tiếp", v: streak, unit: "ngày" },
    { k: "Thẻ hay quên", v: data?.weak_cards ?? 0, unit: "thẻ" },
    { k: `Lỗi ${data?.days ?? 14} ngày qua`, v: data?.total_errors ?? 0, unit: "lần" },
  ];
  const hour = useHour();
  const left = useDayLeft();
  const j = plan.data?.journey;
  if (j) {
    const relic = pickRelic(j, streak, left);
    const st = STAGES[asStage(j.shown_stage)];
    const bars =
      j.next_readiness != null && j.next_items != null
        ? [
            {
              k: "Độ nhớ",
              have: Math.round(readiness ?? 0),
              need: j.next_readiness,
              unit: "%",
            },
            { k: "Từ và mẫu câu đã học", have: j.items, need: j.next_items, unit: "" },
          ]
        : [];
    return (
      <CastleScene
        journey={j}
        hour={hour}
        aria-label="Hành trình Thiên Nga của bạn"
        className="rounded-[32px] shadow-elev-2"
      >
        <div className="flex min-h-[680px] flex-col p-5 sm:p-6">
          <ChapterTitle stage={j.shown_stage} eyebrow="Tiến bộ · Hành trình Thiên Nga">
            <p className="jr-story mt-2 max-w-[34ch]">{st.line}</p>
            {(j.cursed || j.missed_days > 0) && (
              <p className="jr-warnline mt-2">
                {j.cursed
                  ? j.studied_today
                    ? "Lời nguyền đang rạn · học thêm ngày mai để phá"
                    : "Bị nguyền · học 2 ngày liền để phá"
                  : `${j.missed_days} ngày chưa học · ${j.missed_days + 1} cánh hoa đã rơi`}
              </p>
            )}
          </ChapterTitle>

          <div className="jr-glass mt-5 rounded-[22px] px-4 py-4">
            <JourneyPath stage={j.shown_stage} />
            {j.chapters?.length ? (
              <ChapterRows j={j} />
            ) : bars.length > 0 ? (
              <div className="mt-4 space-y-3">
                <p className="jr-eyebrow">
                  Tới chương {ROMAN[asStage(j.stage + 1)]} · {STAGES[asStage(j.stage + 1)].name}
                </p>
                {bars.map((b) => (
                  <div key={b.k}>
                    <div className="flex justify-between text-[12px] font-semibold">
                      <span>{b.k}</span>
                      <span className="tabular-nums jr-ink-soft">
                        {b.have}
                        {b.unit} / {b.need}
                        {b.unit}
                      </span>
                    </div>
                    <div className="jr-hairline mt-1.5">
                      <span
                        style={{ width: `${Math.min(100, (b.have / Math.max(1, b.need)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="jr-story mt-4 text-center">
                Bạn đã đội vương miện. Giữ chuỗi để lâu đài luôn sáng.
              </p>
            )}
          </div>

          {(j.constellations?.length ?? 0) > 0 && <SupportSky j={j} />}

          <dl className="mt-4 grid grid-cols-3 divide-x divide-current/15 text-center">
            {tiles.map((t) => (
              <div key={t.k} className="flex flex-col-reverse px-1">
                <dt className="jr-eyebrow mt-1 !text-[10px]">{t.k}</dt>
                <dd className="font-display text-[28px] font-bold leading-none tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                  <CountUp value={t.v} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="jr-eyebrow mt-3 flex items-center justify-center gap-1.5 !normal-case !tracking-normal">
            <ShieldGlyph ready={!!j.shield_ready} className="!mt-0" />
            {j.shield_ready
              ? "Tuần này còn khiên chuỗi: nghỉ 1 ngày vẫn giữ chuỗi"
              : "Đã dùng khiên chuỗi tuần này · thứ Hai có khiên mới"}
          </p>

          <div className="flex-1" />
          <SwanStage
            className="mt-4"
            journey={j}
            size="h-40 w-40"
            lines={[...journeyLines(j, { relic }), ...heroLines(readiness, data)]}
            relic={
              relic === "rose"
                ? { kind: relic, node: (say) => <RoseRelic journey={j} onTap={say} /> }
                : relic === "hourglass"
                  ? { kind: relic, node: (say) => <HourglassRelic journey={j} onTap={say} /> }
                  : null
            }
          />
        </div>
      </CastleScene>
    );
  }
  return (
    <Stage className="p-5 sm:p-6" aria-label="Tóm tắt tiến bộ">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] opacity-75">Tiến bộ</p>
      <h1 className="mt-1 text-[28px] font-extrabold leading-[1.1]">Chỗ nào còn hay sai?</h1>
      <div className="mt-5 flex items-center gap-5">
        <Ring
          pct={readiness}
          size={120}
          label={readiness !== null ? `Độ nhớ ${readiness}%` : "Chưa có dữ liệu độ nhớ"}
        >
          <div>
            <p className="text-[28px] font-extrabold leading-none">
              {readiness !== null ? (
                <>
                  <CountUp value={Math.round(readiness)} />
                  <span className="text-base">%</span>
                </>
              ) : (
                "—"
              )}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-75">độ nhớ</p>
          </div>
        </Ring>
        <dl className="grid min-w-0 flex-1 gap-2">
          {tiles.map((t) => (
            <div
              key={t.k}
              className="flex items-baseline justify-between gap-2 rounded-[14px] bg-current/10 px-3 py-2"
            >
              <dt className="text-[12px] font-semibold opacity-80">{t.k}</dt>
              <dd className="text-[17px] font-extrabold tabular-nums">
                <CountUp value={t.v} />{" "}
                <span className="text-[11px] font-semibold opacity-75">{t.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <MascotTalk
        className="mt-4"
        tone="stage"
        size="h-24 w-24"
        mood={heroMood(readiness)}
        lines={heroLines(readiness, data)}
      />
    </Stage>
  );
}

function ProgressScreen() {
  const auth = useAuth();
  const query = useQuery({
    queryKey: ["me", "weaknesses"],
    queryFn: getWeaknesses,
    enabled: auth.isAuthenticated,
    staleTime: 30_000,
  });

  if (!auth.isLoading && !auth.isAuthenticated) {
    return (
      <PracticeShell glyph="進" wide>
        <header>
          <p className="text-[13px] font-semibold text-ink-2">Tiến bộ</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">Chỗ nào còn hay sai?</h1>
        </header>
        <AnonymousNudge />
        <CompetencyMap enabled={false} />
      </PracticeShell>
    );
  }

  return (
    <PracticeShell glyph="進" wide>
      <div className="lg:grid lg:grid-cols-[440px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="space-y-4">
          <Rise>
            <ProgressHero data={query.data} />
          </Rise>
          <Rise i={1}>
            <Link
              to="/mistakes"
              onClick={() => tap()}
              className="hit-area card-soft flex items-center gap-3 rounded-[20px] bg-card px-4 py-3.5 text-xs leading-5 transition-transform hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transition-none"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-danger-soft text-danger">
                <BookX size={18} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Sổ lỗi sai</span>
                <span className="block font-medium text-ink-2">
                  Đọc lại các câu luyện tập bạn làm sai, kèm giải thích.
                </span>
              </span>
              <ChevronRight
                size={18}
                strokeWidth={2.4}
                aria-hidden="true"
                className="shrink-0 text-ink-2"
              />
            </Link>
          </Rise>
          {query.data && (
            <Rise i={2}>
              <PracticeActions data={query.data} />
            </Rise>
          )}
        </div>

        <div className="mt-2 lg:mt-0">
          <Rise i={3}>
            <TalkProgress />
            <PresentProgress />
            <CompetencyMap enabled={auth.isAuthenticated} />
          </Rise>

          {(auth.isLoading || query.isLoading) && (
            <LoadingBlocks
              className="mt-6"
              label="Đang tải báo cáo"
              blocks={["h-20", "h-20", "h-20", "h-40"]}
            />
          )}

          {query.isError && (
            <ErrorState
              className="mt-6"
              title="Không tải được báo cáo."
              message={errorMessage(query.error)}
              onRetry={() => void query.refetch()}
              retrying={query.isRefetching}
              error={query.error}
            />
          )}

          {query.data && (
            <Rise i={4}>
              <Report data={query.data} />
            </Rise>
          )}
        </div>
      </div>
    </PracticeShell>
  );
}

/** Trình bày với Haru: the presentation band, focus, trend and studied items used when speaking. */
function PresentProgress() {
  const q = useQuery({
    queryKey: ["present", "insights"],
    queryFn: getPresentInsights,
    staleTime: 30_000,
  });
  if (!q.data || q.data.rounds === 0) return null;
  return (
    <Section
      title="Trình bày"
      hint="Mức trình bày, trọng tâm cần luyện và kiến thức bạn đã dùng thành thạo khi nói."
    >
      <PresentInsightsCard data={q.data} compact />
      <Link
        to="/talk/present"
        onClick={() => tap()}
        className="mt-2 flex items-center justify-end gap-1 text-[13px] font-semibold text-blue-deep"
      >
        Luyện trình bày <ChevronRight size={15} strokeWidth={2.6} />
      </Link>
    </Section>
  );
}

/** Luyện nói với Haru: the trend of the spoken sessions — pronunciation, recurring mistakes, band —
 * with the way into the full history. */
function TalkProgress() {
  const q = useQuery({
    queryKey: ["talk", "insights"],
    queryFn: getTalkInsights,
    staleTime: 30_000,
  });
  if (!q.data) return null;
  if (q.data.sessions === 0) {
    return (
      <Link
        to="/talk"
        onClick={() => tap()}
        className="hit-area card-soft mt-3 flex items-center gap-2.5 rounded-[18px] bg-card px-4 py-3 text-xs leading-5 active:scale-[0.98]"
      >
        <Mic size={16} strokeWidth={2.4} aria-hidden="true" className="shrink-0 text-blue" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Luyện nói với Haru</span>
          <span className="block font-medium text-ink-2">
            Trò chuyện vài phút: Haru chấm phát âm và chỉ ra lỗi hay lặp lại của bạn ở đây.
          </span>
        </span>
        <ChevronRight size={16} strokeWidth={2.6} aria-hidden="true" className="shrink-0" />
      </Link>
    );
  }
  return (
    <Section
      title="Luyện nói với Haru"
      hint="Điểm phát âm qua các buổi và lỗi phát âm hay lặp lại."
    >
      <TalkInsightsCard data={q.data} compact />
      <Link
        to="/talk/history"
        onClick={() => tap()}
        className="mt-2 flex items-center justify-end gap-1 text-[13px] font-semibold text-blue-deep"
      >
        Xem lịch sử trò chuyện <ChevronRight size={15} strokeWidth={2.6} />
      </Link>
    </Section>
  );
}

/** The four chapters of the main lessons, each with its feathers; the one being walked is marked. */
function ChapterRows({ j }: { j: JourneyOut }) {
  return (
    <ol className="mt-4 space-y-2.5" aria-label="Lông của từng chương">
      {(j.chapters ?? []).map((c) => {
        const have = c.earned + c.credited;
        const pct = c.total ? Math.min(100, (have / c.total) * 100) : 0;
        const now = c.n === j.stage;
        return (
          <li key={c.n} className={cn(!now && !c.done && "opacity-75")}>
            <div className="flex justify-between gap-3 text-[12px] font-semibold">
              <span>
                {ROMAN_CH[c.n]} · {c.level}
                {c.done ? " · xong" : now ? " · đang đi" : ""}
              </span>
              <span className="jr-ink-soft tabular-nums">
                {have}/{c.total} lông
              </span>
            </div>
            <div className="jr-hairline mt-1">
              <span style={{ width: `${Math.max(c.done ? 100 : 1.5, pct)}%` }} />
            </div>
            {now && (
              <p className="jr-ink-soft mt-1 text-[12px]">
                {c.n === 3 && j.station ? "Đã thấy bờ xa · " : ""}Đủ lông: {c.becomes.toLowerCase()}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The support lessons' sky: how bright the swan is, and a constellation per topic. A relic
 * earned can be picked to stand beside the swan. */
function SupportSky({ j }: { j: JourneyOut }) {
  const [worn, setWorn] = useState<string | null>(null);
  useEffect(() => setWorn(wornRelic(j.relics)), [j.relics]);
  return (
    // folded under the swan's path: one picture of progress on this screen (the swan's journey);
    // the support topics stay one tap away
    <details className="jr-glass group mt-4 rounded-[22px] px-4 py-3">
      <summary className="jr-eyebrow flex min-h-9 cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
        <span>
          Chủ đề bổ trợ · {(j.constellations ?? []).filter((c) => c.relic_earned).length}/
          {(j.constellations ?? []).length} xong
        </span>
        <span aria-hidden="true" className="transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <SparkleMeter j={j} className="mt-2" />
      <div className="mt-3 grid gap-1.5 lg:grid-cols-2">
        {(j.constellations ?? []).map((c) => (
          <button
            key={c.code}
            type="button"
            disabled={!c.relic_earned}
            onClick={() => {
              tap();
              wearRelic(c.code);
              setWorn(c.code);
            }}
            aria-pressed={c.relic_earned ? worn === c.code : undefined}
            className={cn(
              "rounded-[16px] p-2 text-left transition-colors",
              c.relic_earned && worn === c.code && "bg-white/10",
            )}
          >
            <Constellation c={c} />
          </button>
        ))}
      </div>
    </details>
  );
}
