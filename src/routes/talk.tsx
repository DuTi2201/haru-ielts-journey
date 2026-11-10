import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Brain,
  Gauge,
  Pause,
  Play,
  Trash2,
  Volume2,
  X,
  CircleStop,
  Headphones,
  Languages,
  Lightbulb,
  Loader2,
  Keyboard,
  Mic,
  MicOff,
  SendHorizontal,
  RotateCcw,
  Snail,
  Sparkles,
} from "lucide-react";

import { Mascot } from "@/components/mascot/Mascot";
import { TabBar } from "@/components/haru/TabBar";
import { FeatureAllowance } from "@/components/billing/FeatureAllowance";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useTextAudio } from "@/hooks/use-text-audio";
import { errorMessage } from "@/lib/api/client";
import {
  checkPronunciation,
  forgetTalkFacts,
  getTalkProfile,
  type ConversationFinishOut,
  type ConversationStartOut,
  type ConversationTurn,
  type PronunciationItem,
  type PronunciationOut,
  type TalkProfile,
} from "@/lib/api/conversation";
import { bytesToBase64, pcmToWav } from "@/lib/live/audio";
import { talkApi, useLiveTalk, type SpokenTake, type Speaker } from "@/lib/live/use-live-talk";
import { cn } from "@/lib/utils";
import {
  BandNote,
  clock,
  PronunciationCard,
  ReportCards,
  SaveToReview,
  TalkTabs,
} from "@/components/talk/TalkParts";

