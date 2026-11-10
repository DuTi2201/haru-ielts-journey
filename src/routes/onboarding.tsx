import { createFileRoute } from "@tanstack/react-router";
import { StubScreen } from "@/components/haru/StubScreen";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding · Chọn mục tiêu — Haru" },
      {
        name: "description",
        content: "Onboarding · Chọn mục tiêu trong ứng dụng học tiếng Hàn Haru.",
      },
      { property: "og:title", content: "Onboarding · Chọn mục tiêu — Haru" },
      {
        property: "og:description",
        content: "Onboarding · Chọn mục tiêu trong ứng dụng học tiếng Hàn Haru.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <StubScreen title="Onboarding · Chọn mục tiêu" admin={false} />,
});
