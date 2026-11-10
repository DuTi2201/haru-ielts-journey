import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, Plus, RotateCcw, Tag, TicketPercent } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ADMIN_KEY } from "@/components/admin/admin-kit";
import { Field, GlassPanel, PanelTitle } from "@/components/haru/studio-ui";
import { BTN, BTN_SM, FIELD } from "@/components/haru/studio-kit";
import {
  adminCoupons,
  adminCreateCoupon,
  adminFeatures,
  adminProducts,
  adminResetProduct,
  adminSetFeature,
  adminSetProduct,
  adminSetTrial,
  adminTrial,
  adminUpdateCoupon,
} from "@/lib/api/billing";
import { errorMessage } from "@/lib/api/client";
import type { AdminProductOut, CouponOut, FeatureRuleOut, TrialOut } from "@/lib/api/types";
import { CATALOG_KEY, formatVnd } from "@/lib/billing";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<AdminProductOut["kind"], string> = {
  lesson_pack: "Gói bài học",
  exam_pass: "Pass Luyện thi",
  feature_pass: "Haru Nói",
  combo: "Combo",
};

/** Prices, the AI speaking allowance and discount codes: what an admin changes without a deploy. */
export function SalesTab() {
  return (
    <div className="space-y-5 xl:grid xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:items-start xl:gap-5 xl:space-y-0">
      <ProductsPanel />
      <div className="space-y-5">
        <FeaturesPanel />
        <CouponsPanel />
      </div>
    </div>
  );
}

function useRefreshSales() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [...ADMIN_KEY, "sales"] });
    void qc.invalidateQueries({ queryKey: CATALOG_KEY });
  };
}

// ---------------------------------------------------------------- products

function ProductsPanel() {
  const products = useQuery({
    queryKey: [...ADMIN_KEY, "sales", "products"],
    queryFn: adminProducts,
  });
  return (
    <GlassPanel>
      <PanelTitle icon={<Tag size={16} className="text-blue" />}>Giá từng gói</PanelTitle>
      <p className="mb-3 mt-1 text-xs font-medium leading-5 text-ink-2">
        Đổi giá, giá gốc (gạch ngang), tên, mô tả, hoặc tạm ngừng bán. Áp dụng cho đơn mới ngay; đơn
        đã tạo giữ giá cũ, gói đã bán vẫn dùng được. Thứ mà gói mở (bài nào, bao nhiêu ngày) đổi
        trong code.
      </p>
      {products.isError && (
        <p className="text-sm font-semibold text-danger">{errorMessage(products.error)}</p>
      )}
      <ul className="space-y-2">
        {(products.data ?? []).map((p) => (
          <ProductEditor key={p.code} product={p} />
        ))}
      </ul>
    </GlassPanel>
  );
}

