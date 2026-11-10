import { createFileRoute } from "@tanstack/react-router";
import { StubScreen } from "@/components/haru/StubScreen";

export const Route = createFileRoute("/writing/result")({
  head: () => ({
    meta: [
      { title: "Xưởng viết · Kết quả — Haru" },
      { name: "description", content: "Xưởng viết · Kết quả trong ứng dụng học tiếng Hàn Haru." },
      { property: "og:title", content: "Xưởng viết · Kết quả — Haru" },
      {
        property: "og:description",
        content: "Xưởng viết · Kết quả trong ứng dụng học tiếng Hàn Haru.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <StubScreen title="Xưởng viết · Kết quả" admin={false} />,
});
