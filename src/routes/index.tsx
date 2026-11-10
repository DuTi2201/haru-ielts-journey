import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Check,
  Gavel,
  HeartHandshake,
  Lock,
  Mic,
  Presentation,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { JourneyShowcase } from "@/components/journey/JourneyShowcase";
import { Mascot } from "@/components/mascot/Mascot";
import { FlashcardDemo, Reveal, StickyCta } from "@/components/site/LandingKit";
import { SkillDemos } from "@/components/site/SkillDemos";
import { PublicShell } from "@/components/site/PublicShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/hooks/use-auth";
import { formatVnd, useCatalog } from "@/lib/billing";
import { cn } from "@/lib/utils";

import "@/components/site/skill-demos.css";

const DESCRIPTION =
  "Haru — ứng dụng học tiếng Hàn cho người Việt: bài học theo chủ đề, ôn tập nhớ lâu, luyện nói với AI, luyện thi TOPIK. Học thử miễn phí.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Haru — Học tiếng Hàn mỗi ngày, miễn phí để bắt đầu" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Haru — Học tiếng Hàn mỗi ngày" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

/** A signed-in learner goes straight to their day; everyone else sees what Haru is. */
function Landing() {
  const auth = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (auth.isAuthenticated) void navigate({ to: "/today", replace: true });
  }, [auth.isAuthenticated, navigate]);

  const { catalog } = useCatalog();
  const from = (kind: string) => {
    const xs = (catalog?.products ?? []).filter((p) => p.kind === kind).map((p) => p.amount);
    return xs.length ? formatVnd(Math.min(...xs)) : null;
  };
  const selling = catalog?.enabled === true;
  const heroRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLElement>(null);

  return (
    <PublicShell wide>
      {/* hero */}
      <section
        ref={heroRef}
        className="grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[1.1fr_1fr]"
      >
        <div className="text-center lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-[12px] font-bold text-ink-2 shadow-elev-1">
            <span className="h-2 w-2 rounded-full bg-green" aria-hidden="true" />
            Làm riêng cho người Việt · Sơ cấp đến TOPIK
          </p>
          <h1 className="isolate mt-4 text-[34px] font-extrabold leading-[1.12] tracking-tight sm:text-[48px]">
            Mỗi ngày 15 phút, <span className="text-blue">nhớ lâu</span> và{" "}
            <span className="relative whitespace-nowrap">
              dám nói
              <span
                className="absolute inset-x-0 bottom-1 -z-10 h-3 rounded-full bg-yellow-soft sm:h-4"
                aria-hidden="true"
              />
            </span>{" "}
            tiếng Hàn.
          </h1>
          <p className="mx-auto mt-4 max-w-[520px] text-[16px] font-medium leading-7 text-ink-2 lg:mx-0">
            Bài học ngắn theo chủ đề, ôn tập ngay trước khi quên, luyện nói 1-1 với Haru như với một
            người bạn Hàn, và luyện thi TOPIK có AI chấm. Mọi giải thích đều bằng tiếng Việt.
          </p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              to="/lesson"
              className="group inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] bg-blue px-8 text-[16px] font-bold uppercase tracking-wide text-primary-foreground shadow-[0_4px_0_0_var(--color-blue-deep)] transition-transform hover:-translate-y-0.5 active:translate-y-[2px] active:shadow-none sm:w-auto"
            >
              Học thử miễn phí
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
            <Link
              to="/support-language"
              className="px-3 py-2 text-[14px] font-bold text-blue-deep underline-offset-4 hover:underline"
            >
              Tôi đã có tài khoản
            </Link>
          </div>
          <ul className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] font-semibold text-ink-2 lg:justify-start">
            <li className="flex items-center gap-1.5">
              <Check size={15} className="text-green" aria-hidden="true" /> Không cần thẻ ngân hàng
            </li>
            <li className="flex items-center gap-1.5">
              <Check size={15} className="text-green" aria-hidden="true" />
              {catalog ? `Bài 1–${catalog.free_lesson_max}` : "Các bài đầu"} luôn miễn phí
            </li>
            <li className="flex items-center gap-1.5">
              <Check size={15} className="text-green" aria-hidden="true" /> Không tự gia hạn
            </li>
          </ul>
        </div>
        <div className="flex justify-center lg:justify-end">
          <div className="relative pt-14">
            <div
              className="absolute inset-0 -z-10 scale-110 rounded-full bg-blue-soft blur-3xl"
              aria-hidden="true"
            />
            <Mascot mood="wave" interactive className="absolute -top-6 right-4 h-20 w-20" />
            <span className="absolute -left-3 top-4 z-10 rotate-[-6deg] rounded-[14px] bg-card px-3 py-1.5 text-[14px] font-bold shadow-elev-2">
              안녕하세요!
            </span>
            <FlashcardDemo />
          </div>
        </div>
      </section>

      {/* proof: what you get, in numbers that hold */}
      <section aria-label="Haru tóm tắt" className="grid grid-cols-2 gap-3 pb-12 sm:grid-cols-4">
        {[
          { k: "70+", v: "bài theo chủ đề" },
          { k: "15 phút", v: "đều đặn mỗi ngày" },
          { k: "AI", v: "chấm nói & viết 51–52" },
          { k: "8 bài", v: "học thử miễn phí" },
        ].map((s, n) => (
          <Reveal key={s.k} delay={n * 80}>
            <div className="h-full rounded-[20px] border border-line bg-card px-4 py-4 text-center shadow-elev-1">
              <p className="text-[26px] font-extrabold text-blue-deep">{s.k}</p>
              <p className="mt-0.5 text-[13px] font-semibold text-ink-2">{s.v}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* the story: Hành trình Thiên Nga */}
      <section className="border-t border-line py-12" aria-label="Hành trình Thiên Nga">
        <Reveal>
          <JourneyShowcase />
        </Reveal>
      </section>

      {/* features */}
      <section className="space-y-12 border-t border-line py-12" aria-label="Haru có gì">
        <Feature
          tone="bg-green-soft"
          shots={[
            {
              src: "/landing/lesson.webp",
              alt: "Một bài học: nghe, từ vựng, ngữ pháp và luyện tập",
            },
            { src: "/landing/review.webp", alt: "Ôn tập thẻ từ đúng lúc sắp quên" },
          ]}
          title="Học ngắn, nhớ lâu"
          body="Hơn 70 bài theo chủ đề đời sống, công sở và TOPIK, từ sơ cấp đến cao cấp. Mỗi từ, mỗi mẫu ngữ pháp được nhắc lại đúng lúc bạn sắp quên, nên mười lăm phút mỗi ngày là đủ để tiến bộ."
          points={[
            "Từ vựng có ví dụ và **âm thanh chuẩn**",
            "Ngữ pháp **giải thích bằng tiếng Việt**",
            "**Ôn đúng lúc sắp quên** (lặp lại ngắt quãng)",
          ]}
        />
        <Feature
          flip
          tone="bg-blue-soft"
          shots={[
            { src: "/landing/talk.webp", alt: "Trò chuyện bằng giọng nói với Haru" },
            { src: "/landing/debate.webp", alt: "Tranh luận, đàm phán, phản biện theo tình huống" },
          ]}
          title="Nói chuyện thật với Haru"
          body="Haru trò chuyện bằng giọng nói theo đúng bài bạn đang học, gợi ý khi bạn bí, rồi chấm phát âm từng câu. Khi đã quen, luyện trình bày có cấu trúc và tranh luận, đàm phán như ở lớp học hay công ty Hàn."
          points={[
            "Trò chuyện, Trình bày, **Tranh luận · Đàm phán · Phản biện**",
            "Chấm **theo đúng trình độ** của bạn",
            "Gợi ý dùng **chính kiến thức bạn đã học**",
          ]}
          extra={
            <div className="mt-3 flex gap-2 text-ink-2">
              <Mic size={18} aria-hidden="true" />
              <Presentation size={18} aria-hidden="true" />
              <Gavel size={18} aria-hidden="true" />
            </div>
          }
        />
        <Feature
          tone="bg-yellow-soft"
          shots={[
            { src: "/landing/mistakes.webp", alt: "Sổ lỗi sai với giải thích từng đáp án" },
            { src: "/landing/writing.webp", alt: "Luyện viết câu 51–52 TOPIK II" },
          ]}
          title="Luyện thi TOPIK có AI chấm"
          body="Luyện từng dạng câu hỏi theo trình độ. Viết câu 51–52 được AI chấm ngay: lỗi ở đâu, sửa thế nào, viết lại ra sao. Câu 54 có hẳn một khoá bài học từ đọc đề đến ráp bài."
          points={[
            "Đề luyện **theo dạng và trình độ**",
            "**AI nhận xét câu 51–52** ngay sau khi viết",
            "**Giải thích từng đáp án**",
          ]}
        />
        <Feature
          flip
          tone="bg-danger-soft"
          shots={[
            { src: "/landing/progress.webp", alt: "Báo cáo tiến bộ và điểm yếu" },
            { src: "/landing/present.webp", alt: "Trình bày có cấu trúc, chấm theo trình độ" },
          ]}
          title="Biết mình đang ở đâu"
          body="Haru ghi lại điểm mạnh, lỗi hay lặp lại và tiến bộ qua từng tuần, để bạn biết hôm nay nên ôn gì thay vì học lan man."
          points={[
            "**Báo cáo tiến bộ** theo kỹ năng",
            "**Sổ lỗi** và sổ câu cần luyện",
            "**Kế hoạch học** mỗi ngày",
          ]}
        />
      </section>

      {/* the four kinds of practice, tried on the page */}
      <section className="border-t border-line py-12" aria-label="Xem Haru chấm và sửa">
        <div className="lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-10">
          <div className="mb-6 lg:sticky lg:top-24">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-blue-deep">
              Xem Haru sửa bài trong 30 giây
            </p>
            <h2 className="mt-2 text-[26px] font-extrabold leading-tight sm:text-[32px]">
              Nói, trình bày, tranh luận, viết: Haru sửa ngay
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-ink-2">
              Không chỉ học từ. Bạn nói và viết thật, Haru chỉ đúng chỗ sai, vì sao sai và câu nào
              hay hơn, theo trình độ của bạn.
            </p>
            <p className="mt-2 text-[13px] font-semibold text-ink-2">
              Bấm “Xem tiếp” để thấy Haru hỏi, sửa và nhận xét, đúng như trong app. Mỗi tài khoản có
              lượt dùng thử Haru Nói miễn phí.
            </p>
          </div>
          <SkillDemos />
        </div>
      </section>

      {/* how it works */}
      <section className="border-t border-line py-12" aria-label="Bắt đầu thế nào">
        <Reveal>
          <h2 className="text-center text-[28px] font-extrabold leading-tight">
            Bắt đầu trong 3 bước, chưa đến 5 phút
          </h2>
        </Reveal>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: <Sparkles size={22} />,
              t: "Chọn bài đầu tiên",
              b: "Học ngay trên trình duyệt điện thoại hoặc máy tính, bắt đầu từ Bài 1. Đăng nhập để Haru lưu tiến độ cho bạn.",
            },
            {
              icon: <BookOpenCheck size={22} />,
              t: "Học 15 phút mỗi ngày",
              b: "Từ vựng có âm thanh, ngữ pháp giải thích bằng tiếng Việt. Một bài học dài có thể chia làm nhiều buổi, Haru nhớ chỗ bạn đang dừng.",
            },
            {
              icon: <Mic size={22} />,
              t: "Ôn và nói với Haru",
              b: "Haru nhắc ôn đúng lúc sắp quên và nói chuyện với bạn bằng chính từ vựng, ngữ pháp vừa học.",
            },
          ].map((step, n) => (
            <Reveal key={step.t} delay={n * 100}>
              <li className="relative h-full rounded-[22px] border border-line bg-card p-5 shadow-elev-1">
                <span className="absolute right-4 top-3 text-[40px] font-extrabold leading-none text-hanji-mark">
                  {n + 1}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-blue-soft text-blue-deep">
                  {step.icon}
                </span>
                <h3 className="mt-3 text-[17px] font-bold">{step.t}</h3>
                <p className="mt-1 text-[14px] font-medium leading-6 text-ink-2">{step.b}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* pricing teaser */}
      <section className="border-t border-line py-12" aria-label="Giá">
        <h2 className="text-center text-[28px] font-extrabold leading-tight">
          Học thử miễn phí, trả khi bạn cần
        </h2>
        <p className="mx-auto mt-2 max-w-[560px] text-center text-[15px] font-medium leading-6 text-ink-2">
          Không thuê bao, không tự gia hạn. Mỗi gói thanh toán một lần bằng chuyển khoản QR.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PriceCard
            title="Miễn phí"
            price="0đ"
            lines={[
              `Bài 1–${catalog?.free_lesson_max ?? 8} đầy đủ`,
              "Ôn tập & theo dõi tiến bộ",
              `Dùng thử nói với Haru ${catalog?.trial?.live_trial_minutes ?? 5} phút (một lần)`,
            ]}
            highlight
            cta={
              <Link
                to="/lesson"
                className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-[12px] bg-green text-[13px] font-bold uppercase tracking-wide text-primary-foreground"
              >
                Bắt đầu ngay <ArrowRight size={15} aria-hidden="true" />
              </Link>
            }
          />
          <PriceCard
            title="Gói bài học"
            price={selling && from("lesson_pack") ? `từ ${from("lesson_pack")}` : "Sắp mở bán"}
            lines={["Theo lộ trình, từ Sơ cấp đến TOPIK II", "Mua một lần, học trọn đời"]}
          />
          <PriceCard
            title="Pass Luyện thi"
            price={selling && from("exam_pass") ? `từ ${from("exam_pass")}` : "Sắp mở bán"}
            lines={["Luyện đề, AI chấm viết câu 51–52", "30 hoặc 90 ngày"]}
          />
          <PriceCard
            title="Haru Nói"
            price={selling && from("feature_pass") ? `từ ${from("feature_pass")}` : "Sắp mở bán"}
            lines={["Luyện nói 1-1 với AI, tính theo phút", speakLine(catalog?.products)]}
          />
        </div>
        <div className="mt-6 text-center">
          <Link to="/pricing" className="text-[14px] font-bold text-blue-deep underline">
            Xem bảng giá chi tiết
          </Link>
        </div>
      </section>

      {/* commitments: rights and duties */}
      <section className="border-t border-line py-12" aria-label="Cam kết">
        <h2 className="text-center text-[28px] font-extrabold leading-tight">
          Minh bạch trước khi bạn trả tiền
        </h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[22px] border border-line bg-card p-5 shadow-elev-1">
            <h3 className="flex items-center gap-2 text-[17px] font-bold">
              <HeartHandshake size={20} className="text-green" aria-hidden="true" /> Quyền lợi của
              bạn
            </h3>
            <ul className="mt-3 space-y-2.5 text-[14px] font-medium leading-6">
              <Pledge icon={<RotateCcw size={16} />}>
                Thanh toán một lần, <b className="lp-key">không tự gia hạn, không trừ tiền ngầm</b>.
              </Pledge>
              <Pledge icon={<BadgeCheck size={16} />}>
                <b className="lp-key">Học thử 8 bài trước khi mua</b>; thanh toán lỗi hay chuyển
                nhầm luôn được xử lý.{" "}
                <Link to="/refund" className="font-semibold text-blue-deep underline">
                  Chính sách hoàn tiền
                </Link>
                .
              </Pledge>
              <Pledge icon={<ShieldCheck size={16} />}>
                Thanh toán bằng quét mã QR; Haru không lưu thẻ hay tài khoản ngân hàng, không bán dữ
                liệu của bạn.{" "}
                <Link to="/privacy" className="font-semibold text-blue-deep underline">
                  Chính sách bảo mật
                </Link>
                .
              </Pledge>
              <Pledge icon={<ReceiptText size={16} />}>
                Mọi đơn hàng có lịch sử rõ ràng; hỗ trợ trả lời trong 2 ngày làm việc.
              </Pledge>
            </ul>
          </div>
          <div className="rounded-[22px] border border-line bg-card p-5 shadow-elev-1">
            <h3 className="flex items-center gap-2 text-[17px] font-bold">
              <Lock size={20} className="text-blue" aria-hidden="true" /> Khi dùng Haru, bạn đồng ý
            </h3>
            <ul className="mt-3 space-y-2.5 text-[14px] font-medium leading-6">
              <Pledge icon={<BookOpenCheck size={16} />}>
                Mỗi tài khoản cho một người học, không chia sẻ hay bán lại.
              </Pledge>
              <Pledge icon={<BookOpenCheck size={16} />}>
                Nội dung chỉ để tự học, không sao chép hay phát tán.
              </Pledge>
              <Pledge icon={<BookOpenCheck size={16} />}>
                Kết quả chấm của AI là để luyện tập, không thay cho kết quả thi chính thức.
              </Pledge>
              <Pledge icon={<BookOpenCheck size={16} />}>
                Luyện nói với AI có hạn mức ghi rõ trên gói: số phút của gói và tối đa 20 phút mỗi
                ngày.{" "}
                <Link to="/terms" className="font-semibold text-blue-deep underline">
                  Điều khoản sử dụng
                </Link>
                .
              </Pledge>
            </ul>
          </div>
        </div>
      </section>

      {/* questions people ask before they start */}
      <section className="border-t border-line py-12" aria-label="Câu hỏi thường gặp">
        <h2 className="text-center text-[28px] font-extrabold leading-tight">Câu hỏi thường gặp</h2>
        <Accordion type="single" collapsible className="mx-auto mt-6 max-w-[720px]">
          {faqs(catalog?.free_lesson_max ?? 8).map((f) => (
            <AccordionItem key={f.q} value={f.q} className="border-line">
              <AccordionTrigger className="text-[15px] font-bold hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-[14px] font-medium leading-6 text-ink-2">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* final call */}
      <section
        ref={endRef}
        className="my-6 rounded-[28px] bg-blue px-6 py-10 text-center text-primary-foreground shadow-elev-2"
      >
        <Mascot mood="cheer" className="mx-auto h-28 w-28" />
        <h2 className="mt-3 text-[26px] font-extrabold leading-tight">
          Bắt đầu bài đầu tiên ngay hôm nay
        </h2>
        <p className="mt-1.5 text-[14px] font-medium opacity-90">Mất chưa đến 5 phút. Miễn phí.</p>
        <Link
          to="/lesson"
          className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded-[16px] bg-card px-8 text-[15px] font-bold uppercase tracking-wide text-blue-deep shadow-[0_4px_0_0_rgba(0,0,0,0.15)]"
        >
          Học thử miễn phí
        </Link>
      </section>
      <StickyCta hero={heroRef} end={endRef} />
    </PublicShell>
  );
}

function faqs(freeMax: number): { q: string; a: ReactNode }[] {
  return [
    {
      q: "Haru có thật sự miễn phí không?",
      a: `Có. Bài 1–${freeMax} luôn miễn phí và đầy đủ, cùng ôn tập, theo dõi tiến bộ và Hành trình Thiên Nga. Bạn chỉ trả tiền khi muốn mở thêm bài, luyện thi hay luyện nói với AI.`,
    },
    {
      q: "Người mới bắt đầu có học được không?",
      a: "Được, kể cả khi chưa biết chữ. Bài 1 dạy bảng chữ cái và phát âm trong 5 phần ngắn, đọc toàn từ của bài 2, nên học xong là vào câu giới thiệu đầu tiên được ngay. Mỗi từ có âm thanh chuẩn, ngữ pháp giải thích bằng tiếng Việt theo đúng lỗi người Việt hay mắc.",
    },
    {
      q: "Mỗi ngày cần học bao lâu?",
      a: "Khoảng mười lăm phút. Một bài học dài có thể chia làm nhiều buổi, Haru nhớ chỗ bạn đang dừng và nhắc lại từ, mẫu câu đúng lúc bạn sắp quên. Học đều mỗi ngày hiệu quả hơn học dồn.",
    },
    {
      q: "Thanh toán thế nào, có bị tự trừ tiền không?",
      a: "Mỗi gói thanh toán một lần bằng cách quét mã QR để chuyển khoản. Không thuê bao, không tự gia hạn, và Haru không lưu thẻ hay tài khoản ngân hàng của bạn.",
    },
    {
      q: "Mua nhầm hoặc đổi ý thì có được hoàn tiền không?",
      a: (
        <>
          Có. Bạn được hoàn tiền 100% trong 7 ngày kể từ lúc thanh toán nếu chưa dùng phần trả phí
          của gói; lỗi thanh toán luôn được xử lý. Chi tiết ở{" "}
          <Link to="/refund" className="font-semibold text-blue-deep underline">
            Chính sách hoàn tiền
          </Link>
          .
        </>
      ),
    },
    {
      q: "Cần thiết bị gì để học?",
      a: "Điện thoại hoặc máy tính có trình duyệt là đủ. Để luyện nói với Haru, bạn cần cho phép dùng micro.",
    },
  ];
}

interface Shot {
  src: string;
  alt: string;
}

/** A real screen of the app in a phone outline (screenshots in public/landing, 600×1298). */
function PhoneShot({
  src,
  alt,
  className,
  eager = false,
}: Shot & { className?: string; eager?: boolean }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[34px] border-[6px] border-ink/90 bg-card shadow-elev-2",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        width={600}
        height={1298}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="block h-auto w-full"
      />
    </div>
  );
}

