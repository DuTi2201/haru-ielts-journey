import { useContext, useState } from "react";

import type { PracticeScene } from "@/lib/api/types";
import { sceneIcon } from "@/lib/scene-icons";
import { cn } from "@/lib/utils";
import { LessonImage } from "./LessonImage";
import { SceneImagesContext } from "./scene-images-context";

const TONES = ["bg-blue-soft", "bg-yellow-soft", "bg-green-soft", "bg-purple-soft"] as const;

/** One picture of a situation — the drawn picture when there is one, otherwise the
 * scene's icons side by side on a soft tile — with
 * what it shows written underneath (the caption is what a screen reader gets, and
 * what tells the learner which picture is which). */
export function SceneView({
  scene,
  tone = 0,
  compact = false,
  className,
}: {
  scene: PracticeScene;
  tone?: number;
  compact?: boolean;
  className?: string;
}) {
  const images = useContext(SceneImagesContext);
  const url = scene.image_prompt ? images[scene.image_prompt] : undefined;
  // a picture that cannot be fetched falls back to the icons, so the exercise still reads
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const picture = url && brokenUrl !== url ? url : null;
  return (
    <figure className={cn("w-full", className)}>
      {picture ? (
        <LessonImage
          src={picture}
          alt={scene.caption_vi}
          className="aspect-[4/3] w-full"
          onFail={() => setBrokenUrl(picture)}
        />
      ) : (
        <div
          role="img"
          aria-label={scene.caption_vi}
          className={cn(
            "flex items-center justify-center gap-2 rounded-[14px] border border-line",
            TONES[tone % TONES.length],
            compact ? "min-h-[76px] px-2 py-3" : "min-h-[112px] px-3 py-5",
          )}
        >
          {scene.icons.map((name, i) => {
            const Icon = sceneIcon(name);
            return (
              <Icon
                key={`${name}-${i}`}
                aria-hidden="true"
                strokeWidth={1.9}
                className={cn("shrink-0 text-ink", compact ? "h-8 w-8" : "h-12 w-12")}
              />
            );
          })}
        </div>
      )}
      <figcaption
        className={cn(
          "mt-1.5 font-semibold leading-4 text-ink-2",
          compact ? "text-[12px]" : "text-xs leading-5",
        )}
      >
        {scene.caption_vi}
      </figcaption>
    </figure>
  );
}
