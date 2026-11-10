import type { ContrastOut, VocabItemOut, WordRegister } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Plain-word labels for how a word is used — never the English keys. */
const REGISTER_LABEL: Record<WordRegister, string> = {
  spoken: "Văn nói",
  written: "Văn viết",
  neutral: "Dùng chung",
};

/** The set a card is learned in ("Động từ đi với thời tiết"). Renders nothing for
 * a card extracted before sets existed. */
export function FamilyChip({
  family,
  className,
}: {
  family?: string | null | undefined;
  className?: string | undefined;
}) {
  if (!family) return null;
  return (
    <span
      className={cn(
        "inline-block max-w-full truncate rounded-full bg-blue-soft px-2.5 py-0.5 text-[12px] font-semibold text-blue-deep",
        className,
      )}
    >
      {family}
    </span>
  );
}

/** What goes with a word or phrase: how it is used, what else it pairs with, and
 * the slip Vietnamese learners usually make. Every part is optional; with none of
 * them it renders nothing, so an older card looks as it always did. */
export function ChunkDetails({
  item,
  className,
}: {
  item: Pick<VocabItemOut, "register" | "usage_note_vi" | "collocations">;
  className?: string | undefined;
}) {
  const register = item.register ? REGISTER_LABEL[item.register] : undefined;
  const collocations = item.collocations ?? [];
  if (!register && !item.usage_note_vi && collocations.length === 0) return null;
  return (
    <span className={cn("block space-y-1.5 text-left", className)}>
      {register && (
        <span className="inline-block rounded-full bg-progress px-2 py-0.5 text-[12px] font-semibold text-ink-2">
          {register}
        </span>
      )}
      {collocations.length > 0 && (
        <span className="block">
          <span className="block text-[12px] font-semibold text-ink-2">Hay đi cùng</span>
          <span className="mt-0.5 block space-y-0.5">
            {collocations.map((c) => (
              <span key={c.ko} className="block text-xs leading-5">
                <span lang="ko" className="font-korean font-semibold">
                  {c.ko}
                </span>
                <span className="text-ink-2"> — {c.vi}</span>
              </span>
            ))}
          </span>
        </span>
      )}
      {item.usage_note_vi && (
        <span className="block rounded-[10px] bg-yellow-soft px-2 py-1.5 text-[12px] font-semibold leading-5 text-ink">
          {item.usage_note_vi}
        </span>
      )}
    </span>
  );
}

/** How a grammar pattern differs from the look-alikes it is learned with. */
export function ContrastList({
  group,
  contrasts,
  className,
}: {
  group?: string | null | undefined;
  contrasts?: ContrastOut[] | null | undefined;
  className?: string | undefined;
}) {
  const rows: ContrastOut[] = contrasts ?? [];
  if (!group && rows.length === 0) return null;
  return (
    <div className={cn("rounded-[12px] bg-card/70 px-3 py-2 text-left", className)}>
      <p className="text-[12px] font-semibold text-ink-2">
        {group ? `Học cùng nhóm: ${group}` : "So với mẫu gần nghĩa"}
      </p>
      {rows.length > 0 && (
        <ul className="mt-1 space-y-1">
          {rows.map((c) => (
            <li key={c.pattern} className="text-xs leading-5">
              <span lang="ko" className="font-korean font-semibold">
                {c.pattern}
              </span>
              <span className="text-ink-2"> — {c.diff_vi}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
