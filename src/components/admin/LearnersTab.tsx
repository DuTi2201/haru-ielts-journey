import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useState } from "react";

import {
  accessBrief,
  ADMIN_KEY,
  ago,
  formatDate,
  ROLE_LABEL,
  type AdminSearch,
  type SetAdminSearch,
} from "@/components/admin/admin-kit";
import { Pill } from "@/components/admin/admin-ui";
import { useDebounced } from "@/components/admin/use-debounced";
import { BTN, BTN_SM } from "@/components/haru/studio-kit";
import { Field, PanelEmpty, PanelError, PanelLoading } from "@/components/haru/studio-ui";
import { listAdminLearners, type LearnerFilter } from "@/lib/api/admin";
import { errorMessage } from "@/lib/api/client";
import type { AdminLearnerRow } from "@/lib/api/types";
import { formatVnd } from "@/lib/billing";
import { cn } from "@/lib/utils";

const PAGE = 30;

const FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "paying", label: "Đã trả phí" },
  { id: "free", label: "Chưa trả phí" },
  { id: "editor", label: "Biên tập viên" },
  { id: "admin", label: "Admin" },
  { id: "locked", label: "Đã khoá" },
] as const;

function filterFor(f: string | undefined, q: string, offset: number): LearnerFilter {
  return {
    limit: PAGE,
    offset,
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(f === "editor" || f === "admin" ? { role: f } : {}),
    ...(f === "paying" ? { paying: true } : {}),
    ...(f === "free" ? { paying: false } : {}),
    ...(f === "locked" ? { locked: true } : {}),
  };
}

function LearnerCard({ row, onOpen }: { row: AdminLearnerRow; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="glass-row hit-area flex w-full flex-col gap-1 rounded-[16px] px-3.5 py-3 text-left outline-none transition-transform focus-visible:ring-2 focus-visible:ring-blue/50 active:scale-[0.99] lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1.4fr)] lg:items-center lg:gap-4 lg:rounded-[12px] lg:py-2.5 lg:active:scale-100 lg:hover:bg-card"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
            {row.display_name || row.email}
          </span>
          {row.disabled_at && <Pill tone="bad">Đã khoá</Pill>}
          {!row.disabled_at && row.temp_password_expires_at && (
            <Pill tone="warn">Mật khẩu tạm</Pill>
          )}
          {row.role !== "learner" && <Pill tone="info">{ROLE_LABEL[row.role]}</Pill>}
          {row.open_claims > 0 && <Pill tone="bad">{row.open_claims} yêu cầu</Pill>}
        </span>
        <span
          className={cn(
            "truncate text-[12px] font-medium text-ink-2",
            !row.display_name && "hidden lg:block",
          )}
        >
          {row.email}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-medium text-ink-2">
          <span>Tham gia {formatDate(row.created_at)}</span>
          <span>
            {row.exercises_answered > 0
              ? `${row.exercises_answered} câu đã làm · học ${ago(row.last_active_at)}`
              : `Chưa làm bài · ${row.last_active_at ? `học ${ago(row.last_active_at)}` : "chưa học"}`}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-semibold">
          <span className={row.access.everything ? "text-blue-deep" : "text-ink"}>
            {accessBrief(row.access)}
          </span>
          {row.paid_orders > 0 && (
            <span className="text-green">
              Đã trả {formatVnd(row.paid_total)} ({row.paid_orders} đơn)
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

export function LearnersTab({
  search,
  setSearch,
}: {
  search: AdminSearch;
  setSearch: SetAdminSearch;
}) {
  const [text, setText] = useState(search.q ?? "");
  const settled = useDebounced(text, 300);
  const [offset, setOffset] = useState(0);
  const f = search.f ?? "all";

  // the address follows the settled search text (so the view can be linked to)
  useEffect(() => {
    if ((search.q ?? "") !== settled.trim()) setSearch({ q: settled.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);
  useEffect(() => setOffset(0), [settled, f]);

  const filter = filterFor(f, settled, offset);
  const list = useQuery({
    queryKey: [...ADMIN_KEY, "learners", filter],
    queryFn: () => listAdminLearners(filter),
    placeholderData: keepPreviousData,
  });
  const total = list.data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE, total);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={16}
          strokeWidth={2.4}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-2"
        />
        <Field
          label="Tìm học viên theo email hoặc tên"
          type="search"
          placeholder="Tìm theo email hoặc tên…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Lọc học viên">
        {FILTERS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={f === x.id}
            onClick={() => setSearch({ f: x.id === "all" ? undefined : x.id })}
            className={cn(
              "hit-area shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue/50",
              f === x.id
                ? "border-transparent bg-blue text-primary-foreground"
                : "border-glass-edge bg-glass-row text-ink-2",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      {list.isLoading && <PanelLoading rows={4} label="Đang tải học viên…" />}
      {list.isError && (
        <PanelError
          message={errorMessage(list.error)}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      )}
      {list.data && list.data.items.length === 0 && (
        <PanelEmpty
          title="Không có tài khoản nào khớp"
          hint={
            settled.trim()
              ? "Thử bớt chữ, hoặc tìm theo một phần của email."
              : "Chưa có tài khoản nào ở nhóm này."
          }
        />
      )}
      {list.data && list.data.items.length > 0 && (
        <>
          <div
            aria-hidden="true"
            className="hidden px-3.5 text-[11px] font-bold uppercase tracking-wide text-ink-2 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1.4fr)] lg:gap-4"
          >
            <span>Học viên</span>
            <span>Email</span>
            <span>Tham gia · hoạt động</span>
            <span>Quyền · đã trả</span>
          </div>
          <ul className={cn("space-y-2 lg:space-y-1", list.isPlaceholderData && "opacity-60")}>
            {list.data.items.map((row) => (
              <LearnerCard key={row.id} row={row} onOpen={() => setSearch({ learner: row.id })} />
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[12px] font-semibold text-ink-2">
              {from}–{to} / {total}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className={cn(BTN.soft, BTN_SM)}
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE))}
              >
                <ChevronLeft size={14} strokeWidth={2.4} /> Trước
              </button>
              <button
                type="button"
                className={cn(BTN.soft, BTN_SM)}
                disabled={offset + PAGE >= total}
                onClick={() => setOffset(offset + PAGE)}
              >
                Sau <ChevronRight size={14} strokeWidth={2.4} />
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
