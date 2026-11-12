import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ArrowRight, LogIn } from "lucide-react";

import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { TabBar } from "@/components/haru/TabBar";
import { PracticeLine } from "@/components/pron/PracticeLine";
import { YouTubePlayer } from "@/components/pron/YouTubePlayer";
import { useAuth } from "@/hooks/use-auth";
import { getPronCourse } from "@/lib/api/pronunciation";
import { tap } from "@/lib/feedback";
import { bestScores } from "@/lib/pron-progress";
import { canRecord } from "@/lib/speech-assess";

export const Route = createFileRoute("/pronunciation_/$slug")({
  head: () => ({ meta: [{ title: "Luyện một âm — Haru English" }] }),
  component: SoundScreen,
});

function SoundScreen() {
  const { slug } = Route.useParams();
  const auth = useAuth();
  const q = useQuery({ queryKey: ["pron", "course"], queryFn: getPronCourse, staleTime: 3_600_000 });
  const [best, setBest] = useState<Record<string, number>>(() =>
    typeof window === "undefined" ? {} : bestScores(slug),
  );
  const [busy, setBusy] = useState(false);

  const sounds = q.data?.sounds ?? [];
  const idx = sounds.findIndex((s) => s.slug === slug);
  const s = idx >= 0 ? sounds[idx] : undefined;
  const next = idx >= 0 ? sounds[idx + 1] : undefined;
  const canScore = auth.isAuthenticated && canRecord();

  const line = (text: string, label?: string) => (
    <PracticeLine
      key={`${label}:${text}`}
      slug={slug}
      text={text}
      {...(label ? { label } : {})}
      best={best[text]}
      canScore={canScore}
      busyElsewhere={busy}
      onBusy={setBusy}
      onBest={setBest}
    />
  );

  return (
    <main className="relative mx-auto min-h-dvh max-w-[390px] overflow-hidden bg-paper px-6 pb-[calc(var(--tabbar-h)+2rem)] pt-[max(28px,env(safe-area-inset-top))] text-ink">
      <div className="relative z-10">
        <Link to="/pronunciation" onClick={() => tap()} className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-ink-2">
          <ArrowLeft size={16} aria-hidden="true" /> Tất cả các âm
        </Link>
        {q.isPending && <LoadingBlocks className="mt-4" blocks={["h-12", "h-48", "h-24"]} />}
        {q.isError && <ErrorState className="mt-4" error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />}
        {q.data && !s && <ErrorState className="mt-4" title="Không tìm thấy âm này." />}
        {s && (
          <>
            <p className="mt-1 text-[13px] font-semibold text-ink-2">
              {s.kind} · {s.order}/44
            </p>
            <h1 lang="en" className="text-[40px] font-bold leading-tight">
              /{s.ipa}/
            </h1>

            <div className="mt-3">
              <YouTubePlayer videoId={s.video_id} title={`Âm /${s.ipa}/`} />
              <p className="mt-1.5 text-[12px] leading-4 text-ink-2">
                Nhìn môi, lưỡi và hàm. Chỉnh 0.5x để xem chậm, rồi ghi âm bên dưới.
              </p>
            </div>

            <p className="mt-4 rounded-[16px] bg-blue-soft px-3.5 py-3 text-[13.5px] leading-5 text-blue-deep">
              <b>Mẹo cho người Việt: </b>
              {s.tip_vi}
            </p>

            {!auth.isAuthenticated && (
              <Link
                to="/support-language"
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-blue py-2.5 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
              >
                <LogIn size={16} strokeWidth={2.4} /> Đăng nhập để được chấm điểm
              </Link>
            )}
            {auth.isAuthenticated && !canRecord() && (
              <p className="mt-4 text-[12.5px] font-medium text-ink-2">
                Thiết bị này chưa ghi âm được. Bạn vẫn nghe mẫu và luyện nói theo được.
              </p>
            )}

            <ol className="mt-4 space-y-2.5" aria-label="Bài luyện">
              {s.words
                .filter((w) => w.toLowerCase() !== s.pair?.[0].toLowerCase())
                .map((w, i) => line(w, i === 0 ? "Từ" : ""))}
              {s.pair && line(s.pair[0], "Cặp dễ nhầm")}
              {s.pair && line(s.pair[1])}
              {line(s.words.join(" "), "Đọc liền các từ")}
              {line(s.sentence, "Cả câu")}
            </ol>

            {canScore && (
              <p className="mt-4 text-[11.5px] leading-4 text-ink-2">
                Điểm 0–100 do Azure đo độ giống âm chuẩn của riêng đoạn này. Đây không phải band IELTS: giám
                khảo chấm phát âm khi bạn nói tự do. Bản ghi chỉ gửi đi chấm, không được lưu lại.
              </p>
            )}

            <div className="mt-5 flex gap-2">
              {next && (
                <Link
                  to="/pronunciation/$slug"
                  params={{ slug: next.slug }}
                  onClick={() => tap()}
                  className="hit-area inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-fill px-3 text-[13px] font-semibold"
                >
                  Âm tiếp theo /{next.ipa}/ <ArrowRight size={15} aria-hidden="true" />
                </Link>
              )}
            </div>
          </>
        )}
      </div>
      <TabBar />
    </main>
  );
}