function ProductEditor({ product: p }: { product: AdminProductOut }) {
  const refresh = useRefreshSales();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(p.amount));
  const [compare, setCompare] = useState(p.compare_at ? String(p.compare_at) : "");
  const [title, setTitle] = useState(p.title_vi);
  const [blurb, setBlurb] = useState(p.blurb_vi);
  const [active, setActive] = useState(p.active);
  const save = useMutation({
    mutationFn: () =>
      adminSetProduct(p.code, {
        amount: Number(amount),
        compare_at: compare.trim() ? Number(compare) : null,
        title_vi: title.trim() === p.default_title_vi ? null : title.trim(),
        blurb_vi: blurb.trim(),
        active,
      }),
    onSuccess: () => {
      toast.success(`Đã lưu giá ${p.code}`);
      setOpen(false);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reset = useMutation({
    mutationFn: () => adminResetProduct(p.code),
    onSuccess: () => {
      toast.success("Đã trả về giá mặc định");
      setOpen(false);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const n = Number(amount);
  const amountOk = Number.isInteger(n) && n >= 2000 && n <= 50_000_000;
  const c = Number(compare);
  const compareOk = !compare.trim() || (Number.isInteger(c) && c > n);

  return (
    <li className={cn("rounded-[16px] border border-line bg-card p-3", !p.active && "opacity-70")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">
            {p.title_vi}
            {!p.active && (
              <span className="ml-1.5 rounded-full bg-progress px-2 py-0.5 text-[10px] text-ink-2">
                ngừng bán
              </span>
            )}
            {p.overridden && (
              <span className="ml-1.5 rounded-full bg-blue-soft px-2 py-0.5 text-[10px] text-blue-deep">
                đã chỉnh
              </span>
            )}
          </p>
          <p className="text-[11px] font-semibold text-ink-2">
            {KIND_LABEL[p.kind]} · {p.code}
            {p.days ? ` · ${p.days} ngày` : ""}
            {p.amount !== p.default_amount ? ` · mặc định ${formatVnd(p.default_amount)}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-right text-[13px] font-bold tabular-nums">
          {p.compare_at && (
            <span className="mr-1 text-[11px] text-ink-2 line-through">
              {formatVnd(p.compare_at)}
            </span>
          )}
          {formatVnd(p.amount)}
        </span>
      </button>
      {open && (
        <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
          <label className="text-[11px] font-semibold text-ink-2">
            Giá bán (đ)
            <Field
              label="Giá bán"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              className={cn(!amountOk && "border-danger")}
            />
          </label>
          <label className="text-[11px] font-semibold text-ink-2">
            Giá gốc gạch ngang (đ, để trống nếu không)
            <Field
              label="Giá gốc"
              inputMode="numeric"
              value={compare}
              onChange={(e) => setCompare(e.target.value.replace(/\D/g, ""))}
              className={cn(!compareOk && "border-danger")}
            />
          </label>
          <label className="text-[11px] font-semibold text-ink-2 sm:col-span-2">
            Tên hiển thị
            <Field
              label="Tên"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="text-[11px] font-semibold text-ink-2 sm:col-span-2">
            Mô tả
            <textarea
              value={blurb}
              maxLength={1000}
              rows={3}
              onChange={(e) => setBlurb(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] font-semibold">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{" "}
            Đang bán
          </label>
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            {p.overridden && (
              <button
                type="button"
                className={cn(BTN.soft, BTN_SM)}
                disabled={reset.isPending}
                onClick={() => reset.mutate()}
              >
                <RotateCcw size={13} /> Về mặc định
              </button>
            )}
            <button
              type="button"
              className={cn(BTN.primary, BTN_SM)}
              disabled={!amountOk || !compareOk || save.isPending}
              onClick={() => save.mutate()}
            >
              Lưu
            </button>
          </div>
          {!amountOk && (
            <p className="text-[11px] font-semibold text-danger sm:col-span-2">
              Giá từ 2.000đ đến 50.000.000đ.
            </p>
          )}
          {!compareOk && (
            <p className="text-[11px] font-semibold text-danger sm:col-span-2">
              Giá gốc phải cao hơn giá bán.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------- feature rules

const MODE_LABEL: Record<FeatureRuleOut["mode"], string> = {
  trial: "Dùng thử 1 lần",
  free: "Miễn phí",
  paid: "Chỉ gói",
};

function FeaturesPanel() {
  const refresh = useRefreshSales();
  const rules = useQuery({ queryKey: [...ADMIN_KEY, "sales", "features"], queryFn: adminFeatures });
  const trial = useQuery({ queryKey: [...ADMIN_KEY, "sales", "trial"], queryFn: adminTrial });
  const save = useMutation({
    mutationFn: ({ r, mode }: { r: FeatureRuleOut; mode: FeatureRuleOut["mode"] }) =>
      adminSetFeature(r.feature, { mode }),
    onSuccess: () => {
      toast.success("Đã lưu");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <GlassPanel>
      <PanelTitle icon={<Mic size={16} className="text-blue" />}>
        Haru Nói: dùng thử miễn phí
      </PanelTitle>
      <p className="mb-3 mt-1 text-xs font-medium leading-5 text-ink-2">
        Mỗi tài khoản chưa có gói được dùng thử <b>một lần duy nhất</b>, không làm mới theo ngày. Số
        phút dùng chung cho Trò chuyện và Tranh luận (Gemini Live tính tiền theo phút); phiên dùng
        thử bị cắt đúng số phút còn lại. Hết phần dùng thử thì được mời mua gói.
      </p>
      {trial.data && (
        <TrialForm key={JSON.stringify(trial.data)} value={trial.data} onSaved={refresh} />
      )}
      <ul className="mt-3 space-y-2">
        {(rules.data ?? []).map((r) => (
          <li
            key={r.feature}
            className="flex flex-wrap items-center gap-2 rounded-[16px] border border-line bg-card p-3"
          >
            <div className="min-w-[150px] flex-1">
              <p className="text-[13px] font-semibold">{r.label_vi}</p>
              <p className="text-[11px] font-semibold text-ink-2">
                {r.mode === "trial"
                  ? `Dùng thử: ${r.trial_amount} ${r.trial_unit}${r.trial_shared ? " (chung)" : ""}`
                  : MODE_LABEL[r.mode]}
              </p>
            </div>
            <div
              className="flex gap-1 rounded-full bg-fill p-1"
              role="radiogroup"
              aria-label={`Cách bán ${r.label_vi}`}
            >
              {(["trial", "free", "paid"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={r.mode === m}
                  disabled={save.isPending}
                  onClick={() => r.mode !== m && save.mutate({ r, mode: m })}
                  className={cn(
                    "min-h-8 rounded-full px-3 text-[11px] font-semibold",
                    r.mode === m ? "bg-card text-ink shadow-elev-1" : "text-ink-2",
                  )}
                >
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

function TrialForm({ value, onSaved }: { value: TrialOut; onSaved: () => void }) {
  const [minutes, setMinutes] = useState(String(value.live_trial_minutes));
  const [tries, setTries] = useState(String(value.present_trial_tries));
  const m = Number(minutes);
  const t = Number(tries);
  const ok = Number.isInteger(m) && m >= 5 && m <= 60 && Number.isInteger(t) && t >= 0 && t <= 20;
  const changed = m !== value.live_trial_minutes || t !== value.present_trial_tries;
  const save = useMutation({
    mutationFn: () => adminSetTrial({ live_trial_minutes: m, present_trial_tries: t }),
    onSuccess: () => {
      toast.success("Đã lưu phần dùng thử");
      onSaved();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="grid gap-2 rounded-[16px] border border-line bg-card p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-[11px] font-semibold text-ink-2">
        Phút nói với Haru (5–60)
        <Field
          label="Phút dùng thử"
          inputMode="numeric"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      <label className="text-[11px] font-semibold text-ink-2">
        Lượt chấm Trình bày (0–20)
        <Field
          label="Lượt dùng thử"
          inputMode="numeric"
          value={tries}
          onChange={(e) => setTries(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      <button
        type="button"
        className={cn(BTN.primary, BTN_SM)}
        disabled={!ok || !changed || save.isPending}
        onClick={() => save.mutate()}
      >
        Lưu
      </button>
      {!ok && (
        <p className="text-[11px] font-semibold text-danger sm:col-span-3">
          Phút từ 5 đến 60, lượt từ 0 đến 20.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- coupons

function CouponsPanel() {
  const refresh = useRefreshSales();
  const coupons = useQuery({ queryKey: [...ADMIN_KEY, "sales", "coupons"], queryFn: adminCoupons });
  const products = useQuery({
    queryKey: [...ADMIN_KEY, "sales", "products"],
    queryFn: adminProducts,
  });
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [only, setOnly] = useState<string[]>([]);
  const [maxUses, setMaxUses] = useState("");
  const [once, setOnce] = useState(true);
  const [ends, setEnds] = useState("");
  const [note, setNote] = useState("");
  const create = useMutation({
    mutationFn: () =>
      adminCreateCoupon({
        code,
        percent_off: kind === "percent" ? Number(value) : null,
        amount_off: kind === "amount" ? Number(value) : null,
        product_codes: only.length ? only : null,
        max_uses: maxUses ? Number(maxUses) : null,
        once_per_learner: once,
        ends_at: ends ? new Date(`${ends}T23:59:59+07:00`).toISOString() : null,
        note: note || null,
      }),
    onSuccess: (c) => {
      toast.success(`Đã tạo mã ${c.code}`);
      setCode("");
      setValue("");
      setOnly([]);
      setMaxUses("");
      setEnds("");
      setNote("");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: (c: CouponOut) => adminUpdateCoupon(c.code, { active: !c.active }),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const v = Number(value);
  const valueOk = kind === "percent" ? v >= 1 && v <= 90 : v >= 1000;
  const codeOk = /^[A-Za-z0-9_-]{3,32}$/.test(code);

  return (
    <GlassPanel>
      <PanelTitle icon={<TicketPercent size={16} className="text-blue" />}>Mã giảm giá</PanelTitle>
      <p className="mb-3 mt-1 text-xs font-medium leading-5 text-ink-2">
        Giá sau giảm không thấp hơn 2.000đ và được làm tròn xuống nghìn. Lượt dùng chỉ tính khi đơn
        đã thanh toán; đơn đang chờ giữ chỗ. Mã không xoá được (đơn cũ còn ghi), chỉ tắt.
      </p>
      <div className="grid gap-2 rounded-[16px] border border-line bg-card p-3 sm:grid-cols-2">
        <Field
          label="Mã"
          placeholder="Mã (vd. CHAOMUNG)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <div className="flex gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "percent" | "amount")}
            className={cn(FIELD, "w-auto")}
            aria-label="Kiểu giảm"
          >
            <option value="percent">Giảm %</option>
            <option value="amount">Giảm tiền</option>
          </select>
          <Field
            label="Mức giảm"
            inputMode="numeric"
            placeholder={kind === "percent" ? "1–90" : "đ"}
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <Field
          label="Số lượt tối đa"
          inputMode="numeric"
          placeholder="Số lượt (trống = không giới hạn)"
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ""))}
        />
        <label className="text-[11px] font-semibold text-ink-2">
          Hết hạn sau ngày (trống = không hết hạn)
          <Field
            label="Ngày hết hạn"
            type="date"
            value={ends}
            onChange={(e) => setEnds(e.target.value)}
          />
        </label>
        <div className="sm:col-span-2">
          <p className="text-[11px] font-semibold text-ink-2">Áp dụng cho (không chọn = mọi gói)</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(products.data ?? []).map((p) => (
              <button
                key={p.code}
                type="button"
                aria-pressed={only.includes(p.code)}
                onClick={() =>
                  setOnly((xs) =>
                    xs.includes(p.code) ? xs.filter((x) => x !== p.code) : [...xs, p.code],
                  )
                }
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  only.includes(p.code)
                    ? "border-blue bg-blue-soft text-blue-deep"
                    : "border-line bg-card",
                )}
              >
                {p.title_vi}
              </button>
            ))}
          </div>
        </div>
        <Field
          label="Ghi chú"
          placeholder="Ghi chú (vd. tặng nhóm học Zalo)"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          className="sm:col-span-2"
        />
        <label className="flex items-center gap-2 text-[12px] font-semibold">
          <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} /> Mỗi
          người dùng một lần
        </label>
        <div className="flex justify-end">
          <button
            type="button"
            className={cn(BTN.primary, BTN_SM)}
            disabled={!codeOk || !valueOk || create.isPending}
            onClick={() => create.mutate()}
          >
            <Plus size={13} /> Tạo mã
          </button>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {(coupons.data ?? []).map((c) => (
          <li
            key={c.code}
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-[16px] border border-line bg-card p-3",
              !c.active && "opacity-60",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold tracking-wide">
                {c.code} <span className="font-semibold text-green">· {c.label_vi}</span>
              </p>
              <p className="text-[11px] font-semibold text-ink-2">
                Đã dùng {c.used}
                {c.max_uses ? `/${c.max_uses}` : ""} ·{" "}
                {c.product_codes?.length ? `${c.product_codes.length} gói` : "mọi gói"}
                {c.once_per_learner ? " · mỗi người 1 lần" : ""}
                {c.ends_at ? ` · hết hạn ${new Date(c.ends_at).toLocaleDateString("vi-VN")}` : ""}
                {c.note ? ` · ${c.note}` : ""}
              </p>
            </div>
            <button
              type="button"
              className={cn(c.active ? BTN.soft : BTN.ok, BTN_SM)}
              disabled={toggle.isPending}
              onClick={() => toggle.mutate(c)}
            >
              {c.active ? "Tắt" : "Bật lại"}
            </button>
          </li>
        ))}
        {coupons.data?.length === 0 && (
          <p className="text-[12px] font-semibold text-ink-2">Chưa có mã nào.</p>
        )}
      </ul>
    </GlassPanel>
  );
}