function FeatureBody({
  tone,
  shots,
  title,
  body,
  points,
  flip = false,
  extra,
}: {
  tone: string;
  shots: [Shot, Shot?];
  title: string;
  body: string;
  points: string[];
  flip?: boolean;
  extra?: ReactNode;
}) {
  const [main, side] = shots;
  return (
    <div
      className={cn(
        "grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14",
        flip && "md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]",
      )}
    >
      <div className={cn("flex justify-center", flip && "md:order-2")}>
        {/* the phones rise out of a tinted card and are cut off by its bottom edge */}
        <div
          className={cn(
            "relative h-[360px] w-full max-w-[400px] overflow-hidden rounded-[36px] sm:h-[420px]",
            tone,
          )}
        >
          {side && (
            <PhoneShot
              {...side}
              className={cn(
                "lp-float-late absolute top-16 w-[150px] sm:w-[175px]",
                flip ? "left-4 rotate-[-4deg]" : "right-4 rotate-[4deg]",
              )}
            />
          )}
          <PhoneShot
            {...main}
            className={cn(
              "lp-float absolute top-8 w-[200px] sm:w-[230px]",
              side
                ? flip
                  ? "right-6 sm:right-10"
                  : "left-6 sm:left-10"
                : "left-1/2 -translate-x-1/2",
            )}
          />
        </div>
      </div>
      <div>
        <h3 className="text-[24px] font-extrabold leading-tight text-blue-deep">{title}</h3>
        <p className="mt-2 text-[15px] font-medium leading-7 text-ink-2">{body}</p>
        <ul className="mt-3 space-y-1 text-[14px] font-semibold">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-green">✓</span> <span>{marked(p)}</span>
            </li>
          ))}
        </ul>
        {extra}
      </div>
    </div>
  );
}

