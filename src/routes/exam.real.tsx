import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ChevronDown, FileText, Loader2, LogIn, Play, RotateCcw } from "lucide-react";

import { Meter, SectionTitle, TIER_NAME, TierChip, tierHint } from "@/components/exam/bits";
import { useStartSet } from "@/components/exam/use-start-set";
import { Mascot } from "@/components/mascot/Mascot";
import { PracticeShell } from "@/components/haru/PracticeShell";
import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { Rich } from "@/components/lesson/Rich";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { getRealExam } from "@/lib/api/real-exam";
import type { RxFamilyOut, RxOverviewOut, RxSec, RxTypeStatOut } from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exam/real")({
  head: () => ({
    meta: [
      { title: "Luyện đề thi thật — Haru" },
      {
        name: "description",
        content: "Luyện TOPIK II theo dạng và theo trình độ hiện tại, hiểu từng câu trên Haru.",
      },
      { property: "og:title", content: "Luyện đề thi thật — Haru" },
      {
        property: "og:description",
        content: "Luyện TOPIK II theo dạng và theo trình độ hiện tại, hiểu từng câu trên Haru.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RealExamHub,
});

const SEC_NAME: Record<RxSec, string> = { L: "Nghe", R: "Đọc", W: "Viết" };

function StageCard({ stage }: { stage: RxOverviewOut["stage"] }) {
  return (
    <section className="rounded-[20px] border border-transparent bg-blue-soft p-4 shadow-elev-1">
      <SectionTitle>Trình độ hiện tại</SectionTitle>
      <p className="mt-1 text-lg font-semibold leading-6">{stage.label_vi}</p>
      <div className="mt-2">
        <Meter
          value={stage.known_grammar}
          total={stage.total_grammar}
          label="Mẫu ngữ pháp đã gặp trong bài học"
          tone="blue"
        />
      </div>
      <p className="mt-1.5 text-xs font-semibold leading-5">
        Bạn đã gặp {stage.known_grammar}/{stage.total_grammar} mẫu ngữ pháp trong các bài học. Haru
        chỉ đưa câu hợp với mức này, từ bậc dễ trước.
      </p>
      {stage.goal && (
        <p className="mt-1 text-[12px] font-semibold text-ink-2">Mục tiêu: {stage.goal}</p>
      )}
    </section>
  );
}

function PlanCard({ data }: { data: RxOverviewOut }) {
  const start = useStartSet();
  const { today, resume } = data;
  return (
    <div className="space-y-3">
      {resume && (
        <section className="rounded-[20px] border border-transparent bg-yellow-soft p-4 shadow-elev-1">
          <SectionTitle>Đang làm dở</SectionTitle>
          <p className="mt-1 text-sm font-semibold leading-6">{resume.title_vi}</p>
          <p className="text-xs font-semibold text-ink-2">
            Đã trả lời {resume.done}/{resume.total} câu.
          </p>
          <Link
            to="/exam/real/$setId"
            params={{ setId: resume.set_id }}
            onClick={() => tap()}
            className="hit-area mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-card px-5 text-sm font-semibold shadow-elev-1 active:scale-[0.97] "
          >
            <Play size={15} strokeWidth={2.6} aria-hidden="true" />
            Làm tiếp
          </Link>
        </section>
      )}
      {today ? (
        <section className="rounded-[20px] border border-line bg-card p-4 shadow-elev-1">
          <SectionTitle>Gợi ý cho bạn hôm nay</SectionTitle>
          <p className="mt-1 text-base font-semibold leading-6">
            {today.title_vi.replace(/^Gợi ý hôm nay:\s*/, "")}
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-ink-2">
            <Rich text={today.why_vi} />
          </p>
          <button
            type="button"
            disabled={start.isPending}
            onClick={() => {
              tap();
              start.mutate({});
            }}
            className="hit-area mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-transparent bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
          >
            {start.isPending ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Play size={15} strokeWidth={2.6} aria-hidden="true" />
            )}
            Bắt đầu — {today.size} câu
          </button>
          <p className="mt-1.5 text-[12px] font-semibold leading-4 text-ink-2">
            Không đồng hồ. Mỗi câu xong, bạn thấy mình hiểu thêm điều gì.
          </p>
        </section>
      ) : (
        !resume && (
          <section className="rounded-[20px] border border-transparent bg-green-soft p-4 text-center shadow-elev-1">
            <p className="text-sm font-semibold">Hôm nay không còn câu nào đến hạn.</p>
            <p className="mt-1 text-xs font-semibold leading-5">
              Câu làm tốt nghỉ vài ngày để nhớ lâu. Bạn vẫn có thể chọn một dạng bên dưới.
            </p>
          </section>
        )
      )}
    </div>
  );
}

function TierLegend() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-[16px] border border-line bg-card shadow-elev-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          tap();
          setOpen((v) => !v);
        }}
        className="hit-area flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="min-w-0 flex-1 text-sm font-semibold">
          “Ăn chắc mặc bền” là gì?
          <span className="block text-[12px] font-semibold text-ink-2">
            Ba bậc câu hỏi và khi nào tính là vững
          </span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2.6}
          aria-hidden="true"
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-dashed border-line px-3 pb-3 pt-2.5">
          {[1, 2, 3].map((t) => (
            <p
              key={t}
              className="flex flex-wrap items-center gap-2 text-xs font-semibold leading-5"
            >
              <TierChip tier={t} />
              <span className="min-w-0 flex-1">{tierHint(t)}</span>
            </p>
          ))}
          <p className="text-xs font-semibold leading-5">
            Một câu là <strong className="font-semibold">vững</strong> khi lần làm gần nhất đúng mà
            không mở gợi ý. Một bậc được coi là vững khi 80% câu của nó vững — lúc đó Haru mới đưa
            bạn lên bậc kế. Câu sai quay lại sau vài giờ, câu đúng nhờ gợi ý sau vài ngày, câu vững
            sau một tuần, để điểm dễ không bị rơi mất.
          </p>
        </div>
      )}
    </section>
  );
}

