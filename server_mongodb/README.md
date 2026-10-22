# GreenSteps Travel - Backend MongoDB & RESTful API System

Hệ thống cơ sở dữ liệu MongoDB và máy chủ RESTful API phục vụ đồ án môn **Phát triển ứng dụng Web Nâng Cao** (Giảng viên: TS. Trần Duy Thanh - Trường Đại học Kinh tế - Luật, ĐHQG-HCM).

Hệ thống được thiết kế theo đúng quy chuẩn kiến trúc được giảng dạy trong các chương từ **Chương VI đến Chương VIII**:
- **Chương VI**: Xây dựng kiến trúc RESTful Web Services chuẩn RESTful với Express, Morgan Logger, Body-Parser, CORS.
- **Chương VII**: Tích hợp cơ sở dữ liệu NoSQL MongoDB, kết nối bằng Mongoose ODM & Native MongoClient (`mongodb`), phục vụ Static Files (`public/images`), Upload file (`express-fileupload`).
- **Chương VIII**: Cơ chế bảo mật và xác thực phiên làm việc thông qua **Cookie** (`cookie-parser`) kết hợp **Session** (`express-session`) và JWT Token.

---

## 👥 Bảng Phân Công Tính Năng & Ánh Xạ API

Hệ thống được phân quyền và phân bổ API bám sát 100% ma trận phân công của 5 thành viên:

### 1. Kiên
- **FR-PRO-08**: Khách hàng và đánh giá -> `/api/reviews`
- **FR-ADM-02**: Quản lý người dùng -> `/api/admin/users`, `/api/admin/users/:id/status`
- **FR-CUS-11**: Hỗ trợ & thông báo -> `/api/support/tickets`, `/api/notifications`, `/api/support/chat`
- **FR-ADM-11**: Danh mục & cấu hình hệ thống -> `/api/admin/configs`
- **FR-ADM-12**: Quản trị AI & gợi ý -> `/api/ai/recommendations`
- **FR-ADM-14**: Bảo mật và vận hành -> Express Session, Cookie HTTP-Only, CORS whitelist.

### 2. Linh
- **FR-CUS-01**: Đăng ký, xác thực, đăng nhập -> `/api/auth/register`, `/api/auth/login`, `/api/auth/google`, `/api/auth/profile`
- **FR-ADM-08**: Khuyến mãi & voucher -> `/api/vouchers`, `/api/vouchers/apply`
- **FR-CUS-04**: Xem chi tiết dịch vụ -> `/api/services/:id`, `/api/services`
- **FR-CUS-09**: Yêu thích & đánh giá -> `/api/auth/favorites`, `/api/reviews`
- **FR-CUS-10**: Cộng đồng chia sẻ hành trình -> `/api/community` (bài viết, thả tim, bình luận).

### 3. Phú
- **FR-PRO-01 / FR-ADM-03**: Quản lý dịch vụ & tour trọn gói -> `/api/services`, `/api/tours`
- **FR-PRO-03 / FR-ADM-04**: Quản lý đặt chỗ (Booking & Escrow) -> `/api/bookings`
- **FR-ADM-05**: Báo cáo & phân tích kinh doanh -> `/api/admin/dashboard`
- **FR-CUS-06**: Quản lý đơn đặt dịch vụ -> `/api/bookings/my-bookings`, `/api/bookings/lookup`
- **FR-CUS-08**: Hủy dịch vụ và yêu cầu thay đổi -> `/api/bookings/:id/change-request`.

### 4. Dương
- **FR-PRO-05 / FR-ADM-09**: Quản lý tài chính & Ví GreenSteps -> `/api/wallet`, `/api/wallet/deposit`, `/api/wallet/withdraw`
- **FR-PRO-07 / FR-ADM-10**: Quản lý đối tác du lịch (Provider) -> `/api/partners`, `/api/partners/dashboard`
- **FR-CUS-07**: Thanh toán trực tuyến (Ví Green, Thẻ, Escrow) -> `/api/bookings`, `/api/wallet/transactions`.

### 5. Thùy Anh
- **FR-CUS-02**: Quản lý hồ sơ cá nhân -> `/api/auth/profile`
- **FR-CUS-03**: Tìm kiếm và lọc dịch vụ sinh thái -> `/api/services?destination=&type=&eco=true`
- **FR-CUS-05**: Lập lịch trình cá nhân hóa (AI Travel Planner) -> `/api/ai/plan-trip`, `/api/ai/estimate-carbon`, `/api/itineraries`
- **FR-CUS-11**: Trợ lý ảo AI Chatbot -> `/api/support/chat`.

