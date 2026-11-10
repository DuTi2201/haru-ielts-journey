import { createContext, useContext, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Gavel,
  Mic,
  PenLine,
  Play,
  Presentation,
  RotateCcw,
  Volume2,
} from "lucide-react";

import { Mascot } from "@/components/mascot/Mascot";
import { Ko } from "@/components/lesson/Rich";
import { tap } from "@/lib/feedback";
import { useLandingVoice } from "@/lib/landing-voice";
import { cn } from "@/lib/utils";

import "./skill-demos.css";

/* Bốn phần luyện của Haru, xem trước trên trang chủ: luyện nói, bài nói, tranh luận, chấm viết.
 * Mỗi bản xem trước là một ví dụ minh hoạ dựng sẵn (không gọi AI, không cần đăng nhập) và làm
 * ĐÚNG như app: Haru nói lại câu đúng chứ không ngắt lời (lỗi nằm trong báo cáo cuối buổi), bài nói
 * chấm 5 tiêu chí 1–5 của app, chấm viết 51–52 nhận xét từng chỗ trống (không có điểm số), tranh
 * luận chỉ nhượng bộ trước một lý do cụ thể. Tiếng Hàn đọc bằng giọng Chirp đã lưu sẵn
 * (lib/landing-voice), giọng của thiết bị khi bản ghi chưa có. Mọi câu tiếng Hàn đã được soát. */

type Step =
  | { kind: "haru" | "you"; ko: string; vi?: string; said?: string }
  | { kind: "fix"; from: string; to: string; why: string }
  | { kind: "topic"; ko: string; vi: string; label: string }
  | { kind: "scores"; rows: { k: string; v: number; note?: string }[] }
  | { kind: "check"; rows: { k: string; verdict: "good" | "minor" | "off"; note: string }[] }
  | { kind: "better"; ko: string; label: string }
  | { kind: "coach"; text: string };

interface Demo {
  id: string;
  label: string;
  icon: typeof Mic;
  tag: string;
  steps: Step[];
  done: { title: string; lines: string[] };
  cta: string;
}

