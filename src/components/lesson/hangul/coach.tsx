import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Mic, Pause, Play, Square, Timer, Wind } from "lucide-react";

import { useDrillAudio, type DrillStep } from "@/hooks/use-drill-audio";
import {
  SPEEDS,
  contourOf,
  cueOf,
  glideFrom,
  isVowel,
  mouthOf,
  onsetPitch,
  splitBlock,
  syllables,
  type MouthShape,
  type Pitch,
  type Speed,
} from "@/lib/korean-phonetics";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { Ko } from "../Rich";

/* The pronunciation coach of the alphabet lesson, after the voice-training method of «Master
 * Spoken English» (breath → mouth position → three speeds → patterns): a 60-second warm-up, the
 * mouth drawn from the front and the side, a cue instead of a Vietnamese letter, the pitch a
 * consonant gives, the pitch line of a word, three speeds, pairs heard side by side, a mirror
 * and "say it, then hear yourself next to the model". Everything runs in the browser except the
 * voice, which is the lesson's cached Korean voice. */

// ------------------------------------------------------------------ the mouth --
/** Lips from the front and the tongue from the side, drawn from the sound's phonetics. */
export function MouthDiagram({ jamo, size = 132 }: { jamo: string; size?: number }) {
  const m = mouthOf(jamo);
  if (!m) return null;
  const glide = glideFrom(jamo);
  const g = glide ? mouthOf(glide) : null;
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <Lips m={m} from={g} size={size * 0.62} />
      <Side m={m} size={size} />
    </div>
  );
}

function Lips({ m, from, size }: { m: MouthShape; from: MouthShape | null; size: number }) {
  const w = 22 + m.spread * 22;
  const h = 4 + m.open * 22;
  const lip = (mm: MouthShape, dashed?: boolean) => (
    <ellipse
      cx="40"
      cy="40"
      rx={(22 + mm.spread * 22) / 2 + 6}
      ry={(4 + mm.open * 22) / 2 + 5}
      className={cn(dashed ? "hg-lip-from" : "hg-lip")}
    />
  );
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} className="shrink-0">
      <title>Môi nhìn thẳng</title>
      <circle cx="40" cy="40" r="38" className="hg-face" />
      {from && lip(from, true)}
      {lip(m)}
      <ellipse cx="40" cy="40" rx={w / 2} ry={h / 2} className="hg-mouth-hole" />
      {m.contact === "lips" && <line x1="20" y1="40" x2="60" y2="40" className="hg-contact-line" />}
    </svg>
  );
}

/** A side cut of the mouth: palate on top, the tongue as a curve whose hump follows the vowel, and
 * a dot where a consonant closes. */
function Side({ m, size }: { m: MouthShape; size: number }) {
  // tongue hump: x 30 (front) … 70 (back), y 62 (low) … 40 (high)
  const hx = 30 + m.tongueX * 40;
  const hy = 62 - m.tongueY * 22;
  const contact =
    m.contact === "lips"
      ? { x: 12, y: 46 }
      : m.contact === "ridge"
        ? { x: 27, y: 33 }
        : m.contact === "palate"
          ? { x: 44, y: 28 }
          : m.contact === "velum"
            ? { x: 66, y: 32 }
            : m.contact === "throat"
              ? { x: 80, y: 60 }
              : null;
  const tongue =
    m.contact === "ridge"
      ? "M18 66 C 22 40, 26 35, 28 34 C 40 44, 60 50, 82 70"
      : m.contact === "palate"
        ? "M18 66 C 28 46, 38 30, 46 29 C 58 36, 70 50, 82 70"
        : m.contact === "velum"
          ? "M18 66 C 34 60, 52 44, 64 33 C 72 40, 78 52, 82 70"
          : `M18 66 C 24 ${hy + 6}, ${hx - 10} ${hy}, ${hx} ${hy} C ${hx + 10} ${hy}, 78 ${hy + 10}, 82 70`;
  const jaw = 4 + m.open * 10;
  return (
    <svg viewBox="0 0 96 84" width={size} height={size * 0.875} className="shrink-0">
      <title>Lưỡi nhìn nghiêng</title>
      <path d="M10 30 Q 12 22, 22 22 L 30 24 Q 50 14, 70 22 Q 80 26, 86 34" className="hg-palate" />
      <path
        d={`M10 ${44 + jaw} Q 14 ${54 + jaw}, 26 ${60 + jaw} L 70 ${72} Q 82 ${74}, 88 ${76}`}
        className="hg-jaw"
      />
      <path d={tongue} className="hg-tongue" />
      {/* teeth and lips */}
      <rect x="18" y="24" width="4" height="7" rx="1" className="hg-tooth" />
      <rect x="18" y={40 + jaw} width="4" height="7" rx="1" className="hg-tooth" />
      <path d={`M8 ${30} q -6 4, 0 8`} className="hg-lipline" />
      <path d={`M8 ${44 + jaw} q -6 4, 0 8`} className="hg-lipline" />
      {contact && <circle cx={contact.x} cy={contact.y} r="4.5" className="hg-contact" />}
      {m.air === "nose" && <path d="M40 18 q 6 -10, 16 -12" className="hg-air" />}
      {(m.air === "puff" || m.air === "hiss") && (
        <path d="M6 36 h-5 M6 42 h-6 M6 48 h-5" className="hg-air" />
      )}
    </svg>
  );
}