export const Route = createFileRoute("/talk")({
  validateSearch: (search: Record<string, unknown>): { lesson?: number | undefined } => {
    const n = Number(search["lesson"]);
    return Number.isInteger(n) && n > 0 ? { lesson: n } : {};
  },
  head: () => ({
    meta: [
      { title: "Trò chuyện với Haru — Haru" },
      {
        name: "description",
        content: "Luyện nói tiếng Hàn bằng giọng nói với Haru, theo đúng bài bạn đang học.",
      },
      { property: "og:title", content: "Trò chuyện với Haru — Haru" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TalkScreen,
});

const REMEMBER_KEY = "haru.talk.remember";

function readRemember(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

function TalkScreen() {
  const auth = useAuth();
  const { lesson: chosenLesson } = Route.useSearch();
  const api = useMemo(() => talkApi(chosenLesson), [chosenLesson]);
  const talk = useLiveTalk(api);
  // same first render on server and device, then the saved choice
  const [remember, setRemember] = useState(false);
  useEffect(() => setRemember(readRemember()), []);

  function toggleRemember(on: boolean) {
    setRemember(on);
    try {
      localStorage.setItem(REMEMBER_KEY, on ? "1" : "0");
    } catch {
      // private mode: only for this visit
    }
  }

  if (talk.status === "live" || talk.status === "connecting") {
    return <LiveView talk={talk} />;
  }

  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <Link
        to="/speaking"
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-deep"
      >
        <ArrowLeft size={16} strokeWidth={2.4} /> Luyện tập
      </Link>
      {talk.status !== "ending" && talk.status !== "done" && <TalkTabs active="talk" />}

      {talk.status === "ending" && (
        <section className="mt-16 flex flex-col items-center text-center">
          <Loader2 size={28} className="animate-spin text-blue" />
          <p className="mt-3 text-sm font-semibold">Haru đang xem lại buổi trò chuyện…</p>
        </section>
      )}

      {talk.status === "done" && talk.result && (
        <ReportView
          result={talk.result}
          info={talk.info}
          note={talk.error}
          takes={talk.takes}
          onAgain={talk.reset}
        />
      )}

      {(talk.status === "idle" || talk.status === "error") && (
        <>
          <header className="mt-3 flex items-end gap-3">
            <Mascot mood="wave" className="h-16 w-16 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-ink-2">Luyện nói</p>
              <h1 className="text-2xl font-bold leading-tight">Trò chuyện với Haru</h1>
            </div>
          </header>

          <section className="mt-5 rounded-[20px] border border-line bg-card p-5 shadow-elev-1">
            <ul className="space-y-3 text-[13px] font-semibold leading-5">
              <Tip icon={<Sparkles size={17} className="text-blue" />}>
                Haru hỏi về chính cuộc sống của bạn, dùng từ và mẫu câu của bài đang học và các bài
                trước.
              </Tip>
              <Tip icon={<Lightbulb size={17} className="text-blue" />}>
                Bí thì cứ im lặng: Haru sẽ hỏi dễ hơn, hiện gợi ý, rồi nói tiếng Việt giúp bạn.
              </Tip>
              <Tip icon={<Languages size={17} className="text-blue" />}>
                Chưa nghĩ ra tiếng Hàn? Nói tiếng Việt cũng được — Haru nói lại bằng tiếng Hàn để
                bạn nói theo.
              </Tip>
              <Tip icon={<Headphones size={17} className="text-blue" />}>
                Nên đeo tai nghe để Haru không thu nhầm tiếng từ loa.
              </Tip>
            </ul>
          </section>

          <label
            htmlFor="talk-remember"
            className="mt-3 flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-line bg-card px-4 py-2"
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold">Cho Haru nhớ chuyện bạn kể</span>
              <span className="block text-[12px] font-medium leading-4 text-ink-2">
                Vài điều như sở thích, công việc — để lần sau Haru hỏi thăm. Tắt là không lưu.
              </span>
            </span>
            <Switch id="talk-remember" checked={remember} onCheckedChange={toggleRemember} />
          </label>

          {talk.error && (
            <p
              role="alert"
              className="mt-4 rounded-[14px] bg-danger-soft px-3.5 py-3 text-[13px] font-semibold leading-5 text-danger"
            >
              {talk.error}
            </p>
          )}

          {auth.isAnonymous ? (
            <Link
              to="/support-language"
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue text-sm font-semibold text-primary-foreground shadow-elev-1"
            >
              Đăng nhập để trò chuyện
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void talk.start(remember)}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
            >
              <Mic size={18} strokeWidth={2.4} /> Bắt đầu trò chuyện
            </button>
          )}
          {!auth.isAnonymous && (
            <button
              type="button"
              onClick={() => void talk.start(remember, { typing: true })}
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-card text-[13px] font-semibold text-ink shadow-elev-1 active:scale-[0.97]"
            >
              <Keyboard size={17} strokeWidth={2.4} /> Không có micro? Gõ phím để trò chuyện
            </button>
          )}
          <FeatureAllowance feature="talk" className="mt-3" />

          {auth.isAuthenticated && <ProfilePanel />}
        </>
      )}
      <TabBar />
    </main>
  );
}

function Tip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

type Talk = ReturnType<typeof useLiveTalk<ConversationStartOut, ConversationFinishOut>>;

function statusLine(status: Talk["status"], speaker: Speaker, step: number, muted: boolean) {
  if (status === "connecting") return "Đang gọi Haru…";
  if (muted) return "Micro đang tắt";
  if (speaker === "haru") return "Haru đang nói…";
  if (speaker === "learner") return "Haru đang nghe bạn…";
  if (step >= 1) return "Từ từ thôi — xem gợi ý bên dưới nhé";
  return "Đến lượt bạn nói";
}

function LiveView({ talk }: { talk: Talk }) {
  const [showHaruText, setShowHaruText] = useState(true);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [talk.turns]);
  const left = talk.info ? talk.info.max_seconds - talk.elapsed : 0;

  return (
    <main className="mx-auto flex h-dvh max-w-[390px] flex-col bg-paper px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))] text-ink">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-ink-2">
            {talk.info?.topic ?? "Trò chuyện"}
            {talk.info?.lesson && (
              <>
                {" · "}
                <Link
                  to="/lesson/$id"
                  params={{ id: String(talk.info.lesson.id) }}
                  className="underline decoration-dotted underline-offset-2"
                >
                  {talk.info.lesson.title}
                </Link>
              </>
            )}
          </p>
          <p className="text-[15px] font-semibold">
            Trò chuyện với Haru
            {talk.info && (
              <span className="ml-1.5 align-middle text-[11px] font-semibold text-blue-deep">
                Mức {talk.info.band}/5
              </span>
            )}
          </p>
          {talk.info?.answer_goal_vi && (
            <p className="truncate text-[12px] font-semibold text-green">
              Hôm nay tập: {talk.info.answer_goal_vi}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-fill px-2.5 py-1 text-[12px] font-semibold tabular-nums">
          {talk.status === "live" ? clock(left) : "—"}
        </span>
      </header>

      <div className="mt-4 flex flex-col items-center">
        <div
          className={cn(
            "relative flex h-24 w-24 items-center justify-center rounded-full transition-colors duration-300",
            talk.speaker === "haru"
              ? "bg-blue-soft"
              : talk.speaker === "learner"
                ? "bg-green-soft"
                : "bg-fill",
          )}
        >
          {talk.speaker !== "none" && (
            <span
              aria-hidden
              className={cn(
                "pulse-ring absolute inset-0 rounded-full",
                talk.speaker === "haru" ? "bg-blue/25" : "bg-green/25",
              )}
            />
          )}
          {talk.status === "connecting" ? (
            <Loader2 size={30} className="animate-spin text-blue" />
          ) : (
            <Mascot
              mood={
                talk.speaker === "learner"
                  ? "listening"
                  : talk.speaker === "haru"
                    ? "cheer"
                    : "wave"
              }
              className="h-20 w-20"
              label={talk.speaker === "learner" ? "Haru đang nghe bạn nói" : undefined}
            />
          )}
        </div>
        <p aria-live="polite" className="mt-2 text-[13px] font-semibold text-ink-2">
          {statusLine(talk.status, talk.speaker, talk.step, talk.muted)}
        </p>
        <button
          type="button"
          onClick={() => talk.setSlow(!talk.slow)}
          aria-pressed={talk.slow}
          title="Haru nói chậm hơn nữa, rõ từng âm"
          className={cn(
            "mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold",
            talk.slow ? "border-blue bg-blue-soft text-blue" : "border-line bg-card text-ink-2",
          )}
        >
          <Snail size={15} /> {talk.slow ? "Đang nói chậm" : "Nói chậm"}
        </button>
      </div>

      <div
        ref={list}
        className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pb-2"
        aria-label="Lời hai bên đã nói"
      >
        {talk.turns.length === 0 && talk.status === "live" && (
          <p className="pt-6 text-center text-[12px] font-semibold text-ink-2">
            Haru sẽ chào bạn trước…
          </p>
        )}
        {talk.turns.map((t, i) => (
          <Bubble key={i} turn={t} hidden={t.role === "haru" && !showHaruText} />
        ))}
      </div>

      {talk.info && <HintPanel hints={talk.info.hints} lit={talk.step >= 1} />}

      {talk.typing && <TypeBox talk={talk} />}

      <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <button
          type="button"
          hidden={talk.typing}
          onClick={() => talk.setMuted(!talk.muted)}
          aria-pressed={talk.muted}
          aria-label={talk.muted ? "Bật micro" : "Tắt micro"}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full border border-line shadow-elev-1",
            talk.muted ? "bg-danger-soft text-danger" : "bg-card",
          )}
        >
          {talk.muted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={talk.hint}
            disabled={talk.status !== "live"}
            className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full border border-line bg-card text-[13px] font-semibold shadow-elev-1 disabled:opacity-50"
          >
            <Lightbulb size={17} /> Gợi ý
          </button>
          <button
            type="button"
            onClick={() => setShowHaruText((v) => !v)}
            aria-pressed={showHaruText}
            className="flex min-h-12 items-center justify-center rounded-full border border-line bg-card px-3 text-[12px] font-semibold shadow-elev-1"
          >
            {showHaruText ? "Ẩn chữ" : "Hiện chữ"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => void talk.end()}
          aria-label="Kết thúc"
          className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-danger px-4 text-[13px] font-semibold text-destructive-foreground shadow-elev-1"
        >
          <CircleStop size={18} /> Xong
        </button>
      </div>
    </main>
  );
}

/** Typing mode: one line at a time, sent with Enter or the arrow. Korean or Vietnamese both work. */
function TypeBox({ talk }: { talk: Talk }) {
  const [text, setText] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    talk.sendText(text);
    setText("");
  }
  return (
    <form onSubmit={submit} className="mt-3 flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          talk.typingActivity();
        }}
        lang="ko"
        enterKeyHint="send"
        autoComplete="off"
        disabled={talk.status !== "live"}
        placeholder="Gõ câu trả lời (Hàn hoặc Việt)…"
        aria-label="Câu trả lời của bạn"
        className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-card px-4 text-[15px] font-medium shadow-elev-1 outline-none focus-visible:ring-2 focus-visible:ring-blue"
      />
      <button
        type="submit"
        disabled={!text.trim() || talk.status !== "live"}
        aria-label="Gửi"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue text-primary-foreground shadow-elev-1 active:scale-[0.95] disabled:opacity-50"
      >
        <SendHorizontal size={19} strokeWidth={2.4} />
      </button>
    </form>
  );
}

