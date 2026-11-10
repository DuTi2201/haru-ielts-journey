import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleStop,
  Gavel,
  Handshake,
  Lightbulb,
  Loader2,
  Mic,
  MicOff,
  SearchCheck,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { TabBar } from "@/components/haru/TabBar";
import { FeatureAllowance } from "@/components/billing/FeatureAllowance";
import { clock, TalkTabs, talkDate } from "@/components/talk/TalkParts";
import { useTextAudio } from "@/hooks/use-text-audio";
import { errorMessage } from "@/lib/api/client";
import type { ConversationTurn } from "@/lib/api/conversation";
import {
  finishDebate,
  getDebate,
  getDebateOptions,
  listDebates,
  startDebate,
  type DebateDetail,
  type DebateFinishOut,
  type DebateKind,
  type DebateOptions,
  type DebateStartIn,
  type DebateStartOut,
  type Phrase,
} from "@/lib/api/debate";
import { useLiveTalk } from "@/lib/live/use-live-talk";
import { Mascot } from "@/components/mascot/Mascot";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/talk_/debate")({
  head: () => ({ meta: [{ title: "Tranh luận — Haru" }] }),
  component: DebatePage,
});

const KIND_ICON: Record<DebateKind, typeof Gavel> = {
  debate: Gavel,
  negotiate: Handshake,
  critique: SearchCheck,
};
const KIND_HINT: Record<DebateKind, string> = {
  debate: "Bạn chọn một bên, Haru đứng bên kia. Bảo vệ ý mình, bác lại ý Haru.",
  negotiate:
    "Nhập vai: chợ, chủ nhà, giáo sư, nhân sự… Haru có mức chốt riêng, chỉ nhượng bộ khi bạn có lý.",
  critique: "Haru đưa ra một lập luận có lỗ hổng. Tìm ra chỗ sai và phản biện như trong seminar.",
};

function DebatePage() {
  const qc = useQueryClient();
  const body = useRef<DebateStartIn>({ kind: "debate" });
  const live = useLiveTalk<DebateStartOut, DebateFinishOut>({
    start: () => startDebate(body.current),
    finish: finishDebate,
    failed: (session_id, seconds, turns, error) => ({
      session_id,
      seconds,
      learner_turns: turns.filter((t) => t.role === "learner").length,
      report: null,
      report_error_vi: error,
      criteria: {},
    }),
  });
  const [past, setPast] = useState<DebateDetail | null>(null);

  useEffect(() => {
    if (live.status === "done") void qc.invalidateQueries({ queryKey: ["debate"] });
  }, [live.status, qc]);

  if (live.status === "connecting" || live.status === "live") return <LiveDebate live={live} />;

  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <Link
        to="/speaking"
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-deep"
      >
        <ArrowLeft size={16} strokeWidth={2.4} /> Luyện tập
      </Link>
      <TalkTabs active="debate" />
      {live.status !== "done" && !past && <FeatureAllowance feature="debate" className="mt-3" />}

      {live.status === "ending" && (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <Loader2 size={28} className="animate-spin text-blue" />
          <p className="text-[15px] font-semibold">Haru đang xem lại buổi này…</p>
        </div>
      )}

      {live.status === "done" && live.result && live.info ? (
        <ReportView
          title={live.info.scenario.title_vi}
          kind={live.info.scenario.kind}
          result={live.result}
          turns={live.turns}
          onBack={live.reset}
        />
      ) : past ? (
        <ReportView
          title={past.title_vi}
          kind={past.kind}
          result={past}
          turns={past.turns}
          onBack={() => setPast(null)}
        />
      ) : (
        live.status !== "ending" && (
          <Picker
            error={live.error}
            onStart={(b) => {
              body.current = b;
              void live.start(false);
            }}
            onOpen={(id) => void getDebate(id).then(setPast)}
          />
        )
      )}
      <TabBar />
    </main>
  );
}

// ---------------------------------------------------------------- choosing

