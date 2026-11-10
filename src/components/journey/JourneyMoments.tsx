import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import type { JourneyOut } from "@/lib/api/types";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { asStage, CASTLE, CROW, PROP, RIBBON, STAGES } from "./assets";
import { relicOf } from "./feather-data";
import { RelicMedallion } from "./Feathers";
import { ROMAN, SwanFigure, SwordGleam } from "./Journey";
import { EnchantedRose, PETALS, restingSpot } from "./Relics";

/* The moments of the journey, each played once on a device:
 * - a new stage: a flash of light, falling feathers, the new swan and its castle;
 * - the last petal: the curse falls, the last petal of the enchanted rose drops under its glass;
 * - the rose reborn: the curse is broken, the fallen petals fly back up to the rose;
 * - the crows driven off: the learner came back after days away and studied today;
 * - the shield: the weekly streak shield took a day off for the learner, the crows bounce off it;
 * - a chapter finished is a transformation: the old swan, a flash, the new one (the blindfold falls,
 *   the sword is taken up, the crown);
 * - the station of chapter III (the far shore), a relic earned, the swan sparkling brighter.
 * The first visit tells the story in one screen. What was last shown is kept in this browser. */

const KEY = "haru.journey.v1";

interface Seen {
  stage: number;
  missed: number;
  cursed?: boolean;
  shield?: string | null;
  station?: boolean;
  sparkle?: number;
  relics?: string[];
}

function read(): Seen | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Seen) : null;
  } catch {
    return null;
  }
}

function write(v: Seen) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage blocked: the moment may play again next time */
  }
}

type Moment =
  | { kind: "intro" | "stage"; stage: number; from?: number; becomes?: string | undefined }
  | { kind: "station"; stage: number }
  | { kind: "relic"; stage: number; code: string; name: string | null }
  | { kind: "sparkle"; stage: number; level: number }
  | { kind: "fall" | "reborn"; stage: number }
  | { kind: "crows" }
  | { kind: "shield" }
  | null;

export function JourneyMoments({ journey }: { journey: JourneyOut | null | undefined }) {
  const [moment, setMoment] = useState<Moment>(null);
  // one moment at a time: the next one waits until this one is closed
  const busy = useRef(false);
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    if (!journey || busy.current) return;
    const seen = read();
    const now: Seen = {
      stage: journey.stage,
      missed: journey.missed_days,
      cursed: journey.cursed,
      shield: journey.shield_day ?? null,
      station: !!journey.station,
      sparkle: journey.sparkle ?? 0,
      relics: journey.relics ?? [],
    };
    const newRelic = (journey.relics ?? []).find((r) => !(seen?.relics ?? []).includes(r));
    let m: Moment = null;
    if (!seen) m = { kind: "intro", stage: journey.shown_stage };
    else if (journey.stage > seen.stage)
      m = {
        kind: "stage",
        stage: journey.stage,
        from: seen.stage,
        becomes: journey.chapters?.find((c) => c.n === journey.stage - 1)?.becomes,
      };
    else if (journey.station && !seen.station && journey.stage === 3)
      m = { kind: "station", stage: journey.shown_stage };
    else if (newRelic && !journey.cursed)
      m = {
        kind: "relic",
        stage: journey.shown_stage,
        code: newRelic,
        name: journey.constellations?.find((c) => c.code === newRelic)?.relic ?? null,
      };
    else if ((journey.sparkle ?? 0) > (seen.sparkle ?? 0) && !journey.cursed)
      m = { kind: "sparkle", stage: journey.shown_stage, level: journey.sparkle ?? 0 };
    else if (journey.cursed && !seen.cursed) m = { kind: "fall", stage: journey.shown_stage };
    else if (seen.cursed && !journey.cursed) m = { kind: "reborn", stage: journey.shown_stage };
    else if (journey.shield_day && journey.shield_day !== (seen.shield ?? null) && !journey.cursed)
      m = { kind: "shield" };
    else if (seen.missed > 0 && journey.missed_days === 0 && journey.studied_today)
      m = { kind: "crows" };
    if (m) {
      busy.current = true;
      setMoment(m);
    }
    // the achievements wait their turn: only the one shown is marked as seen (a first visit sees
    // the story and starts from now)
    write(
      seen
        ? {
            ...now,
            station: m?.kind === "station" ? true : (seen.station ?? false),
            sparkle: m?.kind === "sparkle" ? m.level : (seen.sparkle ?? 0),
            relics: m?.kind === "relic" ? [...(seen.relics ?? []), m.code] : (seen.relics ?? []),
          }
        : now,
    );
  }, [journey, turn]);

  if (!moment) return null;
  const close = () => {
    busy.current = false;
    setMoment(null);
    setTurn((t) => t + 1);
  };
  if (moment.kind === "crows") return <CrowsFlee onDone={close} />;
  if (moment.kind === "shield") return <ShieldMoment onDone={close} />;
  if (moment.kind === "fall" || moment.kind === "reborn")
    return <RoseMoment stage={moment.stage} reborn={moment.kind === "reborn"} onClose={close} />;
  if (moment.kind === "station")
    return (
      <SmallMoment
        stage={moment.stage}
        eyebrow="Chương III · giữa đường"
        title="Đã thấy bờ xa"
        line="Lâu đài đã hiện ra. Xong Công sở là xong Trung cấp."
        onClose={close}
        lantern
      />
    );
  if (moment.kind === "relic") {
    const r = relicOf(moment.code, moment.name);
    return (
      <SmallMoment
        stage={moment.stage}
        eyebrow="Bảo vật mới"
        title={r.name}
        line={r.line || "Xong một chủ đề bổ trợ. Bảo vật đứng cạnh thiên nga."}
        onClose={close}
        emblem={<RelicMedallion code={moment.code} name={moment.name} size={76} />}
      />
    );
  }
  if (moment.kind === "sparkle")
    return (
      <SmallMoment
        stage={moment.stage}
        eyebrow="Lông ánh sao"
        title={`Lấp lánh bậc ${moment.level}`}
        line={
          moment.level >= 3
            ? "Ánh sao phủ kín đôi cánh. Sáng nhất rồi!"
            : "Bài bổ trợ giữ lại ánh sao trên lông thiên nga."
        }
        onClose={close}
        sparkle={moment.level}
      />
    );
  return (
    <StageMoment
      stage={moment.stage}
      from={moment.kind === "stage" ? moment.from : undefined}
      becomes={moment.kind === "stage" ? moment.becomes : undefined}
      intro={moment.kind === "intro"}
      onClose={close}
    />
  );
}

