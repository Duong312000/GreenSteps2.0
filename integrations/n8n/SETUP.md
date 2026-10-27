# Kết nối GreenSteps Agent V2

Code backend và cấu hình local đã dùng:
`https://n8n.ba-ailab.com/webhook/greensteps-web2-agent-v2`.
Khóa xác thực giữ trong `backend/.env`, không nằm trong workflow JSON.
Hướng dẫn và số đo tối ưu mới nhất: [PERFORMANCE.md](PERFORMANCE.md).

## Thao tác trên n8n

1. Vào n8n, tạo workflow và chọn menu **Import from File**. Chọn
   `D:\Web2\integrations\n8n\workflows\GreenSteps_Web2_Gemini_Agent_V2.json`.
2. Mở **Google Gemini Chat Model**, chọn Google Gemini credential của bạn.
3. Mở **Webhook Chat**, giữ POST, path `greensteps-web2-agent-v2` và response
   **Using Respond to Webhook Node**. Chọn Header Auth credential có Name là
   `X-GreenSteps-Agent-Key`, Value trùng `N8N_AUTH_HEADER_VALUE` trong `backend/.env`.
   Đây là webhook credential, không phải API key quản trị n8n.
4. Lưu workflow rồi bấm **Listen for test event** ở Webhook Chat.
5. Mở `http://localhost:4200`, mở chatbot và gửi một câu hỏi. Hoặc chạy lệnh
   `npm.cmd run verify:n8n` từ `D:\Web2\backend` khi listener đã sẵn sàng.
   Mỗi lần thử test URL cần bật lại listener nếu n8n đã dừng lắng nghe.

Khi dùng cho khách hàng, publish workflow rồi đổi `N8N_WEBHOOK_URL` sang
`https://n8n.ba-ailab.com/webhook/greensteps-web2-agent-v2` và khởi động lại backend.
Local hiện giữ webhook-test theo yêu cầu của bạn.

[Tài liệu import chính thức](https://docs.n8n.io/workflows/export-import/) ·
[Tài liệu Webhook chính thức](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)

## Dữ liệu và phản hồi

Backend lấy danh mục công khai từ API MongoDB local và gửi `context.catalog`.
n8n không gọi localhost của máy bạn. Giới hạn 80 tour và 80 dịch vụ công khai;
không chuyển thông tin khách hàng, provider hoặc booking.

Workflow trả `{ "success": true, "output": "..." }`; Express chuyển thành
`{ "success": true, "reply": "...", "sessionId": "..." }` cho Aura.
History lấy từ phiên Aura, tối đa 12 tin gần nhất khi vào Agent, không có bộ nhớ
dài hạn trên n8n. Tool chỉ đọc và tính toán; không tạo booking hoặc thanh toán.

## Chẩn đoán

- HTTP 404: kiểm tra đúng path V2, đã import và đang Listen. Với URL production,
  workflow phải được publish. Không tự chuyển sang path demo cũ.
- HTTP 401/403: Header Auth credential phải trùng cả tên header và giá trị backend.
- HTTP 500/502: xem execution n8n, Gemini credential và khả năng chạy Code Tool
  với `$('Validate Input').first()` trên phiên bản/task runner đang sử dụng.
- `catalog.available=false`: kiểm tra backend, MongoDB, PORT và biến catalog enabled.
  Agent phải báo thiếu dữ liệu, không tự bịa giá/tour.
- Timeout: xem execution Gemini; `N8N_CHAT_TIMEOUT_MS` mặc định 35000, tối đa 45000;
  frontend dừng chờ sau 50 giây.

## Xác minh đã thực hiện ngày 24/10/2026

- 18 kiểm thử backend đạt, gồm lọc catalog, giới hạn trường, proxy và MongoDB API.
- Kiểm tra cấu trúc workflow/tool bằng dữ liệu giả lập đạt; không thay thế chạy n8n thật.
- Catalog local thật: 14 tour, 41 dịch vụ, không bị cắt bớt.
- Webhook-test V2 trả 404 khi gọi thật; chưa xác nhận được câu trả lời Gemini.

So với gói gốc, đã sửa ép null/chuỗi rỗng thành số 0 trong bước Validate Input,
budget_estimate và carbon_summary. Không có credentials bí mật trong JSON.


Cập nhật 24/10/2026: backend/.env đã chuyển sang URL production
https://n8n.ba-ailab.com/webhook/greensteps-web2-agent-v2 theo URL mới được cung cấp.
Đã khởi động lại backend; phép thử thật trả HTTP 404, catalog 14 tour và 41 dịch vụ.
Cần kiểm tra workflow đã được publish/active với đúng POST path V2.

Sau khi publish (24/10/2026): gọi production với câu hỏi hợp lệ trả HTTP 500;
nhánh validation với message rỗng trả HTTP 400 / INVALID_MESSAGE đúng hợp đồng.
Webhook đã nhận được request; cần xem execution lỗi trên n8n để xác định node thất bại.