/** "**từ khoá**" in a point is tinted, so the line can be read at a glance. */
function marked(text: string): ReactNode {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? (
      <b key={i} className="lp-key">
        {part}
      </b>
    ) : (
      part
    ),
  );
}

/** The speaking passes as the catalogue sells them ("100 phút / 30 ngày hoặc 300 phút / 90 ngày"). */
function speakLine(
  products:
    { kind: string; minutes?: number | null; days?: number | null; active?: boolean }[] | undefined,
) {
  const passes = (products ?? []).filter((p) => p.kind === "feature_pass" && p.minutes && p.days);
  if (!passes.length) return "Tính theo phút, dùng trong 30 hoặc 90 ngày";
  return passes.map((p) => `${p.minutes} phút / ${p.days} ngày`).join(" hoặc ");
}

function Feature(props: Parameters<typeof FeatureBody>[0]) {
  return (
    <Reveal>
      <FeatureBody {...props} />
    </Reveal>
  );
}

function PriceCard({
  title,
  price,
  lines,
  highlight = false,
  cta,
}: {
  title: string;
  price: string;
  lines: string[];
  highlight?: boolean;
  cta?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-[22px] border bg-card p-5 shadow-elev-1",
        highlight ? "border-2 border-green" : "border-line",
      )}
    >
      {highlight && (
        <span className="absolute -top-3 left-5 rounded-full bg-green px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
          Bắt đầu ở đây
        </span>
      )}
      <p className="text-[13px] font-bold uppercase tracking-wide text-ink-2">{title}</p>
      <p className="mt-1 text-[24px] font-extrabold">{price}</p>
      <ul className="mt-2 space-y-1 text-[13px] font-semibold text-ink-2">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {cta && <div className="mt-auto">{cta}</div>}
    </div>
  );
}

function Pledge({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-1 shrink-0 text-blue">{icon}</span>
      <span>{children}</span>
    </li>
  );
}
