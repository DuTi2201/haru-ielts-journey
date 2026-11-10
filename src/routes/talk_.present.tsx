import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Feather,
  Lightbulb,
  Loader2,
  MessageCircleQuestion,
  Mic,
  Presentation,
  RefreshCw,
  Sparkles,
  Square,
  Target,
  Trophy,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { TabBar } from "@/components/haru/TabBar";
import { FeatureAllowance } from "@/components/billing/FeatureAllowance";
import { PresentInsightsCard } from "@/components/talk/PresentInsightsCard";
import { clock, TalkTabs, talkDate } from "@/components/talk/TalkParts";
import { useTextAudio } from "@/hooks/use-text-audio";
import { errorMessage } from "@/lib/api/client";
import {
  getPresentation,
  getPresentIdeas,
  getPresentInsights,
  listPresentations,
  makePresentOutline,
  sendPresentAnswer,
  sendPresentAttempt,
  startPresentation,
  type AnswerCriterion,
  type PresentAttempt,
  type PresentCriterion,
  type PresentIdea,
  type PresentMode,
  type PresentSession,
  type PresentStart,
} from "@/lib/api/presentation";
import { bytesToBase64, pcmToWav, startMic, type MicCapture } from "@/lib/live/audio";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/talk_/present")({
  head: () => ({ meta: [{ title: "Trình bày — Haru" }] }),
  // ?lesson=: a round about that lesson. ?session=: open this round (one made elsewhere, e.g.
  // "Trình bày 2 phút" / "Phản biện" at the end of a news article).
  validateSearch: (
    search: Record<string, unknown>,
  ): { lesson?: number | undefined; session?: string | undefined } => {
    const n = Number(search["lesson"]);
    const session = typeof search["session"] === "string" ? search["session"] : "";
    return {
      ...(Number.isInteger(n) && n > 0 ? { lesson: n } : {}),
      ...(/^[0-9a-f-]{36}$/i.test(session) ? { session } : {}),
    };
  },
  component: PresentPage,
});

const KEEP = "haru.present.session";
const GENTLE = "haru.present.gentle";
const CRITERIA_ORDER: PresentCriterion[] = [
  "coherence",
  "development",
  "connectives",
  "language",
  "fluency",
];
const ANSWER_ORDER: AnswerCriterion[] = ["directness", "support", "language"];

type View = "intro" | "prep" | "rec" | "marking" | "result" | "answer";

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // private mode: only a convenience
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** "Chế độ nhẹ nhàng": no numbers, words instead — for learners who freeze when they are graded. */
function useGentle(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(read(GENTLE) === "1"), []);
  return [
    on,
    (v) => {
      setOn(v);
      store(GENTLE, v ? "1" : null);
    },
  ];
}

function scoreWord(v: number) {
  if (v >= 5) return "Vượt mục tiêu";
  if (v >= 4) return "Đạt mục tiêu";
  if (v >= 3) return "Gần đạt";
  return "Cần luyện thêm";
}

function PresentPage() {
  const qc = useQueryClient();
  const [session, setSession] = useState<PresentSession | null>(null);
  const [view, setView] = useState<View>("intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerFor, setAnswerFor] = useState<{ attempt: number; q: number } | null>(null);
  const [gentle, setGentle] = useGentle();
  const lastStart = useRef<PresentStart>({});

  const open = useCallback((s: PresentSession) => {
    setSession(s);
    store(KEEP, s.id);
    setView(s.attempts.length ? "result" : "prep");
  }, []);

  const { lesson: chosenLesson, session: givenSession } = Route.useSearch();

  // a round made elsewhere (?session=), else the round in progress after a reload
  useEffect(() => {
    const id = givenSession ?? read(KEEP);
    if (!id) return;
    getPresentation(id)
      .then(open)
      .catch(() => store(KEEP, null));
  }, [open, givenSession]);

  const begin = async (start: PresentStart) => {
    // a round from the lesson screen asks about that lesson (a "topic" round only)
    const body =
      chosenLesson && (start.mode ?? "topic") === "topic"
        ? { ...start, lesson_id: chosenLesson }
        : start;
    lastStart.current = body;
    setBusy(true);
    setError(null);
    try {
      open(await startPresentation(body));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["present"] });
  };

  const submit = async (wav: Uint8Array<ArrayBuffer>) => {
    if (!session) return;
    setView("marking");
    setError(null);
    try {
      setSession(await sendPresentAttempt(session.id, bytesToBase64(wav.buffer)));
      setView("result");
      refresh();
    } catch (e) {
      setError(errorMessage(e));
      setView(session.attempts.length ? "result" : "prep");
    }
  };

  const submitAnswer = async (wav: Uint8Array<ArrayBuffer>) => {
    if (!session || !answerFor) return;
    setView("marking");
    setError(null);
    try {
      setSession(
        await sendPresentAnswer(
          session.id,
          answerFor.attempt,
          answerFor.q,
          bytesToBase64(wav.buffer),
        ),
      );
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
    setView("result");
  };

  const toIntro = () => {
    store(KEEP, null);
    setSession(null);
    setView("intro");
  };

  const question =
    session && answerFor
      ? session.attempts[answerFor.attempt]?.eval.follow_ups[answerFor.q]
      : undefined;

  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <Link
        to="/speaking"
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-deep"
      >
        <ArrowLeft size={16} strokeWidth={2.4} /> Luyện tập
      </Link>
      {view !== "rec" && view !== "answer" && <TalkTabs active="present" />}
      {(view === "intro" || view === "prep") && (
        <FeatureAllowance feature="present" className="mt-3" />
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-[14px] bg-danger-soft px-3.5 py-2.5 text-[13px] font-semibold text-danger"
        >
          {error}
        </p>
      )}

      {view === "intro" && (
        <Intro
          busy={busy}
          gentle={gentle}
          onGentle={setGentle}
          onStart={(b) => void begin(b)}
          onOpen={(id) => void getPresentation(id).then(open)}
        />
      )}
      {view === "prep" && session && (
        <Prep
          session={session}
          busy={busy}
          onSession={setSession}
          onNewTopic={() =>
            void begin({ ...lastStart.current, mode: session.mode, band_shift: shiftOf(session) })
          }
          onBack={toIntro}
          onSpeak={() => setView("rec")}
        />
      )}
      {view === "rec" && session && (
        <Recorder
          kicker={`Lần ${session.attempts.length + 1} · nói liền một mạch, Haru không ngắt lời`}
          title={session.topic.question_ko}
          target={session.frame.target_seconds}
          maxSeconds={session.frame.max_seconds}
          minSeconds={5}
          cues={<Cues session={session} />}
          onCancel={() => setView(session.attempts.length ? "result" : "prep")}
          onDone={(wav) => void submit(wav)}
        />
      )}
      {view === "answer" && session && question && (
        <Recorder
          kicker="Hỏi vặn · trả lời thẳng câu hỏi trước, rồi nói vì sao"
          title={question.q_ko}
          subtitle={question.q_vi}
          maxSeconds={75}
          minSeconds={2}
          cues={<AnswerCues band={session.band} />}
          onCancel={() => setView("result")}
          onDone={(wav) => void submitAnswer(wav)}
        />
      )}
      {view === "marking" && (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <Loader2 size={28} className="animate-spin text-blue" />
          <p className="text-[15px] font-semibold">Haru đang nghe lại bài nói…</p>
          <p className="text-[13px] font-semibold text-ink-2">
            Chấm theo mức của bạn và viết bản nâng cấp, khoảng 10–20 giây.
          </p>
        </div>
      )}
      {view === "result" && session && session.attempts.length > 0 && (
        <Result
          session={session}
          busy={busy}
          gentle={gentle}
          onAgain={() => setView("rec")}
          onPrep={() => setView("prep")}
          onNewTopic={() =>
            void begin({ ...lastStart.current, mode: session.mode, band_shift: shiftOf(session) })
          }
          onIntro={toIntro}
          onAnswer={(attempt, q) => {
            setAnswerFor({ attempt, q });
            setView("answer");
          }}
        />
      )}
      <TabBar />
    </main>
  );
}

