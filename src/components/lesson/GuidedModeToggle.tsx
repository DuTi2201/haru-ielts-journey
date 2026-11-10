import { useGuidedMode } from "@/lib/guided-mode";
import { cn } from "@/lib/utils";

/** "Có hướng dẫn / Tự do": the learner's choice, kept on this device. */
export function GuidedModeToggle({ className }: { className?: string }) {
  const [guided, setGuided] = useGuidedMode();
  const options = [
    { on: true, label: "Có hướng dẫn" },
    { on: false, label: "Tự do" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Chế độ học"
      className={cn("grid grid-cols-2 gap-1.5", className)}
    >
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={guided === o.on}
          onClick={() => setGuided(o.on)}
          className={cn(
            "hit-area flex min-h-10 items-center justify-center rounded-full border border-line px-2 text-xs font-semibold",
            guided === o.on
              ? "bg-blue text-primary-foreground shadow-elev-1"
              : "bg-card text-ink-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
