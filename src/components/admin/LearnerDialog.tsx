import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Lock, LockOpen, ShieldAlert, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  ADMIN_KEY,
  ago,
  entitlementState,
  ENTITLEMENT_LABEL,
  ENTITLEMENT_TONE,
  formatDate,
  formatDateTime,
  ORDER_LABEL,
  ORDER_TONE,
  productName,
  ROLE_LABEL,
  SOURCE_LABEL,
  type AdminGo,
} from "@/components/admin/admin-kit";
import { Pill, StatTile } from "@/components/admin/admin-ui";
import { GrantForm } from "@/components/admin/GrantForm";
import { BTN, BTN_SM, FIELD } from "@/components/haru/studio-kit";
import { ConfirmDialog, PanelError, PanelLoading } from "@/components/haru/studio-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  getAdminLearner,
  lockLearner,
  resetLearnerPassword,
  revokeEntitlement,
  setLearnerRole,
  unlockLearner,
} from "@/lib/api/admin";
import { errorMessage } from "@/lib/api/client";
import type { AdminEntitlementOut, AdminTemporaryPassword, Role } from "@/lib/api/types";
import { formatVnd, useCatalog } from "@/lib/billing";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["learner", "editor", "admin"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-[13px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function EntitlementRow({ row, onRevoke }: { row: AdminEntitlementOut; onRevoke: () => void }) {
  const { catalog } = useCatalog();
  const state = entitlementState(row);
  return (
    <li className="glass-row rounded-[14px] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
          {productName(catalog, row.product_code)}
        </span>
        <Pill tone={ENTITLEMENT_TONE[state]}>{ENTITLEMENT_LABEL[state]}</Pill>
      </div>
      <p className="mt-0.5 text-[12px] font-medium text-ink-2">
        {SOURCE_LABEL[row.source] ?? row.source} · từ {formatDate(row.starts_at)} ·{" "}
        {row.ends_at ? `đến ${formatDate(row.ends_at)}` : "trọn đời"}
      </p>
      {row.note ? (
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[12px] font-medium text-ink-2">
          {row.note}
        </p>
      ) : null}
      {(state === "active" || state === "future") && (
        <button type="button" onClick={onRevoke} className={cn(BTN.soft, BTN_SM, "mt-2")}>
          Thu hồi
        </button>
      )}
    </li>
  );
}

/** The temporary password, shown once. It lives only in this component's state: closing it (or
 * leaving the page) forgets it, and the server keeps only a hash. */
function TemporaryPasswordDialog({
  email,
  value,
  onClose,
}: {
  email: string;
  value: AdminTemporaryPassword | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value.temporary_password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Không sao chép được", {
        description: "Hãy chọn và chép tay mật khẩu bên dưới.",
      });
    }
  }

  return (
    <Dialog open={value !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="!glass-panel-strong w-[calc(100%-2.5rem)] max-w-[380px] rounded-[24px] !p-5 sm:rounded-[24px]"
      >
        <DialogTitle className="flex items-center gap-2 pr-6 text-base font-semibold">
          <KeyRound size={18} strokeWidth={2.4} className="shrink-0 text-blue" />
          Mật khẩu tạm đã sẵn sàng
        </DialogTitle>
        <DialogDescription className="text-xs font-medium leading-5 text-ink-2">
          Gửi cho <strong className="break-all text-ink">{email}</strong> qua kênh riêng (tin nhắn
          trực tiếp, không đăng nơi công khai). Hộp này chỉ hiện một lần; đóng rồi sẽ không xem lại
          được, nhưng bạn đặt lại được bất cứ lúc nào.
        </DialogDescription>
        <div className="glass-row flex items-center gap-2 rounded-[14px] px-3.5 py-3">
          <code
            aria-label="Mật khẩu tạm"
            className="min-w-0 flex-1 select-all break-all font-mono text-lg font-semibold tracking-wider"
          >
            {value?.temporary_password}
          </code>
          <button
            type="button"
            onClick={() => void copy()}
            className={cn(BTN.soft, BTN_SM, "shrink-0")}
            aria-label="Sao chép mật khẩu"
          >
            {copied ? (
              <Check size={14} strokeWidth={2.6} aria-hidden="true" />
            ) : (
              <Copy size={14} strokeWidth={2.4} aria-hidden="true" />
            )}
            {copied ? "Đã chép" : "Chép"}
          </button>
        </div>
        <p className="text-[12px] font-medium leading-4 text-ink-2">
          Dùng được đến {value ? formatDateTime(value.expires_at) : ""}. Lần đăng nhập đầu, học viên
          bị yêu cầu đổi sang mật khẩu riêng; mọi phiên đang đăng nhập của họ đã bị đăng xuất.
        </p>
        <button type="button" className={BTN.primary} onClick={onClose}>
          Đã gửi cho học viên
        </button>
      </DialogContent>
    </Dialog>
  );
}

