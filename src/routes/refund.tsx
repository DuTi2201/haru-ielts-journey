import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalPage } from "@/components/site/LegalPage";
import { POLICY_EFFECTIVE } from "@/routes/terms";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Chính sách hoàn tiền — Haru" },
      {
        name: "description",
        content: "Khi nào Haru hoàn tiền, hoàn bao nhiêu, cách yêu cầu và thời gian xử lý.",
      },
    ],
  }),
  component: Refund,
});

function Refund() {
  return (
    <LegalPage
      title="Chính sách hoàn tiền"
      effective={POLICY_EFFECTIVE}
      intro={
        <p>
          Haru bán theo hình thức trả một lần, không tự gia hạn. Chính sách này nói rõ khi nào bạn
          được hoàn tiền, hoàn bao nhiêu và cách yêu cầu.
        </p>
      }
      sections={[
        {
          title: "Lỗi thanh toán: luôn được xử lý",
          body: (
            <ul>
              <li>
                <b>Đã trừ tiền nhưng chưa mở khoá</b>: bấm “Tôi đã thanh toán nhưng chưa mở khoá”
                trong đơn hàng. Hệ thống kiểm tra lại với payOS và mở khoá ngay nếu thấy tiền. Nếu
                vẫn chưa được, Haru kiểm tra thủ công và mở khoá, hoặc hoàn 100% nếu bạn không muốn
                nhận gói.
              </li>
              <li>
                <b>Chuyển dư hoặc thanh toán hai lần</b> cho cùng một đơn: hoàn phần dư / lần trùng.
              </li>
              <li>
                <b>Chuyển thiếu</b>: bạn chuyển bù phần còn thiếu để mở khoá, hoặc nhận lại số đã
                chuyển.
              </li>
              <li>
                <b>Chuyển sau khi đơn hết hạn</b>: tiền vẫn được ghi nhận và gói vẫn được mở; nếu
                bạn không muốn nhận gói thì được hoàn 100%.
              </li>
            </ul>
          ),
        },
        {
          title: "Đổi ý trong 7 ngày",
          body: (
            <>
              <p>Được hoàn 100% số tiền đã trả khi đủ cả hai điều kiện:</p>
              <ul>
                <li>Yêu cầu trong vòng 7 ngày kể từ lúc thanh toán thành công;</li>
                <li>
                  Chưa dùng phần trả phí: chưa mở bài nào thuộc gói bài học, hoặc chưa dùng lượt nào
                  của pass ngoài phần miễn phí ai cũng có.
                </li>
              </ul>
            </>
          ),
        },
        {
          title: "Sự cố từ phía Haru",
          body: (
            <p>
              Nếu một tính năng đã mua không dùng được quá 24 giờ liên tục vì lỗi của Haru, bạn được
              cộng thêm thời hạn tương ứng cho pass, hoặc hoàn tiền theo tỷ lệ thời gian chưa dùng
              được nếu bạn muốn dừng.
            </p>
          ),
        },
        {
          title: "Trường hợp không hoàn tiền",
          body: (
            <ul>
              <li>Đã dùng nội dung trả phí và quá 7 ngày kể từ khi thanh toán.</li>
              <li>
                Tài khoản bị khoá vì vi phạm Điều khoản sử dụng (chia sẻ tài khoản, gian lận...).
              </li>
              <li>Phần tiền được giảm bởi mã giảm giá.</li>
            </ul>
          ),
        },
        {
          title: "Cách yêu cầu hoàn tiền",
          body: (
            <>
              <p>
                Gửi yêu cầu qua{" "}
                <Link to="/contact" className="text-blue-deep underline">
                  Liên hệ & hỗ trợ
                </Link>{" "}
                với:
              </p>
              <ul>
                <li>Email tài khoản Haru và mã đơn (xem ở trang Lịch sử đơn hàng);</li>
                <li>Ngày giờ, số tiền và mã giao dịch ngân hàng (nếu có);</li>
                <li>Số tài khoản nhận hoàn (trùng với tài khoản đã chuyển).</li>
              </ul>
            </>
          ),
        },
        {
          title: "Thời gian xử lý",
          body: (
            <ul>
              <li>Haru phản hồi trong vòng 2 ngày làm việc.</li>
              <li>
                Khi yêu cầu được chấp nhận, tiền được chuyển về đúng tài khoản đã thanh toán trong
                vòng 7 ngày làm việc. Quyền lợi của gói được hoàn sẽ dừng lại.
              </li>
            </ul>
          ),
        },
      ]}
    />
  );
}
