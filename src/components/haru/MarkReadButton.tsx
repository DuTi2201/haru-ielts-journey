import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { markEditorialRead } from "@/lib/api/editorial";
import { success, tap } from "@/lib/feedback";

/* "Đã đọc xong": tells Today this article is done, so the next one is offered. Needs a login; the
 * button is simply absent for a visitor. */

export function MarkReadButton({ articleId }: { articleId: string }) {
  const auth = useAuth();
  const [done, setDone] = useState(false);
  const mark = useMutation({
    mutationFn: () => markEditorialRead(articleId),
    onSuccess: () => {
      success();
      setDone(true);
    },
  });
  if (!auth.isAuthenticated) return null;
  return (
    <button
      type="button"
      disabled={done || mark.isPending}
      onClick={() => {
        tap();
        mark.mutate();
      }}
      className={
        done
          ? "hit-area mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-green bg-green-soft px-4 text-sm font-semibold"
          : "hit-area mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue px-4 text-sm font-semibold text-white shadow-elev-1 active:scale-[0.97] disabled:opacity-60"
      }
    >
      <Check size={16} strokeWidth={2.6} aria-hidden="true" />
      {done ? "Đã ghi nhận — mai Haru gợi ý bài tiếp theo" : "Tôi đã đọc xong bài này"}
    </button>
  );
}