/** One account in full: who, progress, what it holds (revocable), a grant form, orders and claims.
 * The role can be changed here (never your own), and the account locked or given a temporary
 * password (never an admin's, never your own). */
export function LearnerDialog({
  id,
  onClose,
  go,
}: {
  id: string;
  onClose: () => void;
  go: AdminGo;
}) {
  const qc = useQueryClient();
  const auth = useAuth();
  const { catalog } = useCatalog();
  const detail = useQuery({
    queryKey: [...ADMIN_KEY, "learner", id],
    queryFn: () => getAdminLearner(id),
  });
  const [role, setRole] = useState<Role | null>(null);
  const [confirmRole, setConfirmRole] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [tempPassword, setTempPassword] = useState<AdminTemporaryPassword | null>(null);

  const refresh = () => void qc.invalidateQueries({ queryKey: ADMIN_KEY });
  const changeRole = useMutation({
    mutationFn: (r: Role) => setLearnerRole(id, r),
    onSuccess: (row) => {
      toast.success(`${row.email} giờ là ${ROLE_LABEL[row.role]}`);
      setRole(null);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: (entitlementId: string) => revokeEntitlement(entitlementId),
    onSuccess: () => {
      toast.success("Đã thu hồi quyền");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const lock = useMutation({
    mutationFn: () => lockLearner(id, lockReason),
    onSuccess: (row) => {
      toast.success(`Đã khoá ${row.email}`, {
        description: "Họ bị đăng xuất ngay và không đăng nhập lại được cho đến khi bạn mở khoá.",
      });
      setLocking(false);
      setLockReason("");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const unlock = useMutation({
    mutationFn: () => unlockLearner(id),
    onSuccess: (row) => {
      toast.success(`Đã mở khoá ${row.email}`);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  // gcTime 0: the password it returns must not linger in the query cache after it is shown
  const resetPassword = useMutation({
    mutationFn: () => resetLearnerPassword(id),
    gcTime: 0,
    onSuccess: (tmp) => {
      setTempPassword(tmp);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const d = detail.data;
  const isSelf = d !== undefined && auth.profile?.id === d.id;
  const picked = role ?? d?.role ?? "learner";
  const roleChanged = d !== undefined && picked !== d.role;
  const toRevoke = d?.entitlements.find((e) => e.id === revoking);
  const locked = d?.disabled_at != null;
  const accountBusy = lock.isPending || unlock.isPending || resetPassword.isPending;
  const canManage = d !== undefined && !isSelf && d.role !== "admin";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!glass-panel-strong max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-[560px] overflow-y-auto rounded-[24px] !p-4 sm:rounded-[24px] lg:left-auto lg:right-0 lg:top-0 lg:h-dvh lg:max-h-dvh lg:w-[640px] lg:max-w-[640px] lg:translate-x-0 lg:translate-y-0 lg:rounded-none lg:rounded-l-[24px] lg:!p-6 lg:sm:rounded-l-[24px]">
        <DialogTitle className="flex items-center gap-2 pr-6 text-base font-semibold">
          <UserRound size={18} strokeWidth={2.4} className="shrink-0 text-blue" />
          <span className="min-w-0 truncate">{d ? d.display_name || d.email : "Học viên"}</span>
        </DialogTitle>
        <DialogDescription className="sr-only">
          Tiến độ, quyền đang có, đơn hàng và yêu cầu của tài khoản này.
        </DialogDescription>

        {detail.isLoading && <PanelLoading rows={3} label="Đang tải học viên…" />}
        {detail.isError && (
          <PanelError
            message={errorMessage(detail.error)}
            onRetry={() => void detail.refetch()}
            retrying={detail.isRefetching}
          />
        )}

        {d && (
          <div className="-mt-2">
            <p className="break-all text-xs font-semibold text-ink-2">{d.email}</p>
            <p className="mt-0.5 text-[12px] font-medium text-ink-2">
              Tham gia {formatDate(d.created_at)} · học lần cuối {ago(d.progress.last_active_at)}
              {d.goal ? ` · mục tiêu ${d.goal}` : ""}
              {d.exam_date ? ` · thi ${formatDate(d.exam_date)}` : ""}
            </p>

            <Section title="Vai trò">
              <div className="flex items-center gap-2">
                <select
                  aria-label="Vai trò"
                  className={cn(FIELD, "min-w-0 flex-1 cursor-pointer")}
                  value={picked}
                  disabled={isSelf || changeRole.isPending}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={cn(BTN.primary, "shrink-0")}
                  disabled={!roleChanged || changeRole.isPending}
                  onClick={() => setConfirmRole(true)}
                >
                  Lưu
                </button>
              </div>
              <p className="mt-1.5 text-[12px] font-medium leading-4 text-ink-2">
                {isSelf
                  ? "Đây là tài khoản của bạn: nhờ một admin khác đổi, để luôn còn ít nhất một admin."
                  : "Biên tập viên vào được Studio và mở mọi bài; admin còn thêm trang này. Vai trò có hiệu lực ngay."}
              </p>
            </Section>

            <Section title="Tài khoản">
              <div className="flex flex-wrap items-center gap-1.5">
                {locked ? <Pill tone="bad">Đã khoá</Pill> : <Pill tone="ok">Đang hoạt động</Pill>}
                {d.temp_password_expires_at ? (
                  <Pill tone="warn">
                    Đang dùng mật khẩu tạm · hết hạn {formatDateTime(d.temp_password_expires_at)}
                  </Pill>
                ) : null}
              </div>
              {locked && (
                <p className="mt-1.5 text-[12px] font-medium leading-4 text-ink-2">
                  Khoá từ {formatDateTime(d.disabled_at)}
                  {d.disabled_reason ? ` · lý do: ${d.disabled_reason}` : ""}. Tiến độ, đơn hàng và
                  quyền vẫn nguyên; mở khoá là dùng lại được.
                </p>
              )}
              {canManage ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {locked ? (
                    <button
                      type="button"
                      className={cn(BTN.ok, BTN_SM)}
                      disabled={accountBusy}
                      onClick={() => unlock.mutate()}
                    >
                      <LockOpen size={14} strokeWidth={2.4} aria-hidden="true" /> Mở khoá
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={cn(BTN.soft, BTN_SM)}
                      disabled={accountBusy}
                      aria-expanded={locking}
                      onClick={() => setLocking((v) => !v)}
                    >
                      <Lock size={14} strokeWidth={2.4} aria-hidden="true" /> Khoá tài khoản
                    </button>
                  )}
                  <button
                    type="button"
                    className={cn(BTN.soft, BTN_SM)}
                    disabled={accountBusy}
                    onClick={() => setConfirmReset(true)}
                  >
                    <KeyRound size={14} strokeWidth={2.4} aria-hidden="true" /> Đặt lại mật khẩu
                  </button>
                </div>
              ) : (
                <p className="mt-1.5 text-[12px] font-medium leading-4 text-ink-2">
                  {isSelf
                    ? "Tài khoản của bạn: tự đổi mật khẩu ở mục Tài khoản trong ứng dụng."
                    : "Không khoá hay đặt lại mật khẩu cho admin. Muốn làm, hãy đổi vai trò của họ trước."}
                </p>
              )}
              {canManage && locking && !locked && (
                <div className="glass-row mt-2 space-y-2 rounded-[14px] p-3">
                  <input
                    aria-label="Lý do khoá (tuỳ chọn)"
                    className={FIELD}
                    maxLength={255}
                    placeholder="Lý do (tuỳ chọn, chỉ admin thấy)"
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                  />
                  <p className="text-[12px] font-medium leading-4 text-ink-2">
                    {d.email} sẽ bị đăng xuất ngay và không đăng nhập lại được. Không xoá gì cả.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={cn(BTN.danger, BTN_SM)}
                      disabled={lock.isPending}
                      onClick={() => lock.mutate()}
                    >
                      Khoá tài khoản
                    </button>
                    <button
                      type="button"
                      className={cn(BTN.soft, BTN_SM)}
                      onClick={() => {
                        setLocking(false);
                        setLockReason("");
                      }}
                    >
                      Để sau
                    </button>
                  </div>
                </div>
              )}
            </Section>

            <Section title="Học tập">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <StatTile
                  label="Câu đã làm"
                  value={d.progress.exercises_answered}
                  hint={
                    d.progress.exercises_answered > 0
                      ? `${Math.round((d.progress.exercises_correct / d.progress.exercises_answered) * 100)}% đúng`
                      : undefined
                  }
                />
                <StatTile label="Bài đã động tới" value={d.progress.lessons_touched} />
                <StatTile label="Từ / mẫu câu đang học" value={d.progress.words_tracked} />
                <StatTile label="Lỗi đã ghi" value={d.progress.mistakes_logged} />
              </div>
            </Section>

            <Section title="Quyền đang có">
              {d.access.staff && (
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-blue-deep">
                  <ShieldAlert size={13} strokeWidth={2.4} /> Vai trò {ROLE_LABEL[d.role]} mở mọi
                  bài, không cần quyền riêng.
                </p>
              )}
              {d.entitlements.length === 0 ? (
                <p className="text-xs font-medium text-ink-2">
                  Chưa có quyền nào. Chỉ mở các bài miễn phí khi bật thu phí.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {d.entitlements.map((e) => (
                    <EntitlementRow key={e.id} row={e} onRevoke={() => setRevoking(e.id)} />
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Cấp quyền cho tài khoản này">
              <GrantForm email={d.email} />
            </Section>

            <Section title={`Đơn hàng (${d.orders.length}) · đã trả ${formatVnd(d.paid_total)}`}>
              {d.orders.length === 0 ? (
                <p className="text-xs font-medium text-ink-2">Chưa có đơn nào.</p>
              ) : (
                <ul className="space-y-1.5">
                  {d.orders.map((o) => (
                    <li
                      key={o.id}
                      className="glass-row flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{o.product_title}</span>
                        <span className="block text-[12px] font-medium text-ink-2">
                          {formatDateTime(o.created_at)} · {formatVnd(o.paid_amount)}/
                          {formatVnd(o.amount)}
                        </span>
                      </span>
                      {o.needs_review && <Pill tone="bad">Cần xem</Pill>}
                      <Pill tone={ORDER_TONE[o.status]}>{ORDER_LABEL[o.status]}</Pill>
                    </li>
                  ))}
                </ul>
              )}
              {d.orders.length > 0 && (
                <button
                  type="button"
                  className={cn(BTN.soft, BTN_SM, "mt-2")}
                  onClick={() => {
                    onClose();
                    go("orders", { q: d.email });
                  }}
                >
                  Xem chi tiết ở tab Đơn hàng
                </button>
              )}
            </Section>

            {d.claims.length > 0 && (
              <Section title={`Yêu cầu (${d.claims.length})`}>
                <ul className="space-y-1.5">
                  {d.claims.map((c) => (
                    <li key={c.id} className="glass-row rounded-[14px] px-3 py-2 text-xs">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 text-[12px] font-medium text-ink-2">
                          {formatDateTime(c.created_at)}
                        </span>
                        <Pill
                          tone={
                            c.status === "open" ? "bad" : c.status === "resolved" ? "ok" : "mute"
                          }
                        >
                          {c.status === "open"
                            ? "Chờ xử lý"
                            : c.status === "resolved"
                              ? "Đã xử lý"
                              : "Từ chối"}
                        </Pill>
                      </span>
                      <span className="mt-1 block whitespace-pre-wrap break-words font-medium">
                        {c.note}
                      </span>
                      {c.resolution ? (
                        <span className="mt-1 block text-[12px] font-medium text-ink-2">
                          Phản hồi: {c.resolution}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {d.claims.some((c) => c.status === "open") && (
                  <button
                    type="button"
                    className={cn(BTN.soft, BTN_SM, "mt-2")}
                    onClick={() => {
                      onClose();
                      go("claims");
                    }}
                  >
                    Xử lý ở tab Yêu cầu
                  </button>
                )}
              </Section>
            )}
          </div>
        )}

        <ConfirmDialog
          open={confirmRole}
          onOpenChange={setConfirmRole}
          title={`Đổi thành ${ROLE_LABEL[picked]}?`}
          description={
            picked === "admin"
              ? `${d?.email ?? "Tài khoản này"} sẽ xem được học viên, đơn hàng và tự cấp / thu hồi quyền như bạn. Chỉ làm với người bạn tin tưởng.`
              : `${d?.email ?? "Tài khoản này"} sẽ ${picked === "editor" ? "vào được Studio" : "chỉ còn là học viên"} từ bây giờ.`
          }
          confirmLabel="Đổi vai trò"
          tone={picked === "admin" ? "danger" : "primary"}
          onConfirm={() => changeRole.mutate(picked)}
        />
        <ConfirmDialog
          open={confirmReset}
          onOpenChange={setConfirmReset}
          title="Đặt lại mật khẩu?"
          description={`Mật khẩu cũ của ${d?.email ?? "tài khoản này"} ngừng dùng được ngay và mọi phiên đang đăng nhập bị đăng xuất. Bạn sẽ thấy một mật khẩu tạm (một lần) để gửi riêng cho họ; họ phải đổi trong 72 giờ.`}
          confirmLabel="Đặt lại"
          tone="warn"
          onConfirm={() => resetPassword.mutate()}
        />
        <TemporaryPasswordDialog
          email={d?.email ?? ""}
          value={tempPassword}
          onClose={() => setTempPassword(null)}
        />
        <ConfirmDialog
          open={revoking !== null}
          onOpenChange={(open) => !open && setRevoking(null)}
          title="Thu hồi quyền này?"
          description={`${toRevoke ? productName(catalog, toRevoke.product_code) : "Quyền"} sẽ bị khoá lại ngay cho ${d?.email ?? "học viên"}. Tiền đã thu không bị ảnh hưởng, bạn cấp lại được bất cứ lúc nào.`}
          confirmLabel="Thu hồi"
          tone="danger"
          onConfirm={() => revoking && revoke.mutate(revoking)}
        />
      </DialogContent>
    </Dialog>
  );
}
