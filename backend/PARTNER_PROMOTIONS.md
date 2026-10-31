# Quảng bá & Khuyến mãi

Trang Angular: `/partner-promotions`. API dùng Express và MongoDB hiện có,
cùng JWT/cookie đăng nhập. Khởi động lại API sau khi cập nhật mã nguồn:

```powershell
npm.cmd --prefix server_mongodb start
npm.cmd --prefix my-app start
```

## Dữ liệu và phân quyền

Model `PartnerCampaign` dùng collection theo prefix MongoDB hiện tại
(mặc định `app_partnercampaigns`). Không cần seed để sử dụng. Index mã duy nhất
và index truy vấn chủ sở hữu được tạo trước khi xử lý yêu cầu đầu tiên.

`user_id` luôn lấy từ phiên đăng nhập, không lấy từ body. `vender_id` tham chiếu
`Vender`, là hồ sơ nhà cung cấp gắn với tài khoản trong hệ thống dịch vụ hiện có;
`service_id` tham chiếu `GreenService`. `Provider` trong catalog tour hiện tại là
đơn vị cung ứng tour, không phải danh tính đăng nhập của đối tác, nên không dùng
nó để quyết định quyền sở hữu dịch vụ.

Tất cả API yêu cầu tài khoản có role `provider`, đã xác thực. Mỗi truy vấn đơn
đều kèm chủ sở hữu. Tài nguyên của tài khoản khác trả 404. API kiểm tra dịch vụ
đang hoạt động và thuộc `Vender` của tài khoản. Voucher có thể áp dụng toàn bộ
dịch vụ của chính nhà cung cấp nếu không chọn dịch vụ cụ thể.

## REST API

Prefix: `/api/partner/promotions` (cũng có `/api/v1/partner/promotions`).

| Method | Đường dẫn | Chức năng |
| --- | --- | --- |
| GET | `/` | Danh sách với `q`, `type`, `status`, `from`, `to`, `page`, `limit` |
| GET | `/options` | Dịch vụ đủ điều kiện của tài khoản và bảng giá gói |
| POST | `/` | Tạo chiến dịch |
| GET | `/:id` | Chi tiết và phiên bản hiện tại |
| PUT | `/:id` | Cập nhật thông tin, kèm `version` |
| PATCH | `/:id/status` | `active`, `paused`, `cancelled`, kèm `version` |
| GET | `/:id/report` | Các chỉ số đã lưu của chiến dịch |
| DELETE | `/:id` | Hủy và lưu trữ mềm, body `{ "version": 0 }` |

`type`: `promotion`, `flash_sale`, `voucher`. Các trường dùng chung: `name`,
`service_id`, `start_at`, `end_at` (ISO 8601 có múi giờ). Quảng bá thêm `package`
và `budget`. Flash Sale/voucher thêm `discount_type` (`percent`/`fixed`),
`discount_value`, `min_order`, `usage_limit`; voucher thêm `code`.

Ngân sách tối thiểu bằng đơn giá gói nhân số ngày làm tròn lên. Gói `discovery`,
`featured`, `premium` lần lượt 50.000, 150.000, 300.000 đ/ngày, được định nghĩa
tập trung tại controller. Tạo chiến dịch không tự động thu tiền.

Mã được chuẩn hóa viết hoa, duy nhất toàn collection, kể cả mã đã lưu trữ.
`version` kết hợp `_rev` bảo vệ cập nhật đồng thời; phiên bản cũ trả 409.
Không cho sửa loại chiến dịch; không sửa hoặc tiếp tục chiến dịch đã kết thúc,
hết lượt hoặc đã hủy. Giới hạn lượt không thấp hơn số lượt đã sử dụng.
Chiến dịch có lượt dùng, booking hoặc chi phí không được thay đổi điều kiện ưu
đãi, dịch vụ hoặc mã. API không chấp nhận bộ đếm do client gửi lên.

Trạng thái hiển thị được tính từ thời hạn và số lượt dùng trên mỗi lần đọc.
Xóa luôn lưu trữ mềm để bảo toàn lịch sử, kể cả khi chưa phát sinh giao dịch.
Chiến dịch đã lưu trữ không xuất hiện trong danh sách quản lý hiện hành.

## Phạm vi báo cáo

Module này quản lý và lưu cấu hình chiến dịch; không thay đổi checkout, voucher
đổi điểm hay hệ thống quảng cáo cũ. Báo cáo đọc bộ đếm thật đã lưu; mặc định
bằng 0, không suy diễn lượt xem hoặc booking từ tổng số của dịch vụ. Việc phát
quảng cáo, thu phí và áp dụng ưu đãi mới tại checkout cần nối các sự kiện tương
ứng vào chiến dịch trong một phạm vi triển khai riêng. Hiện không có API công
khai cho client tự tăng lượt sử dụng hoặc tự ghi nhận doanh thu.

## Kiểm tra

```powershell
npm.cmd --prefix backend test
cd my-app
node node_modules/vitest/vitest.mjs run src/app/pages/partner/partner-promotions/partner-promotions.spec.ts
npm.cmd run build
node e2e/promotions.e2e.cjs
```

Integration và browser test dùng MongoDB thật theo cấu hình hiện tại, tự tạo
fixture với ID ngẫu nhiên và chỉ dọn các bản ghi thuộc fixture đó. Browser test
dùng Chrome đã cài, API chạy trên cổng tạm và kiểm tra tạo/sửa/trạng thái/báo
cáo/lưu trữ, tải lại và bố cục mobile. Ảnh kiểm tra ở `tmp/promotions-artifacts`.
Không giữ dữ liệu thử trong tài khoản `Duong`.

Tailwind 3.4.17 và Bootstrap Icons 1.11.3 được phục vụ từ `public/vendor` để giữ
giao diện hiện tại khi CDN bị chặn. Có kèm giấy phép MIT; không đổi markup của
Header, Sidebar hoặc logo.
