import { createFileRoute } from "@tanstack/react-router";
import { StubScreen } from "@/components/haru/StubScreen";

export const Route = createFileRoute("/studio_/exam-review/$id")({
  head: () => ({
    meta: [
      { title: "Studio · Duyệt đề thi — Haru" },
      { name: "description", content: "Studio · Duyệt đề thi trong ứng dụng học tiếng Hàn Haru." },
      { property: "og:title", content: "Studio · Duyệt đề thi — Haru" },
      {
        property: "og:description",
        content: "Studio · Duyệt đề thi trong ứng dụng học tiếng Hàn Haru.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <StubScreen title="Studio · Duyệt đề thi" admin={true} />,
});
