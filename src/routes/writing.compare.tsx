import { createFileRoute } from "@tanstack/react-router";
import { StubScreen } from "@/components/haru/StubScreen";

export const Route = createFileRoute("/writing/compare")({
  head: () => ({
    meta: [
      { title: "Xưởng viết · Đối chiếu — Haru" },
      { name: "description", content: "Xưởng viết · Đối chiếu trong ứng dụng học tiếng Hàn Haru." },
      { property: "og:title", content: "Xưởng viết · Đối chiếu — Haru" },
      {
        property: "og:description",
        content: "Xưởng viết · Đối chiếu trong ứng dụng học tiếng Hàn Haru.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <StubScreen title="Xưởng viết · Đối chiếu" admin={false} />,
});
