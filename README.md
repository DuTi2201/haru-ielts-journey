# Haru Korean Journey

Bạn là Full-stack Senior Software Architect / Tech Lead cho dự án "Haru" — app học tiếng Hàn (Gemini API) cho người Việt, chuẩn PWA mobile-first. Đây là commit đầu tiên: chỉ dựng BỘ KHUNG (scaffold), KHÔNG build toàn bộ app. Bám sát 100% các quy tắc dưới đây, không tự ý đổi kiến trúc, không thêm thư viện ngoài nếu không thật sự cần.

## 1. Tech stack bắt buộc
Frontend: React + TypeScript + Vite + Tailwind CSS + shadcn/ui (Radix) + Lucide Icons (đúng SDD: React, Tailwind, TypeScript, Lucide — shadcn/Radix chỉ dùng làm hạ tầng component ẩn, không thêm UI kit nào khác). Không thêm state-lib ngoài TanStack Query (cho async/cache) + React Context/hooks cơ bản.

Backend: SDD gốc yêu cầu FastAPI + Celery + Redis + PostgreSQL + S3 + SSE + gRPC, nhưng dự án này build trong Lovable nên dùng Supabase làm tương đương đã được xác nhận:
- PostgreSQL (Supabase) = kho dữ liệu chính, thay cho Postgres tự host
- Supabase Edge Functions (Deno) = thay cho Celery worker — mọi lời gọi Gemini API chạy trong edge function, KHÔNG BAO GIỜ gọi AI đồng bộ trong request của client
- Một bảng `jobs` (id, type, status: queued|running|succeeded|failed|cancelled, progress real, step text, result jsonb, error jsonb, created_at, updated_at) + Supabase Realtime subscribe trên bảng này = thay cho Redis pub/sub + SSE job.progress/job.succeeded/job.failed
- Supabase Storage buckets (audio, exam-images, writing-photos) = thay cho S3, dùng signed URL khi upload
- pg_cron (Postgres extension) = thay cho Celery beat, dùng cho job định kỳ (reset rate-limit hàng ngày, dọn cache)
- Một bảng đơn giản `rate_limits`/`locks` trong Postgres (unique constraint + advisory lock) = thay cho Redis single-flight lock, chống tạo trùng job khi user bấm 2 lần
- Supabase Auth (email + JWT) = thay cho auth tự viết, roles lưu trong bảng `profiles.role` (learner|editor|admin)

Nói rõ với tôi trong response đầu tiên là bạn đã hiểu và áp dụng đúng cách ánh xạ Supabase-tương-đương này.

