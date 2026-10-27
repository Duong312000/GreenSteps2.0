# GreenSteps Web2 — n8n Gemini Agent V2

**Căn cứ mã nguồn cung cấp:** `backend/src` trong `New folder(1).zip`, workflow `GreenSteps Web2 - Gemini Demo No Database.json` và các routes/models của Web2 đã gửi trước đó.

## Tình trạng bàn giao

- **Đã tạo:** workflow n8n JSON có thể import, giữ logic Webhook → Validate → AI Agent Gemini → Reply và credential references của workflow bạn gửi; thêm 5 Code Tools đọc danh mục tour/dịch vụ và tính toán.
- **Đã tạo:** module `greensteps-agent-catalog.service.js` để Express đọc danh mục công khai qua GET `/api/tours` và `/api/services` tại **loopback**, lọc trường và chuyển `context.catalog` sang n8n.
- **Đã tạo:** bản vá `greensteps-chat.service.js` tương thích với mã được gửi. Backend vẫn dùng `POST /api/support/chat` và trường `output` của webhook; Angular nhận `reply` như cũ.
- **Đã kiểm tra:** tính hợp lệ JSON, cấu trúc sơ đồ, cú pháp JS và các bài kiểm thử giả lập trong thư mục `tests`.
- **Chưa kiểm tra thực tế:** n8n server `n8n.ba-ailab.com`, credential Gemini, MongoDB thật, frontend Angular và webhook Production. **Không coi bộ này là đã deploy hoặc end-to-end thành công.**

## Sơ đồ

```text
Angular (Aura AI Chat)
    | POST /api/support/chat
    v
Express/MongoDB (localhost:5055)
    |  GET localhost:5055/api/tours + /api/services (server -> self)
    |  lọc danh mục công khai (tối đa 80 tour + 80 dịch vụ)
    |  POST context.catalog + message + history + sessionId + Header Auth
    v
https://n8n.ba-ailab.com/webhook/greensteps-web2-agent-v2
    | Validate Input -> Agent Gemini + Code Tools -> output
    v
Express đọc `output` -> trả {success, reply, sessionId} -> Angular
```

**Tại sao không dùng HTTP Request Tool gọi trực tiếp `localhost:5055` từ n8n?** Vì n8n nằm trên server khác, địa chỉ localhost của n8n không phải máy đang chạy Web2. Mẫu này dùng Express gửi dữ liệu *được lọc* theo từng lượt chat, không mở MongoDB ra Internet và không phải cấu hình tunnel. Danh mục giới hạn 80 bản ghi mỗi loại và có cờ `truncated`; nếu cần tìm hết kho dữ liệu lớn, phải thay bằng API tool bridge xác thực/chỉ đọc được n8n truy cập.

## 1. Import n8n

1. **Không xóa bản Demo đang hoạt động.** Import file `workflows/GreenSteps_Web2_Gemini_Agent_V2.json` thành workflow mới.
2. Kiểm tra node **Webhook Chat**: `POST`, path `greensteps-web2-agent-v2`, Header Auth, response mode: `Using Respond to Webhook Node`.
3. Kiểm tra credential của **Google Gemini Chat Model**; chọn API key hợp lệ trong giao diện n8n. Kiểm tra model tương thích trên n8n của bạn.
4. Kiểm tra credential Header Auth trong node Webhook. **Tên và giá trị thực tế** phải trùng với biến môi trường backend (không thể lấy lại bí mật từ JSON export).
5. **Code Tools** (`search_tours`, `search_services`, `destination_inventory`, `budget_estimate`, `carbon_summary`) dùng dữ liệu `context.catalog` do Express gửi, không gọi MongoDB hoặc booking API.
6. Bật **Listen for Test Event** khi dùng URL `/webhook-test/greensteps-web2-agent-v2`. Chuyển sang production URL `/webhook/greensteps-web2-agent-v2` khi đã kiểm tra và **publish/activate** workflow theo phiên bản n8n.

## 2. Tích hợp backend — trên repo Web2

Backup các file trước khi chép; **không chép đè hàng loạt** do repo có thể đã thay đổi sau khi bạn tạo ZIP.

1. Tạo file `Web2/backend/src/services/greensteps-agent-catalog.service.js` bằng nội dung tại `backend_patch/src/services/greensteps-agent-catalog.service.js`.
2. Áp dụng `backend_patch/chat-service-changes.patch` vào `Web2/backend/src/services/greensteps-chat.service.js`, hoặc dùng `backend_patch/src/services/greensteps-chat.service.js` làm bản tham khảo để merge. Patch chỉ thêm `loadAgentCatalog`, gọi nó trước POST n8n và gửi `context.catalog`; đồng thời **ngừng gửi `userId` cho n8n** vì tính năng này không cần thông tin định danh.
3. Xác nhận backend thực sự đọc file `.env` bạn cấu hình. Theo mã nguồn được cung cấp, Express đọc `N8N_RESPONSE_FIELD` mặc định `output` và mặc định `PORT=5055`.
4. Ở file `.env` đang được backend sử dụng, điền cấu hình (đây là PLACEHOLDER, **không** điền secret vào file tài liệu, repo, Git):

```dotenv
N8N_WEBHOOK_URL=https://n8n.ba-ailab.com/webhook/greensteps-web2-agent-v2
N8N_AUTH_HEADER_NAME=X-GreenSteps-Agent-Key
N8N_AUTH_HEADER_VALUE=REPLACE_WITH_PRIVATE_SECRET
N8N_RESPONSE_FIELD=output
N8N_CHAT_TIMEOUT_MS=45000
N8N_CATALOG_ENABLED=true
PORT=5055
```

