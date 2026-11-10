import { useEffect, useRef, useState, type CSSProperties } from "react";

import celebrate from "@/assets/mascot/celebrate.webp";
import cheer from "@/assets/mascot/cheer.webp";
import comfort from "@/assets/mascot/comfort.webp";
import excited from "@/assets/mascot/excited.webp";
import idea from "@/assets/mascot/idea.webp";
import listening from "@/assets/mascot/listening.webp";
import morning from "@/assets/mascot/morning.webp";
import music from "@/assets/mascot/music.webp";
import proud from "@/assets/mascot/proud.webp";
import reading from "@/assets/mascot/reading.webp";
import sad from "@/assets/mascot/sad.webp";
import sleep from "@/assets/mascot/sleep.webp";
import thinking from "@/assets/mascot/thinking.webp";
import tired from "@/assets/mascot/tired.webp";
import waveBlink from "@/assets/mascot/wave-blink.webp";
import wave from "@/assets/mascot/wave.webp";
import writing from "@/assets/mascot/writing.webp";
import { cn } from "@/lib/utils";

import "./mascot.css";

/**
 * Haru's mascot: the white swan with the striped scarf. It lives INSIDE the learning (empty
 * screens, feedback, the live talk, nudges); the line-art swan with "Haru" written through it is
 * the LOGO (components/site/HaruLogo) and never stands in for it, nor the other way round.
 *
 * Each mood is a short loop of two drawings of the same expression (src/assets/mascot, cut out of
 * the owner's artwork) shown in turn like a sticker, plus its own light, motion and effects
 * (mascot.css). Images load only when a mood is shown.
 */
export type MascotMood =
  | "wave" // hello, sign in, default (blinks)
  | "cheer" // encouragement, Haru talking
  | "celebrate" // finished, a good score, a goal reached (the crown)
  | "comfort" // a wrong answer, an error, not allowed: "it's okay"
  | "listening" // Haru listens while the learner speaks; listening practice
  | "thinking" // nothing here yet, a question, a tip
  | "morning" // today's plan, the daily habit
  | "reading" // reading, a lesson, writing practice, something being prepared
  | "sleep"; // come back tomorrow (a daily limit), offline

type Motion = "bob" | "hop" | "sway" | "groove" | "tilt" | "breathe" | "scribble";
type Fx = "stars" | "rings" | "rays" | "confetti" | "drops" | "zzz" | "spark";

interface MoodSpec {
  frames: [string] | [string, string];
  /** one loop of the two frames */
  beat?: string;
  glow: string;
  motion: Motion;
  fx?: Fx;
  label: string;
}

const MOODS: Record<MascotMood, MoodSpec> = {
  wave: { frames: [wave], glow: "var(--blue)", motion: "bob", label: "Haru vẫy chào" },
  cheer: {
    frames: [cheer, excited],
    beat: "1s",
    glow: "var(--green)",
    motion: "hop",
    fx: "stars",
    label: "Haru cổ vũ",
  },
  celebrate: {
    frames: [celebrate, proud],
    beat: "0.8s",
    glow: "var(--yellow-strong)",
    motion: "hop",
    fx: "confetti",
    label: "Haru ăn mừng",
  },
  comfort: {
    frames: [comfort, sad],
    beat: "2.6s",
    glow: "var(--blue)",
    motion: "sway",
    fx: "drops",
    label: "Haru an ủi: không sao đâu",
  },
  listening: {
    frames: [listening, music],
    beat: "1.1s",
    glow: "var(--green)",
    motion: "groove",
    fx: "rings",
    label: "Haru đang nghe",
  },
  thinking: {
    frames: [thinking, idea],
    beat: "2.4s",
    glow: "var(--purple)",
    motion: "tilt",
    fx: "spark",
    label: "Haru đang nghĩ",
  },
  morning: {
    frames: [morning],
    glow: "var(--yellow-strong)",
    motion: "bob",
    fx: "rays",
    label: "Haru chào ngày mới",
  },
  reading: {
    frames: [reading, writing],
    beat: "2.2s",
    glow: "var(--blue)",
    motion: "scribble",
    label: "Haru đang học",
  },
  sleep: {
    frames: [sleep, tired],
    beat: "3.2s",
    glow: "var(--purple)",
    motion: "breathe",
    fx: "zzz",
    label: "Haru đang ngủ",
  },
};