// ------------------------------------------------------------------ pitch --
const PITCH_TEXT: Record<Pitch, string> = { low: "Giọng trầm", high: "Giọng cao" };

export function PitchBadge({ pitch }: { pitch: Pitch }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        pitch === "high" ? "bg-yellow-soft" : "bg-blue-soft",
      )}
    >
      <span aria-hidden="true" className="flex h-3 items-end gap-[2px]">
        <span
          className="w-[3px] rounded-sm bg-current"
          style={{ height: pitch === "high" ? 4 : 5 }}
        />
        <span
          className="w-[3px] rounded-sm bg-current"
          style={{ height: pitch === "high" ? 12 : 5 }}
        />
      </span>
      {PITCH_TEXT[pitch]}
    </span>
  );
}

/** The word's syllables on two rows: high ones up, low ones down, joined by a line. */
export function ContourLine({ word, active }: { word: string; active?: number | null }) {
  const syl = syllables(word);
  const tones = contourOf(word);
  if (syl.length < 2) return null;
  const step = 34;
  const ys = tones.map((t) => (t === "high" ? 10 : 34));
  return (
    <svg
      viewBox={`0 0 ${syl.length * step + 8} 50`}
      width={syl.length * step + 8}
      height={50}
      role="img"
      aria-label={`Cao độ: ${tones.map((t) => (t === "high" ? "cao" : "thấp")).join(", ")}`}
      className="max-w-full"
    >
      <polyline
        points={ys.map((y, i) => `${i * step + 20},${y + 6}`).join(" ")}
        className="hg-contour"
      />
      {syl.map((s, i) => (
        <text
          key={i}
          x={i * step + 20}
          y={ys[i]! + 12}
          textAnchor="middle"
          className={cn("hg-contour-syl", active === i && "hg-contour-on")}
        >
          {s}
        </text>
      ))}
    </svg>
  );
}

// ------------------------------------------------------------------ three speeds --
/** A word or syllable at three speeds: 1 = block by block of how it is SAID, slow; 2 = joined,
 * a little slow; 3 = natural. `say` is the pronounced form (학생 → 학쌩), so speed 1 already says
 * the sound change. */
export function SpeedDrill({ text, say }: { text: string; say?: string | null | undefined }) {
  const drill = useDrillAudio();
  const spoken = (say ?? text).replace(/[[\]]/g, "");
  const syl = syllables(spoken);
  const [speed, setSpeed] = useState<Speed | null>(null);

  function steps(s: Speed): DrillStep[] {
    if (s === 1 && syl.length > 1)
      return syl.map((c, i) => ({ text: c, rate: 0.75, gapMs: 280, mark: `s${i}` }));
    const r = SPEEDS.find((x) => x.id === s)!.rate;
    return [{ text: spoken, rate: r, mark: "all" }];
  }
  const activeSyl = drill.mark?.startsWith("s") ? Number(drill.mark.slice(1)) : null;

  return (
    <div className="mt-2">
      <ContourLine word={spoken} active={activeSyl} />
      <div role="group" aria-label="Luyện 3 tốc độ" className="mt-1 grid grid-cols-3 gap-1.5">
        {SPEEDS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              tap();
              setSpeed(s.id);
              void drill.play(steps(s.id));
            }}
            className={cn(
              "hit-area flex min-h-12 flex-col items-center justify-center rounded-[12px] border border-line bg-card px-1 text-center active:scale-95",
              speed === s.id && drill.busy && "border-blue bg-blue-soft",
            )}
          >
            <span className="text-[12px] font-bold">
              {s.id}. {s.label}
            </span>
            <span className="text-[10.5px] leading-3 text-ink-2">{s.hint}</span>
          </button>
        ))}
      </div>
      {syl.length > 1 && (
        <p className="mt-1 text-center text-[13px]" aria-live="polite">
          {syl.map((c, i) => (
            <Ko
              key={i}
              className={cn(
                "mx-1 inline-block transition-transform",
                activeSyl === i && "scale-125 font-bold text-blue-deep",
              )}
            >
              {c}
            </Ko>
          ))}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ mirror & recorder --
/** The front camera next to the drawing, so the learner sees their own mouth. Nothing is stored. */
export function Mirror() {
  const video = useRef<HTMLVideoElement | null>(null);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => {
        setErr("Không mở được camera.");
        setOn(false);
      });
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [on]);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setErr(null);
          setOn((v) => !v);
        }}
        className="hit-area inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12px] font-semibold"
      >
        {on ? <CameraOff size={14} /> : <Camera size={14} />}
        {on ? "Tắt gương" : "Soi gương"}
      </button>
      {on && (
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          className="mt-2 aspect-[4/3] w-40 -scale-x-100 rounded-[14px] bg-ink object-cover"
        />
      )}
      {err && <p className="mt-1 text-[12px] text-danger">{err}</p>}
    </div>
  );
}

