# GreenSteps AI performance — 24/10/2026

## Thay đổi đã chạy local

API vẫn trả `{success, reply, sessionId}` cho Aura. Backend xử lý JavaScript
trước khi gọi n8n: chào hỏi/hướng dẫn có mẫu chính xác, liệt kê điểm đến,
tìm tour theo điểm đến + ngày + mức giá, tìm dịch vụ theo điểm đến + loại,
giá sản phẩm theo tên/mã chính xác và tổng các khoản đã tra giá trong catalog.
Không đổi schema MongoDB hoặc nghiệp vụ booking, OAuth/thanh toán.

Ví dụ Fast Path:

```text
Xin chào.
GreenSteps có những điểm đến nào?
Tìm tour Đà Lạt 3 ngày dưới 3 triệu.
Tìm homestay tại Đà Lạt.
Xem giá tour tour_duong_1
Tính tổng dịch vụ SRV_DL_EBIKE01 x 2 + dịch vụ SRV_DL_TUYENLAM01 x 1
```

Classifier dùng grammar đầy đủ, không chỉ dò từ khóa. Có điều kiện chưa hỗ trợ
(hồ bơi, trẻ em, phủ định, so sánh điểm đến), tham chiếu “tour đó”, không xác
định được sản phẩm hoặc nhiều ý trong một câu thì chuyển sang AI. Homestay lọc
tên/loại homestay, không xem mọi dịch vụ stay là homestay. Ngân sách “dưới” dùng
`<`, “tối đa/không quá” dùng `<=`; sản phẩm chưa có giá không được coi là rẻ hơn
ngân sách. Không bịa kết quả để lấp danh mục rỗng.

Phép cộng yêu cầu tên/mã duy nhất + số lượng dương, tối đa 10 khoản và 99 đơn vị
mỗi khoản. Không lấy giá từ lịch sử hoặc số tiền tự khai. Không tự cộng tour trọn
gói với dịch vụ riêng vì có thể trùng chi phí. Giá vẫn là giá tham khảo; catalog
chưa chứa đủ đơn vị tính/điều kiện để xác nhận giá đặt chỗ.

## Cache, AI và giới hạn chờ

Catalog chỉ lấy trường công khai như bản V2, cache trong memory 30 giây,
không cache lỗi. `N8N_CATALOG_CACHE_MS` chỉnh 0–60000; 0 tắt cache. Các endpoint
nguồn hiện có cache riêng 10 phút, nên đây không phải dữ liệu tức thời.
Chào hỏi cố định không cần catalog/n8n credential. Không cache câu trả lời AI.

AI chỉ nhận 6 tin gần nhất, tối đa 1000 ký tự mỗi tin. Catalog theo điểm đến rõ
trong câu hỏi, tối đa 12 tour + 16 dịch vụ, description 120 ký tự, bỏ tags.
Cờ `truncated` cho biết phạm vi đã giới hạn. Hội thoại hiển thị trong Aura không
bị xóa do việc rút gọn payload này.

Backend mặc định `N8N_CHAT_TIMEOUT_MS=35000`, cho phép 1000–45000; gồm chuẩn bị
catalog và gọi n8n. Hết hạn hủy fetch, trả 504/CHAT_TIMEOUT thân thiện. Frontend
dừng sau 50 giây kể cả khi backend/mạng bị treo; đóng/mở widget không gọi lại API.
Không thêm retry tự động ở frontend hoặc Express. Nút Retry của Aura vẫn do khách
chủ động bấm. Việc backend ngắt kết nối không bảo đảm dừng execution V2 từ xa.

## Workflow n8n và Publish

Workflow được quản lý trực tiếp trên máy chủ n8n; repo không lưu JSON workflow
hoặc bản dự phòng. Backend đang cấu hình path `greensteps-web2-agent-v3-fast`.
Khi đổi workflow hoặc webhook path, cập nhật `N8N_WEBHOOK_URL` trong `backend/.env`
và khởi động lại backend. Không đưa credential vào Git.

V3 đặt maxIterations=3, bản mới tăng output lên 4096 token để hạn chế câu bị cụt,
prompt ngắn hơn và đưa sẵn tối đa
4 tour + 6 dịch vụ vào prompt để tránh gọi tool chỉ để đọc dữ liệu đã có.
Tool vẫn dùng phần catalog đã lọc từ backend. Không yêu cầu tính ngân sách/carbon
cho mỗi câu lập lịch trình. Mọi node tắt retryOnFail, workflow đặt executionTimeout
30 giây; cần đối chiếu giới hạn timeout thực tế của server n8n. Retry nội bộ SDK
Gemini không có tùy chọn được ánh xạ trong node legacy này; không tuyên bố đã tắt
retry ở tầng SDK. Giới hạn backend vẫn bảo vệ thời gian chờ của trình duyệt.