function Picker({
  error,
  onStart,
  onOpen,
}: {
  error: string | null;
  onStart: (b: DebateStartIn) => void;
  onOpen: (id: string) => void;
}) {
  const opts = useQuery({ queryKey: ["debate", "options"], queryFn: getDebateOptions });
  const rows = useQuery({ queryKey: ["debate", "rows"], queryFn: () => listDebates(20) });
  const [kind, setKind] = useState<DebateKind>("debate");
  const [pick, setPick] = useState<string | null>(null);
  const [side, setSide] = useState<"찬성" | "반대">("찬성");
  const [motion, setMotion] = useState("");
  const [shift, setShift] = useState<-1 | 0 | 1>(0);
  const [showRubric, setShowRubric] = useState(false);

  if (opts.isLoading) return <Loader2 size={22} className="mx-auto mt-10 animate-spin text-blue" />;
  if (!opts.data) {
    return (
      <p className="mt-6 text-[13px] font-semibold text-danger">
        {opts.error ? errorMessage(opts.error) : "Không tải được."}
      </p>
    );
  }
  const o: DebateOptions = opts.data;
  const list = o.scenarios.filter((s) => s.kind === kind);
  const chosen = list.find((s) => s.id === pick) ?? null;
  const custom = kind === "debate" && motion.trim().length > 0;
  const canStart = (custom || chosen !== null) && o.seconds_left_today >= 60;
  const seg = (on: boolean) =>
    cn(
      "flex min-h-9 flex-1 items-center justify-center gap-1 rounded-full text-[12px] font-semibold",
      on ? "bg-card text-ink shadow-elev-1" : "text-ink-2",
    );

  return (
    <section className="mt-5 space-y-5">
      <div className="rounded-[22px] border border-line bg-card p-4 shadow-elev-1">
        <p className="text-[12px] font-semibold text-ink-2">Mức tranh luận của bạn</p>
        <p className="mt-0.5 text-[20px] font-bold leading-7">
          {o.band}/5 · {o.band_label_vi}
        </p>
        <p className="mt-1 text-[12px] font-semibold leading-4 text-ink-2">
          Tình huống, giọng Haru và cách chấm theo mức này; Haru tự chỉnh mức sau 2 buổi. Bạn còn{" "}
          {Math.floor(o.seconds_left_today / 60)} phút nói hôm nay.
        </p>
        <p className="mt-2 rounded-[12px] bg-yellow-soft px-2.5 py-1.5 text-[12px] font-semibold leading-4">
          Hợp từ Sơ cấp 2 trở lên: cần nói được câu có lý do (-아서/어서, -기 때문에). Mới học Nền
          tảng thì bắt đầu với Nói với Haru.
        </p>
      </div>

      <div className="flex gap-1 rounded-full bg-fill p-1" role="radiogroup" aria-label="Dạng bài">
        {(Object.keys(o.kinds) as DebateKind[]).map((k) => {
          const Icon = KIND_ICON[k];
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                setPick(null);
              }}
              className={seg(kind === k)}
            >
              <Icon size={14} strokeWidth={2.4} /> {o.kinds[k]}
            </button>
          );
        })}
      </div>
      <p className="-mt-3 text-[12px] font-semibold leading-4 text-ink-2">{KIND_HINT[kind]}</p>

      <ul className="space-y-2">
        {list.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => {
                setPick(s.id);
                setMotion("");
              }}
              aria-pressed={pick === s.id}
              className={cn(
                "w-full rounded-[16px] border bg-card p-3 text-left",
                pick === s.id ? "border-blue ring-2 ring-blue/30" : "border-line",
              )}
            >
              <p className="text-[14px] font-bold">{s.title_vi}</p>
              {s.opener_en && kind === "debate" && (
                <p className="font-korean mt-0.5 text-[13px] font-semibold text-blue-deep">
                  {s.opener_en}
                </p>
              )}
              {kind !== "debate" && (
                <p className="mt-0.5 text-[12px] font-semibold leading-4 text-ink-2">
                  {s.situation_vi}
                </p>
              )}
              {pick === s.id && kind !== "debate" && (
                <div className="mt-2 space-y-0.5 text-[12px] font-semibold leading-4">
                  <p>
                    Bạn: <span className="text-ink-2">{s.learner_role_vi}</span> · Haru:{" "}
                    <span className="text-ink-2">{s.haru_role_vi}</span>
                  </p>
                  <p>
                    Mục tiêu: <span className="text-ink-2">{s.learner_goal_vi}</span>
                  </p>
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>

      {kind === "debate" && (
        <div className="space-y-2">
          <input
            value={motion}
            maxLength={200}
            onChange={(e) => {
              setMotion(e.target.value);
              if (e.target.value.trim()) setPick(null);
            }}
            aria-label="Chủ đề của bạn"
            placeholder="…hoặc tự nhập chủ đề tranh luận (tiếng Hàn hoặc Việt)"
            className="w-full rounded-[14px] border border-line bg-card px-3.5 py-2.5 text-sm font-medium placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-blue"
          />
          <div
            className="flex gap-1 rounded-full bg-fill p-1"
            role="radiogroup"
            aria-label="Bên của bạn"
          >
            {(["찬성", "반대"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={side === v}
                onClick={() => setSide(v)}
                className={seg(side === v)}
              >
                Bạn {v === "찬성" ? "ủng hộ (찬성)" : "phản đối (반대)"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[13px] font-semibold">Độ khó buổi này</p>
        <div className="flex gap-1 rounded-full bg-fill p-1" role="radiogroup" aria-label="Độ khó">
          {(
            [
              [-1, "Dễ hơn"],
              [0, "Vừa sức"],
              [1, "Khó hơn"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={shift === v}
              onClick={() => setShift(v)}
              className={seg(shift === v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <PhraseCard phrases={o.phrases[kind]} />

      <div>
        <button
          type="button"
          onClick={() => setShowRubric((v) => !v)}
          className="text-[12px] font-semibold text-blue-deep"
        >
          {showRubric ? "Ẩn" : "Xem"} Haru chấm {o.kinds[kind].toLowerCase()} theo tiêu chuẩn nào
        </button>
        {showRubric && (
          <ul className="mt-2 space-y-1.5">
            {Object.entries(o.rubric[kind]).map(([k, v]) => (
              <li key={k} className="text-[12px] font-semibold leading-4">
                <span className="font-bold">{o.criteria[kind][k]}:</span>{" "}
                <span className="text-ink-2">{v}</span>
              </li>
            ))}
            <li className="text-[11px] font-semibold text-ink-2">Đạt đúng mô tả = 4/5.</li>
          </ul>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-[14px] bg-danger-soft px-3.5 py-2.5 text-[13px] font-semibold text-danger"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!canStart}
        onClick={() =>
          onStart(
            custom
              ? { kind, motion: motion.trim(), side, band_shift: shift }
              : { kind, scenario_id: chosen!.id, side, band_shift: shift },
          )
        }
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-50"
      >
        <Mic size={18} strokeWidth={2.4} /> Bắt đầu {o.kinds[kind].toLowerCase()}
      </button>
      <p className="-mt-3 text-center text-[11px] font-semibold text-ink-2">
        Tối đa 8 phút. Haru giữ lập trường — chỉ nhượng khi bạn đưa lý do hoặc bằng chứng cụ thể.
      </p>

      {rows.data && rows.data.length > 0 && (
        <div>
          <h2 className="mb-2 text-[15px] font-semibold">Các buổi đã luyện</h2>
          <ul className="space-y-2">
            {rows.data.map((r) => {
              const Icon = KIND_ICON[r.kind];
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(r.id)}
                    className="flex w-full items-center gap-3 rounded-[16px] border border-line bg-card p-3 text-left active:scale-[0.98]"
                  >
                    <Icon size={18} className="shrink-0 text-blue" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-ink-2">
                        {talkDate(r.started_at)} · {clock(r.seconds)}
                        {r.band ? ` · mức ${r.band}` : ""}
                      </p>
                      <p className="truncate text-[14px] font-semibold">{r.title_vi}</p>
                    </div>
                    {r.overall != null && (
                      <span className="shrink-0 text-[13px] font-bold tabular-nums">
                        {r.overall.toFixed(1)}
                      </span>
                    )}
                    <ChevronRight size={16} className="shrink-0 text-ink-2" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function PhraseCard({ phrases, lit = false }: { phrases: Phrase[]; lit?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[18px] p-3.5 transition-colors",
        lit ? "bg-yellow-soft" : "border border-line bg-card",
      )}
    >
      <p className="flex items-center gap-1.5 text-[12px] font-bold">
        <Lightbulb size={14} strokeWidth={2.4} className={lit ? "text-ink" : "text-blue"} />
        {lit ? "Thử một mẫu câu" : "Mẫu câu nên dùng"}
      </p>
      <ul className="mt-1.5 grid gap-1">
        {phrases.map((p) => (
          <li key={p.ko} className="text-[13px] leading-5">
            <span lang="ko" className="font-semibold">
              {p.ko}
            </span>{" "}
            <span className="text-[12px] text-ink-2">— {p.vi}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- live

type Live = ReturnType<typeof useLiveTalk<DebateStartOut, DebateFinishOut>>;

function LiveDebate({ live }: { live: Live }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [live.turns]);
  const info = live.info;
  const left = info ? info.max_seconds - live.elapsed : 0;
  const sc = info?.scenario;

  return (
    <main className="mx-auto flex h-dvh max-w-[390px] flex-col bg-paper px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))] text-ink">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-ink-2">
            {sc ? `${sc.title_vi}` : "Đang chuẩn bị…"}
          </p>
          <p className="text-[15px] font-semibold">
            {sc?.kind === "negotiate"
              ? "Đàm phán"
              : sc?.kind === "critique"
                ? "Phản biện"
                : "Tranh luận"}
            {info && (
              <span className="ml-1.5 align-middle text-[11px] font-semibold text-blue-deep">
                Mức {info.band}/5
              </span>
            )}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-fill px-2.5 py-1 text-[12px] font-semibold tabular-nums">
          {live.status === "live" ? clock(left) : "—"}
        </span>
      </header>

      {sc && (
        <p className="mt-2 rounded-[14px] bg-blue-soft px-3 py-2 text-[12px] font-semibold leading-4 text-blue-deep">
          {sc.kind === "debate"
            ? `Bạn bên ${info?.side ?? "찬성"}: «${sc.opener_en}»`
            : `Mục tiêu: ${sc.learner_goal_vi}`}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors",
            live.speaker === "haru"
              ? "bg-blue-soft"
              : live.speaker === "learner"
                ? "bg-green-soft"
                : "bg-fill",
          )}
        >
          {live.status === "connecting" ? (
            <Loader2 size={22} className="animate-spin text-blue" />
          ) : (
            <Mascot
              mood={
                live.speaker === "learner"
                  ? "listening"
                  : live.speaker === "haru"
                    ? "cheer"
                    : "wave"
              }
              className="h-12 w-12"
              label={live.speaker === "learner" ? "Haru đang nghe bạn nói" : undefined}
            />
          )}
        </div>
        <p aria-live="polite" className="text-[13px] font-semibold text-ink-2">
          {live.status === "connecting"
            ? "Đang gọi Haru…"
            : live.muted
              ? "Micro đang tắt"
              : live.speaker === "haru"
                ? "Haru đang nói…"
                : live.speaker === "learner"
                  ? "Haru đang nghe bạn…"
                  : live.step >= 1
                    ? "Bí ý? Thử một mẫu câu bên dưới"
                    : "Đến lượt bạn"}
        </p>
      </div>

      <div
        ref={list}
        className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pb-2"
        aria-label="Lời hai bên đã nói"
      >
        {live.turns.map((t, i) => (
          <Bubble key={i} turn={t} />
        ))}
      </div>

      {info && <PhraseCard phrases={info.phrases} lit={live.step >= 1} />}

      <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <button
          type="button"
          onClick={() => live.setMuted(!live.muted)}
          aria-pressed={live.muted}
          aria-label={live.muted ? "Bật micro" : "Tắt micro"}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full border border-line shadow-elev-1",
            live.muted ? "bg-danger-soft text-danger" : "bg-card",
          )}
        >
          {live.muted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button
          type="button"
          onClick={live.hint}
          disabled={live.status !== "live"}
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-line bg-card text-[13px] font-semibold shadow-elev-1 disabled:opacity-50"
        >
          <Lightbulb size={17} /> Gợi ý
        </button>
        <button
          type="button"
          onClick={() => void live.end()}
          className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-danger px-4 text-[13px] font-semibold text-destructive-foreground shadow-elev-1"
        >
          <CircleStop size={18} /> Xong
        </button>
      </div>
    </main>
  );
}

function Bubble({ turn }: { turn: ConversationTurn }) {
  const mine = turn.role === "learner";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <p
        lang="ko"
        className={cn(
          "max-w-[85%] rounded-[18px] px-3.5 py-2 text-[15px] leading-6",
          mine
            ? "rounded-br-[6px] bg-blue text-primary-foreground"
            : "rounded-bl-[6px] border border-line bg-card",
        )}
      >
        {turn.text}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- report

function SayButton({ text }: { text: string }) {
  const audio = useTextAudio();
  const loading = audio.state === "loading" && audio.activeText === text;
  return (
    <button
      type="button"
      aria-label="Nghe"
      onClick={() => void audio.play(text)}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue-deep active:scale-95"
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Volume2 size={14} strokeWidth={2.4} />
      )}
    </button>
  );
}

function ReportView({
  title,
  kind,
  result,
  turns,
  onBack,
}: {
  title: string;
  kind: DebateKind;
  result: DebateFinishOut;
  turns: ConversationTurn[];
  onBack: () => void;
}) {
  const r = result.report;
  const moved =
    result.band_before != null &&
    result.band_after != null &&
    result.band_after !== result.band_before;
  return (
    <section className="mt-5 space-y-4">
      <div>
        <p className="text-[12px] font-semibold text-ink-2">
          {kind === "negotiate" ? "Đàm phán" : kind === "critique" ? "Phản biện" : "Tranh luận"} ·{" "}
          {clock(result.seconds)} · {result.learner_turns} lượt nói
        </p>
        <h1 className="text-[18px] font-bold leading-6">{title}</h1>
      </div>

      {!r && (
        <p className="rounded-[18px] bg-fill p-4 text-[13px] font-semibold text-ink-2">
          {result.report_error_vi ?? "Chưa có nhận xét."}
        </p>
      )}

      {r && (
        <>
          {moved && (
            <p className="rounded-[18px] bg-blue-soft p-3.5 text-[13px] font-semibold leading-5 text-blue-deep">
              {result.band_after! > result.band_before!
                ? `Hai buổi liền bạn vượt mục tiêu — mức tranh luận lên ${result.band_after}/5: tình huống khó hơn, Haru phản bác sắc hơn.`
                : `Haru hạ mức tranh luận xuống ${result.band_after}/5 để bạn luyện chắc từng bước.`}
            </p>
          )}

          <div className="rounded-[22px] border border-line bg-card p-4 shadow-elev-1">
            <div className="flex items-end justify-between gap-2">
              <p className="text-[34px] font-bold leading-10 tabular-nums">
                {r.overall.toFixed(1)}
                <span className="text-[16px] text-ink-2">/5</span>
              </p>
              {kind === "negotiate" && (
                <Badge ok={r.goal_reached} yes="Đạt mục tiêu" no="Chưa đạt mục tiêu" />
              )}
              {kind === "critique" && (
                <Badge ok={r.flaw_found} yes="Tìm ra lỗ hổng" no="Chưa ra lỗ hổng chính" />
              )}
            </div>
            {r.outcome_vi && (
              <p className="mt-1 text-[13px] font-semibold leading-5">{r.outcome_vi}</p>
            )}
            {kind === "critique" && r.flaw_vi && (
              <p className="mt-2 rounded-[12px] bg-yellow-soft px-3 py-2 text-[12px] font-bold">
                Lỗ hổng được cài sẵn: {r.flaw_vi}
              </p>
            )}
            <ul className="mt-3 space-y-2.5">
              {Object.entries(result.criteria).map(([k, label]) => (
                <li key={k}>
                  <div className="flex items-center justify-between text-[13px] font-semibold">
                    <span>{label}</span>
                    <span className="tabular-nums">{r.scores[k]}/5</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        (r.scores[k] ?? 0) >= 4
                          ? "bg-green"
                          : (r.scores[k] ?? 0) >= 3
                            ? "bg-yellow"
                            : "bg-danger",
                      )}
                      style={{ width: `${(r.scores[k] ?? 0) * 20}%` }}
                    />
                  </div>
                  {r.score_notes_vi[k] && (
                    <p className="mt-1 text-[12px] font-semibold leading-4 text-ink-2">
                      {r.score_notes_vi[k]}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {r.best_move.said_en && (
            <div className="rounded-[18px] bg-green-soft p-3.5">
              <p className="text-[12px] font-bold">👍 Câu hay nhất của bạn</p>
              <p className="font-korean mt-1 text-[14px] font-semibold">“{r.best_move.said_en}”</p>
              {r.best_move.why_vi && (
                <p className="mt-0.5 text-[12px] font-semibold text-ink-2">{r.best_move.why_vi}</p>
              )}
            </div>
          )}

          {r.missed.length > 0 && (
            <div>
              <h2 className="mb-2 text-[15px] font-semibold">Lúc có thể đáp hay hơn</h2>
              <ol className="space-y-2">
                {r.missed.map((m, i) => (
                  <li key={i} className="space-y-1.5 rounded-[16px] border border-line bg-card p-3">
                    <p className="text-[12px] font-semibold text-ink-2">
                      Haru: <span className="font-korean text-ink">{m.haru_said_en}</span>
                    </p>
                    <p className="text-[12px] font-semibold text-ink-2">
                      Bạn:{" "}
                      <span className="font-korean text-ink">{m.you_said_en || "(im lặng)"}</span>
                    </p>
                    <div className="flex items-start gap-2 rounded-[12px] bg-blue-soft p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-korean text-[14px] font-semibold text-blue-deep">
                          {m.better_en}
                        </p>
                        {m.better_vi && (
                          <p className="text-[12px] font-semibold text-ink-2">{m.better_vi}</p>
                        )}
                      </div>
                      <SayButton text={m.better_en} />
                    </div>
                    {m.why_vi && (
                      <p className="text-[12px] font-semibold leading-4">→ {m.why_vi}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {r.phrases_used.length > 0 && (
            <p className="text-[12px] font-semibold text-ink-2">
              Mẫu câu bạn đã dùng:{" "}
              <span className="font-korean text-ink">{r.phrases_used.join(", ")}</span>
            </p>
          )}

          {r.fixes.length > 0 && (
            <div>
              <h2 className="mb-2 text-[15px] font-semibold">Sửa câu</h2>
              <ul className="space-y-2">
                {r.fixes.map((f) => (
                  <li
                    key={f.said + f.better}
                    className="rounded-[16px] border border-line bg-card p-3 text-[13px] font-semibold"
                  >
                    <p className="font-korean text-ink-2 line-through decoration-danger/60">
                      {f.said}
                    </p>
                    <p className="font-korean">{f.better}</p>
                    {f.why_vi && <p className="text-[12px] text-ink-2">{f.why_vi}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.next_time_vi && (
            <p className="flex gap-2 rounded-[18px] border border-line bg-card p-3.5 text-[13px] font-semibold leading-5">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-blue" /> {r.next_time_vi}
            </p>
          )}
        </>
      )}

      {turns.length > 0 && (
        <details className="rounded-[16px] border border-line bg-card p-3">
          <summary className="cursor-pointer text-[13px] font-bold">Lời hai bên đã nói</summary>
          <div className="mt-2 space-y-2">
            {turns.map((t, i) => (
              <Bubble key={i} turn={t} />
            ))}
          </div>
        </details>
      )}

      <button
        type="button"
        onClick={onBack}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
      >
        Luyện tình huống khác
      </button>
    </section>
  );
}

function Badge({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
        ok ? "bg-green-soft text-green" : "bg-yellow-soft",
      )}
    >
      {ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />} {ok ? yes : no}
    </span>
  );
}
