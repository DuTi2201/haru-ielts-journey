import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalPage } from "@/components/site/LegalPage";
import { useCatalog } from "@/lib/billing";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Điều khoản sử dụng — Haru" },
      {
        name: "description",
        content:
          "Điều khoản sử dụng ứng dụng học tiếng Hàn Haru: tài khoản, gói trả phí, thanh toán, tính năng AI.",
      },
    ],
  }),
  component: Terms,
});

export const POLICY_EFFECTIVE = "30/10/2026";

function Terms() {
  const { catalog } = useCatalog();
  const operator = catalog?.merchant?.name || "đơn vị vận hành Haru (thông tin ở cuối trang)";
  const free = catalog?.free_lesson_max ?? 19;
  return (
    <LegalPage
      title="Điều khoản sử dụng"
      effective={POLICY_EFFECTIVE}
      intro={
        <p>
          Haru là ứng dụng học tiếng Hàn trực tuyến dành cho người Việt, do {operator} vận hành. Khi
          tạo tài khoản hoặc thanh toán trên Haru, bạn đồng ý với các điều khoản dưới đây. Vui lòng
          đọc kỹ, đặc biệt là phần gói trả phí và{" "}
          <Link to="/refund" className="text-blue-deep underline">
            Chính sách hoàn tiền
          </Link>
          .
        </p>
      }
      sections={[
        {
          title: "Tài khoản",
          body: (
            <ul>
              <li>Bạn cung cấp email thật và tự bảo mật mật khẩu của mình.</li>
              <li>
                Mỗi tài khoản dành cho một người học. Không chia sẻ, cho thuê hay bán lại tài khoản.
              </li>
              <li>
                Người dưới 16 tuổi cần có sự đồng ý của cha mẹ hoặc người giám hộ trước khi mua gói
                trả phí.
              </li>
            </ul>
          ),
        },
        {
          title: "Nội dung miễn phí và gói trả phí",
          body: (
            <>
              <p>
                {free} bài học đầu tiên luôn miễn phí và đầy đủ. Các phần còn lại được mở bằng các
                gói trên trang{" "}
                <Link to="/pricing" className="text-blue-deep underline">
                  Bảng giá
                </Link>
                :
              </p>
              <ul>
                <li>
                  <b>Gói bài học</b>: mua một lần, dùng lâu dài cho các bài trong gói trong suốt
                  thời gian Haru hoạt động.
                </li>
                <li>
                  <b>Pass có thời hạn</b> (Pass Luyện thi, Haru Nói): dùng trong số ngày ghi trên
                  gói, tính từ lúc thanh toán thành công. Mua thêm khi đang còn hạn thì thời hạn
                  được cộng nối tiếp. Không tự động gia hạn, không tự trừ tiền.
                </li>
                <li>
                  Tính năng luyện nói với AI (Haru Nói) có phần dùng thử miễn phí{" "}
                  <b>một lần cho mỗi tài khoản</b> (số phút nói và số lượt chấm ghi ở trang Bảng
                  giá), không làm mới theo ngày, và một lần cho mỗi trình duyệt. Tạo nhiều tài khoản
                  để dùng thử nhiều lần là vi phạm điều khoản: Haru có thể từ chối dùng thử và khoá
                  các tài khoản đó. Khi lượng dùng thử chung trong ngày đã hết, phần dùng thử tạm
                  dừng tới hôm sau.
                </li>
                <li>
                  Hạn mức của các tính năng dùng AI, kể cả khi bạn đã mua gói: Haru Nói có số phút
                  nói ghi trên gói (dùng chung cho Trò chuyện và Tranh luận · Đàm phán · Phản biện)
                  và tối đa 20 phút nói mỗi ngày; Trình bày tối đa 15 lượt chấm mỗi ngày; luyện viết
                  câu 51–52 tối đa 12 đề mỗi ngày. Gói Haru Nói mua trước ngày 30/10/2026 giữ nguyên
                  quyền lợi đã mua (không tính tổng số phút, vẫn tối đa 20 phút mỗi ngày).
                </li>
              </ul>
            </>
          ),
        },
        {
          title: "Giá và thanh toán",
          body: (
            <ul>
              <li>
                Giá niêm yết bằng đồng Việt Nam. Số tiền hiển thị ở bước “Xác nhận thanh toán” (sau
                mã giảm giá, nếu có) là số tiền cuối cùng bạn trả.
              </li>
              <li>
                Thanh toán bằng chuyển khoản ngân hàng qua mã QR của cổng payOS. Haru không thu và
                không lưu số thẻ hay thông tin đăng nhập ngân hàng của bạn.
              </li>
              <li>
                Mỗi đơn có hiệu lực 15 phút. Hãy chuyển đúng số tiền và giữ nguyên nội dung chuyển
                khoản để hệ thống tự mở khoá. Chuyển thiếu, chuyển dư hay chuyển sau khi đơn hết hạn
                sẽ được kiểm tra và xử lý theo{" "}
                <Link to="/refund" className="text-blue-deep underline">
                  Chính sách hoàn tiền
                </Link>
                .
              </li>
              <li>
                Haru có thể thay đổi giá bán. Thay đổi không ảnh hưởng đến đơn đã tạo và quyền lợi
                bạn đã mua.
              </li>
            </ul>
          ),
        },
        {
          title: "Mã giảm giá",
          body: (
            <ul>
              <li>
                Mỗi mã có điều kiện riêng (gói áp dụng, thời hạn, số lượt) được kiểm tra khi xác
                nhận đơn.
              </li>
              <li>Mã không quy đổi thành tiền mặt; phần giảm giá không được hoàn lại.</li>
              <li>Haru có thể ngừng một mã đang bị lạm dụng mà không cần báo trước.</li>
            </ul>
          ),
        },
        {
          title: "Tính năng AI",
          body: (
            <ul>
              <li>
                Phần chấm điểm, nhận xét, gợi ý và hội thoại được tạo bởi mô hình AI (Google
                Gemini). Kết quả mang tính tham khảo để luyện tập, có thể chưa chính xác, và không
                thay thế kết quả thi hay chứng chỉ chính thức.
              </li>
              <li>
                Khi bạn luyện nói, giọng nói được gửi đến dịch vụ AI để nghe và chấm. Chi tiết xem{" "}
                <Link to="/privacy" className="text-blue-deep underline">
                  Chính sách bảo mật
                </Link>
                .
              </li>
            </ul>
          ),
        },
        {
          title: "Quyền sở hữu nội dung",
          body: (
            <p>
              Bài học, hình ảnh, âm thanh và phần mềm của Haru thuộc quyền của đơn vị vận hành hoặc
              bên cấp phép. Bạn được dùng để học cho chính mình; không sao chép, ghi lại, phân phối
              hay bán lại nội dung.
            </p>
          ),
        },
        {
          title: "Hành vi không được phép",
          body: (
            <ul>
              <li>Chia sẻ tài khoản, dùng chung gói cho nhiều người.</li>
              <li>
                Tạo nhiều tài khoản cho một người, hoặc dùng email tạm thời / email ảo để đăng ký.
              </li>
              <li>Dùng công cụ tự động, khai thác lỗi, can thiệp hay làm quá tải hệ thống.</li>
              <li>Dùng tính năng AI để tạo nội dung vi phạm pháp luật hoặc xúc phạm người khác.</li>
            </ul>
          ),
        },
        {
          title: "Tạm ngưng và chấm dứt",
          body: (
            <p>
              Haru có thể tạm khoá tài khoản vi phạm các điều khoản trên sau khi đã liên hệ với bạn.
              Bạn có thể ngừng sử dụng và yêu cầu xoá tài khoản bất kỳ lúc nào qua trang{" "}
              <Link to="/contact" className="text-blue-deep underline">
                Liên hệ
              </Link>
              .
            </p>
          ),
        },
        {
          title: "Giới hạn trách nhiệm",
          body: (
            <p>
              Haru nỗ lực để dịch vụ chạy ổn định nhưng không cam kết không bao giờ gián đoạn. Khi
              sự cố từ phía Haru khiến bạn không dùng được gói đã mua, Haru sẽ khắc phục, cộng thêm
              thời hạn tương ứng hoặc hoàn tiền theo Chính sách hoàn tiền.
            </p>
          ),
        },
        {
          title: "Thay đổi điều khoản",
          body: (
            <p>
              Khi điều khoản thay đổi, Haru cập nhật ngày hiệu lực ở đầu trang và thông báo trong
              ứng dụng. Quyền lợi bạn đã mua trước đó được giữ nguyên.
            </p>
          ),
        },
        {
          title: "Liên hệ và giải quyết tranh chấp",
          body: (
            <p>
              Mọi thắc mắc, khiếu nại xin gửi qua trang{" "}
              <Link to="/contact" className="text-blue-deep underline">
                Liên hệ & hỗ trợ
              </Link>
              . Hai bên ưu tiên thương lượng; nếu không thành, tranh chấp được giải quyết theo pháp
              luật Việt Nam.
            </p>
          ),
        },
      ]}
    />
  );
}