/** A smaller moment of the journey: the swan, what was won, one line. */
function SmallMoment({
  stage,
  eyebrow,
  title,
  line,
  onClose,
  emblem,
  sparkle = 0,
  lantern = false,
}: {
  stage: number;
  eyebrow: string;
  title: string;
  line: string;
  onClose: () => void;
  emblem?: ReactNode;
  sparkle?: number;
  lantern?: boolean;
}) {
  const s = asStage(stage);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="jr-small-title"
      className="jr-moment jr-letterbox"
    >
      <img
        src={CASTLE[s].day}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-45"
        aria-hidden="true"
      />
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,transparent,oklch(0.08_0.03_285/0.88)_70%)]" />
      {lantern && <span className="jr-lantern" aria-hidden="true" />}
      <div className="relative z-[1] mx-auto flex max-w-[420px] flex-col items-center px-6 text-center">
        <p className="jr-rise jr-chapter" style={{ "--d": "0.2s" } as CSSProperties}>
          {eyebrow}
        </p>
        <h2
          id="jr-small-title"
          className="jr-rise jr-display mt-2"
          style={{ "--d": "0.35s" } as CSSProperties}
        >
          {title}
        </h2>
        <span
          className="jr-rise relative mt-4 flex items-end gap-2"
          style={{ "--d": "0.5s" } as CSSProperties}
        >
          <SwanFigure stage={s} sparkle={sparkle} className="h-48 w-48" />
          {emblem && <span className="jr-relic-float -ml-6">{emblem}</span>}
        </span>
        <p className="jr-rise jr-story mt-3" style={{ "--d": "0.7s" } as CSSProperties}>
          {line}
        </p>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="jr-rise mt-6 inline-flex min-h-12 items-center justify-center rounded-[16px] bg-card px-7 text-[15px] font-bold text-blue-deep shadow-elev-2 active:scale-[0.97]"
          style={{ "--d": "0.9s" } as CSSProperties}
        >
          Tiếp tục hành trình
        </button>
      </div>
    </div>
  );
}

const FEATHERS = Array.from({ length: 18 }, (_, n) => ({
  left: `${(n * 53) % 100}%`,
  delay: `${(n % 6) * 0.45}s`,
  fall: `${3.2 + (n % 5) * 0.6}s`,
  drift: `${((n % 7) - 3) * 22}px`,
  spin: `${180 + (n % 4) * 70}deg`,
}));