function TierDots({ stat }: { stat: RxTypeStatOut }) {
  return (
    <div className="flex flex-wrap gap-1">
      {stat.tiers.map((t) => (
        <span
          key={t.tier}
          title={TIER_NAME[t.tier]}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold",
            t.is_solid ? "bg-green-soft" : "bg-card",
          )}
        >
          Bậc {t.tier}: {t.solid}/{t.total}
        </span>
      ))}
    </div>
  );
}

function TypeRow({ stat }: { stat: RxTypeStatOut }) {
  const start = useStartSet();
  return (
    <li className="rounded-[14px] border border-line bg-paper px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Link
          to="/exam/real/type/$code"
          params={{ code: stat.code }}
          onClick={() => tap()}
          className="min-w-0 flex-1"
        >
          <span className="block text-sm font-semibold leading-5">{stat.name_vi}</span>
          <span className="mt-0.5 block text-[12px] font-semibold text-ink-2">
            {stat.tried === 0
              ? `${stat.total} câu · chưa làm`
              : `${stat.solid}/${stat.total} câu vững`}
          </span>
        </Link>
        <button
          type="button"
          disabled={start.isPending || stat.open === 0}
          onClick={() => {
            tap();
            start.mutate({ type: stat.code });
          }}
          className="hit-area flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-transparent bg-blue px-3.5 text-xs font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-40"
        >
          {start.isPending ? (
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          ) : (
            <Play size={13} strokeWidth={2.6} aria-hidden="true" />
          )}
          Luyện
        </button>
      </div>
      <div className="mt-1.5">
        <TierDots stat={stat} />
      </div>
      <p className="mt-1.5 text-[12px] font-semibold leading-4 text-ink-2">{stat.next_vi}</p>
      <Link
        to="/exam/real/type/$code"
        params={{ code: stat.code }}
        onClick={() => tap()}
        className="mt-1 inline-block text-[12px] font-semibold text-blue-deep"
      >
        Xem cách làm dạng này →
      </Link>
    </li>
  );
}

