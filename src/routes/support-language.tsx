import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MusicSettings } from "@/components/haru/MusicControl";
import { FormEvent, useEffect, useState } from "react";
import {
  KeyRound,
  LogOut,
  Receipt,
  ShieldCheck,
  UserRound,
  UsersRound,
  Vibrate,
} from "lucide-react";
import { toast } from "sonner";

import { SupportButton } from "@/components/billing/SupportButton";
import { ChangePasswordForm } from "@/components/haru/ChangePasswordForm";
import { PolicyLinks } from "@/components/site/PolicyLinks";
import { Mascot } from "@/components/mascot/Mascot";
import { LoadingBlocks } from "@/components/haru/states";
import { TabBar } from "@/components/haru/TabBar";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import * as authApi from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { useCatalog } from "@/lib/billing";
import { getFeedbackPrefs, setFeedbackPrefs, tap, type FeedbackPrefs } from "@/lib/feedback";

export const Route = createFileRoute("/support-language")({
  head: () => ({
    meta: [
      { title: "Tài khoản — Haru" },
      { name: "description", content: "Đăng nhập để lưu tiến độ học tập trong ứng dụng Haru." },
      { property: "og:title", content: "Tài khoản — Haru" },
      {
        property: "og:description",
        content: "Đăng nhập để lưu tiến độ học tập trong ứng dụng Haru.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountScreen,
});

const inputClass =
  "w-full rounded-[14px] border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-blue";

function AuthForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        await authApi.login({ email, password });
        toast.success("Đăng nhập thành công!", {
          description: "Tiến độ học của bạn sẽ được lưu từ giờ.",
        });
      } else {
        await authApi.signup({
          email,
          password,
          ...(displayName ? { display_name: displayName } : {}),
        });
        toast.success("Tạo tài khoản thành công!", { description: "Chào mừng bạn đến với Haru." });
        // a new account starts by finding its first lesson (it can be skipped there)
        onDone();
        void navigate({ to: "/placement" });
        return;
      }
      onDone();
    } catch (err) {
      // a locked account / expired temporary password: the title says what happened, the detail what to do
      const code = err instanceof ApiError ? err.problem.code : null;
      const message =
        code === "email_taken"
          ? "Email này đã có tài khoản. Hãy đăng nhập, hoặc dùng email khác."
          : err instanceof ApiError &&
              (code === "account_disabled" ||
                code === "temp_password_expired" ||
                code === "disposable_email" ||
                code === "too_many_signups")
            ? [err.problem.title, err.problem.detail].filter(Boolean).join(". ")
            : errorMessage(err);
      setError(message);
      toast.error(mode === "login" ? "Đăng nhập thất bại" : "Tạo tài khoản thất bại", {
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-full border border-line py-1.5 text-xs font-semibold ${mode === "login" ? "bg-blue text-primary-foreground" : "bg-card text-ink-2"}`}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-full border border-line py-1.5 text-xs font-semibold ${mode === "signup" ? "bg-blue text-primary-foreground" : "bg-card text-ink-2"}`}
        >
          Tạo tài khoản
        </button>
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        {mode === "signup" && (
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Tên hiển thị (không bắt buộc)"
            className={inputClass}
            autoComplete="name"
          />
        )}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className={inputClass}
          autoComplete="email"
        />
        <input
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "Mật khẩu (tối thiểu 8 ký tự)" : "Mật khẩu"}
          className={inputClass}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />

        {error && <p className="text-xs font-semibold text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-[14px] border border-transparent bg-blue py-2.5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-60"
        >
          {submitting ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>
      </form>
    </div>
  );
}

/** Per-device "how should tapping feel" settings. Kept in localStorage (see
 * lib/feedback.ts), so it also works for learners who are not signed in. */
function FeedbackSettings() {
  // Start from the defaults so the server/first render match, then load the
  // saved choice once the page is in the browser.
  const [prefs, setPrefs] = useState<FeedbackPrefs>({ sound: false, haptics: true });
  useEffect(() => {
    setPrefs(getFeedbackPrefs());
  }, []);

  function update(patch: Partial<FeedbackPrefs>) {
    setPrefs(setFeedbackPrefs(patch));
    // Let them feel/hear what they just turned on.
    tap();
  }

  return (
    <section className="mt-5 rounded-[20px] border border-line bg-card p-5 shadow-elev-1">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Vibrate size={16} strokeWidth={2.4} className="text-blue" /> Rung & âm thanh
      </h2>
      <div className="mt-2 divide-y divide-line">
        <label
          htmlFor="pref-haptics"
          className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 py-1.5"
        >
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold">Rung nhẹ khi chạm</span>
            <span className="block text-[12px] font-medium leading-4 text-ink-2">
              Chỉ hoạt động trên Android — iPhone không cho web rung.
            </span>
          </span>
          <Switch
            id="pref-haptics"
            checked={prefs.haptics}
            onCheckedChange={(on) => update({ haptics: on })}
          />
        </label>
        <label
          htmlFor="pref-sound"
          className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 py-1.5"
        >
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold">Âm thanh nhỏ khi trả lời</span>
            <span className="block text-[12px] font-medium leading-4 text-ink-2">
              Tiếng “ting” khi nhớ từ, tắt sẵn để không ảnh hưởng lúc nghe bài.
            </span>
          </span>
          <Switch
            id="pref-sound"
            checked={prefs.sound}
            onCheckedChange={(on) => update({ sound: on })}
          />
        </label>
      </div>
    </section>
  );
}

function AccountScreen() {
  const auth = useAuth();
  const { selling } = useCatalog();
  const [changingPassword, setChangingPassword] = useState(false);

  function handleLogout() {
    authApi.logout();
    auth.refresh();
    toast("Đã đăng xuất", { description: "Hẹn gặp lại bạn!" });
  }

  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] overflow-hidden bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <div className="relative z-10">
        <header>
          <p className="text-[13px] font-semibold text-ink-2">Tài khoản</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold leading-tight">
            <UserRound size={22} strokeWidth={2.2} className="text-blue" /> Của tôi
          </h1>
          <p className="mt-1 text-xs font-medium text-ink-2">
            Đăng nhập để lưu tiến độ "đã nhớ/chưa nhớ" giữa các lần học.
          </p>
        </header>

        {auth.isLoading && (
          <LoadingBlocks className="mt-6" label="Đang kiểm tra đăng nhập" blocks={["h-40"]} />
        )}

        {!auth.isLoading && auth.isAuthenticated && auth.profile && (
          <section className="mt-5 rounded-[20px] border border-line bg-card p-6 shadow-elev-2">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-transparent bg-blue-soft text-blue-deep">
                <UserRound size={22} strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {auth.profile.display_name || auth.profile.email}
                </p>
                <p className="truncate text-xs font-semibold text-ink-2">{auth.profile.email}</p>
              </div>
            </div>
            <p className="mt-4 text-xs font-semibold text-teal">
              Tiến độ học từ vựng và ngữ pháp của bạn đang được lưu tự động.
            </p>

            {selling && (
              <Link
                to="/pricing"
                onClick={() => tap()}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-transparent bg-blue py-2.5 text-sm font-semibold text-primary-foreground shadow-elev-1 transition-transform active:scale-[0.97] "
              >
                <Receipt size={16} strokeWidth={2.4} aria-hidden="true" /> Gói học & thanh toán
              </Link>
            )}
            {selling && (
              <Link
                to="/orders"
                onClick={() => tap()}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-line bg-card py-2.5 text-sm font-semibold shadow-elev-1 transition-transform active:scale-[0.97]"
              >
                Đơn hàng của tôi
              </Link>
            )}

            {auth.profile.role === "admin" && (
              <Link
                to="/admin"
                search={{ tab: "overview" }}
                onClick={() => tap()}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-transparent bg-green-soft py-2.5 text-sm font-semibold text-ink shadow-elev-1 transition-transform active:scale-[0.97] "
              >
                <UsersRound size={16} strokeWidth={2.4} aria-hidden="true" /> Quản trị · tài khoản,
                học viên, thanh toán
              </Link>
            )}

            {(auth.profile.role === "admin" || auth.profile.role === "editor") && (
              <Link
                to="/studio"
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-transparent bg-yellow-strong py-2.5 text-sm font-semibold text-ink shadow-elev-1 transition-transform active:scale-[0.97] "
              >
                <ShieldCheck size={16} strokeWidth={2.4} /> Vào Studio ·{" "}
                {auth.profile.role === "admin" ? "Admin" : "Biên tập viên"}
              </Link>
            )}

            <button
              type="button"
              aria-expanded={changingPassword}
              onClick={() => setChangingPassword((v) => !v)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-line bg-card py-2.5 text-sm font-semibold shadow-elev-1 transition-transform active:scale-[0.97] "
            >
              <KeyRound size={16} strokeWidth={2.4} aria-hidden="true" /> Đổi mật khẩu
            </button>
            {changingPassword && (
              <ChangePasswordForm className="mt-3" onDone={() => setChangingPassword(false)} />
            )}

            <button
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-line bg-card py-2.5 text-sm font-semibold shadow-elev-1 transition-transform active:scale-[0.97] "
            >
              <LogOut size={16} strokeWidth={2.4} /> Đăng xuất
            </button>
          </section>
        )}

        {!auth.isLoading && !auth.isAuthenticated && <AuthForm onDone={() => auth.refresh()} />}

        <FeedbackSettings />
        <MusicSettings />

        <aside className="mt-7 flex items-end gap-2.5">
          <Mascot mood="wave" className="h-14 w-14 shrink-0" />
          <p className="mb-1 rounded-[18px_18px_18px_4px] border border-line bg-card px-4 py-3 text-xs font-semibold leading-5 shadow-elev-1">
            {auth.isAuthenticated
              ? "Mình lưu lại từng bước bạn học. Cứ đều đặn mỗi ngày nhé!"
              : "Chưa cần tài khoản vẫn học được — nhưng đăng nhập thì mới nhớ được bạn đã học gì."}
          </p>
        </aside>

        <div className="mt-7 space-y-3 border-t border-line pt-5">
          <SupportButton />
          <PolicyLinks />
        </div>
      </div>
      <TabBar />
    </main>
  );
}
