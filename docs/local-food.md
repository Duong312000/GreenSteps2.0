# Ẩm thực địa phương

- Trang khách: `/services?type=food` hoặc `/local-food`.
- Quản trị: `/admin/food` (đăng nhập tài khoản có vai trò `admin`), có liên kết trong sidebar quản trị.
- API: `/api/food` (cũng hỗ trợ `/api/v1/food`). Dùng cấu hình MongoDB và xác thực hiện có.

## Dữ liệu

Chạy `node scripts/seed-food.js` trong `backend`. Script thêm đúng 6 địa điểm demo bằng ID cố định, chạy lại không tạo bản trùng và không ghi đè nội dung admin đã sửa. Dữ liệu nằm trong `local_food_places`; yêu cầu đặt bàn nằm trong `local_food_reservations`. Xóa địa điểm là xóa mềm, giữ lịch sử yêu cầu và không làm seed tự khôi phục địa điểm đã xóa.

Các địa điểm, địa chỉ, giá, đánh giá và thực đơn ban đầu là minh họa. Ảnh được phục vụ từ `my-app/public/image/food`; một số ảnh tái sử dụng tài nguyên trong dự án. Ảnh Unsplash: `photo-1546069901-ba9599a7e63c`, `photo-1512621776951-a57141f2eefd`, `photo-1544787219-7f47ccb76574`.

## API

| Method | Path sau `/api/food` | Quyền |
|---|---|---|
| GET | `/places` | Công khai, chỉ địa điểm đang hiển thị |
| GET / POST | `/admin/places` | Admin |
| PUT / DELETE | `/admin/places/:id` | Admin, yêu cầu `version` hiện tại |
| POST | `/places/:id/reservations` | Đăng nhập |
| GET | `/admin/reservations` | Admin, tối đa 200 yêu cầu gần nhất |
| PATCH | `/admin/reservations/:id` | Admin, `pending` → `confirmed` hoặc `cancelled` |

Trang khách lấy dữ liệu mới khi mở, khi quay lại cửa sổ và mỗi 30 giây khi tab đang hiển thị. API trả `Cache-Control: no-store`. Admin và khách dùng cùng collection; không có danh sách demo dự phòng ở frontend.

Giá lọc theo giá khởi điểm. Ngày/giờ đến được chuyển vào form đặt bàn; danh sách không khẳng định tình trạng chỗ trống. Yêu cầu đặt bàn được lưu ở trạng thái chờ xác nhận, chưa thu tiền hoặc giữ chỗ tự động. Ngày/giờ được diễn giải theo Việt Nam (UTC+7).

Nút trái tim lưu trên thiết bị hiện tại và ghi rõ phạm vi này trong thông báo. Thêm vào lịch trình chuyển ID quán qua sessionStorage, tra lại bản đang hiển thị từ API rồi cho người dùng chọn lịch trình/ngày trong editor hiện có. Chỉ banner chuyển quán được thêm vào editor; không đổi giao diện khi không có quán đang chờ.

## Kiểm tra

Trong `backend`: `node --test test/food.test.js`. Để kiểm tra với MongoDB đã cấu hình, đặt biến môi trường `FOOD_INTEGRATION=1` rồi chạy lại. Kiểm thử tích hợp tạo tài khoản/địa điểm/yêu cầu riêng và dọn các bản ghi do nó tạo.

Trong `my-app`: `npm run build`. Nạp lại tiến trình API sau khi cập nhật mã nguồn để đăng ký route mới.

Chạy `npm run test:food:e2e` trong `my-app` sau khi build và khởi động API trên cổng 5055. Script dùng Chromium headless, dữ liệu MongoDB riêng, kiểm tra luồng khách/admin và lưu ảnh tại `tmp/food-artifacts`. Có thể đặt `FOOD_UI_ORIGIN` để kiểm tra một frontend đang chạy thay cho server tĩnh từ bản build.