/** Hold to say it; let go to hear the model and then yourself, side by side. Nothing leaves the device. */
export function SayAndCompare({ text }: { text: string }) {
  const drill = useDrillAudio();
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [state, setState] = useState<"idle" | "rec" | "play" | "denied">("idle");
  const [mine, setMine] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (mine) URL.revokeObjectURL(mine);
    },
    [mine],
  );

  async function start() {
    tap();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const url = URL.createObjectURL(new Blob(chunks.current, { type: r.mimeType }));
        setMine(url);
        setState("play");
        await drill.play([{ text, gapMs: 350 }]);
        const a = new Audio(url);
        a.onended = () => setState("idle");
        void a.play().catch(() => setState("idle"));
      };
      rec.current = r;
      r.start();
      setState("rec");
      setTimeout(() => r.state === "recording" && r.stop(), 4000);
    } catch {
      setState("denied");
    }
  }
  function end() {
    if (rec.current?.state === "recording") rec.current.stop();
  }

  return (
    <div>
      <button
        type="button"
        onPointerDown={() => void start()}
        onPointerUp={end}
        onPointerLeave={end}
        className={cn(
          "hit-area inline-flex min-h-10 select-none items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold",
          state === "rec" ? "bg-danger text-white" : "border border-line bg-card",
        )}
      >
        {state === "rec" ? <Square size={14} /> : <Mic size={14} />}
        {state === "rec"
          ? "Đang thu… thả tay để nghe"
          : state === "play"
            ? "Mẫu → giọng bạn"
            : "Giữ để nói, thả để so"}
      </button>
      {state === "denied" && (
        <p className="mt-1 text-[12px] text-danger">
          Hãy cho phép dùng micro để tự nghe giọng mình.
        </p>
      )}
      {mine && state === "idle" && (
        <button
          type="button"
          onClick={() => {
            setState("play");
            void drill.play([{ text, gapMs: 350 }]).then(() => {
              const a = new Audio(mine);
              a.onended = () => setState("idle");
              void a.play().catch(() => setState("idle"));
            });
          }}
          className="ml-2 text-[12px] font-semibold text-blue-deep underline"
        >
          Nghe lại
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ one sound, up close --
/** What opens under a tapped letter: the mouth, the cue, the pitch, three speeds, mirror, recorder. */
export function SoundCoach({
  jamo,
  example,
  showVi,
  vi,
}: {
  jamo: string;
  example: string;
  showVi: boolean;
  vi: string;
}) {
  const cue = cueOf(jamo);
  const pitch = isVowel(jamo) ? null : onsetPitch(jamo);
  const block = splitBlock(example);
  return (
    <div className="hg-coach mt-2 rounded-[18px] border border-blue/30 bg-blue-soft/50 p-3 animate-in fade-in duration-200 motion-reduce:animate-none">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <Ko className="text-[44px] font-bold leading-[48px]">{jamo}</Ko>
          {block && block.ch !== jamo && <Ko className="text-[15px] text-ink-2">{example}</Ko>}
        </div>
        <MouthDiagram jamo={jamo} />
      </div>
      {cue && <p className="mt-2 text-[14px] font-semibold leading-5">👄 {cue}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {pitch && <PitchBadge pitch={pitch} />}
        {showVi && (
          <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-ink-2">
            Mốc chữ Việt: {vi}
          </span>
        )}
      </div>
      <SpeedDrill text={example} />
      <div className="mt-2.5 flex flex-wrap items-start gap-2">
        <SayAndCompare text={example} />
        <Mirror />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ warm-up --
const WARM: { icon: string; title: string; body: string; secs: number }[] = [
  {
    icon: "🧘",
    title: "Thả lỏng vai, cổ",
    body: "Nhún vai lên thật cao rồi thả rơi xuống 3 lần. Xoay cổ chậm một vòng.",
    secs: 15,
  },
  {
    icon: "🫁",
    title: "Thở bằng bụng",
    body: "Đặt tay lên bụng. Hít vào bằng mũi cho bụng phồng lên, thở ra chậm bằng miệng «sss…».",
    secs: 20,
  },
  {
    icon: "😮",
    title: "Thả rơi cằm",
    body: "Đặt hai ngón tay ở khớp hàm (trước tai), há miệng như ngáp. Tiếng Hàn mở miệng theo chiều DỌC nhiều hơn tiếng Việt.",
    secs: 15,
  },
  {
    icon: "🎵",
    title: "Giọng phẳng, không dấu",
    body: "Tiếng Hàn không có dấu sắc, huyền, hỏi, ngã. Nói «아—» một hơi đều, không lên không xuống.",
    secs: 10,
  },
];

/** Lông 0: a one-minute warm-up before the first sound (breath, shoulders, jaw, a flat voice). */
export function WarmUp() {
  const [step, setStep] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (step === null) return;
    setLeft(WARM[step]!.secs);
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [step]);
  useEffect(() => {
    if (step !== null && left <= 0 && left !== WARM[step]!.secs) {
      setStep(step + 1 < WARM.length ? step + 1 : null);
    }
  }, [left, step]);
  return (
    <section
      aria-label="Khởi động 60 giây"
      className="rounded-[20px] border border-line bg-card p-3.5 shadow-elev-1"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[15px] font-bold">
          <Wind size={18} className="text-blue" /> Khởi động 60 giây
        </h3>
        <button
          type="button"
          onClick={() => {
            tap();
            setStep(step === null ? 0 : null);
          }}
          className="hit-area inline-flex min-h-10 items-center gap-1 rounded-full bg-blue px-3 text-[12px] font-semibold text-white"
        >
          {step === null ? <Play size={14} /> : <Pause size={14} />}
          {step === null ? "Bắt đầu" : "Dừng"}
        </button>
      </div>
      <p className="mt-1 text-[12.5px] leading-5 text-ink-2">
        Người đọc tin, diễn viên Hàn đều khởi động trước khi nói. Làm theo từng bước, mỗi bước vài
        giây.
      </p>
      <ol className="mt-2 space-y-1.5">
        {WARM.map((w, i) => (
          <li
            key={w.title}
            className={cn(
              "flex gap-2.5 rounded-[14px] px-2.5 py-2 transition-colors",
              step === i ? "bg-blue-soft" : "bg-paper",
            )}
          >
            <span
              className={cn(
                "text-[24px] leading-7",
                step === i && "animate-bounce motion-reduce:animate-none",
              )}
              aria-hidden="true"
            >
              {w.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[13px] font-bold">
                {i + 1}. {w.title}
                {step === i && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-deep">
                    <Timer size={11} /> {Math.max(left, 0)}s
                  </span>
                )}
              </p>
              <p className="text-[12.5px] leading-5 text-ink-2">{w.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------------ pairs --
export interface PairSet {
  title: string;
  items: string[];
  hint: string;
}

/** Sounds that are easy to mix up, heard one after another in one go, with their pitch and mouth. */
export function PairDrill({ sets }: { sets: PairSet[] }) {
  const drill = useDrillAudio();
  return (
    <div className="space-y-2.5">
      {sets.map((set) => (
        <div key={set.title} className="rounded-[16px] border border-line bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13.5px] font-bold">{set.title}</p>
            <button
              type="button"
              onClick={() => {
                tap();
                void drill.play(
                  [...set.items, ...set.items].map((t) => ({ text: t, rate: 0.85, gapMs: 450 })),
                );
              }}
              className="hit-area inline-flex min-h-9 items-center gap-1 rounded-full bg-blue px-3 text-[12px] font-semibold text-white"
            >
              <Play size={13} /> Nghe liền nhau
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {set.items.map((t) => {
              const b = splitBlock(t);
              const p = b ? (isVowel(b.initial) ? null : onsetPitch(b.initial)) : null;
              const jam = b ? (b.initial === "ㅇ" ? b.vowel : b.initial) : t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => void drill.play([{ text: t, rate: 0.85 }])}
                  className={cn(
                    "flex min-w-[88px] flex-col items-center rounded-[14px] border border-line px-2 py-1.5 active:scale-95",
                    drill.mark === t ? "border-blue bg-blue-soft" : "bg-paper",
                  )}
                >
                  <Ko className="text-[26px] font-bold leading-8">{t}</Ko>
                  <MouthDiagram jamo={jam} size={62} />
                  {p && b?.initial !== "ㅇ" && <PitchBadge pitch={p} />}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-5 text-ink-2">{set.hint}</p>
        </div>
      ))}
    </div>
  );
}
