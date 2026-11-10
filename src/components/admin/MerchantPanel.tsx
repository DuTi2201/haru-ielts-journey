import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ADMIN_KEY } from "@/components/admin/admin-kit";
import { BTN, BTN_SM } from "@/components/haru/studio-kit";
import { Field, GlassPanel, PanelTitle } from "@/components/haru/studio-ui";
import { adminMerchant, adminSetMerchant } from "@/lib/api/billing";
import { errorMessage } from "@/lib/api/client";
import type { MerchantAdminOut, MerchantIn } from "@/lib/api/types";
import { CATALOG_KEY } from "@/lib/billing";
import { cn } from "@/lib/utils";

const KEY = [...ADMIN_KEY, "merchant"] as const;

const FIELDS: { key: keyof MerchantIn; label: string; placeholder: string; wide?: boolean }[] = [
  {
    key: "name",
    label: "Tên đơn vị vận hành",
    placeholder: "vd: Hộ kinh doanh Vũ Văn Dương",
    wide: true,
  },
  { key: "tax_id", label: "Mã số thuế", placeholder: "10 chữ số" },
  { key: "phone", label: "Điện thoại", placeholder: "0912 345 678" },
  { key: "email", label: "Email", placeholder: "hotro@ten-mien.vn", wide: true },
  { key: "address", label: "Địa chỉ", placeholder: "Số nhà, phường, tỉnh/thành", wide: true },
];

/** Thông tin vận hành: saved once, read by the footer, /contact and /terms. */
export function MerchantPanel() {
  const q = useQuery({ queryKey: KEY, queryFn: adminMerchant });
  return (
    <GlassPanel>
      <PanelTitle icon={<Building2 size={16} className="text-blue" />}>
        Thông tin vận hành
      </PanelTitle>
      <p className="mb-3 mt-1 text-xs font-medium leading-5 text-ink-2">
        Lưu một lần, hiện ở chân trang, trang Liên hệ và Điều khoản. Ô để trống dùng giá trị trong
        cấu hình máy chủ.
      </p>
      {q.isError && <p className="text-sm font-semibold text-danger">{errorMessage(q.error)}</p>}
      {q.data && <MerchantForm key={JSON.stringify(q.data)} value={q.data} />}
    </GlassPanel>
  );
}

function MerchantForm({ value }: { value: MerchantAdminOut }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, value[f.key] ?? ""])),
  );
  const save = useMutation({
    mutationFn: () =>
      adminSetMerchant(
        Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim() || null])),
      ),
    onSuccess: () => {
      toast.success("Đã lưu thông tin vận hành");
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: CATALOG_KEY });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const shown = value.shown;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="grid gap-2 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label
            key={f.key}
            className={cn("text-[11px] font-semibold text-ink-2", f.wide && "sm:col-span-2")}
          >
            {f.label}
            <Field
              label={f.label}
              placeholder={f.placeholder}
              value={draft[f.key]}
              maxLength={200}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            />
          </label>
        ))}
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
      <div className="text-xs font-semibold leading-5">
        <p className="mb-2 text-[11px] text-ink-2">Người học đang thấy</p>
        <p>{shown.name || "Đang cập nhật"}</p>
        {shown.tax_id && <p className="text-ink-2">MST: {shown.tax_id}</p>}
        {shown.address && <p className="text-ink-2">{shown.address}</p>}
        {(shown.phone || shown.email) && (
          <p className="text-ink-2">{[shown.phone, shown.email].filter(Boolean).join(" · ")}</p>
        )}
      </div>
    </div>
  );
}
