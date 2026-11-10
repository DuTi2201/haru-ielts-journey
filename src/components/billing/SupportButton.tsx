import { Link } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";

import { SupportChannels } from "@/components/billing/SupportChannels";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCatalog } from "@/lib/billing";
import { cn } from "@/lib/utils";

/** "Cần hỗ trợ?": the help channels an admin set (Zalo, Telegram, email, phone…) in a small
 * panel; the contact page when none is set yet. */
export function SupportButton({
  className,
  label = "Hỗ trợ",
  variant = "pill",
}: {
  className?: string;
  label?: string;
  variant?: "pill" | "link";
}) {
  const { catalog } = useCatalog();
  const cls =
    variant === "pill"
      ? "hit-area inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-[13px] font-semibold shadow-elev-1 active:scale-[0.97]"
      : "inline-flex items-center gap-1.5 text-[13px] font-semibold text-blue-deep";
  const inner = (
    <>
      <LifeBuoy size={15} strokeWidth={2.4} aria-hidden="true" /> {label}
    </>
  );
  if (!catalog?.support?.links.length) {
    return (
      <Link to="/contact" className={cn(cls, className)}>
        {inner}
      </Link>
    );
  }
  return (
    <Popover>
      <PopoverTrigger className={cn(cls, className)}>{inner}</PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="mb-1 text-[15px] font-semibold">Haru hỗ trợ bạn</p>
        <p className="mb-3 text-[12px] font-medium leading-5 text-ink-2">
          Chọn cách liên hệ tiện nhất. Hỏi về đơn hàng thì gửi kèm mã đơn nhé.
        </p>
        <SupportChannels support={catalog.support} />
      </PopoverContent>
    </Popover>
  );
}