## 2. Design system "Hanji Pop" — bắt buộc dùng đúng token sau, không tự sáng tạo màu khác
Màu nền chính: #FFF9EF (hanji/giấy). Chữ chính: #1A1740 (ink), chữ phụ: #5B5878 (ink-2). Viền: #1A1740 dày 1.5px, thẻ có shadow đổ cứng "0 4px 0 #1A1740" (offset cứng, không blur) — thẻ đang nhấn thì shadow "0 2px 0". Bo góc lớn: 16–20px cho card, 44px cho nút tròn (icon button 44×44pt tối thiểu).
Bảng màu accent: xanh dương chính #3D5AFE (hover #2A43D6, nền nhạt #E8ECFF), vàng #FFE9A8/#FFC83D, đỏ/hồng #D6353B nền nhạt #FFE0E1, xanh lá #12B886 nền nhạt #E3F7EF/#D3F4E9, tím #7C5CFF nền nhạt #E9E3FF, xanh ngọc #1FB6C9 nền nhạt #D6F3F7, be/tan #EFE7D6 và #E2D9C4 (thanh progress nền), chữ ㅎ/하루 mờ trang trí màu #F6EDD9.
Font: "Be Vietnam Pro" (400/500/600/700/800) cho UI tiếng Việt, "Noto Sans KR" cho chữ Hàn ngắn (nhãn, từ vựng), "Noto Serif KR" (400/600) riêng cho đoạn văn đọc hiểu dài — load qua Google Fonts. Icon: Lucide, stroke 2–2.2px.
Mascot "Kkachi 까치" (chim khách): con vật linh vật vẽ bằng SVG hình học đơn giản (thân xanh dương #3D5AFE viền đen, đầu đen, mỏ vàng, đuôi chẻ 2 nhánh, chân vàng) — chỉ xuất hiện ở onboarding, gate, empty-state, error-state, kèm bong bóng thoại bo góc "18px 18px 18px 4px" nền trắng viền đen.
Layout: mobile-first 390px width là khung chính, safe padding ngang 24px, bottom TabBar cố định cao 84px.

## 3. Data model — khởi tạo đầy đủ TypeScript interfaces + bảng Postgres tương ứng (SQL migration), đúng field/kiểu dữ liệu sau (rút từ SDD, mở rộng hợp lý các bảng chỉ có index mà không có full column list):
- `profiles`: id uuid PK (=auth.users.id), role enum('learner','editor','admin'), display_name text, goal enum('talk','topik1','topik4','topik5','topik6'), exam_date date null, daily_minutes int
- `audio.lecture_audio`: id, cache_key text unique, opus_path text, aac_path text null, prompt_version text, voice text, duration_sec int, created_at
- `corpus.corpus_item`: id, film_id text, text_ko text, kind text, level text, register text, topic_ids int[], embedding vector(768) — bật extension pgvector, index HNSW trên embedding + GIN trên topic_ids
- `analytics.learning_event`: partition theo range occurred_at, PK composite (learner_id, occurred_at, event_id), event_type text, skill text, value real, payload jsonb
- `content.exam_paper`: id, exam_kind text, session_label text, owner_id uuid FK profiles, file_hash text unique per owner, answer_status text, import_job_id uuid, prompt_version text
- `content.question_type`: id, skill text, code text unique, name_ko text, name_vi text, active bool
- `content.exam_passage`: id, paper_id FK cascade, kind text, body_ko text, chart_data jsonb null, image_key text null, audio_key text null, source_page int, source_bbox jsonb, embedding vector(768)
- `content.exam_item`: id, paper_id FK cascade, passage_id FK null, number int unique per paper, qtype_id FK, stem_ko text, options jsonb, answer smallint null, answer_source enum('editor','ai_guess') null, difficulty_est real, confidence real, import_item_id uuid null, embedding vector(768)
- `content.exam_item_tag`: PK composite (item_id, tag_kind, ref_id), item_id FK cascade, tag_kind text, ref_id text, score real, source text
- `vocab_item`: id, learner_id FK, term_ko text, meaning_vi text, topic_id int null, level text
- `item_state`: id, learner_id FK, vocab_item_id FK, srs_stage int, next_review_at timestamptz, ease real
- `import_item`: id, import_batch_id uuid, kind text, status enum('pending','flagged_yellow','flagged_red','confirmed','rejected'), payload jsonb, confidence real
- `writing_submission`: id, learner_id FK, prompt_id text, status enum('uploaded','image_rejected','transcribing','awaiting_confirmation','grading','graded','revising','revised','rewriting'), image_key text, transcript text null, created_at
- `writing_score`: id, submission_id FK, criteria jsonb, score_range int4range, priority_fixes jsonb
- `error_log`: id, learner_id FK, skill text, error_type text, example_ko text, created_at
- `jobs`: (mô tả ở mục 1)

## 4. Routing / Site map — tạo React Router route cho đủ 18 màn hình sau (stub placeholder được, trừ mục 5 phải build đầy đủ), theo đúng tên/thứ tự:
/onboarding (Main — chọn mục tiêu), /placement (kiểm tra đầu vào), /today (Hôm nay — TRANG CHỦ), /lesson/:id (bài học + trình phát audio), /listening (bài nghe TOPIK), /speaking (luyện nói, có waveform + hold-to-record), /reading (bài đọc TOPIK + độ phủ từ vựng), /support-language (ngôn ngữ hỗ trợ), /writing/brief (Xưởng viết bước 1 — chọn đề), /writing/capture (bước 2 — chụp bài), /writing/compare (bước 3 — đối chiếu bản chép), /writing/result (bước 4 — kết quả chấm), /writing/revise (bước 5 — tự sửa + viết lại), /progress (tiến bộ — radar 6 kỹ năng + gate + error log), /studio (admin — duyệt lô nhập dữ liệu), /studio/exam-review/:id (admin — duyệt đề thi đã tách câu).
Bottom TabBar 5 tab cố định (mọi màn hình learner, ẩn ở /studio*): Hôm nay(/today) · Học(/lesson) · Luyện(gộp /speaking, /reading, /listening, /writing/*) · Tiến bộ(/progress) · Tôi(/support-language + settings).
Mọi luồng AI-call phải theo state machine: writing_submission (uploaded↔image_rejected→transcribing→awaiting_confirmation→grading→graded→revising→revised→rewriting→grading), import batch (queued→extracting→validating→awaiting_review→confirmed|cancelled→rolled_back).

## 5. UI states + deliverable đầu tiên
Mọi component async phải có đủ 5 trạng thái: Default/Loading/Empty/Error/Success, và tuân theo 5 cấp độ chờ trong SDD: cấp 0 tức thời <100ms optimistic; cấp 1 ngắn 100ms–1s (skeleton, chỉ hiện sau delay 150ms); cấp 2 trung 1–5s (progress bar thật + text bước); cấp 3 dài 5–60s (SSE/Realtime stage-stepper + Kkachi animation, không block UI); cấp 4 rất dài >60s (mục Tiến độ toàn app + thông báo + kết quả từng phần).

BUILD ĐẦY ĐỦ ngay bây giờ màn hình "/today" (Hôm nay) khớp chính xác thiết kế sau (mobile 390px):
- Nền #FFF9EF, chữ ㅎ mờ #F6EDD9 góc trên phải trang trí.
- Header: dòng nhỏ "Mục tiêu · TOPIK II cấp 4" (#5B5878) + dòng lớn 26px/800 "Chào buổi sáng!"; bên phải badge chuỗi ngày học (icon lửa đỏ, nền vàng #FFE9A8, viền đen, bo tròn, số "12").
- Card cổng (gate) viền đen dày, shadow cứng: icon khiên + "Cổng làm đề TOPIK 4", số "72%" xanh dương đậm bên phải; progress bar bo tròn nền #EFE7D6 fill #3D5AFE 72%; dòng text nhỏ giải thích còn thiếu gì để mở cổng.
- Tiêu đề "Kế hoạch hôm nay" + badge "15 phút" nền #E8ECFF.
- 3 task card dọc: (1) task đã xong (nền xanh lá nhạt #E3F7EF, icon check tròn xanh lá #12B886, text "Khởi động · kiểm tra nhanh — 3 phút · xong rồi, đúng 4/5 câu", không có mũi tên/không click); (2) task chưa xong link tới /lesson (nền #E8ECFF, icon tam giác play xanh dương #3D5AFE, "Học 9 từ mới cho bài đọc — 6 phút · chủ đề 환경 (môi trường)", mũi tên phải); (3) task chưa xong link tới /writing/revise (nền trắng viền đen, icon bút vàng #FFC83D, "Tự sửa bài viết câu 54 — 6 phút · còn 3 chỗ cần sửa", mũi tên phải). Mỗi card bo góc 18px, viền đen 1.5px, shadow cứng.
- Cuối trang: mascot Kkachi (SVG nhỏ 56px) + bong bóng thoại chứa tip ngắn.
- Bottom TabBar 5 tab cố định cao 84px, tab "Hôm nay" đang active (nền xanh nhạt, chữ xanh đậm đậm nét), icon Lucide cho mỗi tab, tab active có nền pill #E8ECFF chữ #2A43D6 bold, tab inactive chữ #5B5878.

Sau khi dựng xong, cho tôi biết rõ: (a) bạn đã tạo những file/route nào, (b) database schema đã migrate chưa, (c) link preview để tôi mở bằng Safari trên iPhone kiểm tra ngay bố cục mobile. Đừng build các màn hình khác ở bước này — chỉ cần route stub trống là đủ, tôi sẽ yêu cầu từng bước tiếp theo sau khi xem preview.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/712b85ce-b275-45b4-875d-28ef749339a5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
