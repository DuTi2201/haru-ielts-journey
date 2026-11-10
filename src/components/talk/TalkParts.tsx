import { Link } from "@tanstack/react-router";
import { BookmarkPlus, Check, Gauge, Loader2, Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTextAudio } from "@/hooks/use-text-audio";
import { errorMessage } from "@/lib/api/client";
import {
  saveTalkSession,
  type ConversationReport,
  type PronunciationItem,
  type PronunciationOut,
} from "@/lib/api/conversation";
import { cn } from "@/lib/utils";

/** Pieces shared by the talk screen (/talk), its history (/talk/history, /talk/history/$id) and
 * the progress screen: the report cards, the pronunciation cards and the Trò chuyện | Trình bày | Lịch sử tabs. */

export function clock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function talkDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function scoreTone(score: number) {
  if (score >= 80) return "bg-green-soft text-green";
  if (score >= 55) return "bg-yellow-soft text-ink";
  return "bg-danger-soft text-danger";
}

/** "Trò chuyện | Trình bày | Tranh luận | Lịch sử" under the back link of the talk screens. */
export function TalkTabs({ active }: { active: "talk" | "present" | "debate" | "history" }) {
  const tab = (on: boolean) =>
    cn(
      "flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-full px-1 text-[12px] font-semibold transition-colors",
      on ? "bg-card text-ink shadow-elev-1" : "text-ink-2",
    );
  return (
    <nav aria-label="Trò chuyện với Haru" className="mt-3 flex gap-1 rounded-full bg-fill p-1">
      <Link
        to="/talk"
        aria-current={active === "talk" ? "page" : undefined}
        className={tab(active === "talk")}
      >
        Trò chuyện
      </Link>
      <Link
        to="/talk/present"
        aria-current={active === "present" ? "page" : undefined}
        className={tab(active === "present")}
      >
        Trình bày
      </Link>
      <Link
        to="/talk/debate"
        aria-current={active === "debate" ? "page" : undefined}
        className={tab(active === "debate")}
      >
        Tranh luận
      </Link>
      <Link
        to="/talk/history"
        aria-current={active === "history" ? "page" : undefined}
        className={tab(active === "history")}
      >
        Lịch sử
      </Link>
    </nav>
  );
}

