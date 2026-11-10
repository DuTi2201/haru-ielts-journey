import { ChevronDown, Compass } from "lucide-react";

/* «Cách đọc hiệu quả»: the keyword → link → one-line-summary method, adapted to Korean (the
 * predicate and its ending come last, 은/는 vs 이/가, Sino-Korean nouns, connectives, TOPIK 일치
 * questions) and cut to the learner's stage: A = level 1–2 short passage, B = level 3–4 news,
 * C = level 5–6 editorial. Static text; open by default on a short beginner passage. */

interface Step {
  t: string;
  d: string;
}
interface Stage {
  subtitle: string;
  steps: Step[];
  mistake: string;
  note?: string;
}

const A: Stage = {
  subtitle: "4 bước cho đoạn ngắn",
  steps: [
    { t: "Nhìn đuôi câu trước", d: "Gạch vị ngữ cuối câu: đã, đang, sẽ hay không làm?" },
    { t: "Tìm ai làm gì", d: "Khoanh danh từ có 은/는, 이/가, 을/를 để biết ai làm gì." },
    { t: "Đoán từ bằng Hán Việt", d: "Thử ghép âm Hán Việt đoán nghĩa rồi mới tra." },
    { t: "Nối thành một dòng", d: "Viết: chủ đề → hành động → kết quả, bằng mũi tên." },
  ],
  mistake: "Dịch từng từ từ trái sang phải; bỏ sót 안/못/-지 않다 nên hiểu ngược nghĩa.",
  note: "Đọc 3 lượt: lượt 1 lấy ý chung, không tra từ; lượt 2 gạch và tra; lượt 3 đọc to theo giọng Haru.",
};

const B: Stage = {
  subtitle: "5 bước cho bài tin tức",
  steps: [
    { t: "Đọc câu hỏi và đáp án trước", d: "Cần ý chính hay chi tiết? Gạch từ khóa từng đáp án." },
    { t: "Tiêu đề và câu dẫn", d: "Câu đầu trả lời ai, gì, đâu, khi nào, vì sao." },
    { t: "Đánh dấu từ nối, trích dẫn", d: "Khoanh 그러나, 따라서, 한편; tách lời ai nói qua -라고 말했다, -에 따르면." },
    { t: "Giữ số liệu, tên riêng", d: "Đối chiếu từng số, tên, thời gian với đáp án." },
    { t: "Tóm mỗi đoạn một dòng", d: "Mỗi đoạn một dòng mũi tên, rồi chọn câu chủ đề." },
  ],
  mistake: "Thấy đáp án có từ giống bài liền chọn, bỏ qua phủ định và chủ thể.",
  note: "Lượt đầu được lướt chi tiết; khi chọn đáp án phải đối chiếu lại: câu sai thường chỉ đổi một con số, chủ thể hoặc mức độ (모두 → 일부).",
};

const C: Stage = {
  subtitle: "6 bước cho xã luận",
  steps: [
    { t: "Tìm vấn đề tác giả nêu", d: "Viết vấn đề ở đoạn mở thành một câu hỏi." },
    { t: "Tìm câu chủ đề mỗi đoạn", d: "Xem đầu đoạn (두괄식) và cuối đoạn (미괄식)." },
    { t: "Vẽ bản đồ từ nối", d: "그러나 đổi hướng, 따라서 kết luận, 즉 diễn giải, 한편 chuyển ý." },
    { t: "Tách sự thật và ý kiến", d: "Đuôi -아야 한다, -ㄹ 것이다, -다고 본다 cho thấy lập trường." },
    { t: "Tóm tắt khung lập luận", d: "Vấn đề → nguyên nhân → giải pháp, bằng cụm danh từ Hán Hàn." },
    { t: "Đánh giá giá trị lập luận", d: "2–3 câu: đồng ý gì, thiếu gì, mượn cấu trúc nào cho bài 54." },
  ],
  mistake: "Tóm tắt ví dụ thay vì luận điểm; chép nguyên câu thay vì nén thành cụm danh từ.",
};

export function ReadingGuide({ level }: { level: number | null | undefined }) {
  const lv = level ?? 3;
  const stage = lv <= 2 ? A : lv <= 4 ? B : C;
  return (
    <details
      open={lv <= 2}
      className="group mt-4 rounded-[18px] border border-line bg-card p-4 shadow-elev-1"
    >
      <summary className="hit-area flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <Compass size={18} strokeWidth={2.2} className="text-blue" aria-hidden="true" />
        <span className="flex-1">
          <span className="block text-[15px] font-bold">Cách đọc hiệu quả</span>
          <span className="block text-[12px] font-medium text-ink-2">{stage.subtitle}</span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2.6}
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <ol className="mt-3 space-y-2.5">
        {stage.steps.map((s, i) => (
          <li key={s.t} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-soft text-[12px] font-bold text-blue-deep">
              {i + 1}
            </span>
            <span>
              <span className="block text-[13.5px] font-semibold leading-5">{s.t}</span>
              <span className="font-korean-inline block text-[12.5px] font-medium leading-5 text-ink-2">
                {s.d}
              </span>
            </span>
          </li>
        ))}
      </ol>
      {stage.note && (
        <p className="mt-3 rounded-[12px] bg-blue-soft px-3 py-2 text-[12px] font-semibold leading-5">
          {stage.note}
        </p>
      )}
      <p className="mt-2 text-[12px] font-medium leading-5 text-ink-2">
        <span className="font-semibold">Sai lầm hay gặp: </span>
        {stage.mistake}
      </p>
    </details>
  );
}
