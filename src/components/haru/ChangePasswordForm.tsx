import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import * as authApi from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/client";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/password";
import { cn } from "@/lib/utils";

const INPUT =
  "w-full rounded-[14px] border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-blue";

/** Change your own password. On success the server hands back a fresh session for this device
 * (every other device is signed out), so the learner stays logged in here. */
export function ChangePasswordForm({
  currentLabel = "Mật khẩu hiện tại",
  submitLabel = "Đổi mật khẩu",
  onDone,
  className,
}: {
  currentLabel?: string;
  submitLabel?: string;
  onDone?: () => void;
  className?: string;
}) {
  const auth = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(current, next, again);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await authApi.changePassword({ current_password: current, new_password: next });
      await auth.refresh();
      toast.success("Đã đổi mật khẩu", {
        description: "Các thiết bị khác sẽ phải đăng nhập lại bằng mật khẩu mới.",
      });
      setCurrent("");
      setNext("");
      setAgain("");
      onDone?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className={cn("space-y-2.5", className)} noValidate>
      <input
        type="password"
        aria-label={currentLabel}
        placeholder={currentLabel}
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        className={INPUT}
      />
      <input
        type="password"
        aria-label="Mật khẩu mới"
        placeholder={`Mật khẩu mới (tối thiểu ${MIN_PASSWORD_LENGTH} ký tự)`}
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        className={INPUT}
      />
      <input
        type="password"
        aria-label="Nhập lại mật khẩu mới"
        placeholder="Nhập lại mật khẩu mới"
        autoComplete="new-password"
        value={again}
        onChange={(e) => setAgain(e.target.value)}
        className={INPUT}
      />
      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-transparent bg-blue py-2.5 text-sm font-semibold text-primary-foreground shadow-elev-1 transition-transform active:scale-[0.97] disabled:opacity-60"
      >
        {submitting ? "Đang đổi…" : submitLabel}
      </button>
    </form>
  );
}
