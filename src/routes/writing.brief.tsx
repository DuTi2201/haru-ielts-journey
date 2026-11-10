import { createFileRoute } from "@tanstack/react-router";
import { StubScreen } from "@/components/haru/StubScreen";

export const Route = createFileRoute("/writing/brief")({
  head: () => ({
    meta: [
      { title: "Xưởng viết · Chọn đề — Haru" },
      { name: "description", content: "Xưởng viết · Chọn đề trong ứng dụng học tiếng Hàn Haru." },
      { property: "og:title", content: "Xưởng viết · Chọn đề — Haru" },
      {
        property: "og:description",
        content: "Xưởng viết · Chọn đề trong ứng dụng học tiếng Hàn Haru.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <StubScreen title="Xưởng viết · Chọn đề" admin={false} />,
});