function Bubble({ turn, hidden }: { turn: ConversationTurn; hidden: boolean }) {
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
          hidden && "select-none blur-sm",
        )}
      >
        {turn.text}
      </p>
    </div>
  );
}

function HintPanel({ hints, lit }: { hints: ConversationStartOut["hints"]; lit: boolean }) {
  const [open, setOpen] = useState(false);
  const show = open || lit;
  if (!hints.words.length && !hints.frames.length) return null;
  return (
    <section
      className={cn(
        "mt-2 rounded-[18px] border px-3.5 py-2.5 transition-colors duration-300",
        lit ? "border-transparent bg-yellow-soft" : "border-line bg-card",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={show}
        className="flex w-full items-center justify-between text-[12px] font-semibold"
      >
        <span className="flex items-center gap-1.5">
          <Lightbulb size={15} className={lit ? "text-ink" : "text-blue"} />
          {lit ? "Gợi ý cho bạn" : "Từ và mẫu câu của bài"}
        </span>
        <span className="text-ink-2">{show ? "Thu gọn" : "Xem"}</span>
      </button>
      {show && (
        <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
          {hints.frames.length > 0 && (
            <ul className="space-y-1">
              {hints.frames.map((f) => (
                <li key={f.ko} className="text-[13px] leading-5">
                  <span lang="ko" className="font-semibold">
                    {f.ko}
                  </span>{" "}
                  <span className="text-ink-2">— {f.vi}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-1.5">
            {hints.words.map((w) => (
              <span
                key={w.ko}
                className="rounded-full bg-card px-2.5 py-1 text-[12px] font-semibold shadow-elev-1"
              >
                <span lang="ko">{w.ko}</span> <span className="font-medium text-ink-2">{w.vi}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ReportView({
  result,
  info,
  note,
  takes,
  onAgain,
}: {
  result: ConversationFinishOut;
  info: ConversationStartOut | null;
  note: string | null;
  takes: SpokenTake[];
  onAgain: () => void;
}) {
  const r = result.report;
  const minutesLeft = info ? Math.floor((info.seconds_left_today - result.seconds) / 60) : 0;
  return (
    <section className="mt-4 space-y-3">
      <header className="flex items-end gap-3">
        <Mascot mood="celebrate" className="h-14 w-14 shrink-0" />
        <div>
          <p className="text-[13px] font-semibold text-ink-2">
            {clock(result.seconds)} · {result.learner_turns} lượt bạn nói
          </p>
          <h1 className="text-xl font-bold leading-tight">Nhận xét của Haru</h1>
        </div>
      </header>

      {note && (
        <p className="rounded-[14px] bg-fill px-3.5 py-2.5 text-[12px] font-semibold text-ink-2">
          {note}
        </p>
      )}

      {!r && (
        <p className="rounded-[18px] border border-line bg-card p-4 text-[13px] font-semibold leading-5">
          {result.report_error_vi ?? "Chưa có nhận xét cho buổi này."}
        </p>
      )}

      {r && <ReportCards report={r} />}

      {result.band_note_vi && <BandNote text={result.band_note_vi} />}

      {takes.length > 0 && <PronunciationSection sessionId={result.session_id} takes={takes} />}

      {r && <SaveToReview sessionId={result.session_id} saved={false} />}

      <div className="flex gap-2 pt-1">
        {minutesLeft >= 1 && (
          <button
            type="button"
            onClick={onAgain}
            className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-blue text-sm font-semibold text-primary-foreground shadow-elev-1"
          >
            <RotateCcw size={16} /> Nói tiếp
          </button>
        )}
        <Link
          to="/speaking"
          className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-line bg-card text-sm font-semibold shadow-elev-1"
        >
          Về Luyện tập
        </Link>
      </div>
    </section>
  );
}

/** Band, time left today and what Haru remembers — with a way to make it forget. */
function ProfilePanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["talk-profile"], queryFn: getTalkProfile, staleTime: 30_000 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const p = q.data;
  if (!p) return null;

  async function forget(index?: number) {
    setBusy(true);
    setErr(null);
    try {
      qc.setQueryData<TalkProfile>(["talk-profile"], await forgetTalkFacts(index));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-3 space-y-3">
      <div className="flex items-start gap-3 rounded-[16px] border border-line bg-card px-4 py-3">
        <Gauge size={18} className="mt-0.5 shrink-0 text-blue" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">
            Mức trò chuyện {p.band}/5 · {p.band_label_vi}
          </p>
          <p className="text-[12px] font-medium leading-4 text-ink-2">{p.band_note_vi}</p>
          <p className="mt-1 text-[12px] font-medium leading-4 text-ink-2">
            Haru tự điều chỉnh sau mỗi 2 buổi theo cách bạn trả lời.
            {p.daily_minutes > 0 &&
              ` Bạn còn ${Math.floor(p.seconds_left_today / 60)} phút nói hôm nay.`}
          </p>
        </div>
      </div>

      {p.facts.length > 0 && (
        <div className="rounded-[16px] border border-line bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Brain size={16} className="text-blue" /> Haru đang nhớ
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void forget()}
              className="hit-area flex items-center gap-1 text-[12px] font-semibold text-danger disabled:opacity-50"
            >
              <Trash2 size={14} /> Xoá hết
            </button>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {p.facts.map((f, i) => (
              <li key={`${f.text}-${i}`} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0 text-[13px] leading-5">{f.text}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void forget(i)}
                  aria-label={`Quên: ${f.text}`}
                  className="hit-area shrink-0 rounded-full p-1 text-ink-2 disabled:opacity-50"
                >
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>
          {err && <p className="mt-1 text-[12px] font-semibold text-danger">{err}</p>}
        </div>
      )}
    </section>
  );
}

/** After the report: a few of the learner's own sentences, listened to again by Haru. The audio
 * leaves the device only for this one check and is not stored. */
function PronunciationSection({ sessionId, takes }: { sessionId: string; takes: SpokenTake[] }) {
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [data, setData] = useState<PronunciationOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const urls = useMemo(
    () =>
      new Map(
        takes.map((t) => [
          t.turn,
          URL.createObjectURL(new Blob([pcmToWav(t.samples)], { type: "audio/wav" })),
        ]),
      ),
    [takes],
  );
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  useEffect(() => {
    let alive = true;
    checkPronunciation(
      sessionId,
      takes.map((t) => ({
        index: t.turn,
        heard: t.text,
        wav_b64: bytesToBase64(pcmToWav(t.samples).buffer),
      })),
    )
      .then((out) => {
        if (!alive) return;
        setData(out);
        setState("done");
      })
      .catch((e) => {
        if (!alive) return;
        setErr(errorMessage(e));
        setState("error");
      });
    return () => {
      alive = false;
    };
  }, [sessionId, takes]);

  return <PronunciationCard data={data} loading={state === "loading"} error={err} ownUrls={urls} />;
}
