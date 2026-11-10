import { useState } from "react";
import { Delete } from "lucide-react";

import { tap } from "@/lib/feedback";
import { compose, KEY_ROWS, keysOf } from "@/lib/hangul";
import { cn } from "@/lib/utils";

/** A Korean (2-set) keyboard on the screen, for a learner whose phone has none installed yet:
 * letters gather into blocks as a phone keyboard does (ㅇ ㅖ ㅇ ㅛ → 예요). It edits the last
 * word of `value`; a space starts a new one, ⌫ takes the last letter off. */
export function KoreanKeypad({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [shift, setShift] = useState(false);
  const cut = value.lastIndexOf(" ") + 1;
  const head = value.slice(0, cut);
  const word = value.slice(cut);

  const press = (k: string) => {
    tap();
    onChange(head + compose([...keysOf(word), k]));
    setShift(false);
  };
  const back = () => {
    tap();
    if (!word) {
      onChange(value.slice(0, -1));
      return;
    }
    onChange(head + compose(keysOf(word).slice(0, -1)));
  };
  const key = (label: string, onClick: () => void, extra?: string, aria?: string) => (
    <button
      key={aria ?? label}
      type="button"
      onClick={onClick}
      aria-label={aria ?? label}
      className={cn(
        "flex h-10 flex-1 items-center justify-center rounded-[8px] border border-line bg-card font-korean text-[17px] font-semibold shadow-elev-1 active:scale-95",
        extra,
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-2 space-y-1.5 rounded-[14px] bg-paper p-2" aria-label="Bàn phím tiếng Hàn">
      {KEY_ROWS.map((row, r) => (
        <div key={r} className="flex gap-1">
          {r === 2 &&
            key(
              "⇧",
              () => setShift((v) => !v),
              cn("flex-[1.4] text-[14px]", shift && "border-blue bg-blue text-primary-foreground"),
              "Shift",
            )}
          {row.map((k) => {
            const letter = shift && k.shift ? k.shift : k.key;
            return key(letter, () => press(letter));
          })}
          {r === 2 && (
            <button
              type="button"
              onClick={back}
              aria-label="Xoá"
              className="flex h-10 flex-[1.4] items-center justify-center rounded-[8px] border border-line bg-card shadow-elev-1 active:scale-95"
            >
              <Delete size={17} />
            </button>
          )}
        </div>
      ))}
      <div className="flex gap-1">
        {key(
          "cách",
          () => {
            tap();
            onChange(value + " ");
          },
          "text-[13px] font-semibold",
          "Dấu cách",
        )}
      </div>
    </div>
  );
}
