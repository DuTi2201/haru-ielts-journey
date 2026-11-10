import type { PracticeTable } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Rich } from "./Rich";

/** A small table (header row, then rows whose first cell is the row's name). */
export function TableView({ table, className }: { table: PracticeTable; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-[14px] border border-line bg-card", className)}>
      <table className="w-full min-w-[260px] border-collapse text-left text-xs">
        <thead>
          <tr className="bg-blue-soft">
            {table.header.map((h) => (
              <th key={h} scope="col" className="px-2.5 py-2 font-semibold text-blue-deep">
                <Rich text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-t border-progress align-top">
              {row.map((cell, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="px-2.5 py-2 font-semibold">
                    <Rich text={cell} />
                  </th>
                ) : (
                  <td key={j} className="px-2.5 py-2 text-ink-2">
                    <Rich text={cell} />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
