import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardCheck,
  Gift,
  LogIn,
  Mic,
  Receipt,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";

import { OrderRow, shortDate } from "@/components/billing/OrderRow";
import { PayDialog } from "@/components/billing/PayDialog";
import { SupportButton } from "@/components/billing/SupportButton";
import { ProductRow } from "@/components/billing/UnlockPanel";
import { Mascot } from "@/components/mascot/Mascot";
import { ErrorState, LoadingBlocks } from "@/components/haru/states";
import { Shell } from "@/components/lesson/LessonShell";
import { PolicyLinks } from "@/components/site/PolicyLinks";
import { useAuth } from "@/hooks/use-auth";
import { getMyEntitlements, listOrders } from "@/lib/api/billing";
import { errorMessage } from "@/lib/api/client";
import type { BillingCatalogOut, BillingProductOut, FeatureRuleOut } from "@/lib/api/types";
import { ENTITLEMENTS_KEY, ORDERS_KEY, formatVnd, ownsProduct, useCatalog } from "@/lib/billing";
import { tap } from "@/lib/feedback";
import { cn } from "@/lib/utils";

interface PricingSearch {
  /** The order payOS sent the learner back to (`returnUrl` / `cancelUrl`). */
  order?: string | undefined;
}

const DESCRIPTION =
  "Bảng giá Haru: học miễn phí các bài đầu, mở thêm gói bài học, Pass Luyện thi và Haru Nói. Thanh toán một lần, không tự gia hạn.";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Bảng giá — Haru" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Bảng giá — Haru" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): PricingSearch => ({
    order:
      typeof search["order"] === "string" && search["order"] !== "" ? search["order"] : undefined,
  }),
  component: PricingScreen,
});

/** The trial, one line per allowance: the live minutes (Trò chuyện and Tranh luận share them)
 * and the marked presentations. */
function trialLines(rules: FeatureRuleOut[]): { ok: boolean; text: string }[] {
  const out: { ok: boolean; text: string }[] = [];
  const live = rules.filter((r) => r.trial_unit === "phút");
  const liveTrial = live.find((r) => r.mode === "trial");
  if (live.some((r) => r.mode === "free"))
    out.push({ ok: true, text: "Nói chuyện với Haru: miễn phí" });
  else if (liveTrial)
    out.push({
      ok: true,
      text: `Nói chuyện với Haru: ${liveTrial.trial_amount} phút, dùng chung cho Trò chuyện và Tranh luận`,
    });
  else out.push({ ok: false, text: "Nói chuyện với Haru: chỉ có trong gói Haru Nói" });
  const present = rules.find((r) => r.feature === "present");
  if (present)
    out.push(
      present.mode === "free"
        ? { ok: true, text: "Trình bày: miễn phí" }
        : present.mode === "trial" && present.trial_amount > 0
          ? { ok: true, text: `Trình bày: ${present.trial_amount} lượt chấm` }
          : { ok: false, text: "Trình bày: chỉ có trong gói Haru Nói" },
    );
  return out;
}

