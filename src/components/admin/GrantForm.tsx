import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ADMIN_KEY, productName } from "@/components/admin/admin-kit";
import { ConfirmDialog, Field } from "@/components/haru/studio-ui";
import { BTN, FIELD } from "@/components/haru/studio-kit";
import { grantAccess } from "@/lib/api/admin";
import { errorMessage } from "@/lib/api/client";
import type { AdminEntitlementOut } from "@/lib/api/types";
import { useCatalog } from "@/lib/billing";
import { cn } from "@/lib/utils";

/** Gives a learner a right by hand: a pack, an exam pass for some days, or everything. The grant
 * leaves a trace (who, why) and can be revoked from the learner's page. With `email` the form is
 * for that learner only (inside the learner's page). */
export function GrantForm({
  email: fixedEmail,
  onGranted,
}: {
  email?: string;
  onGranted?: (row: AdminEntitlementOut) => void;
}) {
  const qc = useQueryClient();
  const { catalog } = useCatalog();
  const [email, setEmail] = useState(fixedEmail ?? "");
  const [code, setCode] = useState("");
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  const products = catalog?.products ?? [];
  const product = products.find((p) => p.code === code);
  const usesDays =
    code === "all" || product?.kind === "exam_pass" || product?.kind === "feature_pass";
  const daysValue = Number(days);
  const daysOk =
    !usesDays ||
    days.trim() === "" ||
    (Number.isInteger(daysValue) && daysValue >= 1 && daysValue <= 3650);
  const target = (fixedEmail ?? email).trim().toLowerCase();
  const ready = target.includes("@") && code !== "" && daysOk;

  const grant = useMutation({
    mutationFn: () =>
      grantAccess({
        email: target,
        product_code: code,
        ...(usesDays && days.trim() !== "" ? { days: daysValue } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (row) => {
      toast.success(`Đã cấp “${productName(catalog, row.product_code)}” cho ${target}`);
      void qc.invalidateQueries({ queryKey: ADMIN_KEY });
      setNote("");
      setDays("");
      onGranted?.(row);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // "everything, for life" is the one grant worth a second look
  const needsConfirm = code === "all" && days.trim() === "";
  const submit = () => (needsConfirm ? setConfirming(true) : grant.mutate());

  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) submit();
      }}
    >
      {fixedEmail === undefined && (
        <Field
          label="Email học viên"
          type="email"
          required
          autoComplete="off"
          placeholder="Email học viên (đúng như lúc đăng ký)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      )}
      <select
        aria-label="Quyền cần cấp"
        className={cn(FIELD, "cursor-pointer")}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      >
        <option value="">Chọn quyền cần cấp…</option>
        <optgroup label="Gói bài học (trọn đời)">
          {products
            .filter((p) => p.kind === "lesson_pack")
            .map((p) => (
              <option key={p.code} value={p.code}>
                {p.title_vi}
              </option>
            ))}
        </optgroup>
        <optgroup label="Pass luyện thi">
          {products
            .filter((p) => p.kind === "exam_pass")
            .map((p) => (
              <option key={p.code} value={p.code}>
                {p.title_vi}
              </option>
            ))}
        </optgroup>
        <optgroup label="Haru Nói (luyện nói AI)">
          {products
            .filter((p) => p.kind === "feature_pass")
            .map((p) => (
              <option key={p.code} value={p.code}>
                {p.title_vi}
              </option>
            ))}
        </optgroup>
        <optgroup label="Combo (cấp từng gói trong combo)">
          {products
            .filter((p) => p.kind === "combo")
            .map((p) => (
              <option key={p.code} value={p.code}>
                {p.title_vi}
              </option>
            ))}
        </optgroup>
        <optgroup label="Đặc biệt">
          <option value="all">Toàn quyền: mọi bài, Pass luyện thi và Haru Nói</option>
        </optgroup>
      </select>
      {usesDays && (
        <Field
          label="Số ngày"
          type="number"
          inputMode="numeric"
          min={1}
          max={3650}
          placeholder={
            code === "all"
              ? "Số ngày (bỏ trống = vô thời hạn)"
              : `Số ngày (bỏ trống = ${product?.days ?? 30} ngày)`
          }
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
      )}
      <Field
        label="Lý do"
        maxLength={500}
        placeholder="Lý do (quà tặng, nhận thiếu tiền…)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {!daysOk && (
        <p role="alert" className="text-xs font-semibold text-danger">
          Số ngày phải là số nguyên từ 1 đến 3650.
        </p>
      )}
      <button
        type="submit"
        className={cn(BTN.primary, "w-full")}
        disabled={!ready || grant.isPending}
      >
        <Gift size={14} strokeWidth={2.4} /> {grant.isPending ? "Đang cấp…" : "Cấp quyền"}
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Cấp toàn quyền vô thời hạn?"
        description={`${target} sẽ mở được mọi bài học và Pass luyện thi, không hết hạn. Bạn vẫn thu hồi được ở trang học viên.`}
        confirmLabel="Cấp toàn quyền"
        tone="warn"
        onConfirm={() => grant.mutate()}
      />
    </form>
  );
}