- Tên header trên là **ví dụ** theo buổi cấu hình trước; hãy đối chiếu credential Header Auth thực trong n8n.
- URL production chỉ chạy khi workflow đã được publish/activate. Khi đang test, thay thành `/webhook-test/greensteps-web2-agent-v2` và bật Listen for Test Event.
- Không commit `.env` và không đưa credential vào frontend.
- Vì API công khai `/api/services` có thể chứa dịch vụ `pending`, adapter chỉ đưa dịch vụ trạng thái `active`, `approved`, `published`, `available` vào AI. Cần điều chỉnh danh sách trạng thái nếu nghiệp vụ GreenSteps định nghĩa trạng thái công khai khác.
- Khi MongoDB lỗi, endpoint GET lỗi, hoặc `N8N_CATALOG_ENABLED` chưa bật, Agent vẫn chat tư vấn chung nhưng phải nêu chưa có dữ liệu GreenSteps, không được bịa giá/tour.

## 3. Kiểm tra thử

### A. Từ PowerShell (n8n test)

```powershell
$headers = @{ 'X-GreenSteps-Agent-Key' = $env:GREENSTEPS_N8N_TEST_SECRET }
$body = @{
  message='Gợi ý tour Đà Lạt 3 ngày 2 đêm'
  sessionId='greensteps-test-001'
  history=@()
  context=@{ catalog=@{ available=$false; tours=@(); services=@(); truncated=$false } }
} | ConvertTo-Json -Depth 12
Invoke-RestMethod -Uri 'https://n8n.ba-ailab.com/webhook-test/greensteps-web2-agent-v2' -Method Post -Headers $headers -ContentType 'application/json' -Body $body
```

**Mong đợi:** JSON có `output` (không yêu cầu nội dung câu trả lời cụ thể). Vì test payload không có dữ liệu thật nên Agent phải nói không tra cứu được danh mục.

### B. Từ Angular/Express (sau khi copy patch)

```powershell
$body = @{ message='Tìm tour Đà Lạt'; sessionId='greensteps-test-001'; history=@() } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:5055/api/support/chat' -Method Post -ContentType 'application/json' -Body $body
```

**Mong đợi:** backend trả `success: true`, `reply` và `sessionId` khi n8n trả `output` đúng định dạng.

### C. Dữ liệu mẫu minh họa

Dùng `tests/sample-n8n-payload.json` để kiểm tra việc Tool `search_tours` và `search_services` lọc catalog. **Dữ liệu trong file này hoàn toàn giả lập**, chỉ phục vụ kiểm thử, không được dùng như dữ liệu chính thức của GreenSteps.

## 4. Chức năng và giới hạn

| Năng lực | V2 |
|---|---|
| Chat tiếng Việt bằng Gemini | Có workflow, phụ thuộc credential thực |
| Tra cứu tour | Có Code Tool trên danh mục đã gửi (read-only) |
| Tra cứu dịch vụ | Có Code Tool trên danh mục trạng thái công khai |
| Thống kê điểm đến | Có Tool |
| Dự toán chi phí VND | Có Tool cộng những khoản đã biết, không suy diễn giá |
| Tổng carbon | Có Tool cộng kg CO2e nếu nguồn và đơn vị phù hợp |
| Lịch trình từng ngày | Agent gợi ý; không phải tối ưu thời gian/khoảng cách đã kiểm chứng |
| FAQ/chính sách chính thức | Chưa có bộ chính sách đã xác minh, không tự bịa |
| Booking riêng tư | **Không cho Agent tra cứu** cho đến khi có API kiểm quyền |
| Thanh toán/đặt/hủy | **Không triển khai** |
| Bộ nhớ hội thoại | Backend gửi `history` từ frontend (12 tin gần nhất); không có bộ nhớ dài hạn trong n8n |
| Thẻ tour đẹp | Frontend Aura/Angular cần code bổ sung; V2 hiện trả text |

## 5. Nếu gặp lỗi

| Hiện tượng | Kiểm tra |
|---|---|
| n8n trả 401/403 | Đối chiếu **Name** + **Value** của Header Auth và biến env backend |
| n8n trả 404 | Workflow chưa active/publish, sai URL test/production hoặc sai path |
| Backend trả `CHAT_RESPONSE_INVALID` | Đảm bảo node `Format Reply` trả `output` là chuỗi không rỗng; `N8N_RESPONSE_FIELD=output` |
| Agent báo chưa có dữ liệu | Kiểm tra `N8N_CATALOG_ENABLED=true`, MongoDB, endpoint GET; test Code `Validate Input` xem `catalog.available` |
| ToolCode không thấy `$('Validate Input')` | Xem n8n version và task runner; kiểm tra hỗ trợ truy cập node trước trong Code Tool. Nếu phiên bản không hỗ trợ, cần thay tool bằng workflow tool adapter theo môi trường thực. |
| Gemini lỗi credential/quota | Kiểm tra credentials, model đang hỗ trợ, giới hạn sử dụng |
| Angular TS2322 | Sửa `activeId`/`id` TypeScript trong `greensteps-chat.service.ts`, không liên quan n8n |

## 6. Các bước triển khai tiếp theo

1. Import workflow mới, kiểm tra 3 tình huống: chào hỏi, hỏi tour khi catalog tắt, hỏi tour khi catalog có dữ liệu.
2. Merge backend patch, gọi API local, xác nhận `context.catalog.available === true` và số bản ghi hợp lệ.
3. Kiểm tra **Execution** để bảo đảm Agent thực sự gọi `search_tours`/`search_services` khi hỏi dữ liệu.
4. Chỉ khi hai phía hoạt động mới đổi frontend sang Production n8n qua backend.
5. Sau này xây tool bridge ký danh tính và phân quyền cho booking; tuyệt đối không truyền token/cookie khách hàng sang n8n tùy tiện.