Giữ model `models/gemini-2.5-flash` đã hoạt động với credential hiện tại, vì chưa
truy cập được danh sách model khả dụng trong tài khoản. Trong n8n, chọn credential
rồi xem dropdown model để thử model Flash nhanh hơn có tool calling nếu có;
đo lại trước khi kết luận. Không tự chọn model chưa xác minh tài khoản dùng được.

Node `lmChatGoogleGemini` dùng trong gói không ánh xạ Thinking Level/Thinking Budget.
Không thêm `thinkingLevel: low` vô hiệu vào JSON. Nếu instance có node mới hỗ trợ
Thinking Level và model tương thích, thử low rồi chạy lại benchmark. Tham chiếu:
[mã node n8n chính thức](https://github.com/n8n-io/n8n/blob/master/packages/@n8n/nodes-langchain/nodes/llms/LmChatGoogleGemini/LmChatGoogleGemini.node.ts),
[Google thinking](https://ai.google.dev/gemini-api/docs/thinking).

1. Mở workflow đang dùng trên n8n.
2. Webhook Chat: chọn Header Auth có Name/Value trùng backend/.env. Không điền
   secret vào JSON hoặc frontend. Google Gemini Chat Model: chọn credential đang dùng.
3. Save rồi Publish/Active. POST path phải trùng `N8N_WEBHOOK_URL` trong backend.
4. Sau khi publish, đổi duy nhất URL trong `backend/.env`:

   ```dotenv
   N8N_WEBHOOK_URL=https://n8n.ba-ailab.com/webhook/greensteps-web2-agent-v3-fast
   N8N_CHAT_TIMEOUT_MS=35000
   N8N_CATALOG_CACHE_MS=30000
   ```

5. Khởi động lại backend, chạy lại benchmark bên dưới. Nếu cần rollback, trả URL
   về `/webhook/greensteps-web2-agent-v2` rồi khởi động lại. V2 JSON không thay đổi.

Bạn đã xác nhận publish V3 và chọn credentials. Backend đã chuyển sang URL
production V3, khởi động lại và đo 15 request thật. Nhánh validation V3 trả
400/INVALID_MESSAGE đúng hợp đồng, nhưng nhánh AI trả 500. Cần xem node lỗi trong
Executions để xác định nguyên nhân; webhook key không cho phép đọc log quản trị.

## Log hiệu năng

Browser console có `[GreenSteps chat performance]` với `frontendExpressMs`,
HTTP status cho request từ Aura. Express ghi JSON `greensteps_chat_performance`:
requestId ngẫu nhiên, path fast/ai, intent, status/upstreamStatus, code,
catalogMs, n8nMs, totalApiMs, disconnected và agentMs nếu V3 cung cấp.
Không ghi nội dung chat, lịch sử, userId, sessionId, URL, header key hoặc token.

Response thêm header `Server-Timing` (catalog/n8n/api), `X-Chat-Path`,
`X-Request-Id`, có CORS expose để trình duyệt đọc; JSON body giữ nguyên.
Các thời gian gồm I/O và xử lý, không cộng chúng như các giai đoạn độc lập nếu
đã nằm trong totalApiMs. Tổng API ở log tính đến khi response đóng; header api
đo ngay trước serialize/send. Browser duration còn bao gồm network/CORS/scheduling.

V3 có AI Start → Agent → Format Reply, trả `performance.agentMs` là **tổng Agent
bao gồm model và tool**, không phải riêng Gemini. Code Tools ghi durationMs với
tên tool, không ghi input/output. Console Code log phụ thuộc runner/log của host;
xem node/sub-node durations trong Executions để biết thời gian Gemini riêng nếu
n8n lưu chúng. Không có quyền đọc log server nên chưa có số liệu Gemini/tool thật.

## Đo thật: 3 lần × 5 câu

Chrome headless chạy trên máy local, mở frontend `http://localhost:4200/tours`,
gọi API thật `http://localhost:5055/api/support/chat` bằng browser fetch, không
intercept/mocks. Mỗi mẫu dùng session mới, history rỗng, chạy tuần tự.
AI URL lần đo cuối: **production V3** `/webhook/greensteps-web2-agent-v3-fast`.
Không đo thời gian vẽ từng ký tự giao diện. Số liệu bao gồm cold start/network;
không loại bỏ outlier hoặc lỗi. Chưa đo tải đồng thời/Internet production.

| Câu hỏi | Lần 1 (ms) | Lần 2 (ms) | Lần 3 (ms) | Trung vị (ms) | Kết quả |
| --- | ---: | ---: | ---: | ---: | --- |
| Xin chào. | 256.8 | 10.7 | 8.2 | 10.7 | 3/3 HTTP 200, Fast Path |
| GreenSteps có những điểm đến nào? | 207.2 | 13.3 | 12.0 | 13.3 | 3/3 HTTP 200, Fast Path |
| Tìm tour Đà Lạt 3 ngày dưới 3 triệu. | 87.6 | 8.9 | 9.3 | 9.3 | 3/3 HTTP 200, Fast Path |
| Tìm homestay tại Đà Lạt. | 14.0 | 12.2 | 11.4 | 12.2 | 3/3 HTTP 200, Fast Path |
| Lập lịch trình Đà Lạt 3 ngày 2 đêm. | 2022.8 | 1920.6 | 430.0 | 1920.6 | 3/3 Express 502 do n8n HTTP 500 |

Trung vị câu 5 là thời gian **trả lỗi**, không phải thời gian tạo lịch trình thành
công. Fast Path đã chứng minh không gọi Gemini (n8nMs=0, header path=fast).
Chưa thể kết luận AI đạt mục tiêu tốc độ hoặc độ ổn định. Không có baseline đủ
3 mẫu trước thay đổi để công bố tỷ lệ cải thiện. Benchmark ghi raw samples gồm
catalog/n8n/api timings và lỗi vào `tmp/performance-results.json`; đây là output
local bị bỏ qua bởi Git.
Lần đo trước với backend Fast Path mới nhưng AI URL còn V2 ghi nhận AI timeout 35025.3 ms,
hai lỗi upstream 6234.8/4245.6 ms. Đây không phải baseline trước khi sửa backend;
không dùng hai lần đo này để tuyên bố V3 nhanh hơn khi AI đều chưa thành công.

## Chạy lại kiểm thử

```powershell
cd D:\Web2\backend
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27018/?replicaSet=rs0'
npm.cmd test

cd D:\Web2
cd D:\Web2\my-app
npm.cmd run build
npm.cmd run test:chat:e2e
npm.cmd run benchmark:chat
```

Benchmark cần frontend và backend đang chạy, Chrome cài sẵn (hoặc biến
PLAYWRIGHT_CHROMIUM_EXECUTABLE). Gửi ít nhất 15 request thật; không tự retry các
mẫu lỗi. Kết quả được ghi đè tại `tmp/performance-results.json`.
Giới hạn endpoint 20 request/phút vẫn giữ nguyên. Không chạy nhiều benchmark
đồng thời để tránh gây rate limit. E2E giao diện có fixture riêng, không dùng làm
bằng chứng kết nối AI thật.

## File thay đổi trong đợt tối ưu này

| File | Thay đổi |
| --- | --- |
| backend/src/services/greensteps-chat-fast-path.service.js | Grammar, lookup/giá/tổng, rút gọn payload AI |
| backend/src/services/greensteps-agent-catalog.service.js | Cache catalog công khai |
| backend/src/services/greensteps-chat.service.js | Điều phối Fast/AI, deadline, đo catalog/n8n |
| backend/src/routes/support.routes.js | Header timing, log tổng API an toàn |
| backend/test/greensteps-chat-fast-path.test.js | Phân loại, lọc, giá, tổng, cache, chuyển AI |
| backend/test/greensteps-chat.test.js | Kiểm tra headers/log không lộ dữ liệu |
| backend/.env.example | Timeout/cache mẫu |
| backend/.env (ignored) | Timeout 35000, cache 30000; giữ credentials |
| my-app/src/app/components/greensteps-chat/greensteps-chat.service.ts | History ngắn, timeout 50s, log browser |
| my-app/package.json | Lệnh benchmark:chat |
| my-app/e2e/benchmark-greensteps-chat.cjs | 15 phép đo browser thật, lưu kết quả/lỗi |
| integrations/n8n/PERFORMANCE.md | Báo cáo, cấu hình, Publish, kiểm thử |
| CHAT_WIDGET.md | Liên kết báo cáo và timeout mới |