function shiftOf(s: PresentSession): -1 | 0 | 1 {
  return s.shift < 0 ? -1 : s.shift > 0 ? 1 : 0;
}

// ---------------------------------------------------------------- intro

function Intro({
  busy,
  gentle,
  onGentle,
  onStart,
  onOpen,
}: {
  busy: boolean;
  gentle: boolean;
  onGentle: (v: boolean) => void;
  onStart: (b: PresentStart) => void;
  onOpen: (id: string) => void;
}) {
  const insights = useQuery({
    queryKey: ["present", "insights"],
    queryFn: getPresentInsights,
    staleTime: 30_000,
  });
  const rows = useQuery({
    queryKey: ["present", "rows"],
    queryFn: () => listPresentations(20),
    staleTime: 30_000,
  });
  const [mode, setMode] = useState<PresentMode>("topic");
  const [shift, setShift] = useState<-1 | 0 | 1>(0);
  const [title, setTitle] = useState("");
  const [material, setMaterial] = useState("");
  const band = insights.data?.present_band;

  const seg = (on: boolean) =>
    cn(
      "flex min-h-9 flex-1 items-center justify-center rounded-full text-[12px] font-semibold",
      on ? "bg-card text-ink shadow-elev-1" : "text-ink-2",
    );

  return (
    <section className="mt-5 space-y-5">
      {insights.data && insights.data.rounds > 0 ? (
        <PresentInsightsCard data={insights.data} gentle={gentle} />
      ) : (
        <div className="rounded-[22px] border border-line bg-card p-5 shadow-elev-1">
          <Presentation size={26} strokeWidth={2.2} className="text-blue" />
          <h1 className="mt-2 text-[22px] font-bold leading-7">Trình bày có cấu trúc</h1>
          <p className="mt-2 text-[13px] font-semibold leading-5 text-ink-2">
            Không chỉ trả lời cho xong câu: nói liền một mạch, có ý chính, lý do, ví dụ và kết luận
            — như IELTS Speaking, TOPIK 말하기 hay thuyết trình trên lớp. Haru chấm theo đúng mức
            của bạn, không áp một khung khó cho người mới bắt đầu.
          </p>
        </div>
      )}

      <div>
        <div
          className="flex gap-1 rounded-full bg-fill p-1"
          role="radiogroup"
          aria-label="Loại bài"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "topic"}
            onClick={() => setMode("topic")}
            className={seg(mode === "topic")}
          >
            Đề theo bài học
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "defense"}
            onClick={() => setMode("defense")}
            className={seg(mode === "defense")}
          >
            Thuyết trình của tôi
          </button>
        </div>

        {mode === "defense" && (
          <div className="mt-3 space-y-2">
            <p className="text-[12px] font-semibold leading-4 text-ink-2">
              Bài thuyết trình trên lớp, đề tài nghiên cứu, báo cáo… Haru đổi thành dàn ý tiếng Hàn,
              chấm như giáo sư và hỏi lại như hội đồng.
            </p>
            <input
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tên đề tài (tiếng Việt hoặc Hàn)"
              aria-label="Tên đề tài"
              className="w-full rounded-[14px] border border-line bg-card px-3.5 py-2.5 text-sm font-medium placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-blue"
            />
            <textarea
              value={material}
              maxLength={6000}
              onChange={(e) => setMaterial(e.target.value)}
              rows={5}
              aria-label="Nội dung"
              placeholder="Dán dàn ý / nội dung slide / tóm tắt: mục tiêu, phương pháp, kết quả…"
              className="w-full rounded-[14px] border border-line bg-card px-3.5 py-2.5 text-sm font-medium placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-blue"
            />
          </div>
        )}

        <p className="mb-1.5 mt-4 text-[13px] font-semibold">
          Độ khó lượt này{band ? ` · mức của bạn ${band}/5` : ""}
        </p>
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
        <p className="mt-1.5 text-[11px] font-semibold leading-4 text-ink-2">
          Mức của bạn tự lên/xuống theo các lượt “Vừa sức”. Lượt dễ hơn/khó hơn không tính.
        </p>

        <label className="mt-4 flex items-start gap-3 rounded-[16px] border border-line bg-card p-3">
          <input
            type="checkbox"
            checked={gentle}
            onChange={(e) => onGentle(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-blue)]"
          />
          <span>
            <span className="flex items-center gap-1.5 text-[13px] font-bold">
              <Feather size={14} strokeWidth={2.4} className="text-blue" /> Chế độ nhẹ nhàng
            </span>
            <span className="mt-0.5 block text-[12px] font-semibold leading-4 text-ink-2">
              Ẩn điểm số, có 3 giây hít thở trước khi nói. Hợp khi bạn hay run hoặc ngại nói.
            </span>
          </span>
        </label>

        <button
          type="button"
          disabled={busy || (mode === "defense" && !title.trim())}
          onClick={() =>
            onStart(
              mode === "defense"
                ? { mode, band_shift: shift, title: title.trim(), material: material.trim() }
                : { mode, band_shift: shift },
            )
          }
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} strokeWidth={2.4} />
          )}
          {mode === "defense" ? "Chuẩn bị thuyết trình" : "Nhận đề"}
        </button>
      </div>

      {rows.data && rows.data.length > 0 && (
        <div>
          <h2 className="mb-2 text-[15px] font-semibold">Các lượt đã nói</h2>
          <ul className="space-y-2">
            {rows.data.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className="flex w-full items-center gap-3 rounded-[16px] border border-line bg-card p-3 text-left active:scale-[0.98]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-ink-2">
                      {talkDate(r.created_at)} · mức {r.band}
                      {r.mode === "defense" ? " · thuyết trình" : ""} · {r.tries} lần
                      {r.answers ? ` · ${r.answers} câu hỏi vặn` : ""}
                    </p>
                    <p className="font-korean mt-0.5 truncate text-[14px] font-semibold">
                      {r.title_ko}
                    </p>
                  </div>
                  {!gentle && r.first_overall != null && r.best_overall != null && (
                    <span className="shrink-0 text-[12px] font-bold tabular-nums">
                      {r.first_overall.toFixed(1)}
                      {r.best_overall > r.first_overall && (
                        <span className="text-green"> → {r.best_overall.toFixed(1)}</span>
                      )}
                    </span>
                  )}
                  <ChevronRight size={16} className="shrink-0 text-ink-2" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- prep

function SayButton({ text, label }: { text: string; label: string }) {
  const audio = useTextAudio();
  const loading = audio.state === "loading" && audio.activeText === text;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => void audio.play(text)}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue-deep active:scale-95"
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Volume2 size={16} strokeWidth={2.4} />
      )}
    </button>
  );
}

