import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, errorMessage } from "@/lib/api/client";
import { createRealExamSet } from "@/lib/api/real-exam";
import type { RxScopeIn } from "@/lib/api/types";

/** Opens a sitting for a scope and goes to it. When every question in the scope is resting
 * (answered well a short while ago) the server says so; that is a normal outcome, not an error. */
export function useStartSet() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scope: RxScopeIn) => createRealExamSet(scope),
    onSuccess: (set) => {
      void queryClient.invalidateQueries({ queryKey: ["me", "real-exam"] });
      void navigate({ to: "/exam/real/$setId", params: { setId: set.id } });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.problem.code === "nothing_to_practice") {
        toast("Phần này đang nghỉ.", {
          description:
            "Các câu bạn vừa làm tốt sẽ quay lại sau vài ngày; câu sai quay lại sau vài giờ. Thử một dạng khác nhé.",
        });
        return;
      }
      toast.error("Chưa mở được lượt luyện.", { description: errorMessage(e) });
    },
  });
}
