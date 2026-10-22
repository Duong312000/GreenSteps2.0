# Đăng ký và đăng nhập bằng Google

1. Trong Google Cloud Console, cấu hình Google Auth Platform (Branding, Audience và Data Access: openid, email, profile).
2. Tạo OAuth Client ID loại **Web application**. Thêm Authorized JavaScript origins:
   - `http://localhost:4200`
   - `http://127.0.0.1:4200` nếu dùng địa chỉ này
   - Origin HTTPS thực tế của frontend khi triển khai (không có đường dẫn).
3. Nếu ứng dụng ở chế độ Testing, thêm email thử nghiệm vào Test users.
4. Trong `.env` của backend đang chạy (`server_mongodb` hoặc `backend`), thêm:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```
   Không cần Client Secret. Không đặt secret trong frontend.
5. Khởi động lại backend và frontend. Bấm Google ở trang đăng ký hoặc đăng nhập, chọn tài khoản và cấp quyền.

Frontend lấy Client ID công khai từ `GET /api/auth/google/config`. Sau khi người dùng chọn tài khoản, frontend gửi access token tới `POST /api/auth/google-login`. Server kiểm tra token với Google (audience, hạn sử dụng, subject và email đã xác minh), rồi tạo tài khoản traveler mới hoặc đăng nhập tài khoản cùng email. Mật khẩu nội bộ của tài khoản mới là ngẫu nhiên, không thể đoán từ username.

Chỉ tự động khớp email khi Google là nguồn xác thực email (Gmail hoặc Workspace). Các địa chỉ bên thứ ba dùng luồng email/mật khẩu. Tài khoản MongoDB bị khóa không được đăng nhập Google. Hai backend dùng cùng một quy trình xác minh; chỉ cần chạy một backend.

## Kiểm tra

- Client ID trống: hiển thị lỗi cấu hình, không tạo tài khoản.
- Hủy/chặn popup: hiện thông báo và cho thử lại.
- Token giả, hết hạn, sai Client ID hoặc email chưa xác minh: API từ chối.
- Gmail mới: tạo một traveler, có tên và ảnh Google; lần tiếp theo dùng lại tài khoản.
- Tài khoản cũ cùng email: đăng nhập, giữ nguyên quyền và hồ sơ.
- Kiểm thử token: `node --test tests/google-auth.test.cjs`.

Chưa thể kiểm thử tương tác Google thật khi chưa có Client ID hợp lệ.
