# Đăng ký / đăng nhập Facebook

## Cấu hình Meta

1. Vào https://developers.facebook.com/apps/ và tạo app có Facebook Login cho website.
2. Trong cấu hình Facebook Login, bật JavaScript SDK login và khai báo domain/origin frontend được phép. Khai báo Site URL tương ứng; dùng HTTPS cho website triển khai.
3. Lấy App ID, App Secret và phiên bản Graph API được hỗ trợ từ dashboard của app.
4. Trong `.env` của backend đang chạy, điền:

```env
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_GRAPH_VERSION=vXX.0
```

Thay vXX.0 bằng phiên bản thực tế trong Meta dashboard. Không đưa App Secret vào frontend hoặc gửi trong chat. API cấu hình chỉ công khai App ID, phiên bản và trạng thái bật/tắt.

5. Khởi động lại backend MongoDB. Index định danh Facebook được tạo tự động; có thể chạy `node scripts/migrate-facebook.js` trong `backend` để tạo index trước. Script này không sửa PostgreSQL hoặc xóa dữ liệu. Xem thêm `backend/README.md`.
6. Tải lại frontend. Bấm Facebook ở đăng ký hoặc đăng nhập, chọn tài khoản và cấp quyền email.
7. Khi app ở chế độ phát triển, dùng tài khoản có vai trò tester/developer được thêm trong Meta app. Để mở cho người dùng thực tế, hoàn thành các yêu cầu hiển thị trong Meta dashboard, gồm chính sách quyền riêng tư và xóa dữ liệu.

## Hành vi

Server kiểm tra token bằng debug_token, so khớp App ID, loại token, thời hạn, user ID và profile /me. Token chỉ dùng để xác minh, không lưu vào database. Sau đó cấp JWT của GreenSteps và cookie HttpOnly.

Tài khoản mới được tạo là traveler với mật khẩu ngẫu nhiên và định danh Facebook riêng. Lần sau tìm theo Facebook ID. Nếu chưa tìm thấy Facebook ID, hệ thống dùng email lấy trực tiếp từ Meta để tìm tài khoản hiện có và liên kết Facebook vào tài khoản đó; giữ nguyên mật khẩu, hồ sơ và quyền. Không ghi đè liên kết Facebook khác. Thiếu quyền/email thì báo lỗi và cho thử lại. MongoDB chặn tài khoản không active.

## Kiểm tra

`node --test tests/facebook-auth.test.cjs tests/google-auth.test.cjs`

Cần App ID, App Secret và cấu hình website thực tế để kiểm thử popup, email permission và tài khoản Facebook thật. Mã đã tích hợp nhưng không tự tạo Meta app hoặc thay đổi thiết lập tài khoản Meta.
