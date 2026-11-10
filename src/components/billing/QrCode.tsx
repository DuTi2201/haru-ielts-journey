import { useMemo } from "react";

import { qrMatrix } from "@/lib/qr";
import { cn } from "@/lib/utils";

const QUIET = 4; // the blank border every QR needs round it, in modules

/** A QR drawn as one SVG path. It is black on white whatever the theme: scanners read that, and
 * a themed (inverted or tinted) code would not scan. Renders nothing when `value` cannot be encoded. */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const symbol = useMemo(() => {
    try {
      const rows = qrMatrix(value);
      const cells: string[] = [];
      rows.forEach((row, y) =>
        row.forEach((dark, x) => {
          if (dark) cells.push(`M${x + QUIET} ${y + QUIET}h1v1h-1z`);
        }),
      );
      return { size: rows.length + QUIET * 2, path: cells.join("") };
    } catch {
      return null;
    }
  }, [value]);
  if (!symbol) return null;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${symbol.size} ${symbol.size}`}
      shapeRendering="crispEdges"
      className={cn("aspect-square w-full rounded-[12px] bg-white text-black", className)}
    >
      <path d={symbol.path} fill="currentColor" />
    </svg>
  );
}
