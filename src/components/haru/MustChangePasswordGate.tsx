import * as DialogPrimitive from "@radix-ui/react-dialog";
import { KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";

import { ChangePasswordForm } from "@/components/haru/ChangePasswordForm";
import { useAuth } from "@/hooks/use-auth";
import * as authApi from "@/lib/api/auth";

/** Shown over the whole app while the account still has the temporary password an admin made:
 * nothing else can be used until a password of the learner's own is set (or they sign out).
 * It cannot be closed with Esc or by tapping outside. */
export function MustChangePasswordGate() {
  const auth = useAuth();
  const open = auth.profile?.must_change_password === true;

  function signOut() {
    authApi.logout();
    void auth.refresh();
    toast("Đã đăng xuất", { description: "Đăng nhập lại khi bạn sẵn sàng đổi mật khẩu." });
  }

  return (
    <DialogPrimitive.Root open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-ink/60 backdrop-blur-sm" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-[91] max-h-[90dvh] w-[calc(100%-2.5rem)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px] border border-line bg-card p-5 text-ink shadow-elev-2 outline-none"
        >
          <DialogPrimitive.Title className="flex items-center gap-2 text-base font-semibold">
            <KeyRound size={18} strokeWidth={2.4} className="shrink-0 text-blue" />
            Đặt mật khẩu của riêng bạn
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mb-3 mt-1.5 text-xs font-medium leading-5 text-ink-2">
            Bạn đang dùng mật khẩu tạm do quản trị viên cấp. Hãy đổi sang mật khẩu mới (chỉ bạn
            biết) trước khi học tiếp; mật khẩu tạm sẽ hết hạn.
          </DialogPrimitive.Description>
          <ChangePasswordForm currentLabel="Mật khẩu tạm" submitLabel="Lưu mật khẩu mới" />
          <button
            type="button"
            onClick={signOut}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-line bg-card py-2.5 text-sm font-semibold shadow-elev-1 transition-transform active:scale-[0.97] "
          >
            <LogOut size={16} strokeWidth={2.4} /> Đăng xuất
          </button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