/** Praise, recasts, words to learn and what to try next. */
export function ReportCards({ report: r }: { report: ConversationReport }) {
  return (
    <>
      <div className="rounded-[18px] bg-green-soft p-4">
        <p className="text-[14px] font-semibold leading-6">{r.praise_vi}</p>
        {r.summary_vi && (
          <p className="mt-1 text-[13px] font-medium leading-5 text-ink-2">{r.summary_vi}</p>
        )}
      </div>

      {r.fixes.length > 0 && (
        <div className="rounded-[18px] border border-line bg-card p-4 shadow-elev-1">
          <h2 className="text-[13px] font-semibold">Nói lại cho tự nhiên hơn</h2>
          <ul className="mt-2 space-y-3">
            {r.fixes.map((f, i) => (
              <li key={i} className="text-[14px] leading-6">
                <p lang="ko" className="text-ink-2 line-through decoration-danger/60">
                  {f.said}
                </p>
                <p lang="ko" className="font-semibold text-blue-deep">
                  {f.better}
                </p>
                <p className="text-[12px] font-medium leading-5 text-ink-2">{f.why_vi}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.words.length > 0 && (
        <div className="rounded-[18px] border border-line bg-card p-4 shadow-elev-1">
          <h2 className="text-[13px] font-semibold">Từ nên học thêm</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.words.map((w) => (
              <span
                key={w.ko}
                className="rounded-full bg-blue-soft px-2.5 py-1 text-[13px] font-semibold"
              >
                <span lang="ko">{w.ko}</span> <span className="font-medium text-ink-2">{w.vi}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {r.next_time_vi && (
        <p className="rounded-[18px] bg-yellow-soft p-4 text-[13px] font-semibold leading-5">
          Lần sau thử: {r.next_time_vi}
        </p>
      )}
    </>
  );
}

export function BandNote({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-[18px] bg-blue-soft p-4 text-[13px] font-semibold leading-5">
      <Gauge size={17} className="mt-0.5 shrink-0 text-blue" /> {text}
    </p>
  );
}

/** The pronunciation check of one session. `ownUrls`: the learner's own takes, only right after
 * the session (the audio is not kept anywhere). */
export function PronunciationCard({
  data,
  loading = false,
  error = null,
  ownUrls,
}: {
  data: PronunciationOut | null;
  loading?: boolean;
  error?: string | null;
  ownUrls?: Map<number, string> | undefined;
}) {
  return (
    <div className="rounded-[18px] border border-line bg-card p-4 shadow-elev-1">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold">Phát âm từng câu</h2>
        {data?.average != null && (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
              scoreTone(data.average),
            )}
          >
            TB {Math.round(data.average)}/100
          </span>
        )}
      </div>
      {loading && (
        <p className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-ink-2">
          <Loader2 size={15} className="animate-spin text-blue" /> Haru đang nghe lại giọng bạn…
        </p>
      )}
      {error && <p className="mt-2 text-[12px] font-semibold text-danger">{error}</p>}
      {data && (
        <>
          {data.overall_vi && <p className="mt-1.5 text-[13px] leading-5">{data.overall_vi}</p>}
          <ul className="mt-3 space-y-3">
            {data.items.map((it) => (
              <PronItem key={it.index} item={it} ownUrl={ownUrls?.get(it.index)} />
            ))}
          </ul>
          <p className="mt-3 text-[11px] font-medium leading-4 text-ink-2">
            Điểm do AI nghe lại và ước lượng — để tham khảo, không phải điểm thi. Âm thanh chỉ dùng
            để chấm, không lưu lại.
          </p>
        </>
      )}
    </div>
  );
}

/** "Đưa vào ôn tập": the words Haru suggested and the sentences Haru corrected go to the talk
 * notebook (and words that are lesson cards into the review queue) — never the learner's own
 * wording, right or wrong. */
export function SaveToReview({
  sessionId,
  saved,
  onSaved,
}: {
  sessionId: string;
  saved: boolean;
  onSaved?: () => void;
}) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">(saved ? "done" : "idle");
  const [msg, setMsg] = useState<string | null>(null);
  async function save() {
    setState("saving");
    try {
      const out = await saveTalkSession(sessionId);
      setMsg(
        [
          out.notes_added
            ? `${out.notes_added} mục mới vào Sổ trò chuyện`
            : "Đã có trong Sổ trò chuyện",
          out.added_to_review.length ? `${out.added_to_review.length} từ vào thẻ ôn hôm nay` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
      setState("done");
      onSaved?.();
    } catch (e) {
      setMsg(errorMessage(e));
      setState("error");
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={state === "saving" || state === "done"}
        className={cn(
          "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border text-[13px] font-semibold shadow-elev-1",
          state === "done" ? "border-transparent bg-green-soft text-green" : "border-line bg-card",
        )}
      >
        {state === "saving" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : state === "done" ? (
          <Check size={16} />
        ) : (
          <BookmarkPlus size={16} />
        )}
        {state === "done" ? "Đã đưa vào ôn tập" : "Đưa từ mới và câu đã sửa đúng vào ôn tập"}
      </button>
      {msg && (
        <p
          className={cn(
            "mt-1.5 text-center text-[12px] font-semibold",
            state === "error" ? "text-danger" : "text-ink-2",
          )}
        >
          {msg}
        </p>
      )}
    </div>
  );
}

export function PronItem({
  item,
  ownUrl,
}: {
  item: PronunciationItem;
  ownUrl?: string | undefined;
}) {
  const sample = useTextAudio();
  const [playingOwn, setPlayingOwn] = useState(false);
  const own = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => own.current?.pause(), []);

  function toggleOwn() {
    if (!ownUrl) return;
    if (playingOwn) {
      own.current?.pause();
      setPlayingOwn(false);
      return;
    }
    sample.stop();
    own.current?.pause();
    const a = new Audio(ownUrl);
    a.onended = () => setPlayingOwn(false);
    own.current = a;
    void a.play().then(
      () => setPlayingOwn(true),
      () => setPlayingOwn(false),
    );
  }

  return (
    <li className="rounded-[14px] bg-fill p-3">
      <div className="flex items-start justify-between gap-2">
        <p lang="ko" className="text-[15px] font-semibold leading-6">
          {item.target_ko}
        </p>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums",
            scoreTone(item.score),
          )}
        >
          {item.score}
        </span>
      </div>
      {item.heard_ko && item.heard_ko !== item.target_ko && (
        <p className="text-[12px] font-medium text-ink-2">
          Haru nghe thành: <span lang="ko">{item.heard_ko}</span>
        </p>
      )}
      {item.issues.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {item.issues.map((x, i) => (
            <li key={i} className="text-[12px] leading-5">
              <span lang="ko" className="font-semibold">
                {x.word}
              </span>
              {x.heard_as && (
                <span className="text-ink-2">
                  {" "}
                  → <span lang="ko">{x.heard_as}</span>
                </span>
              )}
              <span className="block">{x.problem_vi}</span>
              <span className="block text-blue-deep">Cách sửa: {x.tip_vi}</span>
            </li>
          ))}
        </ul>
      )}
      {item.good_vi && (
        <p className="mt-1.5 text-[12px] font-medium leading-5 text-green">{item.good_vi}</p>
      )}
      <div className="mt-2 flex gap-2">
        {ownUrl && (
          <button
            type="button"
            onClick={toggleOwn}
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12px] font-semibold"
          >
            {playingOwn ? <Pause size={14} /> : <Play size={14} />} Giọng bạn
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            own.current?.pause();
            setPlayingOwn(false);
            void sample.play(item.target_ko);
          }}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12px] font-semibold"
        >
          {sample.state === "loading" && sample.activeText === item.target_ko ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Volume2 size={14} />
          )}{" "}
          Giọng mẫu
        </button>
      </div>
    </li>
  );
}
