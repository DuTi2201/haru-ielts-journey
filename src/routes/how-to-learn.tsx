import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Mascot } from "@/components/mascot/Mascot";
import { BulletList } from "@/components/lesson/Disclosure";
import { GuidedModeToggle } from "@/components/lesson/GuidedModeToggle";
import { Shell } from "@/components/lesson/LessonShell";
import { Rich } from "@/components/lesson/Rich";
import { useAuth } from "@/hooks/use-auth";
import { tap } from "@/lib/feedback";
import { writeLocal } from "@/lib/lesson-local";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/how-to-learn")({
  head: () => ({
    meta: [
      { title: "Cách học hiệu quả — Haru" },
      {
        name: "description",
        content: "Ba màn ngắn về cách học một bài trong Haru để nhớ lâu.",
      },
      { property: "og:title", content: "Cách học hiệu quả — Haru" },
      {
        property: "og:description",
        content: "Ba màn ngắn về cách học một bài trong Haru để nhớ lâu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowToLearnScreen,
});

const BTN =
  "flex min-h-11 items-center justify-center gap-2 rounded-full border border-line px-5 text-sm font-semibold shadow-elev-2 active:scale-[0.97] ";

interface Screen {
  title: string;
  lead: string;
}
const SCREENS: Screen[] = [
  {
    title: "Học thế nào cho nhớ lâu?",
    lead: "Ba thói quen nhỏ, áp dụng được ngay từ bài đầu tiên.",
  },
  { title: "Một bài học đi thế nào", lead: "Năm việc, làm theo thứ tự. Bài nào cũng như vậy." },
  { title: "Sổ tay của bạn", lead: "Chép ít, nhưng chép đúng chỗ." },
];

const REMEMBER = [
  "**Tự nhớ trước, xem đáp án sau.** Che nghĩa, đoán, rồi mới lật. Đoán sai vẫn có ích.",
  "**Ít mà đều.** Mỗi ngày một chút tốt hơn dồn một buổi dài. Haru nhắc bạn ôn đúng lúc sắp quên (cần đăng nhập).",
  "**Chép có chọn lọc.** Đừng chép lại cả bài. Chỉ ghi lỗi của bạn và câu bạn tự đặt.",
];

const STEPS: { name: string; text: string }[] = [
  {
    name: "Nghe",
    text: "Nghe cả bài một lần, chưa cần nhìn chữ. Rồi nghe lại, lần này có chữ.",
  },
  {
    name: "Từ vựng",
    text: "Dùng “Thẻ ghi nhớ”, đoán nghĩa trước khi lật. Bắt đầu với các từ “Cần thuộc ngay”.",
  },
  { name: "Ngữ pháp", text: "Đọc mẫu, rồi tự đặt một câu của riêng bạn trước khi làm bài." },
  { name: "Luyện tập", text: "Sai thì đọc giải thích, chép lại câu đúng, làm lại." },
  { name: "Ôn tập hôm nay", text: "Vài phút mỗi ngày, đúng lúc Haru nhắc (cần đăng nhập)." },
];

const NOTEBOOK = [
  "**Lỗi của tôi:** câu bạn làm sai và câu đúng. Haru tự gom câu sai vào Sổ lỗi sai (cần đăng nhập).",
  "**Câu tôi tự đặt:** mỗi mẫu ngữ pháp một câu về chính bạn.",
  "**Mẫu cần nhớ:** những mẫu bạn hay nhầm, mỗi mẫu một dòng.",
];

function HowToLearnScreen() {
  const auth = useAuth();
  const [index, setIndex] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const screen = SCREENS[index]!;
  const last = index === SCREENS.length - 1;

  // seeing the page is enough: the lesson picker stops offering the card
  useEffect(() => {
    writeLocal("howto-seen", true);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  const go = (next: number) => {
    tap();
    setIndex(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <Shell>
      <header className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-ink-2">
          Cách học · {index + 1}/{SCREENS.length}
        </p>
        <Link
          to="/lesson"
          onClick={() => tap()}
          className="hit-area -mr-2 inline-flex min-h-9 items-center rounded-full px-2 text-xs font-semibold text-blue-deep active:scale-95"
        >
          Bỏ qua
        </Link>
      </header>

      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {SCREENS.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full border border-line",
              i <= index ? "bg-blue" : "bg-card",
            )}
          />
        ))}
      </div>

      <section aria-label={screen.title} className="mt-5 lg:max-w-[520px]">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold leading-tight outline-none"
        >
          {screen.title}
        </h1>
        <p className="mt-1 text-[13px] font-medium leading-5 text-ink-2">{screen.lead}</p>

        {index === 0 && <BulletList items={REMEMBER} className="mt-4 space-y-3" />}

        {index === 1 && (
          <ol className="mt-4 space-y-2.5">
            {STEPS.map((s, i) => (
              <li
                key={s.name}
                className="flex gap-3 rounded-[16px] border border-line bg-card px-3.5 py-3"
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue text-xs font-semibold text-primary-foreground"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-5">{s.name}</p>
                  <Rich as="p" text={s.text} className="text-xs leading-5 text-ink-2" />
                </div>
              </li>
            ))}
          </ol>
        )}

        {index === 2 && (
          <>
            <p className="mt-4 text-xs font-semibold leading-5">Ba mục là đủ:</p>
            <BulletList items={NOTEBOOK} className="mt-2 space-y-3" />
            <Link
              to="/mistakes"
              onClick={() => tap()}
              className="hit-area mt-3 inline-flex min-h-9 items-center text-xs font-semibold text-blue-deep underline"
            >
              Mở Sổ lỗi sai
            </Link>
            {auth.isAnonymous && (
              <p className="mt-4 rounded-[14px] bg-yellow-soft px-3.5 py-2.5 text-xs font-semibold leading-5">
                Đăng nhập để Haru lưu tiến trình và lịch ôn của bạn.{" "}
                <Link to="/support-language" className="font-semibold text-blue-deep underline">
                  Đăng nhập
                </Link>
              </p>
            )}
            <div className="mt-5">
              <p className="text-xs font-semibold">Bạn muốn học theo cách nào?</p>
              <GuidedModeToggle className="mt-2" />
              <p className="mt-2 text-[12px] font-medium leading-4 text-ink-2">
                “Có hướng dẫn” hiện các gợi ý ngắn trong bài. “Tự do” tắt chúng. Đổi lúc nào cũng
                được, ngay trong khối “Việc cần làm” của mỗi bài.
              </p>
            </div>
          </>
        )}
      </section>

      <aside className="mt-6 flex items-end gap-2.5">
        <Mascot mood="thinking" className="h-14 w-14 shrink-0" />
        <p className="mb-1 rounded-[18px_18px_18px_4px] border border-line bg-card px-4 py-3 text-xs font-semibold leading-5 shadow-elev-1">
          Không cần nhớ hết ngay. Bài nào cũng có khối “Việc cần làm” để bạn xem lại.
        </p>
      </aside>

      <div className="mt-8 flex gap-2.5 lg:max-w-[520px]">
        {index > 0 && (
          <button
            type="button"
            onClick={() => go(index - 1)}
            className={cn(BTN, "bg-card")}
            aria-label="Màn trước"
          >
            <ArrowLeft size={16} strokeWidth={2.8} />
          </button>
        )}
        {last ? (
          <Link
            to="/lesson"
            onClick={() => tap()}
            className={cn(BTN, "flex-1 bg-blue text-primary-foreground")}
          >
            Bắt đầu học <ArrowRight size={16} strokeWidth={2.8} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => go(index + 1)}
            className={cn(BTN, "flex-1 bg-blue text-primary-foreground")}
          >
            Tiếp <ArrowRight size={16} strokeWidth={2.8} />
          </button>
        )}
      </div>
    </Shell>
  );
}
