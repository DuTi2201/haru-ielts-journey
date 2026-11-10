/** A short dialogue situation that closes a sitting, in three small parts that use only what the
 * sitting taught: (1) put the turns of a dialogue in order, (2) choose the reply that fits and see
 * why each one does or does not, (3) compare two ways of saying it. Every part gives the reason, not
 * just right/wrong, and nothing here is saved or held against the learner. */
import { Check, Loader2, RotateCcw, Undo2, Volume2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Ko } from "@/components/lesson/Rich";
import { useTextAudio } from "@/hooks/use-text-audio";
import type { SituationOut } from "@/lib/api/types";
import { success, tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

type Turn = SituationOut["turns"][number];

/** A fixed, scrambled order for the tiles (never the right one), so a re-render does not reshuffle. */
function scramble(n: number, seed: number): number[] {
  const base = Array.from({ length: n }, (_, i) => i);
  let x = seed || 7;
  for (let attempt = 0; attempt < 8; attempt++) {
    const order = [...base];
    for (let i = n - 1; i > 0; i--) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      const j = x % (i + 1);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    if (order.some((v, i) => v !== i)) return order;
  }
  return [...base].reverse();
}

const voiceOf = (t: Turn) => (t.who === "A" ? "ko-female-1" : "ko-male-1");

function PartTitle({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <header>
      <p className="text-[11px] font-bold uppercase tracking-wide text-blue">
        Phần {n}/3 · {title}
      </p>
      <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{hint}</p>
    </header>
  );
}

function Verdict({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "mt-2 rounded-[14px] p-3 text-[13px] leading-5",
        ok ? "bg-green-soft text-ink" : "bg-fill text-ink",
      )}
    >
      <p className="mb-1 flex items-center gap-1 font-bold">
        {ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
        {ok ? "Đúng rồi" : "Chưa đúng, xem lý do nhé"}
      </p>
      {children}
    </div>
  );
}

