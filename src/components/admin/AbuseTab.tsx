import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Globe, Lock, MailX, Monitor, Plus, ShieldAlert, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ADMIN_KEY, ago, formatDate, type SetAdminSearch } from "@/components/admin/admin-kit";
import { Pill, StatTile } from "@/components/admin/admin-ui";
import { Field, GlassPanel, PanelTitle } from "@/components/haru/studio-ui";
import { BTN, BTN_SM } from "@/components/haru/studio-kit";
import {
  addBlockedDomain,
  getAbuseClusters,
  getAbuseOverview,
  lockMany,
  removeBlockedDomain,
  setAbuseGuard,
} from "@/lib/api/admin";
import { errorMessage } from "@/lib/api/client";
import type { AbuseCluster, AbuseGuard } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const KEY = [...ADMIN_KEY, "abuse"] as const;

/** The free trial's guard: what it gave away today, its numbers, the accounts that share a browser
 * or a network (locked together when they break the terms), and throwaway-mail domains. */
export function AbuseTab({ setSearch }: { setSearch: SetAdminSearch }) {
  return (
    <div className="space-y-5 xl:grid xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:items-start xl:gap-5 xl:space-y-0">
      <ClustersPanel setSearch={setSearch} />
      <div className="space-y-5">
        <TodayPanel />
        <DomainsPanel />
      </div>
    </div>
  );
}

function useOverview() {
  return useQuery({ queryKey: [...KEY, "overview"], queryFn: getAbuseOverview });
}

// ---------------------------------------------------------------- today + guard