function faq(catalog: BillingCatalogOut | null | undefined): { q: string; a: string }[] {
  const t = catalog?.trial;
  const speak = (catalog?.products ?? []).filter((p) => p.kind === "feature_pass" && p.minutes);
  const sizes = speak.map((p) => `${p.minutes} phút trong ${p.days} ngày`).join(", ");
  return [
    {
      q: "Có tự động gia hạn hay trừ tiền định kỳ không?",
      a: "Không. Mọi gói đều thanh toán một lần. Gói có thời hạn hết hạn thì dừng, bạn tự quyết định có mua tiếp hay không.",
    },
    {
      q: "Thanh toán thế nào? Có an toàn không?",
      a: "Bạn quét mã QR để chuyển khoản, ngân hàng nào cũng được (cổng thanh toán payOS xử lý giao dịch). Haru không thấy và không lưu số thẻ hay tài khoản ngân hàng của bạn. Gói được mở tự động ngay khi giao dịch thành công, thường chỉ sau vài giây.",
    },
    {
      q: "Đã chuyển tiền mà chưa mở khoá thì sao?",
      a: "Vào Đơn hàng của tôi, mở đơn đó và bấm “Tôi đã thanh toán nhưng chưa mở khoá”. Hệ thống kiểm tra lại giao dịch ngay; nếu vẫn chưa được, đội hỗ trợ xử lý trong 2 ngày làm việc.",
    },
    {
      q: "Mua nhầm hoặc đổi ý thì có được hoàn tiền không?",
      a: "Có. Bạn được hoàn 100% trong 7 ngày kể từ lúc thanh toán nếu chưa dùng phần trả phí của gói (chưa mở bài trả phí, chưa luyện với Pass hay Haru Nói). Lỗi thanh toán luôn được xử lý. Chi tiết ở Chính sách hoàn tiền.",
    },
    {
      q: "Haru Nói tính phút thế nào?",
      a: `Mỗi gói Haru Nói có một số phút nói${sizes ? ` (${sizes})` : ""}, tính theo thời gian bạn thật sự nói chuyện với Haru, dùng chung cho Trò chuyện và Tranh luận · Đàm phán · Phản biện; mỗi ngày nói tối đa 20 phút. Trình bày không trừ phút (tối đa 15 lượt chấm mỗi ngày). Mua thêm gói khi đang còn hạn thì số phút được cộng ngay, thời hạn được nối tiếp. Phút chưa dùng hết hạn cùng gói.`,
    },
    {
      q: "Dùng thử Haru Nói miễn phí là thế nào?",
      a: `Mỗi tài khoản được dùng thử một lần: ${t?.live_trial_minutes ?? 5} phút nói chuyện trực tiếp với Haru (dùng chung cho Trò chuyện và Tranh luận) và ${t?.present_trial_tries ?? 1} lượt chấm Trình bày. Phần dùng thử không làm mới theo ngày.`,
    },
    {
      q: "Gói Viết câu 54 khác Pass Luyện thi thế nào?",
      a: "Gói Viết câu 54 là 8 bài học, mua một lần, dạy cách viết câu 54 từ đọc đề, tìm ý đến ráp bài. Pass Luyện thi có thời hạn, mở phần luyện đề TOPIK theo từng dạng câu và luyện viết câu 51–52 có AI chấm. Hiện AI chưa chấm bài viết câu 53–54.",
    },
    {
      q: "Đã mua gói bài nhỏ, muốn lên gói lớn thì sao?",
      a: "Bạn chỉ trả phần chênh lệch: số tiền đã trả cho gói nhỏ nằm trọn trong gói lớn (ví dụ Sinh hoạt 2 trong Lộ trình Trung cấp hoặc Trọn bộ) được trừ thẳng khi thanh toán.",
    },
    {
      q: "Mua pass khi pass cũ vẫn còn hạn thì sao?",
      a: "Thời hạn mới được cộng nối tiếp sau ngày hết hạn của pass cũ, bạn không mất ngày nào.",
    },
    {
      q: "Đổi điện thoại có mất gói không?",
      a: "Không. Gói gắn với tài khoản, đăng nhập trên máy nào cũng dùng được.",
    },
  ];
}