function FamilyCard({ family, defaultOpen }: { family: RxFamilyOut; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-[20px] border border-line bg-card shadow-elev-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          tap();
          setOpen((v) => !v);
        }}
        className="hit-area w-full px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-sm font-semibold leading-5">{family.name_vi}</span>
          <span className="shrink-0 text-[12px] font-semibold text-ink-2">
            {family.solid}/{family.total}
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2.6}
            aria-hidden="true"
            className={cn("shrink-0 transition-transform", open && "rotate-180")}
          />
        </span>
        <span className="mt-1.5 block">
          <Meter
            value={family.solid}
            total={family.total}
            label={`${family.name_vi}: số câu vững`}
          />
        </span>
        <span className="mt-1.5 block text-[12px] font-semibold leading-4 text-ink-2">
          {family.blurb_vi}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-dashed border-line px-3 pb-3 pt-2.5">
          <p className="text-[12px] font-semibold leading-4">
            Bạn nhận được: <Rich text={family.gain_vi} />
          </p>
          <ul className="space-y-2">
            {family.types.map((t) => (
              <TypeRow key={t.code} stat={t} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Papers({ data }: { data: RxOverviewOut }) {
  return (
    <section>
      <SectionTitle>Đề thi thật</SectionTitle>
      <ul className="mt-2 space-y-2">
        {data.exams.map((e) => (
          <li key={e.id}>
            <Link
              to="/exam/real/paper/$exam"
              params={{ exam: e.id }}
              onClick={() => tap()}
              className="flex items-start gap-3 rounded-[16px] border border-line bg-card px-3.5 py-3 shadow-elev-1 active:scale-[0.97]"
            >
              <FileText
                size={18}
                strokeWidth={2.4}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{e.title}</span>
                <span className="mt-0.5 block text-[12px] font-semibold text-ink-2">
                  {e.sections.map((s) => `${SEC_NAME[s.sec]} ${s.solid}/${s.total}`).join(" · ")}
                </span>
                {e.note_vi && (
                  <span className="mt-0.5 block text-[12px] font-semibold leading-4 text-ink-2">
                    {e.note_vi}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Recent({ data }: { data: RxOverviewOut }) {
  if (data.recent.length === 0) return null;
  return (
    <section>
      <SectionTitle>Các lượt gần đây</SectionTitle>
      <ul className="mt-2 space-y-2">
        {data.recent.map((r) => (
          <li key={r.set_id}>
            <Link
              to="/exam/real/$setId"
              params={{ setId: r.set_id }}
              onClick={() => tap()}
              className="flex items-center gap-3 rounded-[14px] border border-line bg-card px-3.5 py-2.5 active:scale-[0.99]"
            >
              <RotateCcw size={15} strokeWidth={2.4} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold leading-5">{r.title_vi}</span>
                <span className="block text-[12px] font-semibold text-ink-2">
                  {r.solid} vững · {r.aided} nhờ gợi ý · {r.wrong} chưa đúng / {r.total} câu
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RealExamHub() {
  const auth = useAuth();
  const query = useQuery({
    queryKey: ["me", "real-exam"],
    queryFn: getRealExam,
    enabled: auth.isAuthenticated,
    staleTime: 0,
  });
  const data = query.data;
  const sections: RxSec[] = ["L", "R", "W"];

  return (
    <PracticeShell glyph="問">
      <header>
        <Link
          to="/progress"
          onClick={() => tap()}
          className="hit-area -ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-semibold text-blue-deep active:scale-95"
        >
          <ArrowLeft size={15} strokeWidth={2.6} /> Tiến bộ
        </Link>
        <h1 className="mt-1 text-2xl font-bold leading-tight">Luyện đề thi thật</h1>
        <p className="mt-1 text-[13px] font-semibold leading-5 text-ink-2">
          Từng câu của đề TOPIK II, làm theo dạng và theo mức bạn đang học. Không chạy đua với đồng
          hồ: mỗi câu để lại cho bạn một điều hiểu được.
        </p>
      </header>

      {!auth.isLoading && !auth.isAuthenticated && (
        <section className="mt-8 rounded-[20px] border border-line bg-card p-6 text-center shadow-elev-2">
          <Mascot mood="wave" className="mx-auto h-16 w-16" />
          <h2 className="mt-3 text-lg font-semibold leading-snug">Đăng nhập để luyện đề</h2>
          <p className="mt-1.5 text-xs font-semibold leading-5 text-ink-2">
            Haru cần biết bạn đã học đến đâu để chọn câu hợp, và nhớ câu nào bạn đã vững.
          </p>
          <Link
            to="/support-language"
            className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-transparent bg-blue py-2.5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
          >
            <LogIn size={16} strokeWidth={2.4} /> Đăng nhập / Tạo tài khoản
          </Link>
        </section>
      )}

      {(auth.isLoading || (auth.isAuthenticated && query.isLoading)) && (
        <LoadingBlocks
          className="mt-6"
          label="Đang tải"
          blocks={["h-28", "h-32", "h-14", "h-14", "h-14"]}
        />
      )}

      {query.isError && (
        <ErrorState
          className="mt-6"
          title="Không tải được trang này."
          error={query.error}
          message={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      )}

      {data && (
        <div className="mt-5 space-y-5">
          <StageCard stage={data.stage} />
          <PlanCard data={data} />
          <TierLegend />
          {sections.map((sec) => {
            const fams = data.families
              .filter((f) => f.sec === sec)
              .sort((a, b) => a.order - b.order);
            if (fams.length === 0) return null;
            return (
              <section key={sec} className="space-y-2.5">
                <SectionTitle>
                  {sec === "L" ? "Nghe" : sec === "R" ? "Đọc" : "Viết"} — chọn cụm, rồi dạng
                </SectionTitle>
                {fams.map((f, i) => (
                  <FamilyCard key={f.code} family={f} defaultOpen={sec === "L" && i === 0} />
                ))}
              </section>
            );
          })}
          <Papers data={data} />
          <Recent data={data} />
        </div>
      )}
    </PracticeShell>
  );
}