const DEMOS: Demo[] = [
  {
    id: "talk",
    label: "Luyện nói",
    icon: Mic,
    tag: "Haru Nói · có lượt dùng thử",
    steps: [
      { kind: "haru", ko: "어제 저녁에 뭐 했어요?", vi: "Tối qua bạn làm gì?" },
      { kind: "you", ko: "저는 친구를 만나요." },
      {
        kind: "haru",
        ko: "아, 친구를 만났어요? 어디에서 만났어요?",
        vi: "À, bạn đã gặp bạn à? Gặp ở đâu?",
      },
      { kind: "coach", text: "Haru nói lại câu đúng (만났어요) thay vì ngắt lời bạn." },
      { kind: "you", ko: "카페에서 만났어요." },
      { kind: "haru", ko: "좋아요! 카페에서 뭐 마셨어요?", vi: "Hay quá! Ở quán bạn uống gì?" },
      { kind: "you", ko: "커피를 마셨어요." },
      { kind: "coach", text: "Báo cáo sau buổi:" },
      {
        kind: "fix",
        from: "만나요",
        to: "만났어요",
        why: "Kể chuyện hôm qua thì dùng đuôi quá khứ.",
      },
    ],
    done: {
      title: "Sau 3 lượt nói",
      lines: [
        "Nói đúng sau khi Haru nhắc: 만났어요",
        "Dùng đúng: N에서 · -았/었어요",
        "Phát âm nên luyện: 마셨어요 [마셔써요]",
      ],
    },
    cta: "Nói thử với Haru",
  },
  {
    id: "present",
    label: "Bài nói",
    icon: Presentation,
    tag: "Haru Nói · có lượt dùng thử",
    steps: [
      {
        kind: "topic",
        label: "Đề trình bày",
        ko: "주말에 보통 무엇을 해요? 이유와 예를 들어 말해 보세요.",
        vi: "Cuối tuần bạn thường làm gì? Nói lý do và cho ví dụ.",
      },
      {
        kind: "you",
        ko: "저는 주말에 보통 운동을 해요. 왜냐하면 평일에 너무 바빠서 운동할 시간이 없어요. 그리고 운동하면 기분이 좋아요.",
      },
      {
        kind: "scores",
        rows: [
          { k: "Mạch lạc", v: 4 },
          { k: "Đủ ý", v: 3, note: "chưa có ví dụ" },
          { k: "Từ nối", v: 4, note: "왜냐하면, 그리고" },
          { k: "Từ & ngữ pháp", v: 3, note: "왜냐하면 … -기 때문이에요" },
          { k: "Trôi chảy", v: 4 },
        ],
      },
      {
        kind: "better",
        label: "Bản nâng cấp",
        ko: "저는 주말에 보통 운동을 해요. 왜냐하면 평일에는 너무 바빠서 운동할 시간이 없기 때문이에요. 예를 들어 지난 토요일에는 친구와 공원에서 한 시간 동안 뛰었어요. 운동을 하면 스트레스가 풀리고 기분이 좋아져요.",
      },
    ],
    done: {
      title: "Lượt sau bạn tập",
      lines: ["왜냐하면 … -기 때문이에요", "Thêm một ví dụ: 예를 들어 …", "Nói lại, Haru chấm lại"],
    },
    cta: "Trình bày thử",
  },
  {
    id: "debate",
    label: "Tranh luận",
    icon: Gavel,
    tag: "Haru Nói · có lượt dùng thử",
    steps: [
      {
        kind: "topic",
        label: "Tranh luận · bạn ủng hộ, Haru phản đối",
        ko: "회사는 재택근무를 늘려야 한다.",
        vi: "Công ty nên cho làm việc tại nhà nhiều hơn.",
      },
      {
        kind: "haru",
        ko: "재택근무를 하면 동료와 소통하기 어려워요. 팀워크가 약해질 수 있어요.",
        vi: "Làm ở nhà thì khó trao đổi với đồng nghiệp, tinh thần đồng đội dễ yếu đi.",
      },
      {
        kind: "you",
        ko: "하지만 화상 회의로 충분히 소통할 수 있어요. 그리고 출퇴근 시간이 줄어서 일에 더 집중할 수 있어요.",
      },
      {
        kind: "haru",
        ko: "좋은 지적이에요. 그 부분은 인정해요. 하지만 신입 사원은 누구한테 일을 배워요?",
        vi: "Ý hay, phần đó tôi công nhận. Nhưng nhân viên mới học việc từ ai?",
      },
      {
        kind: "coach",
        text: "Báo cáo sau buổi: bạn phản bác đúng trọng tâm, có 2 lý do. Với câu hỏi về nhân viên mới, hãy công nhận trước rồi mới phản bác:",
      },
      {
        kind: "better",
        label: "Câu trả lời tốt hơn",
        ko: "물론 처음에는 어려울 수 있어요. 하지만 멘토 제도를 만들면 신입 사원도 잘 배울 수 있어요.",
      },
    ],
    done: {
      title: "Haru ghi nhận",
      lines: [
        "Mạnh: phản bác đúng trọng tâm",
        "Thêm: 물론 … 하지만 … để công nhận trước",
        "Thêm: một ví dụ thực tế",
      ],
    },
    cta: "Tranh luận thử",
  },
  {
    id: "write",
    label: "Chấm viết",
    icon: PenLine,
    tag: "Pass Luyện thi · câu 51–52",
    steps: [
      {
        kind: "topic",
        label: "Câu 51 · điền vào ㉠ ㉡",
        ko: "[도서관 이용 안내] 다음 주부터 이용 시간이 바뀝니다. 평일에는 오후 9시까지 ( ㉠ ). 주말에는 오후 6시에 문을 닫습니다. 이용에 ( ㉡ ).",
        vi: "Thông báo của thư viện: giờ mở cửa thay đổi từ tuần sau.",
      },
      { kind: "you", said: "Bạn viết", ko: "㉠ 이용해요   ㉡ 참고하시기 바랍니다" },
      {
        kind: "check",
        rows: [
          { k: "㉠", verdict: "minor", note: "Đúng ý, nhưng thông báo không dùng đuôi -아/어요." },
          { k: "㉡", verdict: "good", note: "Đúng ý, đúng văn phong." },
        ],
      },
      {
        kind: "fix",
        from: "이용해요",
        to: "이용하실 수 있습니다",
        why: "Thông báo dùng đuôi trang trọng -ㅂ니다, như câu trước và sau.",
      },
    ],
    done: {
      title: "㉠ cần sửa nhỏ · ㉡ đạt",
      lines: [
        "Lỗi hay gặp: văn phong không khớp với cả bài",
        "Lỗi được ghi lại, đề sau ưu tiên đúng điểm này",
        "Đáp án mẫu chỉ là một cách viết: câu khác cùng ý vẫn đúng",
      ],
    },
    cta: "Luyện viết thử",
  },
];