function StageMoment({
  stage,
  from,
  becomes,
  intro,
  onClose,
}: {
  stage: number;
  from?: number | undefined;
  becomes?: string | undefined;
  intro: boolean;
  onClose: () => void;
}) {
  const s = asStage(stage);
  const st = STAGES[s];
  // a chapter finished: the old swan first, then the light, then the new one
  const prev = !intro && from !== undefined && from < s ? asStage(from) : null;
  const [changed, setChanged] = useState(prev === null);
  useEffect(() => {
    if (prev === null) return;
    const t = window.setTimeout(() => setChanged(true), prefersReducedMotion() ? 0 : 1500);
    return () => window.clearTimeout(t);
  }, [prev]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="jr-moment-title"
      className={cn("jr-moment", !intro && "jr-letterbox")}
    >
      <img
        src={CASTLE[s].day}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-55"
        aria-hidden="true"
      />
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,transparent,oklch(0.08_0.03_285/0.85)_70%)]" />
      {!intro && changed && <span className="jr-flash" aria-hidden="true" />}
      {prev !== null && !changed && s === 2 && (
        <img src={RIBBON} alt="" className="jr-ribbon" aria-hidden="true" />
      )}
      {!intro &&
        changed &&
        FEATHERS.map((f) => (
          <span
            key={f.left + f.delay}
            className="jr-feather"
            aria-hidden="true"
            style={
              {
                left: f.left,
                "--delay": f.delay,
                "--fall": f.fall,
                "--drift": f.drift,
                "--spin": f.spin,
              } as CSSProperties
            }
          />
        ))}
      <div
        key={String(changed)}
        className="relative z-[1] mx-auto flex max-w-[420px] flex-col items-center px-6 text-center"
      >
        <p className="jr-rise jr-chapter" style={{ "--d": "0.2s" } as CSSProperties}>
          {intro
            ? "Hành trình Thiên Nga"
            : !changed && becomes
              ? becomes
              : `Chương ${ROMAN[s]} · ${st.mood}`}
        </p>
        <h2
          id="jr-moment-title"
          className="jr-rise jr-display mt-2"
          style={{ "--d": "0.35s" } as CSSProperties}
        >
          {intro
            ? "Bạn là một thiên nga đang chờ phá lời nguyền"
            : prev !== null && !changed
              ? STAGES[prev].name
              : st.name}
        </h2>
        <span className="jr-rise relative" style={{ "--d": "0.5s" } as CSSProperties}>
          {prev !== null && !changed ? (
            <SwanFigure key="before" stage={prev} still className="jr-before mt-4 h-52 w-52" />
          ) : (
            <span key="after" className={cn("relative block", prev !== null && "jr-after")}>
              <SwanFigure stage={s} className="mt-4 h-52 w-52" />
              {s === 4 && prev !== null && (
                <span className="absolute inset-0" aria-hidden="true">
                  <SwordGleam x={78} y={22} on />
                </span>
              )}
            </span>
          )}
        </span>
        <p className="jr-rise jr-story mt-3" style={{ "--d": "0.7s" } as CSSProperties}>
          {intro
            ? "Mỗi phần bài học xong là một lông trắng mọc lại; xong một trình độ, thiên nga đổi hình. Mỗi ngày vắng, hoa hồng rơi một cánh và quạ kéo về. Mỗi tuần có một khiên đỡ một ngày bận."
            : prev !== null && !changed
              ? "…"
              : st.line}
        </p>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="jr-rise mt-6 inline-flex min-h-12 items-center justify-center rounded-[16px] bg-card px-7 text-[15px] font-bold text-blue-deep shadow-elev-2 active:scale-[0.97]"
          style={{ "--d": "0.9s" } as CSSProperties}
        >
          {intro ? "Bắt đầu hành trình" : "Tiếp tục hành trình"}
        </button>
      </div>
    </div>
  );
}

const FLEE = [
  { top: "30%", left: "20%", fx: "-220px", fy: "-260px", delay: "0s" },
  { top: "40%", left: "70%", fx: "240px", fy: "-220px", delay: "0.1s" },
  { top: "55%", left: "35%", fx: "-260px", fy: "-160px", delay: "0.2s" },
  { top: "25%", left: "55%", fx: "200px", fy: "-300px", delay: "0.05s" },
  { top: "60%", left: "62%", fx: "280px", fy: "-120px", delay: "0.25s" },
];

/** The crows scatter: the learner came back. */
function CrowsFlee({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, prefersReducedMotion() ? 2200 : 2600);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-0 z-[70]">
      {FLEE.map((c) => (
        <img
          key={c.left}
          src={CROW.flyA}
          alt=""
          className="jr-flee absolute w-16"
          style={
            {
              top: c.top,
              left: c.left,
              "--fx": c.fx,
              "--fy": c.fy,
              "--delay": c.delay,
            } as CSSProperties
          }
        />
      ))}
      <p className="jr-glass jr-rise absolute inset-x-6 bottom-[calc(var(--tabbar-h)+1.5rem)] mx-auto max-w-[360px] rounded-[18px] px-4 py-3 text-center text-[14px] font-bold text-[oklch(0.98_0_0)]">
        Bạn đã đuổi bầy quạ đi! Lâu đài sáng trở lại.
      </p>
    </div>
  );
}