const STARS: CSSProperties[] = [
  { top: "2%", left: "4%", animationDelay: "0s" },
  { top: "14%", right: "0%", animationDelay: "0.7s" },
  { top: "44%", left: "-2%", animationDelay: "1.3s", width: "10%" },
];
const SPARK: CSSProperties[] = [
  { top: "0%", right: "6%", animationDelay: "0s", width: "12%" },
  { top: "18%", right: "-2%", animationDelay: "1.1s", width: "8%" },
];
const BITS = [
  { left: "6%", c: "var(--yellow-strong)", d: "0s" },
  { left: "20%", c: "var(--blue)", d: "0.9s" },
  { left: "34%", c: "var(--danger)", d: "1.7s" },
  { left: "62%", c: "var(--green)", d: "0.4s" },
  { left: "78%", c: "var(--yellow-strong)", d: "1.3s" },
  { left: "90%", c: "var(--purple)", d: "2.1s" },
];

function Effects({ fx }: { fx: Fx | undefined }) {
  if (!fx) return null;
  if (fx === "rays") return <span className="mascot-rays" aria-hidden="true" />;
  return (
    <span className="mascot-fx" aria-hidden="true">
      {fx === "stars" && STARS.map((s, i) => <span key={i} className="mascot-star" style={s} />)}
      {fx === "spark" && SPARK.map((s, i) => <span key={i} className="mascot-star" style={s} />)}
      {fx === "rings" && (
        <>
          <span className="mascot-ring" />
          <span className="mascot-ring" style={{ animationDelay: "0.9s" }} />
        </>
      )}
      {fx === "confetti" &&
        BITS.map((b) => (
          <span
            key={b.left}
            className="mascot-bit"
            style={{ left: b.left, background: b.c, animationDelay: b.d }}
          />
        ))}
      {fx === "drops" && (
        <>
          <span className="mascot-drop" style={{ left: "12%" }} />
          <span className="mascot-drop" style={{ left: "84%", animationDelay: "1.4s" }} />
        </>
      )}
      {fx === "zzz" && (
        <>
          <span className="mascot-z">z</span>
          <span className="mascot-z" style={{ animationDelay: "1.7s", fontSize: "14cqmin" }}>
            z
          </span>
        </>
      )}
    </span>
  );
}

export function Mascot({
  mood = "wave",
  className = "h-16 w-16",
  still = false,
  label,
  interactive = false,
  tapMood = "cheer",
}: {
  mood?: MascotMood;
  /** the box (height and width); the swan stands on its bottom edge */
  className?: string | undefined;
  /** no motion and no effects (a mascot in a long list, a print view) */
  still?: boolean;
  /** what a screen reader says; the mood's own words by default */
  label?: string | undefined;
  /** a tap (or Enter) makes it react for a moment */
  interactive?: boolean;
  /** how it reacts to a tap */
  tapMood?: MascotMood;
}) {
  const [reacting, setReacting] = useState(false);
  const shown: MascotMood = reacting ? tapMood : mood;
  const m = MOODS[shown];
  // a new mood pops in; the first one does not (no flash when a page opens)
  const first = useRef(true);
  const [entering, setEntering] = useState(false);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setEntering(true);
    const t = window.setTimeout(() => setEntering(false), 340);
    return () => window.clearTimeout(t);
  }, [shown]);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const react = () => {
    setReacting(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setReacting(false), 1800);
  };
  const [a, b] = m.frames;

  return (
    <span
      role={interactive ? "button" : "img"}
      tabIndex={interactive ? 0 : undefined}
      aria-label={label ?? m.label}
      data-mood={shown}
      data-motion={still ? undefined : m.motion}
      data-interactive={interactive || undefined}
      onClick={interactive ? react : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                react();
              }
            }
          : undefined
      }
      className={cn("mascot shrink-0", className)}
      style={{ "--glow": m.glow, "--beat": m.beat ?? "2s" } as CSSProperties}
    >
      <span className="mascot-glow" aria-hidden="true" />
      {!still && <Effects fx={m.fx} />}
      <span className={cn("mascot-body", entering && "mascot-enter")}>
        <img
          src={a}
          alt=""
          className={cn("mascot-img", b && !still && "mascot-frame-a")}
          draggable={false}
          decoding="async"
        />
        {b && !still && (
          <img
            src={b}
            alt=""
            className="mascot-img mascot-frame-b"
            draggable={false}
            decoding="async"
          />
        )}
        {shown === "wave" && !still && (
          <img
            src={waveBlink}
            alt=""
            className="mascot-img mascot-blink"
            draggable={false}
            decoding="async"
          />
        )}
      </span>
    </span>
  );
}
