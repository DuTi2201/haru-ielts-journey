import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ADMIN_KEY } from "@/components/admin/admin-kit";
import { SupportChannels } from "@/components/billing/SupportChannels";
import { BTN, BTN_SM, FIELD } from "@/components/haru/studio-kit";
import { Field, GlassPanel, PanelTitle } from "@/components/haru/studio-ui";
import { adminSetSupport, adminSupport } from "@/lib/api/billing";
import { errorMessage } from "@/lib/api/client";
import type { SupportAdminOut, SupportIn } from "@/lib/api/types";
import { CATALOG_KEY } from "@/lib/billing";
import { cn } from "@/lib/utils";

const KEY = [...ADMIN_KEY, "support"] as const;

const FIELDS: { key: keyof SupportIn; label: string; placeholder: string }[] = [
  { key: "zalo", label: "Zalo", placeholder: "Số điện thoại Zalo, hoặc https://zalo.me/…" },
  { key: "telegram", label: "Telegram", placeholder: "@ten_nguoi_dung hoặc https://t.me/…" },
  { key: "messenger", label: "Messenger", placeholder: "Tên trang, hoặc https://m.me/…" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/…" },
  { key: "email", label: "Email", placeholder: "hotro@ten-mien.vn" },
  { key: "phone", label: "Điện thoại", placeholder: "0912 345 678" },
];

/** The help channels learners see behind every "Hỗ trợ" button, the contact page and the
 * payment dialog. */
export function SupportPanel() {
  const q = useQuery({ queryKey: KEY, queryFn: adminSupport });
  return (
    <GlassPanel>
      <PanelTitle icon={<LifeBuoy size={16} className="text-blue" />}>Thông tin hỗ trợ</PanelTitle>
      <p className="mb-3 mt-1 text-xs font-medium leading-5 text-ink-2">
        Người học thấy các kênh này khi bấm “Hỗ trợ”, ở trang Liên hệ và khi thanh toán gặp lỗi. Để
        trống kênh nào thì kênh đó không hiện. Kênh đầu tiên có giá trị (theo thứ tự dưới đây) là
        nút chính.
      </p>
      {q.isError && <p className="text-sm font-semibold text-danger">{errorMessage(q.error)}</p>}
      {q.data && <SupportForm key={JSON.stringify(q.data)} value={q.data} />}
    </GlassPanel>
  );
}

function SupportForm({ value }: { value: SupportAdminOut }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...FIELDS.map((f) => f.key), "hours", "note"].map((k) => [
        k,
        (value[k as keyof SupportIn] as string | null | undefined) ?? "",
      ]),
    ),
  );
  const save = useMutation({
    mutationFn: () =>
      adminSetSupport(
        Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim() || null])),
      ),
    onSuccess: () => {
      toast.success("Đã lưu thông tin hỗ trợ");
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: CATALOG_KEY });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set = (k: string) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="grid gap-2 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="text-[11px] font-semibold text-ink-2">
            {f.label}
            <Field
              label={f.label}
              placeholder={f.placeholder}
              value={draft[f.key]}
              maxLength={200}
              onChange={set(f.key)}
            />
          </label>
        ))}
        <label className="text-[11px] font-semibold text-ink-2 sm:col-span-2">
          Giờ hỗ trợ
          <Field
            label="Giờ hỗ trợ"
            placeholder="vd: 8:00–22:00 mỗi ngày"
            value={draft["hours"]}
            maxLength={300}
            onChange={set("hours")}
          />
        </label>
        <label className="text-[11px] font-semibold text-ink-2 sm:col-span-2">
          Ghi chú cho người học
          <textarea
            className={FIELD}
            rows={2}
            maxLength={300}
            placeholder="vd: Hỏi về đơn hàng thì gửi kèm mã đơn."
            value={draft["note"]}
            onChange={set("note")}
          />
        </label>
        <div className="flex justify-end sm:col-span-2">
          <button
            type="button"
            className={cn(BTN.primary, BTN_SM)}
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            Lưu
          </button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold text-ink-2">Người học đang thấy</p>
        <SupportChannels support={value.shown} />
      </div>
    </div>
  );
}