/** The enchanted rose, large: the last petal falls (the curse), or the fallen ones fly back up to
 * the flower (the curse broken). The words come once the petal has landed. */
function RoseMoment({
  stage,
  reborn,
  onClose,
}: {
  stage: number;
  reborn: boolean;
  onClose: () => void;
}) {
  const s = asStage(stage);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(
      () => setDone(true),
      prefersReducedMotion() ? 0 : reborn ? 2600 : 3800,
    );
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, reborn]);
  const last = restingSpot(PETALS - 1);
  // falling: four down and the last one on its way; reborn: all five rise back to the flower
  const fallen = reborn ? (done ? 0 : PETALS) : done ? PETALS : PETALS - 1;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="jr-moment-title"
      className="jr-moment"
      data-rose={reborn ? "reborn" : "fall"}
    >
      <img
        src={reborn ? CASTLE[s].day : CASTLE[s].dark}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-40"
        aria-hidden="true"
      />
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent,oklch(0.06_0.03_285/0.92)_65%)]" />
      {done && <span className={reborn ? "jr-flash" : "jr-dim"} aria-hidden="true" />}
      <div className="relative z-[1] mx-auto flex max-w-[420px] flex-col items-center px-6 text-center">
        <EnchantedRose fallen={fallen} falling={false} className="jr-rose-xl h-72 w-44">
          {!reborn && !done && (
            <span
              className="jr-petal jr-petal-last"
              aria-hidden="true"
              style={{ "--to-x": `${last.x}%`, "--r": `${last.r}deg` } as CSSProperties}
            />
          )}
          {reborn &&
            !done &&
            Array.from({ length: PETALS }, (_, n) => {
              const p = restingSpot(n);
              return (
                <span
                  key={n}
                  className="jr-petal jr-petal-up"
                  aria-hidden="true"
                  style={
                    {
                      left: `${p.x}%`,
                      "--r": `${p.r}deg`,
                      "--delay": `${n * 0.18}s`,
                    } as CSSProperties
                  }
                />
              );
            })}
        </EnchantedRose>
        <div className={done ? "" : "invisible"}>
          <p className="jr-rise jr-chapter mt-6">
            {reborn ? "Lời nguyền đã bị phá" : "Cánh hoa cuối cùng đã rơi"}
          </p>
          <h2
            id="jr-moment-title"
            className="jr-rise jr-display mt-2"
            style={{ "--d": "0.15s" } as CSSProperties}
          >
            {reborn ? "Hoa hồng nở lại rồi!" : "Lời nguyền đã giáng xuống…"}
          </h2>
          <p className="jr-rise jr-story mt-3" style={{ "--d": "0.3s" } as CSSProperties}>
            {reborn
              ? "Hai ngày liền bạn quay lại, bầy quạ đã bỏ đi. Thiên nga trở về chặng của mình."
              : "Vắng lâu quá, thiên nga lùi một chặng. Học 2 ngày liền để phá lời nguyền: chặng bạn đạt được vẫn còn nguyên."}
          </p>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="jr-rise mt-6 inline-flex min-h-12 items-center justify-center rounded-[16px] bg-card px-7 text-[15px] font-bold text-blue-deep shadow-elev-2 active:scale-[0.97]"
            style={{ "--d": "0.45s" } as CSSProperties}
          >
            {reborn ? "Tiếp tục hành trình" : "Bắt đầu phá nguyền"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The weekly shield held: the crows that came for the castle bounce off it and scatter. */
function ShieldMoment({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, prefersReducedMotion() ? 2600 : 3400);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDone}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_42%,oklch(0.18_0.05_285),oklch(0.07_0.03_285)_70%)] px-6"
    >
      <img src={PROP.shield} alt="" aria-hidden="true" className="jr-shield-big" />
      {FLEE.map((c) => (
        <img
          key={c.left}
          src={CROW.flyA}
          alt=""
          className="jr-flee absolute w-14"
          style={
            {
              top: "calc(50% - 90px)",
              left: "calc(50% - 28px)",
              "--fx": c.fx,
              "--fy": c.fy,
              "--delay": `calc(0.6s + ${c.delay})`,
            } as CSSProperties
          }
        />
      ))}
      <div className="jr-rise mt-8 max-w-[360px] text-center text-[oklch(0.98_0_0)]">
        <p className="jr-chapter">Khiên chuỗi</p>
        <p className="jr-story mt-1.5">
          Hôm qua bạn nghỉ, khiên đã đỡ cho bạn: bầy quạ không vào được lâu đài. Tuần sau khiên lại
          sẵn sàng.
        </p>
      </div>
    </div>
  );
}
