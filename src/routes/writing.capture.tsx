import { createFileRoute } from "@tanstack/react-router";
import { StubScreen } from "@/components/haru/StubScreen";

export const Route = createFileRoute("/writing/capture")({
  head: () => ({
    meta: [
      { title: "Xưởng viết · Chụp bài — Haru" },
      { name: "description", content: "Xưởng viết · Chụp bài trong ứng dụng học tiếng Hàn Haru." },
      { property: "og:title", content: "Xưởng viết · Chụp bài — Haru" },
      {
        property: "og:description",
        content: "Xưởng viết · Chụp bài trong ứng dụng học tiếng Hàn Haru.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <StubScreen title="Xưởng viết · Chụp bài" admin={false} />,
});
