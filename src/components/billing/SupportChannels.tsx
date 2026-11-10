import { AtSign, Clock, Facebook, Mail, MessageCircle, Phone, Send } from "lucide-react";
import type { ComponentType } from "react";

import type { SupportKind, SupportOut } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const ICON: Record<SupportKind, ComponentType<{ size?: number; className?: string }>> = {
  zalo: MessageCircle,
  telegram: Send,
  messenger: AtSign,
  facebook: Facebook,
  email: Mail,
  phone: Phone,
};

const VERB: Record<SupportKind, string> = {
  zalo: "Nhắn Zalo",
  telegram: "Nhắn Telegram",
  messenger: "Nhắn Messenger",
  facebook: "Trang Facebook",
  email: "Gửi email",
  phone: "Gọi điện",
};

/** The help channels an admin set (admin page → Tổng quan → Thông tin hỗ trợ), each opening its
 * own app: a chat, the mail app, the phone. */
export function SupportChannels({
  support,
  className,
}: {
  support: SupportOut | null | undefined;
  className?: string;
}) {
  const links = support?.links ?? [];
  if (!links.length) {
    return (
      <p className={cn("text-[13px] font-medium text-ink-2", className)}>
        Thông tin liên hệ đang được cập nhật.
      </p>
    );
  }
  return (
    <div className={cn("space-y-2", className)}>
      <ul className="space-y-1.5">
        {links.map((l) => {
          const Icon = ICON[l.kind];
          const external = l.url.startsWith("https://");
          return (
            <li key={l.kind}>
              <a
                href={l.url}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="hit-area flex items-center gap-3 rounded-[14px] border border-line bg-card px-3 py-2.5 text-left shadow-elev-1 transition-transform active:scale-[0.98]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-soft text-blue-deep">
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">{VERB[l.kind]}</span>
                  <span className="block truncate text-[12px] font-medium text-ink-2">
                    {l.value}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      {(support?.hours || support?.note) && (
        <div className="space-y-1 px-1 text-[12px] font-medium leading-5 text-ink-2">
          {support.hours && (
            <p className="flex items-center gap-1.5">
              <Clock size={13} aria-hidden="true" /> {support.hours}
            </p>
          )}
          {support.note && <p>{support.note}</p>}
        </div>
      )}
    </div>
  );
}