function PricingScreen() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { order: returnedOrder } = Route.useSearch();
  const { catalog, selling, isLoading, isError, error, refetch, isRefetching } = useCatalog();

  const entitlements = useQuery({
    queryKey: ENTITLEMENTS_KEY,
    queryFn: getMyEntitlements,
    enabled: auth.isAuthenticated && selling,
    staleTime: 15_000,
  });
  const orders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: listOrders,
    enabled: auth.isAuthenticated && selling,
    staleTime: 15_000,
  });

  // the dialog: a product to buy (checkout first), or an order to reopen (payOS sends the learner back here)
  const [buying, setBuying] = useState<BillingProductOut | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const open = buying !== null || resumeId !== null;

  useEffect(() => {
    if (returnedOrder && auth.isAuthenticated) setResumeId(returnedOrder);
  }, [returnedOrder, auth.isAuthenticated]);

  const close = () => {
    setBuying(null);
    setResumeId(null);
    if (returnedOrder) void navigate({ to: "/pricing", search: {}, replace: true });
  };

  const held = entitlements.data;
  const of = (kind: BillingProductOut["kind"]) =>
    catalog?.products.filter((p) => p.kind === kind) ?? [];
  const speak = of("feature_pass");
  const canBuy = auth.isAuthenticated && !!catalog?.purchasable;
  const examEnds = held?.exam_pass.active ? held.exam_pass.ends_at : null;
  const speakEnds = held?.feature_pass?.active ? held.feature_pass.ends_at : null;
  const rules = catalog?.feature_rules ?? [];
  const pending = (orders.data ?? []).filter(
    (o) => o.status === "PENDING" || o.status === "UNDERPAID",
  );

  return (
    <Shell>
      <header className="text-center lg:text-left">
        <Mascot mood="cheer" className="mx-auto h-16 w-16 lg:mx-0" />
        <h1 className="mt-2 text-[26px] font-bold leading-tight">
          Học tiếng Hàn theo cách của bạn
        </h1>
        <p className="mt-1.5 text-[13px] font-medium leading-5 text-ink-2">
          Bắt đầu miễn phí. Chỉ trả cho phần bạn cần: thanh toán một lần, không tự gia hạn.
        </p>
        <ul className="mt-4 grid grid-cols-3 gap-2 text-[11px] font-semibold leading-4">
          {[
            [ShieldCheck, "Thanh toán bằng quét mã QR"],
            [RotateCcw, "Không tự gia hạn"],
            [BadgeCheck, `Học thử ${catalog?.free_lesson_max ?? 19} bài trước khi trả`],
          ].map(([Icon, t]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <li
                key={t as string}
                className="flex flex-col items-center gap-1 rounded-[14px] bg-card p-2.5 shadow-elev-1"
              >
                <I size={18} strokeWidth={2.2} className="text-blue" aria-hidden="true" />
                {t as string}
              </li>
            );
          })}
        </ul>
      </header>

      {isLoading && (
        <LoadingBlocks
          className="mt-6"
          label="Đang tải các gói"
          blocks={["h-24", "h-20", "h-20"]}
        />
      )}
      {isError && (
        <ErrorState
          className="mt-6"
          title="Không tải được các gói."
          message={errorMessage(error)}
          onRetry={() => void refetch()}
          retrying={isRefetching}
        />
      )}

      {catalog && !selling && (
        <section className="mt-6 rounded-[20px] bg-green-soft p-5 shadow-elev-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Gift size={16} strokeWidth={2.4} aria-hidden="true" /> Hiện chưa bán gói nào
          </h2>
          <p className="mt-1.5 text-xs font-semibold leading-5">
            Mọi bài học và phần luyện tập đang mở cho bạn. Khi có gói thu phí, bạn sẽ thấy ở đây.
          </p>
        </section>
      )}

      {catalog && selling && (
        <>
          {!auth.isLoading && !auth.isAuthenticated && (
            <Link
              to="/support-language"
              className="mt-5 flex items-center justify-center gap-1.5 rounded-[14px] bg-blue py-3 text-sm font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97]"
            >
              <LogIn size={16} aria-hidden="true" /> Đăng nhập / Tạo tài khoản để mua
            </Link>
          )}
          {!catalog.purchasable && (
            <p className="mt-5 rounded-[16px] bg-yellow-soft px-4 py-3 text-xs font-semibold leading-5">
              Thanh toán chưa sẵn sàng. Bạn xem giá trước, quay lại mua sau nhé.
            </p>
          )}
          {held?.everything && (
            <p className="mt-5 rounded-[16px] bg-green-soft px-4 py-3 text-xs font-semibold leading-5">
              Tài khoản của bạn đã được mở toàn bộ nội dung.
            </p>
          )}
          {pending.length > 0 && (
            <button
              type="button"
              onClick={() => setResumeId(pending[0]!.id)}
              className="mt-5 flex w-full items-center gap-2 rounded-[16px] bg-yellow-soft px-4 py-3 text-left text-xs font-semibold"
            >
              <Receipt size={16} aria-hidden="true" /> Bạn có đơn “{pending[0]!.product_title}” đang
              chờ thanh toán
              <ChevronRight size={16} className="ml-auto shrink-0" aria-hidden="true" />
            </button>
          )}

          {/* free vs Haru Nói */}
          <section className="mt-6 grid gap-3 lg:grid-cols-2" aria-label="Miễn phí và Haru Nói">
            <div className="rounded-[20px] border border-line bg-card p-4 shadow-elev-1">
              <p className="text-[12px] font-bold text-ink-2">MIỄN PHÍ</p>
              <p className="mt-0.5 text-[22px] font-bold">0đ</p>
              <ul className="mt-2 space-y-1.5 text-[13px] font-semibold">
                <Li ok>Bài 1–{catalog.free_lesson_max} đầy đủ</Li>
                <Li ok>Ôn tập lặp lại ngắt quãng, theo dõi tiến bộ</Li>
                <li className="pt-1 text-[11px] font-bold text-ink-2">
                  Dùng thử Haru Nói, một lần cho mỗi tài khoản:
                </li>
                {trialLines(rules).map((l) => (
                  <Li key={l.text} ok={l.ok}>
                    {l.text}
                  </Li>
                ))}
              </ul>
            </div>
            {speak.length > 0 && (
              <div className="rounded-[20px] border-2 border-blue bg-card p-4 shadow-elev-2">
                <p className="flex items-center gap-1.5 text-[12px] font-bold text-blue-deep">
                  <Mic size={14} aria-hidden="true" /> HARU NÓI
                </p>
                <p className="mt-0.5 text-[13px] font-semibold text-ink-2">
                  Luyện nói 1-1 với Haru, tính theo phút nói
                </p>
                <ul className="mt-2 space-y-1.5 text-[13px] font-semibold">
                  <Li ok>
                    Trò chuyện và Tranh luận · Đàm phán · Phản biện dùng chung số phút của gói, tối
                    đa 20 phút mỗi ngày
                  </Li>
                  <Li ok>Trình bày: tối đa 15 lượt chấm mỗi ngày, không trừ phút</Li>
                  <Li ok>Chấm theo trình độ, gợi ý dùng kiến thức bạn đã học</Li>
                </ul>
                {speakEnds && (
                  <p className="mt-2 text-xs font-semibold text-green">
                    {held?.feature_pass?.minutes_left != null
                      ? `Gói của bạn còn ${held.feature_pass.minutes_left}/${held.feature_pass.minutes_total} phút, đến ${shortDate(speakEnds)}. Mua thêm: phút cộng ngay, thời hạn nối tiếp.`
                      : `Haru Nói của bạn còn đến ${shortDate(speakEnds)}. Mua thêm sẽ cộng nối tiếp.`}
                  </p>
                )}
                <ul className="mt-3 space-y-2">
                  {speak.map((p) => (
                    <ProductRow key={p.code} product={p} onBuy={setBuying} disabled={!canBuy} />
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="mt-7" aria-label="Gói bài học">
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <BookOpen size={17} className="text-blue" aria-hidden="true" /> Gói bài học
            </h2>
            <p className="mt-0.5 text-[12px] font-medium text-ink-2">
              Mua một lần, học trọn đời. Lên gói lớn chỉ trả phần chênh lệch.
            </p>
            <ul className="mt-2.5 space-y-2.5">
              {of("lesson_pack").map((p) => (
                <ProductRow
                  key={p.code}
                  product={p}
                  onBuy={setBuying}
                  disabled={!canBuy}
                  owned={ownsProduct(catalog, held, p)}
                  badge={p.code === "pack_all" ? "Lợi nhất" : undefined}
                />
              ))}
            </ul>
          </section>

          {of("combo").length > 0 && (
            <section className="mt-7" aria-label="Combo">
              <h2 className="flex items-center gap-2 text-[15px] font-bold">
                <Gift size={17} className="text-blue" aria-hidden="true" /> Combo tiết kiệm
              </h2>
              <p className="mt-0.5 text-[12px] font-medium text-ink-2">
                Hai, ba gói trong một lần thanh toán, rẻ hơn mua lẻ. Gói bài học đã mua được trừ vào
                giá.
              </p>
              <ul className="mt-2.5 space-y-2.5">
                {of("combo").map((p) => (
                  <ComboRow
                    key={p.code}
                    combo={p}
                    catalog={catalog}
                    onBuy={setBuying}
                    disabled={!canBuy}
                  />
                ))}
              </ul>
            </section>
          )}

          <section className="mt-7" aria-label="Luyện thi">
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <ClipboardCheck size={17} className="text-blue" aria-hidden="true" /> Pass Luyện thi
            </h2>
            <p className="mt-0.5 text-[12px] font-medium text-ink-2">
              Luyện đề TOPIK theo từng dạng câu và luyện viết câu 51–52 có AI chấm.
            </p>
            {examEnds && (
              <p className="mt-1 text-xs font-semibold text-green">
                Pass của bạn còn hiệu lực đến {shortDate(examEnds)}. Mua thêm sẽ cộng nối tiếp.
              </p>
            )}
            <ul className="mt-2.5 space-y-2.5">
              {of("exam_pass").map((p) => (
                <ProductRow key={p.code} product={p} onBuy={setBuying} disabled={!canBuy} />
              ))}
            </ul>
          </section>

          {auth.isAuthenticated && (orders.data?.length ?? 0) > 0 && (
            <section className="mt-7" aria-label="Đơn gần đây">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-bold">Đơn gần đây</h2>
                <Link to="/orders" className="text-[12px] font-semibold text-blue-deep">
                  Xem tất cả
                </Link>
              </div>
              <ul className="mt-2.5 space-y-2">
                {(orders.data ?? []).slice(0, 3).map((o) => (
                  <OrderRow key={o.id} order={o} onOpen={setResumeId} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="mt-8" aria-label="Câu hỏi thường gặp">
        <h2 className="text-[15px] font-bold">Câu hỏi thường gặp</h2>
        <div className="mt-2.5 space-y-2">
          {faq(catalog).map((f) => (
            <details key={f.q} className="group rounded-[14px] border border-line bg-card p-3.5">
              <summary className="cursor-pointer list-none text-[13px] font-semibold marker:hidden">
                {f.q}
              </summary>
              <p className="mt-1.5 text-[13px] font-medium leading-5 text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-8 space-y-3 border-t border-line pt-5">
        <div className="flex flex-wrap gap-2">
          <SupportButton />
          {auth.isAuthenticated && (
            <Link
              to="/orders"
              className="hit-area inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-[13px] font-semibold shadow-elev-1"
            >
              <Receipt size={15} aria-hidden="true" /> Đơn hàng của tôi
            </Link>
          )}
        </div>
        <PolicyLinks />
      </div>

      <PayDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) close();
        }}
        product={buying}
        resumeOrderId={resumeId}
        supportUrl={catalog?.support_url}
      />
    </Shell>
  );
}

function Li({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      {ok ? (
        <Check
          size={15}
          strokeWidth={3}
          className="mt-0.5 shrink-0 text-green"
          aria-hidden="true"
        />
      ) : (
        <X
          size={15}
          strokeWidth={3}
          className={cn("mt-0.5 shrink-0 text-ink-2")}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </li>
  );
}

/** A combo: what it holds, as chips, and the price against buying them one by one. */
function ComboRow({
  combo,
  catalog,
  onBuy,
  disabled,
}: {
  combo: BillingProductOut;
  catalog: BillingCatalogOut;
  onBuy: (p: BillingProductOut) => void;
  disabled: boolean;
}) {
  const parts = (combo.includes ?? [])
    .map((code) => catalog.products.find((p) => p.code === code))
    .filter((p): p is BillingProductOut => !!p);
  const apart = combo.list_total ?? parts.reduce((n, p) => n + p.amount, 0);
  return (
    <li className="rounded-[18px] border-2 border-blue/40 bg-card p-3.5 shadow-elev-1">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-snug">{combo.title_vi}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {parts.map((p) => (
              <li
                key={p.code}
                className="rounded-full bg-blue-soft px-2.5 py-0.5 text-[11px] font-semibold text-blue-deep"
              >
                {p.title_vi}
              </li>
            ))}
          </ul>
          {apart > combo.amount && (
            <p className="mt-1.5 text-[12px] font-semibold text-green">
              <span className="text-ink-2 line-through">{formatVnd(apart)}</span> · tiết kiệm{" "}
              {formatVnd(apart - combo.amount)}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            tap();
            onBuy(combo);
          }}
          className="hit-area shrink-0 rounded-[12px] bg-blue px-3 py-2 text-xs font-semibold text-primary-foreground shadow-elev-1 active:scale-[0.97] disabled:opacity-60"
        >
          {formatVnd(combo.amount)}
        </button>
      </div>
    </li>
  );
}
