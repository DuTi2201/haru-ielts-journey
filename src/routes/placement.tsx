import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Clock, Lock, LogIn, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { PracticeShell } from "@/components/haru/PracticeShell";
import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { OptionButton, StimulusView } from "@/components/lesson/McqExercise";
import { Mascot } from "@/components/mascot/Mascot";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { finishPlacement, getAdaptivePlacement, placementNext } from "@/lib/api/content";
import type {
  AdaptiveAnswerIn,
  AdaptiveResultOut,
  AdaptiveStepOut,
  McqExerciseOut,
  Purpose,
  SelfLevel,
} from "@/lib/api/types";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/placement")({
  head: () => ({
    meta: [
      { title: "Tìm bài bắt đầu — Haru" },
      { name: "description", content: "Khoảng 2 phút để Haru tìm bài bắt đầu hợp với bạn." },
      { property: "og:title", content: "Tìm bài bắt đầu — Haru" },
      { property: "og:description", content: "Khoảng 2 phút để Haru tìm bài bắt đầu hợp với bạn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlacementScreen,
});

const PURPOSES: { id: Purpose; label: string }[] = [
  { id: "talk", label: "Giao tiếp, sống ở Hàn" },
  { id: "work", label: "Đi làm, công sở" },
  { id: "topik1", label: "Thi TOPIK I" },
  { id: "topik4", label: "TOPIK II cấp 3–4" },
  { id: "topik5", label: "TOPIK II cấp 5–6" },
];
const LEVELS: { id: SelfLevel; label: string }[] = [
  { id: "new", label: "Chưa biết gì" },
  { id: "basic", label: "Đọc được chữ, nói vài câu" },
  { id: "elementary", label: "Sơ cấp (TOPIK I)" },
  { id: "intermediate", label: "Trung cấp (TOPIK 3–4)" },
  { id: "advanced", label: "Cao cấp (TOPIK 5–6)" },
];
const MINUTES = [10, 15, 30, 45];

function Back() {
  return (
    <Link
      to="/today"
      onClick={() => tap()}
      className="hit-area -ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-1 text-xs font-semibold text-blue-deep active:scale-95"
    >
      <ArrowLeft size={15} strokeWidth={2.6} /> Hôm nay
    </Link>
  );
}

function PlacementScreen() {
  const auth = useAuth();
  const last = useQuery({
    queryKey: ["me", "placement", "adaptive"],
    queryFn: getAdaptivePlacement,
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
  });
  const [retake, setRetake] = useState(false);

  return (
    <PracticeShell glyph="시">
      <Back />
      {!auth.isLoading && !auth.isAuthenticated && (
        <div className="mt-4 rounded-[20px] border border-line bg-card p-5 text-center shadow-elev-1">
          <Mascot mood="wave" className="mx-auto h-20 w-20" />
          <h1 className="mt-2 text-xl font-bold">Tìm bài bắt đầu</h1>
          <p className="mt-1 text-sm font-medium text-ink-2">
            Đăng nhập để Haru lưu kết quả và xếp lịch học cho bạn.
          </p>
          <Link
            to="/support-language"
            className="hit-area mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-blue px-5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
          >
            <LogIn size={15} strokeWidth={2.4} /> Đăng nhập / Tạo tài khoản
          </Link>
        </div>
      )}
      {auth.isAuthenticated && last.isLoading && (
        <LoadingBlocks className="mt-4" label="Đang tải" blocks={["h-24", "h-48"]} />
      )}
      {auth.isAuthenticated && last.isError && (
        <ErrorState
          className="mt-4"
          title="Không tải được."
          message={errorMessage(last.error)}
          onRetry={() => void last.refetch()}
          retrying={last.isRefetching}
        />
      )}
      {auth.isAuthenticated && last.isSuccess && (
        <>
          {last.data && !retake ? (
            <Result result={last.data} onRetake={() => setRetake(true)} />
          ) : (
            <Flow onDone={() => setRetake(false)} />
          )}
        </>
      )}
    </PracticeShell>
  );
}

type Phase = "intro" | "survey" | "test";

function Flow({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("intro");
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [level, setLevel] = useState<SelfLevel | null>(null);
  const [minutes, setMinutes] = useState(15);
  const [step, setStep] = useState<AdaptiveStepOut | null>(null);
  const answers = useRef<AdaptiveAnswerIn[]>([]);

  const finish = useMutation({
    mutationFn: () =>
      finishPlacement({
        survey: { purpose: purpose!, self_level: level!, daily_minutes: minutes },
        answers: answers.current,
      }),
    onSuccess: (res) => {
      qc.setQueryData(["me", "placement", "adaptive"], res);
      for (const key of [["me", "plan"], ["me", "placement"], ["me", "competency"], ["lessons"]])
        void qc.invalidateQueries({ queryKey: key });
      onDone();
    },
    onError: (err) => toast.error("Chưa lưu được kết quả.", { description: errorMessage(err) }),
  });

  const next = useMutation({
    mutationFn: () => placementNext({ self_level: level!, answers: answers.current }),
    onSuccess: (s) => {
      if (s.done) finish.mutate();
      else setStep(s);
    },
    onError: (err) => toast.error("Chưa tải được câu hỏi.", { description: errorMessage(err) }),
  });

  function begin() {
    answers.current = [];
    setStep(null);
    if (level === "new") {
      finish.mutate();
      return;
    }
    setPhase("test");
    next.mutate();
  }

  function answer(choice: string) {
    if (!step?.item || next.isPending) return;
    tap();
    answers.current = [...answers.current, { ref: step.item.ref, choice }];
    next.mutate();
  }

  if (phase === "intro")
    return (
      <section className="mt-4 rounded-[24px] border border-line bg-card p-5 text-center shadow-elev-1">
        <Mascot mood="wave" className="mx-auto h-24 w-24" />
        <h1 className="mt-2 text-2xl font-bold">Tìm bài bắt đầu</h1>
        <p className="mx-auto mt-1 max-w-[30ch] text-sm font-medium leading-6 text-ink-2">
          Mình hỏi 3 câu và vài câu tiếng Hàn ngắn, rồi xếp bài và lịch học hợp với bạn.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink-2">
          <Clock size={13} strokeWidth={2.4} /> Khoảng 2 phút · không tính điểm
        </p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              tap();
              setPhase("survey");
            }}
            className="hit-area inline-flex min-h-12 items-center gap-1.5 rounded-full bg-blue px-6 text-[15px] font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
          >
            Bắt đầu <ArrowRight size={16} strokeWidth={2.6} />
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: "/today" })}
            className="hit-area min-h-10 text-xs font-semibold text-ink-2"
          >
            Để sau, học từ bài đầu
          </button>
        </div>
      </section>
    );

  if (phase === "survey")
    return (
      <div className="mt-4 space-y-5">
        <Choice
          title="Bạn học tiếng Hàn để làm gì?"
          value={purpose}
          onPick={setPurpose}
          options={PURPOSES}
        />
        <Choice title="Bạn đang ở đâu?" value={level} onPick={setLevel} options={LEVELS} />
        <Choice
          title="Mỗi ngày học bao lâu?"
          value={minutes}
          onPick={setMinutes}
          options={MINUTES.map((m) => ({ id: m, label: `${m} phút` }))}
        />
        <button
          type="button"
          disabled={!purpose || !level || finish.isPending || next.isPending}
          onClick={begin}
          className="hit-area flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full bg-blue px-6 text-[15px] font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.98] disabled:opacity-40"
        >
          {level === "new" ? "Xem lộ trình" : "Làm vài câu ngắn"}{" "}
          <ArrowRight size={16} strokeWidth={2.6} />
        </button>
      </div>
    );

  const item = step?.item;
  const ex = item?.exercise as unknown as McqExerciseOut | undefined;
  const q = ex?.questions?.[0];
  const loading = next.isPending || finish.isPending || !item;
  return (
    <div className="mt-4 space-y-4">
      <div
        role="progressbar"
        aria-label="Tiến độ"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((step?.progress ?? 0) * 100)}
        className="h-1.5 overflow-hidden rounded-full bg-progress"
      >
        <div
          className="h-full rounded-full bg-blue transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${Math.max(4, (finish.isPending ? 1 : (step?.progress ?? 0)) * 100)}%` }}
        />
      </div>
      {finish.isPending ? (
        <div className="py-10 text-center">
          <Mascot mood="thinking" className="mx-auto h-20 w-20" />
          <p className="mt-2 text-sm font-semibold text-ink-2">Mình đang xếp lộ trình cho bạn…</p>
        </div>
      ) : loading || !ex || !q ? (
        <LoadingBlocks label="Đang tải câu hỏi" blocks={["h-20", "h-44"]} />
      ) : (
        <>
          {ex.instruction_vi && (
            <p className="text-[13px] font-semibold text-ink-2">{ex.instruction_vi}</p>
          )}
          {ex.stimulus && (
            <StimulusView
              stimulus={ex.stimulus}
              exercise={ex}
              lessonId={0}
              once={false}
              answered={false}
              fill={null}
              exam
            />
          )}
          <div role="radiogroup" aria-label="Các lựa chọn" className="space-y-2">
            {q.options.map((o, i) => (
              <OptionButton
                key={o.id}
                option={o}
                index={i}
                state="idle"
                locked={next.isPending}
                visual={false}
                onPick={() => answer(o.id)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => answer("")}
            disabled={next.isPending}
            className="hit-area flex min-h-11 w-full items-center justify-center rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink-2 shadow-elev-1 active:scale-[0.98] disabled:opacity-50"
          >
            Mình chưa học phần này
          </button>
        </>
      )}
    </div>
  );
}

function Choice<T extends string | number>({
  title,
  value,
  onPick,
  options,
}: {
  title: string;
  value: T | null;
  onPick: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <fieldset>
      <legend className="text-[15px] font-semibold">{title}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => {
              tap();
              onPick(o.id);
            }}
            className={cn(
              "hit-area min-h-10 rounded-full border px-3.5 text-[13px] font-semibold active:scale-[0.97]",
              value === o.id
                ? "border-transparent bg-blue text-primary-foreground"
                : "border-line bg-card text-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Result({ result: r, onRetake }: { result: AdaptiveResultOut; onRetake: () => void }) {
  const first = r.next_lessons[0];
  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-[24px] border border-line bg-card p-5 shadow-elev-1">
        <div className="flex items-start gap-3">
          <Mascot mood="celebrate" className="h-16 w-16 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">Kết quả</p>
            <h1 className="mt-0.5 text-[17px] font-bold leading-6">{r.headline}</h1>
          </div>
        </div>
        {r.start_lesson_id != null && (
          <div className="mt-4 rounded-[16px] bg-paper p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">
              Bài bắt đầu
            </p>
            <p className="mt-0.5 text-[15px] font-semibold leading-5">{r.start_title}</p>
            <Link
              to="/lesson/$id"
              params={{ id: String(r.start_lesson_id) }}
              onClick={() => tap()}
              className="hit-area mt-3 flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-blue px-5 text-[15px] font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.98]"
            >
              Học bài này <ArrowRight size={16} strokeWidth={2.6} />
            </Link>
          </div>
        )}
        {first && !first.free && (
          <p className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-ink-2">
            <Lock size={12} strokeWidth={2.6} /> Bài này cần gói bài học ·{" "}
            <Link to="/pricing" className="text-blue-deep underline">
              xem gói
            </Link>
          </p>
        )}
      </section>

      {r.tips.length > 0 && (
        <ul className="space-y-2">
          {r.tips.map((t) => (
            <li key={t} className="rounded-[16px] bg-paper px-4 py-3 text-sm font-medium leading-6">
              {t}
            </li>
          ))}
        </ul>
      )}

      {r.gaps.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold">Nên ôn lại</h2>
          <ul className="mt-2 space-y-1.5">
            {r.gaps.map((g) => (
              <li key={g.title}>
                {g.lesson_id != null ? (
                  <Link
                    to="/lesson/$id"
                    params={{ id: String(g.lesson_id) }}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-[14px] border border-line bg-card px-3.5 text-[13px] font-semibold"
                  >
                    <span className="min-w-0 truncate">{g.title}</span>
                    <ArrowRight size={14} strokeWidth={2.6} className="shrink-0 text-ink-2" />
                  </Link>
                ) : (
                  <span className="text-[13px] font-semibold">{g.title}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.lessons_to_goal > 0 && (
        <section className="rounded-[20px] border border-line bg-card p-4 shadow-elev-1">
          <h2 className="text-sm font-semibold">Tới mục tiêu {r.goal_label}</h2>
          <p className="mt-1 text-[13px] font-medium text-ink-2">
            {r.lessons_to_goal} bài · khoảng {r.weeks} tuần với {r.daily_minutes} phút mỗi ngày
          </p>
          <ol className="mt-3 space-y-1.5">
            {r.next_lessons.map((l, i) => (
              <li key={l.id} className="flex items-center gap-2.5 text-[13px] font-semibold">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-soft text-[12px] text-blue-deep">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{l.title}</span>
                <span className="shrink-0 text-xs text-ink-2">~{l.minutes} phút</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="text-[12px] font-medium leading-4 text-ink-2">
        {r.tested
          ? `Ước lượng từ ${r.asked} câu (${r.right} câu đúng), không phải điểm thi. Lịch học tính từ số phút bạn chọn.`
          : "Bạn chọn bắt đầu từ đầu. Khi đã học một thời gian, làm kiểm tra để Haru xếp lại."}
      </p>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onRetake}
          className="hit-area inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-sm font-semibold shadow-elev-1 active:scale-[0.97]"
        >
          <RotateCcw size={14} strokeWidth={2.6} /> Làm lại
        </button>
        <Link
          to="/today"
          className="hit-area inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-blue-deep"
        >
          Về Hôm nay
        </Link>
      </div>
    </div>
  );
}