export function SituationStep({ situation }: { situation: SituationOut }) {
  const audio = useTextAudio();
  const [part, setPart] = useState(1);
  const { turns } = situation;
  const order = useMemo(
    () => scramble(turns.length, situation.scene_vi.length),
    [turns.length, situation.scene_vi],
  );

  // part 1
  const [placed, setPlaced] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const free = order.filter((i) => !placed.includes(i));
  const inOrder = placed.length === turns.length && placed.every((v, i) => v === i);

  // part 2 / 3. The data lists the fitting reply and the better way first; they are shown in a
  // fixed, mixed order so the right one is not always in the same place.
  const replyOrder = useMemo(() => {
    const n = situation.reply.options.length;
    const ok = situation.reply.options.findIndex((o) => o.ok);
    const base = situation.reply.prompt_en.length;
    for (let seed = base; seed < base + 12; seed++) {
      const o = scramble(n, seed);
      if (o[0] !== ok) return o;
    }
    return Array.from({ length: n }, (_, i) => i).reverse();
  }, [situation.reply]);
  const flip = (situation.compare.a.ko.length + situation.compare.b.ko.length) % 2 === 1;
  const wayOrder: ("a" | "b")[] = flip ? ["b", "a"] : ["a", "b"];
  const [pick, setPick] = useState<number | null>(null);
  const [way, setWay] = useState<"a" | "b" | null>(null);

  const playTurn = (t: Turn) => {
    tap();
    void audio.play(t.ko, voiceOf(t));
  };
  const Speaker = ({ t }: { t: Turn }) => {
    const busy = audio.activeText === t.ko && audio.state === "loading";
    return (
      <button
        type="button"
        onClick={() => playTurn(t)}
        aria-label="Nghe câu này"
        className="hit-area inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-fill active:scale-[0.95]"
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <Volume2 size={16} aria-hidden="true" />
        )}
      </button>
    );
  };

  const next = (
    <button
      type="button"
      onClick={() => {
        tap();
        setPart((p) => p + 1);
      }}
      className="mt-3 flex min-h-12 w-full items-center justify-center rounded-[14px] bg-blue px-4 text-sm font-semibold text-primary-foreground active:scale-[0.97]"
    >
      Phần tiếp theo
    </button>
  );

  return (
    <section aria-label="Tình huống" className="space-y-3">
      <p className="rounded-[14px] bg-fill px-3 py-2 text-[13px] leading-5">
        <b>Tình huống.</b> {situation.scene_vi}
      </p>

      {part === 1 && (
        <div>
          <PartTitle
            n={1}
            title="Xếp lượt thoại"
            hint="Chạm từng câu theo đúng thứ tự cuộc hội thoại. Chạm câu đã xếp để bỏ ra."
          />
          <ol className="mt-2 space-y-1.5" aria-label="Thứ tự bạn đã xếp">
            {placed.map((i, k) => {
              const t = turns[i]!;
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={checked}
                    onClick={() => setPlaced(placed.filter((x) => x !== i))}
                    className={cn(
                      "hit-area w-full rounded-[12px] border px-3 py-2 text-left",
                      checked
                        ? i === k
                          ? "border-green/50 bg-green-soft"
                          : "border-danger/50 bg-fill"
                        : "border-blue/40 bg-card",
                    )}
                  >
                    <span className="mr-1 text-[11px] font-bold text-ink-2">{k + 1}.</span>
                    <Ko className="text-[16px] font-semibold">{t.ko}</Ko>
                  </button>
                </li>
              );
            })}
            {placed.length === 0 && (
              <li className="rounded-[12px] border border-dashed border-line px-3 py-3 text-[12px] text-ink-2">
                Chưa có câu nào. Chạm một câu bên dưới để đặt nó đầu tiên.
              </li>
            )}
          </ol>

          {!checked && (
            <ul className="mt-3 space-y-1.5" aria-label="Các câu còn lại">
              {free.map((i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      tap();
                      setPlaced([...placed, i]);
                    }}
                    className="hit-area w-full rounded-[12px] bg-fill px-3 py-2 text-left active:scale-[0.98]"
                  >
                    <Ko className="text-[16px] font-semibold">{turns[i]!.ko}</Ko>
                    <span className="block text-[12px] leading-4 text-ink-2">{turns[i]!.vi}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!checked ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={placed.length === 0}
                onClick={() => setPlaced(placed.slice(0, -1))}
                className="hit-area inline-flex min-h-12 items-center gap-1 rounded-[14px] bg-fill px-4 text-sm font-semibold disabled:opacity-40"
              >
                <Undo2 size={16} aria-hidden="true" /> Bỏ câu cuối
              </button>
              <button
                type="button"
                disabled={placed.length !== turns.length}
                onClick={() => {
                  setChecked(true);
                  if (inOrder) success();
                }}
                className="min-h-12 flex-1 rounded-[14px] bg-blue px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40 active:scale-[0.97]"
              >
                Kiểm tra
              </button>
            </div>
          ) : (
            <>
              <Verdict ok={inOrder}>
                <p>
                  {inOrder
                    ? "Bạn xếp đúng. Nghe lại cả đoạn để quen nhịp nói của từng người."
                    : "Đây là thứ tự đúng. Mỗi người hỏi rồi người kia đáp: câu hỏi luôn đi trước câu trả lời."}
                </p>
              </Verdict>
              <ol className="mt-2 space-y-1.5">
                {turns.map((t, i) => (
                  <li
                    key={i}
                    className={cn("flex items-center gap-2", t.who === "B" && "flex-row-reverse")}
                  >
                    <div
                      className={cn(
                        "min-w-0 flex-1 rounded-[14px] px-3 py-2",
                        t.who === "A" ? "bg-fill" : "bg-blue-soft",
                      )}
                    >
                      <Ko className="text-[16px] font-semibold">{t.ko}</Ko>
                      <span className="block text-[12px] leading-4 text-ink-2">{t.vi}</span>
                    </div>
                    <Speaker t={t} />
                  </li>
                ))}
              </ol>
              {!inOrder && (
                <button
                  type="button"
                  onClick={() => {
                    setPlaced([]);
                    setChecked(false);
                  }}
                  className="hit-area mt-2 inline-flex min-h-11 items-center gap-1 rounded-[12px] bg-fill px-3 text-[13px] font-semibold"
                >
                  <RotateCcw size={14} aria-hidden="true" /> Xếp lại
                </button>
              )}
              {next}
            </>
          )}
        </div>
      )}

      {part === 2 && (
        <div>
          <PartTitle
            n={2}
            title="Chọn lời đáp"
            hint="Một người nói với bạn. Chọn câu đáp hợp nhất, rồi đọc lý do của cả ba câu."
          />
          <div className="mt-2 rounded-[14px] bg-fill px-3 py-2">
            <Ko className="text-[17px] font-bold">{situation.reply.prompt_en}</Ko>
            <span className="block text-[12px] leading-4 text-ink-2">
              {situation.reply.prompt_vi}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {replyOrder.map((i) => {
              const o = situation.reply.options[i]!;
              const shown = pick !== null;
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={shown}
                    onClick={() => {
                      setPick(i);
                      if (o.ok) success();
                      else tap();
                    }}
                    className={cn(
                      "hit-area w-full rounded-[14px] border px-3 py-2 text-left",
                      !shown && "border-line bg-card active:scale-[0.98]",
                      shown && o.ok && "border-green/60 bg-green-soft",
                      shown && !o.ok && pick === i && "border-danger/60 bg-fill",
                      shown && !o.ok && pick !== i && "border-line bg-card opacity-80",
                    )}
                  >
                    <Ko className="text-[16px] font-semibold">{o.ko}</Ko>
                    {shown && (
                      <>
                        <span className="block text-[12px] leading-4 text-ink-2">{o.vi}</span>
                        <span className="mt-1 block text-[13px] leading-5">
                          <b>{o.ok ? "Hợp vì: " : "Chưa hợp vì: "}</b>
                          {o.why_vi}
                        </span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {pick !== null && next}
        </div>
      )}

      {part === 3 && (
        <div>
          <PartTitle
            n={3}
            title="So sánh hai cách nói"
            hint="Cả hai đều là tiếng Hàn đúng ngữ pháp. Chọn cách hợp với hoàn cảnh."
          />
          <p className="mt-2 text-[14px] font-semibold leading-5">{situation.compare.ask_vi}</p>
          <div className="mt-2 grid gap-2">
            {wayOrder.map((k, pos) => {
              const w = situation.compare[k];
              const shown = way !== null;
              const right = situation.compare.better === k;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={shown}
                  onClick={() => {
                    setWay(k);
                    if (right) success();
                    else tap();
                  }}
                  className={cn(
                    "hit-area rounded-[14px] border px-3 py-3 text-left",
                    !shown && "border-line bg-card active:scale-[0.98]",
                    shown && right && "border-green/60 bg-green-soft",
                    shown && !right && way === k && "border-danger/60 bg-fill",
                    shown && !right && way !== k && "border-line bg-card opacity-80",
                  )}
                >
                  <span className="text-[11px] font-bold uppercase text-ink-2">
                    Cách {pos === 0 ? "A" : "B"}
                  </span>
                  <Ko className="block text-[18px] font-bold leading-snug">{w.ko}</Ko>
                  {shown && <span className="block text-[12px] leading-4 text-ink-2">{w.vi}</span>}
                </button>
              );
            })}
          </div>
          {way !== null && (
            <Verdict ok={way === situation.compare.better}>
              <p>
                <b>Cách {wayOrder.indexOf(situation.compare.better) === 0 ? "A" : "B"} hợp hơn.</b>{" "}
                {situation.compare.why_vi}
              </p>
            </Verdict>
          )}
          {way !== null && (
            <p className="mt-3 text-center text-[13px] font-semibold text-ink-2">
              Xong tình huống. Bạn có thể quay lại xem các phần trước.
            </p>
          )}
        </div>
      )}

      {audio.error && <p className="text-[12px] font-medium text-danger">{audio.error}</p>}
    </section>
  );
}
