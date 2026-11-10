import { createFileRoute } from "@tanstack/react-router";
import { StubScreen } from "@/components/haru/StubScreen";

export const Route = createFileRoute("/writing/revise")({
  head: () => ({
    meta: [
      { title: "Xưởng viết · Tự sửa — Haru" },
      { name: "description", content: "Xưởng viết · Tự sửa trong ứng dụng học tiếng Hàn Haru." },
      { property: "og:title", content: "Xưởng viết · Tự sửa — Haru" },
      {
        property: "og:description",
        content: "Xưởng viết · Tự sửa trong ứng dụng học tiếng Hàn Haru.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <StubScreen title="Xưởng viết · Tự sửa" admin={false} />,
});
