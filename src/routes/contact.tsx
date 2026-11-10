import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone, Receipt } from "lucide-react";

import { SupportChannels } from "@/components/billing/SupportChannels";
import { PublicShell } from "@/components/site/PublicShell";
import { useCatalog } from "@/lib/billing";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Liên hệ & hỗ trợ — Haru" },
      { name: "description", content: "Liên hệ Haru: hỗ trợ học tập, thanh toán, hoàn tiền." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const { catalog } = useCatalog();
  const m = catalog?.merchant;
  return (
    <PublicShell>
      <div className="pt-8">
        <h1 className="text-[28px] font-bold leading-9">Liên hệ & hỗ trợ</h1>
        <p className="mt-2 text-[15px] leading-7">
          Cần giúp về bài học, thanh toán chưa mở khoá hay hoàn tiền? Nhắn cho Haru — chúng mình trả
          lời trong vòng 2 ngày làm việc, thường là sớm hơn.
        </p>
        <SupportChannels support={catalog?.support} className="mt-5 max-w-[420px]" />
        <Link
          to="/orders"
          className="hit-area mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-[13px] font-semibold shadow-elev-1"
        >
          <Receipt size={15} strokeWidth={2.4} aria-hidden="true" /> Đơn hàng của tôi
        </Link>

        <section className="mt-8 rounded-[20px] border border-line bg-card p-5 shadow-elev-1">
          <h2 className="text-[17px] font-bold">Đơn vị vận hành</h2>
          <dl className="mt-3 space-y-2 text-[14px] leading-6">
            <div>
              <dt className="text-[12px] font-semibold text-ink-2">Tên</dt>
              <dd className="font-semibold">{m?.name || "Đang cập nhật"}</dd>
            </div>
            {m?.tax_id && (
              <div>
                <dt className="text-[12px] font-semibold text-ink-2">Mã số thuế / ĐKKD</dt>
                <dd className="font-semibold">{m.tax_id}</dd>
              </div>
            )}
            {m?.address && (
              <div className="flex gap-2">
                <MapPin size={16} className="mt-1 shrink-0 text-blue" aria-hidden="true" />
                <dd className="font-semibold">{m.address}</dd>
              </div>
            )}
            {m?.email && (
              <div className="flex gap-2">
                <Mail size={16} className="mt-1 shrink-0 text-blue" aria-hidden="true" />
                <dd>
                  <a href={`mailto:${m.email}`} className="font-semibold text-blue-deep underline">
                    {m.email}
                  </a>
                </dd>
              </div>
            )}
            {m?.phone && (
              <div className="flex gap-2">
                <Phone size={16} className="mt-1 shrink-0 text-blue" aria-hidden="true" />
                <dd>
                  <a
                    href={`tel:${m.phone.replace(/\s+/g, "")}`}
                    className="font-semibold text-blue-deep underline"
                  >
                    {m.phone}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="text-[17px] font-bold">Khi báo lỗi thanh toán, gửi kèm</h2>
          <ul className="mt-2 space-y-1 text-[14px] leading-6 [&_li]:ml-5 [&_li]:list-disc">
            <li>Email tài khoản và mã đơn (ở trang Đơn hàng của tôi);</li>
            <li>Ngày giờ, số tiền, mã giao dịch ngân hàng hoặc ảnh chụp biên lai.</li>
          </ul>
        </section>
      </div>
    </PublicShell>
  );
}