function TodayPanel() {
  const overview = useOverview();
  const t = overview.data?.today;
  const g = overview.data?.guard;
  return (
    <GlassPanel>
      <PanelTitle icon={<ShieldAlert size={16} className="text-blue" />}>
        Dùng thử hôm nay
      </PanelTitle>
      {overview.isError && (
        <p className="mt-2 text-sm font-semibold text-danger">{errorMessage(overview.error)}</p>
      )}
      {t && g && (
        <>
          {!g.trial_enabled && (
            <p className="mt-2 rounded-[14px] bg-danger-soft px-3 py-2 text-[12px] font-semibold text-danger">
              Dùng thử đang TẠM DỪNG cho mọi người.
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <StatTile
              label="Phút nói đã cấp"
              value={t.live_cap ? `${t.live_minutes}/${t.live_cap}` : t.live_minutes}
              hint={t.live_cap ? undefined : "không giới hạn"}
              tone={t.live_cap && t.live_minutes >= t.live_cap * 0.9 ? "alert" : undefined}
            />
            <StatTile
              label="Lượt chấm trình bày"
              value={t.present_cap ? `${t.present_tries}/${t.present_cap}` : t.present_tries}
              hint={t.present_cap ? undefined : "không giới hạn"}
            />
            <StatTile label="Tài khoản dùng thử" value={t.trial_accounts} />
            <StatTile label="Tài khoản mới" value={t.new_accounts} />
          </div>
          <GuardForm key={JSON.stringify(g)} value={g} />
        </>
      )}
    </GlassPanel>
  );
}

const NUMBERS: {
  key: Exclude<keyof AbuseGuard, "trial_enabled">;
  label: string;
  hint: string;
  min: number;
  max: number;
}[] = [
  {
    key: "trial_daily_minutes",
    label: "Tổng phút dùng thử mỗi ngày",
    hint: "Cho cả hệ thống, 0 = không giới hạn. Hết thì tạm dừng tới 0h.",
    min: 0,
    max: 100_000,
  },
  {
    key: "trial_daily_present_tries",
    label: "Tổng lượt chấm thử mỗi ngày",
    hint: "0 = không giới hạn.",
    min: 0,
    max: 100_000,
  },
  {
    key: "trial_accounts_per_device",
    label: "Tài khoản được thử / trình duyệt",
    hint: "1 = mỗi trình duyệt chỉ một tài khoản được dùng thử.",
    min: 1,
    max: 10,
  },
  {
    key: "trial_accounts_per_ip_daily",
    label: "Tài khoản mới dùng thử / mạng / 24h",
    hint: "Mềm: ký túc xá, 4G có thể chung một IP.",
    min: 1,
    max: 1000,
  },
  {
    key: "signup_per_ip_daily",
    label: "Tài khoản tạo / mạng / 24h",
    hint: "Lớp học đăng ký cùng lúc thì nâng tạm số này.",
    min: 1,
    max: 1000,
  },
];

function GuardForm({ value }: { value: AbuseGuard }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(NUMBERS.map((n) => [n.key, String(value[n.key])])),
  );
  const save = useMutation({
    mutationFn: (body: Partial<AbuseGuard>) => setAbuseGuard(body),
    onSuccess: (g) => {
      toast.success(g.trial_enabled ? "Đã lưu" : "Đã tạm dừng dùng thử");
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const parsed = NUMBERS.map((n) => {
    const v = Number(draft[n.key]);
    return { ...n, v, ok: draft[n.key] !== "" && Number.isInteger(v) && v >= n.min && v <= n.max };
  });
  const ok = parsed.every((p) => p.ok);
  const changed = parsed.some((p) => p.v !== value[p.key]);

  return (
    <div className="mt-3 space-y-3 rounded-[16px] border border-line bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold">Công tắc dùng thử</p>
          <p className="text-[11px] font-semibold text-ink-2">
            Tắt khi thấy bị lạm dụng hoặc chi phí Gemini tăng bất thường.
          </p>
        </div>
        <button
          type="button"
          className={cn(value.trial_enabled ? BTN.danger : BTN.ok, BTN_SM)}
          disabled={save.isPending}
          onClick={() => {
            if (value.trial_enabled && !window.confirm("Tạm dừng dùng thử cho mọi người?")) return;
            save.mutate({ trial_enabled: !value.trial_enabled });
          }}
        >
          {value.trial_enabled ? "Tạm dừng" : "Bật lại"}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {parsed.map((p) => (
          <label key={p.key} className="text-[11px] font-semibold text-ink-2">
            {p.label}
            <Field
              label={p.label}
              inputMode="numeric"
              value={draft[p.key]}
              onChange={(e) =>
                setDraft((d) => ({ ...d, [p.key]: e.target.value.replace(/\D/g, "") }))
              }
              className={cn(!p.ok && "border-danger")}
            />
            <span className="mt-0.5 block font-medium">{p.hint}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className={cn(BTN.primary, BTN_SM)}
          disabled={!ok || !changed || save.isPending}
          onClick={() => save.mutate(Object.fromEntries(parsed.map((p) => [p.key, p.v])))}
        >
          Lưu giới hạn
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- clusters

function ClustersPanel({ setSearch }: { setSearch: SetAdminSearch }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"all" | "device" | "ip">("device");
  const [days, setDays] = useState(30);
  const [trialOnly, setTrialOnly] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const clusters = useQuery({
    queryKey: [...KEY, "clusters", kind, days, trialOnly],
    queryFn: () => getAbuseClusters({ kind, days, trialOnly }),
  });
  const emails = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clusters.data ?? []) for (const a of c.accounts) m.set(a.id, a.email);
    return m;
  }, [clusters.data]);
  const lock = useMutation({
    mutationFn: () => lockMany([...picked], reason),
    onSuccess: (r) => {
      toast.success(
        `Đã khoá ${r.locked} tài khoản` +
          (r.already ? `, ${r.already} đã khoá từ trước` : "") +
          (r.skipped ? `, bỏ qua ${r.skipped} (nhân viên / chính bạn)` : ""),
      );
      setPicked(new Set());
      void qc.invalidateQueries({ queryKey: ADMIN_KEY });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = (ids: string[], on: boolean) =>
    setPicked((s) => {
      const next = new Set(s);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  return (
    <GlassPanel>
      <PanelTitle icon={<Ban size={16} className="text-danger" />}>Nghi lạm dụng</PanelTitle>
      <p className="mb-3 mt-1 text-xs font-medium leading-5 text-ink-2">
        Các tài khoản dùng chung một <b>trình duyệt</b> hoặc một <b>mạng (IP)</b>. Chung trình duyệt
        và cùng dùng thử là dấu hiệu rõ nhất. Chung mạng thường vô hại (ký túc xá, trường, 4G): xem
        kỹ ngày tạo và email trước khi khoá. Khoá không xoá dữ liệu, mở lại được ở trang học viên.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-fill p-1" role="radiogroup" aria-label="Loại">
          {(
            [
              ["device", "Trình duyệt"],
              ["ip", "Mạng"],
              ["all", "Cả hai"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "min-h-8 rounded-full px-3 text-[11px] font-semibold",
                kind === k ? "bg-card text-ink shadow-elev-1" : "text-ink-2",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          aria-label="Khoảng thời gian"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="min-h-9 rounded-full border border-line bg-card px-3 text-[12px] font-semibold"
        >
          {[7, 30, 90, 365].map((d) => (
            <option key={d} value={d}>
              {d} ngày
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[12px] font-semibold">
          <input
            type="checkbox"
            checked={trialOnly}
            onChange={(e) => setTrialOnly(e.target.checked)}
          />
          Chỉ nhóm có ≥ 2 tài khoản đã dùng thử
        </label>
      </div>

      {picked.size > 0 && (
        <div className="sticky top-2 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-[16px] border border-danger/40 bg-card p-3 shadow-elev-1">
          <p className="text-[13px] font-semibold">Đã chọn {picked.size} tài khoản</p>
          <Field
            label="Lý do khoá"
            placeholder="Lý do (mặc định: tạo nhiều tài khoản để dùng thử lại)"
            value={reason}
            maxLength={255}
            onChange={(e) => setReason(e.target.value)}
            className="min-w-[200px] flex-1"
          />
          <button
            type="button"
            className={cn(BTN.soft, BTN_SM)}
            onClick={() => setPicked(new Set())}
          >
            Bỏ chọn
          </button>
          <button
            type="button"
            className={cn(BTN.danger, BTN_SM)}
            disabled={lock.isPending}
            onClick={() => {
              const list = [...picked]
                .map((id) => emails.get(id) ?? id)
                .slice(0, 8)
                .join("\n");
              const more = picked.size > 8 ? `\n… và ${picked.size - 8} tài khoản nữa` : "";
              if (window.confirm(`Khoá ${picked.size} tài khoản?\n\n${list}${more}`)) lock.mutate();
            }}
          >
            <Lock size={13} /> Khoá {picked.size}
          </button>
        </div>
      )}

      {clusters.isError && (
        <p className="mt-3 text-sm font-semibold text-danger">{errorMessage(clusters.error)}</p>
      )}
      {clusters.isLoading && <p className="mt-3 text-sm font-semibold text-ink-2">Đang tải…</p>}
      {clusters.data && clusters.data.length === 0 && (
        <p className="mt-3 rounded-[16px] border border-line bg-card p-4 text-center text-[13px] font-semibold text-ink-2">
          Chưa thấy nhóm nào đáng ngờ trong {days} ngày qua.
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {(clusters.data ?? []).map((c) => (
          <ClusterCard
            key={`${c.kind}-${c.key}`}
            cluster={c}
            picked={picked}
            toggle={toggle}
            open={(id) => setSearch({ learner: id })}
          />
        ))}
      </ul>
    </GlassPanel>
  );
}

function ClusterCard({
  cluster: c,
  picked,
  toggle,
  open,
}: {
  cluster: AbuseCluster;
  picked: Set<string>;
  toggle: (ids: string[], on: boolean) => void;
  open: (id: string) => void;
}) {
  const lockable = c.accounts
    .filter((a) => a.role === "learner" && !a.disabled_at)
    .map((a) => a.id);
  const all = lockable.length > 0 && lockable.every((id) => picked.has(id));
  const Icon = c.kind === "device" ? Monitor : Globe;
  return (
    <li className="rounded-[16px] border border-line bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Icon size={15} className={c.kind === "device" ? "text-danger" : "text-ink-2"} />
        <p className="min-w-0 flex-1 text-[13px] font-semibold">
          {c.kind === "device" ? "Trình duyệt" : "Mạng"}{" "}
          <span className="font-mono text-[11px] text-ink-2">#{c.key}</span>
          <span className="ml-2 text-[12px] text-ink-2">
            {c.accounts.length} tài khoản · {c.trial_accounts} đã dùng thử · {ago(c.last_seen)}
          </span>
        </p>
        {lockable.length > 0 && (
          <button
            type="button"
            className={cn(BTN.soft, BTN_SM)}
            onClick={() => toggle(lockable, !all)}
          >
            {all ? "Bỏ chọn nhóm" : "Chọn cả nhóm"}
          </button>
        )}
      </div>
      <ul className="mt-2 divide-y divide-line">
        {c.accounts.map((a) => {
          const canLock = a.role === "learner" && !a.disabled_at;
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
              <input
                type="checkbox"
                aria-label={`Chọn ${a.email}`}
                disabled={!canLock}
                checked={picked.has(a.id)}
                onChange={(e) => toggle([a.id], e.target.checked)}
              />
              <button
                type="button"
                onClick={() => open(a.id)}
                className="min-w-0 flex-1 text-left"
                title="Mở trang học viên"
              >
                <span className="block truncate text-[13px] font-semibold underline-offset-2 hover:underline">
                  {a.email}
                </span>
                <span className="block text-[11px] font-semibold text-ink-2">
                  tạo {formatDate(a.created_at)} · thấy {ago(a.last_seen)}
                  {a.trial_live_minutes ? ` · thử ${a.trial_live_minutes} phút` : ""}
                  {a.trial_present_tries ? ` · ${a.trial_present_tries} lượt chấm` : ""}
                </span>
              </button>
              {a.paid_orders > 0 && <Pill tone="ok">đã mua {a.paid_orders}</Pill>}
              {a.role !== "learner" && <Pill tone="info">{a.role}</Pill>}
              {a.disabled_at && <Pill tone="bad">đã khoá</Pill>}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

// ---------------------------------------------------------------- domains

function DomainsPanel() {
  const qc = useQueryClient();
  const overview = useOverview();
  const [domain, setDomain] = useState("");
  const add = useMutation({
    mutationFn: () => addBlockedDomain(domain),
    onSuccess: () => {
      toast.success(`Đã chặn ${domain.trim().replace(/^@/, "")}`);
      setDomain("");
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (d: string) => removeBlockedDomain(d),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const list = overview.data?.domains ?? [];
  return (
    <GlassPanel>
      <PanelTitle icon={<MailX size={16} className="text-blue" />}>Email tạm thời</PanelTitle>
      <p className="mb-3 mt-1 text-xs font-medium leading-5 text-ink-2">
        Đăng ký bằng email tạm thời bị từ chối theo danh sách có sẵn
        {overview.data
          ? ` (${overview.data.bundled_domains.toLocaleString("vi-VN")} tên miền)`
          : ""}
        . Thấy tên miền mới lọt qua thì thêm ở đây (chặn cả tên miền con). Gmail, Outlook, Yahoo…
        không chặn được.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (domain.trim()) add.mutate();
        }}
      >
        <Field
          label="Tên miền"
          placeholder="vd: tempmail.xyz"
          value={domain}
          maxLength={253}
          onChange={(e) => setDomain(e.target.value)}
        />
        <button
          type="submit"
          className={cn(BTN.primary, BTN_SM, "shrink-0")}
          disabled={!domain.trim() || add.isPending}
        >
          <Plus size={13} /> Chặn
        </button>
      </form>
      {list.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {list.map((d) => (
            <li
              key={d.domain}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-card py-1 pl-3 pr-1 text-[12px] font-semibold"
            >
              {d.domain}
              <button
                type="button"
                aria-label={`Bỏ chặn ${d.domain}`}
                className="grid h-6 w-6 place-items-center rounded-full text-ink-2 hover:bg-fill"
                disabled={remove.isPending}
                onClick={() => remove.mutate(d.domain)}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