const VERDICT = { good: "Đạt", minor: "Cần sửa nhỏ", off: "Chưa đúng ý" } as const;

/** Every Korean line the demos read aloud: the server keeps a Chirp recording of each
 * (LANDING_TEXTS in the backend's app/services/landing_audio.py must list the same texts). A
 * notice with blanks (㉠ ㉡) is not read: a voice cannot say a blank. */
export const DEMO_SPOKEN: string[] = DEMOS.flatMap((d) =>
  d.steps.flatMap((st) => {
    if (st.kind === "haru" || st.kind === "better") return [st.ko];
    if (st.kind === "topic") return /[㉠㉡]/.test(st.ko) ? [] : [st.ko];
    if (st.kind === "fix") return [st.to];
    return [];
  }),
);

function Speak({ ko }: { ko: string }) {
  const say = useContext(SayContext);
  if (!DEMO_SPOKEN.includes(ko)) return null;
  return (
    <button
      type="button"
      onClick={() => say(ko)}
      aria-label={`Nghe: ${ko}`}
      className="hit-area inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card/80 text-blue-deep active:scale-95"
    >
      <Volume2 size={14} strokeWidth={2.6} />
    </button>
  );
}

function StepView({ step }: { step: Step }) {
  switch (step.kind) {
    case "haru":
      return (
        <div className="flex items-end gap-2">
          <Mascot mood="cheer" className="h-9 w-9 shrink-0" />
          <div className="max-w-[85%] rounded-[18px_18px_18px_4px] bg-card px-3.5 py-2.5 shadow-elev-1">
            <div className="flex items-start gap-2">
              <Ko className="text-[15px] font-semibold leading-6">{step.ko}</Ko>
              <Speak ko={step.ko} />
            </div>
            {step.vi && <p className="mt-0.5 text-[12px] text-ink-2">{step.vi}</p>}
          </div>
        </div>
      );
    case "you":
      return (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-[18px_18px_4px_18px] bg-blue px-3.5 py-2.5 text-primary-foreground shadow-elev-1">
            <p className="text-[11px] font-semibold opacity-80">{step.said ?? "Bạn nói"}</p>
            <Ko className="text-[15px] font-semibold leading-6">{step.ko}</Ko>
          </div>
        </div>
      );
    case "fix":
      return (
        <div className="rounded-[16px] border border-yellow bg-yellow-soft px-3.5 py-2.5">
          <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold">
            <Ko className="text-danger line-through decoration-2">{step.from}</Ko>
            <ArrowRight size={14} aria-hidden="true" />
            <Ko className="text-green">{step.to}</Ko>
            <Speak ko={step.to} />
          </p>
          <p className="mt-0.5 text-[12px] leading-5 text-ink-2">{step.why}</p>
        </div>
      );
    case "topic":
      return (
        <div className="rounded-[16px] border border-line bg-card px-3.5 py-3 shadow-elev-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-blue-deep">
            {step.label}
          </p>
          <div className="mt-1 flex items-start gap-2">
            <Ko className="text-[15px] font-bold leading-6">{step.ko}</Ko>
            <Speak ko={step.ko} />
          </div>
          <p className="mt-0.5 text-[12px] text-ink-2">{step.vi}</p>
        </div>
      );
    case "scores":
      return (
        <div className="rounded-[16px] border border-line bg-card px-3.5 py-3 shadow-elev-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-blue-deep">Haru chấm</p>
          <ul className="mt-1.5 space-y-1.5">
            {step.rows.map((r) => (
              <li key={r.k} className="text-[13px]">
                <div className="flex items-center justify-between gap-2 font-semibold">
                  <span>{r.k}</span>
                  <span className="tabular-nums">{r.v}/5</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-progress">
                  <span
                    className={cn("block h-full rounded-full", r.v >= 4 ? "bg-green" : "bg-yellow")}
                    style={{ width: `${r.v * 20}%` }}
                  />
                </div>
                {r.note && (
                  <p className="mt-0.5 text-[12px] text-ink-2">
                    <Ko>{r.note}</Ko>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      );
    case "check":
      return (
        <div className="rounded-[16px] border border-line bg-card px-3.5 py-3 shadow-elev-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-blue-deep">
            Haru nhận xét · ý kiến của AI
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {step.rows.map((r) => (
              <li key={r.k} className="text-[13px]">
                <div className="flex items-center justify-between gap-2 font-semibold">
                  <span>{r.k}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[12px]",
                      r.verdict === "good" ? "bg-green-soft text-green" : "bg-yellow-soft",
                    )}
                  >
                    {VERDICT[r.verdict]}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-ink-2">{r.note}</p>
              </li>
            ))}
          </ul>
        </div>
      );
    case "better":
      return (
        <div className="rounded-[16px] border border-green bg-green-soft px-3.5 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-green">{step.label}</p>
          <div className="mt-1 flex items-start gap-2">
            <Ko className="text-[14px] font-semibold leading-6">{step.ko}</Ko>
            <Speak ko={step.ko} />
          </div>
        </div>
      );
    case "coach":
      return <p className="px-1 text-[13px] font-semibold leading-5 text-ink-2">{step.text}</p>;
  }
}

/** The four demos in tabs; "try it for real" goes to sign up. */
const SayContext = createContext<(text: string) => void>(() => {});

export function SkillDemos() {
  const voice = useLandingVoice();
  const say = voice.speak;
  const [tab, setTab] = useState(DEMOS[0]!.id);
  const [shown, setShown] = useState(1);
  const demo = DEMOS.find((d) => d.id === tab) ?? DEMOS[0]!;
  const finished = shown > demo.steps.length;
  useEffect(() => setShown(1), [tab]);

  const next = () => {
    tap();
    const step = demo.steps[shown];
    setShown((n) => n + 1);
    if (step?.kind === "haru") say(step.ko); // Haru speaks; your own lines are yours to say
  };

  return (
    <SayContext.Provider value={say}>
      <div role="tablist" aria-label="Các phần luyện" className="flex gap-2 overflow-x-auto pb-1">
        {DEMOS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={d.id === tab}
            onClick={() => {
              tap();
              setTab(d.id);
            }}
            className={cn(
              "hit-area inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-semibold",
              d.id === tab ? "bg-blue text-primary-foreground shadow-elev-1" : "bg-card text-ink",
            )}
          >
            <d.icon size={15} strokeWidth={2.4} aria-hidden="true" /> {d.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        className="mt-3 rounded-[26px] border border-line bg-paper p-3.5 shadow-elev-2 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-purple-soft px-2.5 py-0.5 text-[11px] font-semibold">
            {demo.tag}
          </span>
          <span className="text-[11px] font-semibold text-ink-2">Ví dụ minh hoạ</span>
        </div>
        <ol className="mt-3 space-y-2.5" aria-live="polite">
          {demo.steps.slice(0, shown).map((s, n) => (
            <li key={`${demo.id}-${n}`} className="sd-rise">
              <StepView step={s} />
            </li>
          ))}
        </ol>
        {finished ? (
          <Result demo={demo} onAgain={() => setShown(1)} />
        ) : (
          <button
            type="button"
            onClick={next}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-blue text-[14px] font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.98]"
          >
            <Play size={15} strokeWidth={2.6} aria-hidden="true" />
            {shown === demo.steps.length ? "Xem kết quả" : "Xem tiếp"}
            <span className="text-[12px] opacity-80">
              {shown}/{demo.steps.length}
            </span>
          </button>
        )}
      </div>
    </SayContext.Provider>
  );
}

function Result({ demo, onAgain }: { demo: Demo; onAgain: () => void }) {
  return (
    <div className="sd-rise mt-3 rounded-[18px] bg-card p-4 shadow-elev-1">
      <p className="text-[15px] font-bold">{demo.done.title}</p>
      <ul className="mt-1.5 space-y-1 text-[13px] font-semibold leading-5">
        {demo.done.lines.map((l) => (
          <li key={l} className="flex gap-2">
            <span className="text-green" aria-hidden="true">
              ✓
            </span>
            <Ko>{l}</Ko>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Link
          to="/support-language"
          onClick={() => tap()}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-blue text-[14px] font-semibold text-primary-foreground active:scale-[0.98]"
        >
          {demo.cta} <ArrowRight size={15} strokeWidth={2.6} />
        </Link>
        <button
          type="button"
          onClick={() => {
            tap();
            onAgain();
          }}
          aria-label="Xem lại"
          className="flex min-h-11 w-11 items-center justify-center rounded-[14px] border border-line"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
