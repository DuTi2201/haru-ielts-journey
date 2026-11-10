import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalPage } from "@/components/site/LegalPage";
import { POLICY_EFFECTIVE } from "@/routes/terms";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Chính sách bảo mật — Haru" },
      {
        name: "description",
        content: "Haru thu thập dữ liệu gì, dùng để làm gì, chia sẻ với ai và quyền của bạn.",
      },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage
      title="Chính sách bảo mật"
      effective={POLICY_EFFECTIVE}
      intro={<p>Haru chỉ thu thập những gì cần để bạn học được và để xử lý thanh toán.</p>}
      sections={[
        {
          title: "Dữ liệu Haru lưu",
          body: (
            <ul>
              <li>Tài khoản: email, tên hiển thị, mật khẩu (đã mã hoá, Haru không đọc được).</li>
              <li>
                Chống lạm dụng: một mã ngẫu nhiên của trình duyệt và địa chỉ IP khi bạn đăng ký,
                đăng nhập hoặc dùng thử. Cả hai chỉ được lưu ở dạng mã băm không đảo ngược được, chỉ
                để nhận ra nhiều tài khoản dùng chung một trình duyệt / mạng.
              </li>
              <li>
                Quá trình học: bài đã học, kết quả ôn tập, bài viết bạn nộp, điểm và nhận xét.
              </li>
              <li>
                Luyện nói: bản chép lời, điểm và nhận xét của mỗi buổi. Những điều bạn kể về bản
                thân chỉ được ghi nhớ khi bạn bật “cho Haru nhớ”, và có thể xoá bất cứ lúc nào.
              </li>
              <li>
                Đơn hàng: gói đã mua, số tiền, trạng thái, mã giao dịch. Haru không lưu số thẻ, số
                tài khoản hay tên chủ tài khoản của người chuyển.
              </li>
            </ul>
          ),
        },
        {
          title: "Giọng nói của bạn",
          body: (
            <ul>
              <li>
                Khi trò chuyện hoặc tranh luận, giọng nói đi thẳng từ trình duyệt tới dịch vụ Google
                Gemini để Haru nghe và trả lời; máy chủ Haru không ghi âm buổi nói.
              </li>
              <li>
                Khi trình bày hoặc chấm phát âm, bản ghi được gửi lên để chấm một lần và không lưu
                lại; chỉ kết quả chấm được lưu.
              </li>
            </ul>
          ),
        },
        {
          title: "Bên thứ ba",
          body: (
            <ul>
              <li>
                Google (Gemini, Google Cloud): xử lý AI, lưu trữ âm thanh bài học và bản sao lưu.
              </li>
              <li>payOS: tạo mã QR và xác nhận chuyển khoản.</li>
              <li>Haru không bán dữ liệu của bạn và không dùng dữ liệu cho quảng cáo.</li>
            </ul>
          ),
        },
        {
          title: "Lưu trữ trên thiết bị",
          body: (
            <p>
              Ứng dụng lưu phiên đăng nhập, mã ngẫu nhiên của trình duyệt và vài tuỳ chọn (âm thanh,
              chế độ hiển thị) trong bộ nhớ trình duyệt của bạn. Haru không dùng cookie quảng cáo.
            </p>
          ),
        },
        {
          title: "Quyền của bạn",
          body: (
            <p>
              Bạn có thể xem, sửa thông tin tài khoản và yêu cầu xoá tài khoản cùng dữ liệu học tập
              qua{" "}
              <Link to="/contact" className="text-blue-deep underline">
                Liên hệ & hỗ trợ
              </Link>
              . Dữ liệu đơn hàng được giữ theo yêu cầu của pháp luật về kế toán.
            </p>
          ),
        },
      ]}
    />
  );
}
