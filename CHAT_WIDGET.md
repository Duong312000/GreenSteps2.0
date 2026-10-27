# GreenSteps AI — floating Aura chat

## Đã tích hợp

Widget dùng trực tiếp Web Component `<aura-chat>` từ package chính thức
[`aura-ai-chat@1.0.2`](https://github.com/cc-yuxi/aura-ai-chat), license MIT.
Đã đối chiếu README, `packages/lib`, demo `demos/angular`, các type và export
trong package thực tế. Aura không có floating launcher; wrapper Angular quản lý
nút tròn và popup, còn hội thoại, Markdown, prompt gợi ý, composer, loading,
history và retry là component thật của Aura. Không thêm React/Vue.

Widget nằm trong app shell, ngoài router-outlet. Mặc định chỉ hiện nút 58px ở
góc phải dưới. Aura được import khi mở lần đầu, sau đó giữ nguyên một instance.
Đóng/mở và chuyển trang không reset config, không xóa hội thoại, không gửi API.
Các trang `admin` và `partner-*` ẩn widget mà không hủy instance.

Popup desktop rộng tối đa 400px, cao tối đa 620px. Mobile chiếm phần lớn vùng
hiển thị, chừa header website; Visual Viewport điều chỉnh khi vùng nhìn thay đổi
do bàn phím. Escape đóng chat; focus trả về launcher; Tab xử lý xuyên các shadow
root. CSS được giới hạn trong component/Shadow DOM. Widget dùng z-index 1100,
nằm trên header/dropdown (1050–1070), dưới modal đăng nhập (2000).
Bấm ra ngoài khung chat sẽ đóng và giữ focus ở phần website vừa chọn; bấm trong
Aura/launcher không bị đóng nhầm nhờ composedPath xuyên Shadow DOM. Hội thoại
và instance vẫn được giữ lại, không phát sinh API khi đóng/mở.

Font Material Symbols subset được self-host trong `my-app/public/fonts` cùng
license Apache-2.0 để icon Aura không lệ thuộc việc tải Google Fonts.
Dropdown model được ẩn bằng CSS part trong Shadow DOM: khách hàng không phải
chọn model. Một số nhãn nội bộ của Aura 1.0.2 như Retry/history vẫn bằng tiếng Anh.

Giao diện mới tham khảo ảnh mẫu: khung trắng bo góc 30px, desktop tối đa
420×660px, header trắng, biểu tượng lá, lời chào lớn và bốn thẻ gợi ý. Nền
chuyển nhẹ từ trắng sang mint, xanh lam nhạt và vàng ở phía dưới. Composer dạng
viên thuốc, tin khách nền xanh ngọc và tin AI nền xám nhạt. Dùng component Aura
thật; không thêm thẻ nguồn/bản đồ/đánh giá giả để mô phỏng ảnh mẫu.
Style trong `greensteps-chat.aura-styles.ts` chỉ được gắn một lần vào Shadow DOM
Aura/composer của widget; logo SVG nội bộ ở `public/images/greensteps-ai-mark.svg`.

## Kiến trúc

```text
Angular wrapper + Aura UI
    → custom AIProvider
    → POST /api/support/chat
    → Express validates + attaches server-only auth header
    → n8n Webhook → Gemini Agent
    → Express normalizes response → Aura renders Markdown
```

Provider không dùng LLM trong trình duyệt, không có tool execution hoặc agent
loop riêng; mỗi lần gửi gọi backend một lần. Streaming tắt vì adapter nhận JSON
hoàn chỉnh. `/api/ai/chat` cũ tiếp tục phục vụ phần lập lịch trình, không bị thay.
Không sửa database, booking hoặc authentication.

History dùng `IConversationManager` trong memory của Angular service. Còn nguyên
khi đóng/mở và điều hướng SPA; tải lại tab sẽ bắt đầu phiên mới. Chưa lưu chat
vào MongoDB hoặc localStorage. Không lưu webhook key hoặc provider token trên
trình duyệt. Có thể thay phần lưu trữ bằng backend xác thực sau này.

## Cấu hình n8n

Đặt trong `backend/.env` (Git bỏ qua):

```dotenv
N8N_WEBHOOK_URL=https://n8n.ba-ailab.com/webhook/greensteps-web2-agent-v3-fast
N8N_AUTH_HEADER_NAME=X-GreenSteps-Agent-Key
N8N_AUTH_HEADER_VALUE=your-private-webhook-key
N8N_RESPONSE_FIELD=output
N8N_CHAT_TIMEOUT_MS=35000
N8N_CATALOG_ENABLED=true
N8N_CATALOG_CACHE_MS=30000
```

Local hiện dùng `/webhook-test/` theo lựa chọn của bạn. Bấm **Listen for test
event** ở Webhook node trước khi gửi. Khi listener không hoạt động, n8n trả 404;
adapter trả thông báo tạm thời chưa kết nối được, không bịa câu trả lời AI.
Khi triển khai cho khách hàng, publish/activate workflow và đổi URL sang
`/webhook/greensteps-web2-agent-v2`. [n8n Webhook documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/).

Backend gửi JSON gồm `message`, `chatInput` (cùng nội dung), `sessionId`,
`history: [{ role, content }]` và context website. `chatInput` hỗ trợ cấu hình
Agent/LangChain thường dùng; không chuyển role system/tool từ client tới n8n.

Response contract của adapter mặc định:

```json
{ "output": "Câu trả lời Markdown từ AI Agent" }
```

Cũng nhận mảng chứa đúng một object như trên. Nếu workflow trả
`{ "reply": "..." }`, đặt `N8N_RESPONSE_FIELD=reply`; nếu trả
`{ "data": { "reply": "..." } }`, dùng `data.reply`. Adapter chỉ đọc trường
đã cấu hình, không dò tùy ý hoặc hiển thị raw error từ n8n.

**Trạng thái xác minh V2 (24/10/2026):** đã đọc được catalog thật từ backend:
14 tour, 41 dịch vụ công khai. Gọi webhook-test V2 trả HTTP 404. Chưa xác minh
được câu trả lời Gemini thật; cần import workflow, chọn credentials và bật listener.

## Agent V2 và dữ liệu MongoDB

Bản tối ưu Fast Path/AI Path, kết quả đo thật và cách Publish workflow V3 nằm tại
[integrations/n8n/PERFORMANCE.md](integrations/n8n/PERFORMANCE.md).
Backend hiện xử lý chào hỏi/tra cứu rõ ràng bằng JavaScript trước khi gọi n8n;
AI có deadline mặc định 35 giây, tối đa 45 giây, frontend 50 giây.

Workflow n8n được quản lý trực tiếp trên máy chủ; repo không lưu bản workflow JSON.
Cách cấu hình và Publish nằm trong [integrations/n8n/PERFORMANCE.md](integrations/n8n/PERFORMANCE.md).

Backend đọc hai GET endpoint cố định trên `127.0.0.1:${PORT}/api`, mặc định cổng
5055. Chỉ gửi các trường công khai cho tối đa 80 tour và 80 dịch vụ có trạng thái
active/approved/published/available. Không gửi userId, nhà cung cấp, hồ sơ khách,
booking, token hoặc URI MongoDB. Không chấp nhận catalog do trình duyệt gửi lên.
Catalog đi kèm từng tin nhắn trong `context.catalog`; n8n không cần truy cập máy local.
Các endpoint danh mục hiện có cache tối đa 10 phút, nên dữ liệu có thể có độ trễ này.

Workflow có các tool `search_tours`, `search_services`, `destination_inventory`,
`budget_estimate`, `carbon_summary` và Calculator. Không ghi database hay đặt tour.
Giá/phát thải thiếu được giữ null, không thay bằng 0. Nếu catalog lỗi hoặc tắt bằng
`N8N_CATALOG_ENABLED=false`, Agent được yêu cầu nói rõ thiếu dữ liệu. Lỗi workflow
`success:false` không được xem là câu trả lời AI thành công.

Lệnh kiểm tra thật (gửi một câu hỏi sang n8n, không in khóa hoặc nội dung phản hồi):

```powershell
cd D:\Web2\backend
npm.cmd run verify:n8n
```

Backend có giới hạn đầu vào, lịch sử, kích thước response, timeout, hủy request
khi client ngắt và giới hạn 20 tin nhắn/phút theo người dùng/IP. Lỗi xác thực,
404, timeout và mất mạng được trả thành thông báo; không đưa key vào response.

## Chạy và kiểm tra

Backend:

```powershell
cd D:\Web2\backend
npm.cmd run db:local
npm.cmd start
```

Frontend:

```powershell
cd D:\Web2\my-app
npm.cmd start
```

Mở `http://localhost:4200`. Nhấn nút tròn → chọn prompt hoặc nhập tin nhắn.
Đóng bằng X/Escape rồi mở lại; chuyển sang trang khác để kiểm tra lịch sử.
Để thử AI thật, bật listener n8n trước. Khởi động lại backend sau khi sửa `.env`.

Kiểm thử tự động:

```powershell
cd D:\Web2\backend
node --test test/greensteps-chat.test.js

cd D:\Web2\my-app
npm.cmd run build
npm.cmd run test:chat:e2e
```

E2E dùng Playwright (dev dependency), tự phục vụ bản build qua HTTP local và
intercept **chỉ trong kiểm thử** response chat. Dùng Chrome cài sẵn trên Windows;
có thể đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, hoặc chạy `npx playwright install
chromium` để cài Chromium. Ảnh kiểm tra nằm trong `tmp/chat-widget-artifacts`.

Các kiểm tra gồm mặc định đóng, cùng instance, prompt/Enter gửi tin, Markdown,
session, error/retry, giữ lịch sử khi đóng/mở và đổi route, Escape/focus, mobile
và thu nhỏ viewport. Kiểm tra viewport không thay thế kiểm thử bàn phím thực tế
trên thiết bị iOS/Android. Test fixture không được nạp vào app production.

## File chính

| File | Vai trò |
| --- | --- |
| `my-app/src/app/components/greensteps-chat/greensteps-chat.component.*` | Wrapper, launcher, responsive, accessibility |
| `my-app/src/app/components/greensteps-chat/greensteps-chat.service.ts` | Custom provider + conversation manager |
| `my-app/src/app/components/greensteps-chat/greensteps-chat.types.ts` | Request/response types, dùng đúng type Aura |
| `my-app/src/app/app.html`, `app-module.ts` | Một widget trong layout chung |
| `my-app/public/fonts/*` | Icon font và license |
| `backend/src/routes/support.routes.js` | Endpoint chat mới |
| `backend/src/services/greensteps-chat.service.js` | Validate, gọi n8n, response adapter |
| `backend/src/routes/index.js` | Mount `/support` |
| `backend/.env.example` | Các biến cấu hình không chứa secret |
| `backend/test/greensteps-chat.test.js` | Kiểm thử proxy và lỗi |
| `my-app/e2e/greensteps-chat.e2e.cjs` | Kiểm thử widget trên trình duyệt |

Dependency runtime mới: `aura-ai-chat@1.0.2` (Lit/Material/DOMPurify/marked đi kèm).
Dependency dev mới: `playwright`. Package và lockfile đã cập nhật.


Cập nhật 24/10/2026: backend/.env đã chuyển sang URL production
https://n8n.ba-ailab.com/webhook/greensteps-web2-agent-v2 theo URL mới được cung cấp.
Đã khởi động lại backend; phép thử thật trả HTTP 404, catalog 14 tour và 41 dịch vụ.
Cần kiểm tra workflow đã được publish/active với đúng POST path V2.

Sau khi publish (24/10/2026): gọi production với câu hỏi hợp lệ trả HTTP 500;
nhánh validation với message rỗng trả HTTP 400 / INVALID_MESSAGE đúng hợp đồng.
Webhook đã nhận được request; cần xem execution lỗi trên n8n để xác định node thất bại.