---

## 🗄️ Cấu Trúc Cơ Sở Dữ Liệu MongoDB (`GreenStepsData`)

Hệ thống bao gồm 15 Collections chính:
1. `users`: Thông tin tài khoản, hồ sơ cá nhân, phân quyền (traveler, provider, admin), số dư ví, điểm xanh.
2. `auth_sessions`: Quản lý phiên đăng nhập và Cookie/Token thiết bị.
3. `providers`: Thông tin doanh nghiệp đối tác, giấy phép kinh doanh, hợp đồng sinh thái, tài khoản ngân hàng.
4. `services`: Các dịch vụ sinh thái (lưu trú homestay, nhà hàng chay, xe ô tô điện, hoạt động nhặt rác chèo SUP).
5. `schedules`: Tour trọn gói của hệ thống (`is_sample: true`) và Lịch trình cá nhân tùy biến (`is_sample: false`).
6. `bookings`: Đơn đặt dịch vụ, mã E-Voucher, thông tin khách, cơ chế ký quỹ an toàn Escrow (`holding`, `released`).
7. `reviews`: Đánh giá 5 sao, hình ảnh thực tế, phản hồi chính thức từ Nhà cung cấp.
8. `community_posts`: Bài viết mạng xã hội GreenSteps, chia sẻ kinh nghiệm du lịch Net-Zero, bình luận.
9. `wallet_transactions`: Lịch sử giao dịch tiền vào/ra trên Ví GreenSteps.
10. `vouchers`: Mã giảm giá toàn sàn hoặc riêng cho từng đối tác.
11. `ad_campaigns`: Chiến dịch quảng cáo banner và hiển thị nổi bật.
12. `badges`: Hệ thống huy hiệu xanh vinh danh du khách (Tiên phong Net-Zero, Bảo vệ rừng, v.v.).
13. `notifications`: Thông báo tự động về biến động đơn đặt, số dư ví, sự kiện.
14. `support_tickets`: Hệ thống vé hỗ trợ khách hàng và lịch sử trao đổi.
15. `system_configs`: Cấu hình sàn (tỷ lệ hoa hồng, tỷ lệ quy đổi điểm xanh, thời hạn ký quỹ Escrow).

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Yêu cầu hệ thống
- **Node.js**: Phiên bản 18+ trở lên.
- **MongoDB**: Dịch vụ MongoDB cục bộ đang chạy tại `mongodb://127.0.0.1:27017`.

### 2. Cài đặt thư viện
```bash
cd greensteps/server_mongodb
npm install
```

### 3. Nạp dữ liệu mẫu ban đầu (Seed Data)
Lệnh này sẽ tự động khởi tạo dữ liệu chuẩn cho các tour Đà Lạt, Phú Yên, Hội An, người dùng mẫu, dịch vụ lưu trú và xe điện:
```bash
npm run seed
```

### 4. Khởi chạy máy chủ API
```bash
npm start
```
- Máy chủ sẽ chạy tại: **`http://localhost:5055`**
- URL API: **`http://localhost:5055/api`**
- Thư mục ảnh tĩnh: **`http://localhost:5055/images`**

---

## 🔑 Tài Khoản Thử Nghiệm Mẫu

Sau khi chạy lệnh `npm run seed`, hệ thống đã sẵn sàng 3 tài khoản mẫu:

| Loại tài khoản | Username | Email | Mật khẩu | Chức năng chính |
| :--- | :--- | :--- | :--- | :--- |
| **Quản trị viên** | `admin` | `admin@greensteps.vn` | `admin123` | Quản trị toàn sàn, duyệt đối tác, quản lý người dùng, xem thống kê doanh thu Escrow |
| **Đối tác (Provider)** | `partner_dalat` | `partner@dalateco.vn` | `partner123` | Quản lý dịch vụ homestay/xe điện, xem doanh thu, phản hồi đánh giá |
| **Khách du lịch** | `traveler01` | `traveler@gmail.com` | `traveler123` | Đặt tour sinh thái, tạo lịch trình AI, thanh toán Ví Green, đổi điểm xanh |