function TopicCard({ session }: { session: PresentSession }) {
  const t = session.topic;
  const defense = session.mode === "defense";
  return (
    <div className="rounded-[22px] border border-line bg-card p-4 shadow-elev-1">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-ink-2">
            {defense ? "Thuyết trình · " : ""}Mức {session.band}/5 · {session.band_label_vi}
            {session.shift < 0 ? " (dễ hơn)" : session.shift > 0 ? " (khó hơn)" : ""}
            {session.lesson && (
              <>
                {" · "}
                <Link
                  to="/lesson/$id"
                  params={{ id: String(session.lesson.id) }}
                  className="underline decoration-dotted underline-offset-2"
                >
                  {session.lesson.title}
                </Link>
              </>
            )}
          </p>
          <p className="font-korean mt-1.5 text-[18px] font-bold leading-6">{t.question_ko}</p>
          {t.question_vi && (
            <p className="mt-1 text-[13px] font-semibold text-ink-2">{t.question_vi}</p>
          )}
        </div>
        <SayButton text={t.question_ko} label="Nghe đề" />
      </div>
      {t.angle_vi && (
        <p className="mt-3 rounded-[12px] bg-fill px-3 py-2 text-[12px] font-semibold leading-4 text-ink-2">
          💡 {t.angle_vi}
        </p>
      )}
      {t.words.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.words.map((w) => (
            <span key={w.ko} className="rounded-full bg-fill px-2.5 py-1 text-[12px] font-semibold">
              <span className="font-korean">{w.ko}</span>
              <span className="text-ink-2"> · {w.vi}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** What this round asks of this learner: the focus and the studied items to use. */
function PlanCard({ session }: { session: PresentSession }) {
  if (!session.focus && session.targets.length === 0) return null;
  return (
    <div className="rounded-[18px] bg-blue-soft p-3.5">
      {session.focus_label_vi && (
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-blue-deep">
          <Target size={15} strokeWidth={2.4} /> Trọng tâm lượt này: {session.focus_label_vi}
        </p>
      )}
      {session.targets.length > 0 && (
        <>
          <p className={cn("text-[12px] font-bold text-ink", session.focus_label_vi && "mt-2")}>
            Vận dụng kiến thức bạn đã học
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {session.targets.map((t) => (
              <li key={t.key} className="rounded-[12px] bg-card px-3 py-2">
                <p className="text-[13px] font-semibold">
                  <span className="font-korean text-blue-deep">{t.ko}</span>
                  <span className="text-ink-2"> · {t.vi}</span>
                </p>
                {t.example_ko && (
                  <p className="font-korean mt-0.5 text-[12px] font-medium text-ink-2">
                    {t.example_ko}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] font-semibold text-ink-2">{t.why_vi}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Prep({
  session,
  busy,
  onSession,
  onNewTopic,
  onBack,
  onSpeak,
}: {
  session: PresentSession;
  busy: boolean;
  onSession: (s: PresentSession) => void;
  onNewTopic: () => void;
  onBack: () => void;
  onSpeak: () => void;
}) {
  const [notes, setNotes] = useState(session.notes_vi);
  const [outlining, setOutlining] = useState(false);
  const [ideas, setIdeas] = useState<PresentIdea[] | null>(null);
  const [thinking, setThinking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const f = session.frame;
  const defense = session.mode === "defense";

  const outline = async () => {
    setOutlining(true);
    setErr(null);
    try {
      onSession(await makePresentOutline(session.id, notes));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setOutlining(false);
    }
  };

  const think = async () => {
    setThinking(true);
    setErr(null);
    try {
      setIdeas(await getPresentIdeas(session.id));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setThinking(false);
    }
  };

  const pickIdea = (i: PresentIdea) => {
    setNotes(
      [i.stance_vi, i.reason_vi && `vì ${i.reason_vi}`, i.example_vi && `ví dụ: ${i.example_vi}`]
        .filter(Boolean)
        .join("; "),
    );
    setIdeas(null);
  };

  return (
    <section className="mt-5 space-y-4">
      <TopicCard session={session} />
      <PlanCard session={session} />

      <div>
        <h2 className="mb-2 text-[15px] font-semibold">
          Khung {defense ? "thuyết trình" : "trình bày"} · {clock(f.target_seconds[0])}–
          {clock(f.target_seconds[1])}
        </h2>
        <ol className="space-y-2">
          {f.parts.map((p, i) => (
            <li key={p.key} className="rounded-[16px] border border-line bg-card p-3">
              <p className="text-[13px] font-bold">
                {i + 1}. {p.label_vi}
                <span className="font-semibold text-ink-2"> — {p.hint_vi}</span>
              </p>
              <p className="font-korean mt-1 text-[13px] font-semibold text-blue-deep">
                {p.starters.join("  ·  ")}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label htmlFor="present-notes" className="text-[15px] font-semibold">
            Ghi nhanh ý (tiếng Việt)
          </label>
          <button
            type="button"
            disabled={thinking}
            onClick={() => void think()}
            className="flex min-h-8 items-center gap-1 rounded-full bg-yellow-soft px-3 text-[12px] font-semibold active:scale-[0.97] disabled:opacity-60"
          >
            {thinking ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Lightbulb size={14} strokeWidth={2.4} />
            )}
            Không biết nói gì?
          </button>
        </div>
        {ideas && (
          <div className="mb-3 space-y-2">
            <p className="text-[12px] font-semibold leading-4 text-ink-2">
              Chọn một hướng gần với bạn, rồi thay ví dụ bằng chuyện của chính bạn.
            </p>
            {ideas.map((i) => (
              <div key={i.stance_vi} className="rounded-[16px] border border-line bg-card p-3">
                <p className="text-[11px] font-bold text-blue-deep">{i.tool_vi}</p>
                <p className="mt-0.5 text-[13px] font-bold">{i.stance_vi}</p>
                {i.reason_vi && (
                  <p className="mt-0.5 text-[12px] font-semibold text-ink-2">Vì: {i.reason_vi}</p>
                )}
                {i.example_vi && (
                  <p className="text-[12px] font-semibold text-ink-2">Ví dụ: {i.example_vi}</p>
                )}
                {i.hook_ko && (
                  <p className="font-korean mt-1.5 text-[13px] font-semibold">
                    Mở đầu: {i.hook_ko}
                    {i.hook_vi && (
                      <span className="font-sans text-[12px] text-ink-2"> ({i.hook_vi})</span>
                    )}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => pickIdea(i)}
                  className="mt-2 min-h-8 rounded-full bg-blue-soft px-3 text-[12px] font-semibold text-blue-deep"
                >
                  Dùng ý này
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          id="present-notes"
          value={notes}
          maxLength={1200}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={
            defense
              ? "Ý bạn muốn nhấn mạnh, điều sợ bị hỏi… (có thể để trống)"
              : "VD: thích thành phố — tiện, có tàu điện; đi làm 20 phút…"
          }
          className="w-full rounded-[14px] border border-line bg-card px-3.5 py-2.5 text-sm font-medium placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-blue"
        />
        <button
          type="button"
          disabled={outlining}
          onClick={() => void outline()}
          className="mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full bg-blue-soft text-[13px] font-semibold text-blue-deep active:scale-[0.97] disabled:opacity-60"
        >
          {outlining ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} strokeWidth={2.4} />
          )}
          {session.outline ? "Làm lại dàn ý từ khoá" : "Haru làm dàn ý từ khoá"}
        </button>
        {err && <p className="mt-2 text-[12px] font-semibold text-danger">{err}</p>}
      </div>

      {session.outline && <OutlineCards session={session} />}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={defense ? onBack : onNewTopic}
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-line bg-card px-4 text-[13px] font-semibold active:scale-[0.97] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} strokeWidth={2.4} />
          )}
          {defense ? "Đề tài khác" : "Đổi đề"}
        </button>
        <button
          type="button"
          onClick={onSpeak}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-blue text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
        >
          <Mic size={18} strokeWidth={2.4} /> Bắt đầu nói
        </button>
      </div>
      <p className="text-center text-[12px] font-semibold text-ink-2">
        Mẹo: chuẩn bị khoảng 1 phút rồi nói, đừng viết cả câu ra để đọc.
      </p>
    </section>
  );
}

function OutlineCards({
  session,
  compact = false,
}: {
  session: PresentSession;
  compact?: boolean;
}) {
  if (!session.outline) return null;
  return (
    <ol className={cn("space-y-2", compact && "space-y-1.5")}>
      {session.outline.map((o, i) => (
        <li
          key={o.part}
          className={cn("rounded-[16px] border border-line bg-card", compact ? "px-3 py-2" : "p-3")}
        >
          <p className="text-[12px] font-bold text-ink-2">
            {i + 1}. {o.label_vi}
            {o.suggested && <span className="ml-1 font-semibold text-blue-deep">(Haru gợi ý)</span>}
          </p>
          {!compact && o.idea_vi && <p className="mt-0.5 text-[13px] font-semibold">{o.idea_vi}</p>}
          <p className="font-korean mt-1 text-[14px] font-semibold text-blue-deep">
            {o.starter_ko}
            {o.keywords_ko.length > 0 && (
              <span className="text-ink"> · {o.keywords_ko.join(" · ")}</span>
            )}
          </p>
          {(o.targets ?? []).length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1">
              {(o.targets ?? []).map((t) => (
                <span
                  key={t.key}
                  className="font-korean rounded-full bg-yellow-soft px-2 py-0.5 text-[11px] font-semibold"
                >
                  ★ {t.ko}
                </span>
              ))}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function Cues({ session }: { session: PresentSession }) {
  if (session.outline) return <OutlineCards session={session} compact />;
  return (
    <ol className="space-y-1.5">
      {session.frame.parts.map((p, i) => (
        <li
          key={p.key}
          className="rounded-[14px] border border-line bg-card px-3 py-2 text-[13px] font-semibold"
        >
          {i + 1}. {p.label_vi} ·{" "}
          <span className="font-korean text-blue-deep">{p.starters[0]}</span>
        </li>
      ))}
      {session.targets.length > 0 && (
        <li className="flex flex-wrap gap-1 pt-1">
          {session.targets.map((t) => (
            <span
              key={t.key}
              className="font-korean rounded-full bg-yellow-soft px-2 py-0.5 text-[11px] font-semibold"
            >
              ★ {t.ko}
            </span>
          ))}
        </li>
      )}
    </ol>
  );
}

function AnswerCues({ band }: { band: number }) {
  const lines =
    band <= 2
      ? ["네/아니요 + câu trả lời ngắn", "왜냐하면 … 때문이에요 / -아서/어서"]
      : band === 3
        ? ["Trả lời thẳng ở câu đầu", "왜냐하면 …기 때문이에요", "예를 들어서 …"]
        : ["좋은 질문 감사합니다. 제 생각에는 …", "그 이유는 …기 때문입니다", "물론 …지만, …"];
  return (
    <ul className="space-y-1.5">
      {lines.map((l) => (
        <li
          key={l}
          className="font-korean rounded-[14px] border border-line bg-card px-3 py-2 text-[13px] font-semibold text-blue-deep"
        >
          {l}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- recording

function Recorder({
  kicker,
  title,
  subtitle,
  target,
  maxSeconds,
  minSeconds,
  cues,
  onCancel,
  onDone,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  target?: [number, number];
  maxSeconds: number;
  minSeconds: number;
  cues?: ReactNode;
  onCancel: () => void;
  onDone: (wav: Uint8Array<ArrayBuffer>) => void;
}) {
  // read once, synchronously: the countdown must decide before the mic opens
  const [gentle] = useState(() => read(GENTLE) === "1");
  const mic = useRef<MicCapture | null>(null);
  const chunks = useRef<Int16Array[]>([]);
  const startedAt = useRef(0);
  const finished = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [state, setState] = useState<"breathe" | "asking" | "on" | "denied">(() =>
    gentle ? "breathe" : "asking",
  );
  const [count, setCount] = useState(3);
  const [tooShort, setTooShort] = useState(false);

  const stop = useCallback(
    (send: boolean) => {
      if (finished.current) return;
      const secs = (performance.now() - startedAt.current) / 1000;
      if (send && secs < minSeconds) {
        setTooShort(true);
        return;
      }
      finished.current = true;
      mic.current?.stop();
      mic.current = null;
      if (!send) return onCancel();
      const total = chunks.current.reduce((n, c) => n + c.length, 0);
      const all = new Int16Array(total);
      let at = 0;
      for (const c of chunks.current) {
        all.set(c, at);
        at += c.length;
      }
      onDone(pcmToWav(all));
    },
    [minSeconds, onCancel, onDone],
  );

  // gentle mode: three breaths' worth of countdown before the mic opens
  useEffect(() => {
    if (state !== "breathe") return;
    if (count <= 0) {
      setState("asking");
      return;
    }
    const t = window.setTimeout(() => setCount((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [state, count]);

  // Open the mic once. The "gone" flag lives in a ref reset on every mount, so React's dev
  // double-mount (mount, unmount, mount) does not drop the stream that is still opening.
  const opened = useRef(false);
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
      mic.current?.stop();
      mic.current = null;
    };
  }, []);
  useEffect(() => {
    if (state !== "asking" || opened.current) return;
    opened.current = true;
    startMic((_b64, rms, pcm) => {
      chunks.current.push(pcm);
      setLevel(rms);
    })
      .then((m) => {
        if (gone.current || finished.current) return m.stop();
        mic.current = m;
        startedAt.current = performance.now();
        setState("on");
      })
      .catch(() => {
        if (!gone.current) setState("denied");
      });
  }, [state]);

  useEffect(() => {
    if (state !== "on") return;
    const t = window.setInterval(() => {
      const s = (performance.now() - startedAt.current) / 1000;
      setElapsed(s);
      if (s >= minSeconds) setTooShort(false);
      if (s >= maxSeconds) stop(true);
    }, 200);
    return () => window.clearInterval(t);
  }, [state, maxSeconds, minSeconds, stop]);

  const [lo, hi]: [number, number] = target ?? [0, maxSeconds];
  const pct = Math.min(100, (elapsed / maxSeconds) * 100);
  const inTarget = elapsed >= lo && elapsed <= hi;

  return (
    <section className="mt-4">
      <p className="text-[12px] font-semibold text-ink-2">{kicker}</p>
      <p className="font-korean mt-1 text-[17px] font-bold leading-6">{title}</p>
      {subtitle && <p className="mt-0.5 text-[13px] font-semibold text-ink-2">{subtitle}</p>}

      {state === "denied" ? (
        <div className="mt-6 rounded-[18px] bg-danger-soft p-4 text-[13px] font-semibold text-danger">
          Chưa mở được micro. Cho phép Haru dùng micro trong cài đặt trình duyệt rồi thử lại.
          <button type="button" onClick={onCancel} className="mt-3 block underline">
            Quay lại
          </button>
        </div>
      ) : state === "breathe" ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="flex h-28 w-28 animate-pulse items-center justify-center rounded-full bg-green-soft text-[40px] font-bold text-green">
            {count}
          </div>
          <p className="mt-4 text-[15px] font-semibold">Hít sâu… thở ra chậm.</p>
          <p className="mt-1 text-[13px] font-semibold text-ink-2">
            Nói chậm cũng được, sai cũng được. Câu đầu chỉ cần nói ý chính.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col items-center">
            <div
              className="flex h-28 w-28 items-center justify-center rounded-full bg-blue-soft transition-transform"
              style={{ transform: `scale(${1 + Math.min(0.25, level * 4)})` }}
            >
              {state === "asking" ? (
                <Loader2 size={30} className="animate-spin text-blue" />
              ) : (
                <Mic size={34} strokeWidth={2.2} className="text-blue-deep" />
              )}
            </div>
            <p className="mt-4 text-[34px] font-bold tabular-nums" aria-live="off">
              {clock(elapsed)}
            </p>
            <p
              className={cn(
                "text-[12px] font-semibold",
                target && inTarget ? "text-green" : "text-ink-2",
              )}
            >
              {target ? `Mục tiêu ${clock(lo)}–${clock(hi)} · ` : ""}tự dừng ở {clock(maxSeconds)}
            </p>
            <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-fill">
              {target && (
                <div
                  className="absolute inset-y-0 bg-green/25"
                  style={{
                    left: `${(lo / maxSeconds) * 100}%`,
                    width: `${((hi - lo) / maxSeconds) * 100}%`,
                  }}
                />
              )}
              <div className="absolute inset-y-0 left-0 bg-blue" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {cues && <div className="mt-5">{cues}</div>}

          {tooShort && (
            <p className="mt-3 text-center text-[12px] font-semibold text-danger">
              Nói thêm chút nữa nhé, ít nhất {minSeconds} giây.
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => stop(false)}
              className="flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-line bg-card px-4 text-[13px] font-semibold active:scale-[0.97]"
            >
              <X size={16} strokeWidth={2.4} /> Huỷ
            </button>
            <button
              type="button"
              disabled={state !== "on"}
              onClick={() => stop(true)}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-blue text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-60"
            >
              <Square size={16} strokeWidth={2.6} /> Xong, chấm bài
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- result

function scoreColor(v: number) {
  if (v >= 4) return "bg-green";
  if (v >= 3) return "bg-yellow";
  return "bg-danger";
}

function Delta({
  now,
  before,
  lowerIsBetter = false,
}: {
  now: number;
  before: number | undefined;
  lowerIsBetter?: boolean;
}) {
  if (before === undefined || now === before) return null;
  const better = lowerIsBetter ? now < before : now > before;
  return (
    <span className={cn("ml-1 text-[11px] font-bold", better ? "text-green" : "text-danger")}>
      {now > before ? "▲" : "▼"} {Math.abs(Math.round((now - before) * 10) / 10)}
    </span>
  );
}

function Result({
  session,
  busy,
  gentle,
  onAgain,
  onPrep,
  onNewTopic,
  onIntro,
  onAnswer,
}: {
  session: PresentSession;
  busy: boolean;
  gentle: boolean;
  onAgain: () => void;
  onPrep: () => void;
  onNewTopic: () => void;
  onIntro: () => void;
  onAnswer: (attempt: number, q: number) => void;
}) {
  const insights = useQuery({
    queryKey: ["present", "insights"],
    queryFn: getPresentInsights,
    staleTime: 10_000,
  });
  const n = session.attempts.length;
  const [shown, setShown] = useState(n - 1);
  useEffect(() => setShown(n - 1), [n]);
  const a: PresentAttempt = session.attempts[Math.min(shown, n - 1)] ?? session.attempts[n - 1]!;
  const prev = a.index > 0 ? session.attempts[a.index - 1] : undefined;
  const ev = a.eval;
  const m = a.metrics;
  const [lo, hi] = session.frame.target_seconds;
  const full = ev.upgraded.map((u) => u.ko).join(" ");
  const best = insights.data?.best_overall;
  const isBest = best != null && ev.overall >= best && (insights.data?.rounds ?? 0) > 1;

  return (
    <section className="mt-5 space-y-4">
      <p className="font-korean text-[15px] font-bold leading-5">{session.topic.question_ko}</p>

      {n > 1 && (
        <div
          className="flex gap-1 rounded-full bg-fill p-1"
          role="tablist"
          aria-label="Các lần nói"
        >
          {session.attempts.map((x) => (
            <button
              key={x.index}
              type="button"
              role="tab"
              aria-selected={x.index === a.index}
              onClick={() => setShown(x.index)}
              className={cn(
                "min-h-9 flex-1 rounded-full text-[12px] font-semibold",
                x.index === a.index ? "bg-card text-ink shadow-elev-1" : "text-ink-2",
              )}
            >
              Lần {x.index + 1}
              {!gentle && ` · ${x.eval.overall.toFixed(1)}`}
            </button>
          ))}
        </div>
      )}

      {/* strengths first: for the anxious this is what they see before any number */}
      {ev.strength_vi && (
        <p className="rounded-[18px] bg-green-soft p-3.5 text-[13px] font-semibold leading-5">
          👍 {ev.strength_vi}
        </p>
      )}

      {a.band_after != null && session.base_band != null && a.band_after !== session.base_band && (
        <p className="rounded-[18px] bg-blue-soft p-3.5 text-[13px] font-semibold leading-5 text-blue-deep">
          {a.band_after > session.base_band
            ? `Hai lượt liền bạn vượt mục tiêu — mức trình bày lên ${a.band_after}/5. Lượt sau khung dài hơn, chấm khắt hơn.`
            : `Haru hạ mức trình bày xuống ${a.band_after}/5 để bạn luyện chắc từng bước. Mức sẽ lên lại khi bạn đạt mục tiêu hai lượt liền.`}
        </p>
      )}

      {/* overall */}
      <div className="rounded-[22px] border border-line bg-card p-4 shadow-elev-1">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[12px] font-semibold text-ink-2">
              Lần {a.index + 1} · chấm theo mục tiêu mức {session.band}/5
            </p>
            {gentle ? (
              <p className="mt-1 text-[22px] font-bold leading-7">
                {scoreWord(Math.round(ev.overall))}
              </p>
            ) : (
              <p className="mt-0.5 text-[34px] font-bold leading-10 tabular-nums">
                {ev.overall.toFixed(1)}
                <span className="text-[16px] text-ink-2">/5</span>
                {prev && <Delta now={ev.overall} before={prev.eval.overall} />}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {isBest && (
              <span className="flex items-center gap-1 rounded-full bg-yellow-soft px-2.5 py-1 text-[11px] font-bold">
                <Trophy size={12} strokeWidth={2.6} /> Kỷ lục của bạn
              </span>
            )}
            {ev.off_topic && (
              <span className="rounded-full bg-danger-soft px-2.5 py-1 text-[11px] font-bold text-danger">
                Lạc đề
              </span>
            )}
          </div>
        </div>
        {ev.compare_vi && (
          <p className="mt-2 rounded-[12px] bg-blue-soft px-3 py-2 text-[13px] font-semibold leading-5 text-blue-deep">
            {ev.compare_vi}
          </p>
        )}
        <ul className="mt-3 space-y-2.5">
          {CRITERIA_ORDER.map((k) => (
            <li key={k}>
              <div className="flex items-center justify-between text-[13px] font-semibold">
                <span>
                  {session.criteria[k]}
                  {session.focus === k && (
                    <span className="ml-1 rounded-full bg-blue-soft px-1.5 py-0.5 text-[10px] font-bold text-blue-deep">
                      trọng tâm
                    </span>
                  )}
                </span>
                <span className="tabular-nums">
                  {gentle ? scoreWord(ev.scores[k]) : `${ev.scores[k]}/5`}
                  {!gentle && prev && <Delta now={ev.scores[k]} before={prev.eval.scores[k]} />}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill">
                <div
                  className={cn("h-full rounded-full", scoreColor(ev.scores[k]))}
                  style={{ width: `${ev.scores[k] * 20}%` }}
                />
              </div>
              {ev.score_notes_vi[k] && (
                <p className="mt-1 text-[12px] font-semibold leading-4 text-ink-2">
                  {ev.score_notes_vi[k]}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {ev.tips_vi.length > 0 && (
        <div className="rounded-[18px] border border-line bg-card p-3.5">
          <p className="text-[13px] font-bold">Lần sau thử</p>
          <ul className="mt-1.5 space-y-1.5">
            {ev.tips_vi.map((t) => (
              <li key={t} className="flex gap-2 text-[13px] font-semibold leading-5">
                <span className="text-blue">→</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* structure */}
      <div>
        <h2 className="mb-2 text-[15px] font-semibold">Cấu trúc bài nói</h2>
        <ol className="space-y-2">
          {ev.parts.map((p) => (
            <li key={p.part} className="flex gap-2.5 rounded-[16px] border border-line bg-card p-3">
              <Tick ok={p.present} />
              <div className="min-w-0">
                <p className="text-[13px] font-bold">{p.label_vi}</p>
                {p.said_ko && (
                  <p className="font-korean mt-0.5 text-[13px] font-semibold">“{p.said_ko}”</p>
                )}
                {p.note_vi && (
                  <p className="mt-0.5 text-[12px] font-semibold leading-4 text-ink-2">
                    {p.note_vi}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
        {ev.connectives_used.length > 0 && (
          <p className="mt-2 text-[12px] font-semibold text-ink-2">
            Từ nối đã dùng:{" "}
            <span className="font-korean text-ink">{ev.connectives_used.join(", ")}</span>
          </p>
        )}
      </div>

      {(ev.targets_used ?? []).length > 0 && (
        <div>
          <h2 className="mb-2 text-[15px] font-semibold">Vận dụng kiến thức đã học</h2>
          <ul className="space-y-2">
            {ev.targets_used.map((t) => (
              <li
                key={t.key}
                className="flex gap-2.5 rounded-[16px] border border-line bg-card p-3"
              >
                <Tick ok={t.correct} half={t.used && !t.correct} />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold">
                    <span className="font-korean">{t.ko}</span>
                    <span className="font-semibold text-ink-2">
                      {" "}
                      · {t.correct ? "dùng đúng" : t.used ? "dùng chưa đúng" : "chưa dùng"}
                    </span>
                  </p>
                  {t.said_ko && (
                    <p className="font-korean mt-0.5 text-[13px] font-semibold">“{t.said_ko}”</p>
                  )}
                  {t.note_vi && (
                    <p className="mt-0.5 text-[12px] font-semibold leading-4 text-ink-2">
                      {t.note_vi}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] font-semibold text-ink-2">
            Dùng đúng ở 3 lượt khác nhau là “thành thạo” — Haru chuyển sang kiến thức khác.
          </p>
        </div>
      )}

      {/* measured */}
      <div>
        <h2 className="mb-2 text-[15px] font-semibold">Độ trôi (đo từ bản ghi)</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Thời gian nói"
            value={clock(m.speaking_seconds)}
            note={
              m.in_target
                ? "Đúng mục tiêu"
                : m.speaking_seconds < lo
                  ? `Ngắn, nên ${clock(lo)}–${clock(hi)}`
                  : `Dài, nên ${clock(lo)}–${clock(hi)}`
            }
            good={m.in_target}
          />
          <Stat
            label="Khoảng lặng ≥ 1 giây"
            value={String(m.pauses)}
            note={`Lâu nhất ${m.longest_pause.toFixed(1)}s`}
            delta={prev && <Delta now={m.pauses} before={prev.metrics.pauses} lowerIsBetter />}
          />
          <Stat
            label="Tiếng ngập ngừng"
            value={String(m.fillers)}
            note="음, 어, 그…"
            delta={prev && <Delta now={m.fillers} before={prev.metrics.fillers} lowerIsBetter />}
          />
          <Stat
            label="Tốc độ"
            value={m.syllables_per_sec != null ? `${m.syllables_per_sec}` : "—"}
            note="âm tiết / giây"
            delta={
              prev && m.syllables_per_sec != null && prev.metrics.syllables_per_sec != null ? (
                <Delta now={m.syllables_per_sec} before={prev.metrics.syllables_per_sec} />
              ) : undefined
            }
          />
        </div>
      </div>

      {ev.upgraded.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Bản nâng cấp của bài bạn</h2>
            <SayButton text={full} label="Nghe cả bài nâng cấp" />
          </div>
          <ol className="space-y-2">
            {ev.upgraded.map((u) => (
              <li key={u.part} className="rounded-[16px] border border-line bg-card p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-ink-2">{u.label_vi}</p>
                    <p className="font-korean mt-0.5 text-[15px] font-semibold leading-6">{u.ko}</p>
                    {u.vi && (
                      <p className="mt-0.5 text-[12px] font-semibold leading-4 text-ink-2">
                        {u.vi}
                      </p>
                    )}
                  </div>
                  <SayButton text={u.ko} label={`Nghe phần ${u.label_vi}`} />
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] font-semibold text-ink-2">
            Nghe, nói nhại theo 1–2 lần, rồi nói lại bằng lời của bạn — đừng đọc thuộc.
          </p>
        </div>
      )}

      {(ev.stretch ?? []).length > 0 && (
        <div className="rounded-[18px] bg-yellow-soft p-3.5">
          <p className="text-[13px] font-bold">Nâng một bậc</p>
          <ul className="mt-1.5 space-y-1.5">
            {ev.stretch.map((x) => (
              <li key={x.ko} className="text-[13px] font-semibold leading-5">
                <span className="font-korean">{x.ko}</span>
                <span className="text-ink-2"> · {x.vi}</span>
                {x.why_vi && <p className="text-[12px] text-ink-2">{x.why_vi}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(ev.follow_ups ?? []).length > 0 && (
        <FollowUps session={session} attempt={a} gentle={gentle} onAnswer={onAnswer} />
      )}

      {ev.pron_issues.length > 0 && (
        <div>
          <h2 className="mb-2 text-[15px] font-semibold">Phát âm cần sửa</h2>
          <ul className="space-y-2">
            {ev.pron_issues.map((p) => (
              <li
                key={p.word}
                className="rounded-[16px] border border-line bg-card p-3 text-[13px] font-semibold"
              >
                <span className="font-korean">{p.word}</span>
                {p.heard_as && (
                  <span className="text-ink-2">
                    {" "}
                    → nghe thành <span className="font-korean">{p.heard_as}</span>
                  </span>
                )}
                {p.tip_vi && <p className="mt-0.5 text-[12px] leading-4 text-ink-2">{p.tip_vi}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="rounded-[16px] border border-line bg-card p-3">
        <summary className="cursor-pointer text-[13px] font-bold">Haru nghe được gì</summary>
        <p className="font-korean mt-2 text-[14px] font-medium leading-6">
          {ev.transcript_ko.split(/(\s+)/).map((tok, i) =>
            /^(으*음+|어+|으+|엄+|흠+)[.,…~?!]*$/.test(tok) ? (
              <mark key={i} className="rounded bg-yellow-soft px-0.5 text-ink">
                {tok}
              </mark>
            ) : (
              tok
            ),
          )}
        </p>
      </details>

      <div className="space-y-2 pt-1">
        {session.attempts_left > 0 && (
          <button
            type="button"
            onClick={onAgain}
            disabled={session.attempts_left_today === 0}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-60"
          >
            <Mic size={18} strokeWidth={2.4} /> Nói lại lần {n + 1}
          </button>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrep}
            className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-line bg-card text-[13px] font-semibold active:scale-[0.97]"
          >
            Xem lại dàn ý
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={session.mode === "defense" ? onIntro : onNewTopic}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-line bg-card text-[13px] font-semibold active:scale-[0.97] disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} strokeWidth={2.4} />
            )}
            {session.mode === "defense" ? "Đề tài khác" : "Đề mới"}
          </button>
        </div>
        {session.attempts_left_today != null && (
          <p className="text-center text-[12px] font-semibold text-ink-2">
            Hôm nay còn {session.attempts_left_today} lượt chấm.
          </p>
        )}
      </div>
    </section>
  );
}

function Tick({ ok, half = false }: { ok: boolean; half?: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
        ok
          ? "bg-green-soft text-green"
          : half
            ? "bg-yellow-soft text-ink"
            : "bg-danger-soft text-danger",
      )}
    >
      {ok ? (
        <Check size={13} strokeWidth={3} />
      ) : half ? (
        <span className="text-[11px] font-bold">~</span>
      ) : (
        <X size={13} strokeWidth={3} />
      )}
    </span>
  );
}

/** "Hỏi vặn": the questions a teacher / committee would ask about what was just said. */
function FollowUps({
  session,
  attempt,
  gentle,
  onAnswer,
}: {
  session: PresentSession;
  attempt: PresentAttempt;
  gentle: boolean;
  onAnswer: (attempt: number, q: number) => void;
}) {
  const defense = session.mode === "defense";
  return (
    <div>
      <h2 className="mb-1 flex items-center gap-1.5 text-[15px] font-semibold">
        <MessageCircleQuestion size={17} strokeWidth={2.4} className="text-blue" />
        {defense ? "Hội đồng hỏi lại" : "Hỏi vặn"}
      </h2>
      <p className="mb-2 text-[12px] font-semibold leading-4 text-ink-2">
        Luyện phản xạ khi bị hỏi lại: trả lời thẳng ở câu đầu, rồi đưa lý do hoặc dẫn chứng.
      </p>
      <ol className="space-y-2">
        {attempt.eval.follow_ups.map((q, i) => {
          const ans = attempt.answers?.[String(i)];
          return (
            <li key={q.q_ko} className="rounded-[16px] border border-line bg-card p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-korean text-[15px] font-semibold leading-6">{q.q_ko}</p>
                  {q.q_vi && <p className="text-[12px] font-semibold text-ink-2">{q.q_vi}</p>}
                </div>
                <SayButton text={q.q_ko} label="Nghe câu hỏi" />
              </div>
              {ans && (
                <div className="mt-2 space-y-1.5 rounded-[12px] bg-fill p-2.5">
                  <p className="font-korean text-[13px] font-medium">“{ans.transcript_ko}”</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ANSWER_ORDER.map((k) => (
                      <span
                        key={k}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-bold",
                          ans.scores[k] >= 4
                            ? "bg-green-soft text-green"
                            : ans.scores[k] >= 3
                              ? "bg-yellow-soft"
                              : "bg-danger-soft text-danger",
                        )}
                      >
                        {session.answer_criteria[k]}{" "}
                        {gentle ? scoreWord(ans.scores[k]).toLowerCase() : `${ans.scores[k]}/5`}
                      </span>
                    ))}
                  </div>
                  {ans.note_vi && (
                    <p className="text-[12px] font-semibold leading-4 text-ink-2">{ans.note_vi}</p>
                  )}
                  {ans.better_ko && (
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-[13px] font-semibold">
                        <span className="font-korean">{ans.better_ko}</span>
                        {ans.better_vi && (
                          <span className="block text-[12px] text-ink-2">{ans.better_vi}</span>
                        )}
                      </p>
                      <SayButton text={ans.better_ko} label="Nghe câu trả lời mẫu" />
                    </div>
                  )}
                </div>
              )}
              {(!ans || ans.tries < 2) && (
                <button
                  type="button"
                  onClick={() => onAnswer(attempt.index, i)}
                  className="mt-2 flex min-h-9 items-center gap-1.5 rounded-full bg-blue-soft px-3.5 text-[12px] font-semibold text-blue-deep active:scale-[0.97]"
                >
                  <Mic size={14} strokeWidth={2.4} /> {ans ? "Trả lời lại" : "Trả lời"}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  good,
  delta,
}: {
  label: string;
  value: string;
  note: string;
  good?: boolean;
  delta?: ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-line bg-card p-3">
      <p className="text-[11px] font-semibold text-ink-2">{label}</p>
      <p className="mt-0.5 text-[20px] font-bold tabular-nums">
        {value}
        {delta}
      </p>
      <p
        className={cn(
          "text-[11px] font-semibold",
          good === true ? "text-green" : good === false ? "text-danger" : "text-ink-2",
        )}
      >
        {note}
      </p>
    </div>
  );
}
