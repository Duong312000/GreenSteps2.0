# Admin Danh mục và Cấu hình đặt chỗ

## Intent

Hoàn thiện mục **Admin → Danh mục & Cấu hình** để quản trị viên có thể quản lý danh mục dịch vụ và các thiết lập ảnh hưởng đến báo giá/booking mà không cần sửa mã nguồn. Các thiết lập phải được lưu bền vững trong MongoDB và chỉ áp dụng cho báo giá, booking mới; dữ liệu giá đã chụp trong booking cũ được giữ nguyên.

## Current state

- Menu `settings` đã có trong `AdminComponent`, nhưng chưa được ánh xạ tới module quản lý và hiện hiển thị placeholder “đang phát triển”.
- Danh mục dịch vụ hiện là text tự do trong `current_data.category`; backend có giá trị mặc định Ăn uống, Lưu trú, Khám phá, chưa có danh mục tập trung.
- Phần trăm giảm giá, phí dịch vụ, tỷ lệ đặt cọc và các phương thức áp dụng đặt cọc đang nằm trong `booking-pricing.config.js`.
- `BookingAddon` có model và danh sách seed, nhưng Admin chưa có API hoặc giao diện quản lý.
- Booking pricing cần đọc cấu hình lưu trong DB ở runtime; không phụ thuộc vào giá trị mặc định biên dịch vào ứng dụng sau khi cấu hình đã được lưu.
- Formula audit: `createBooking` currently charges the service/tour price (including per-guest and shared itinerary activity costs) and applies voucher discount. `SERVICE_FEE_VND = 120_000` exists in config but is not used by the real create-booking path. The 10% calculation in settlement is provider commission, not a customer service fee.
- The global 8% discount and 30% deposit in the same config are also not applied in the live create-booking path. Existing voucher discounts are applied per voucher. To avoid changing live prices at rollout, persisted global discount, customer service fee, and deposit defaults are all 0; Admin can explicitly configure them later. Keep provider commission unchanged.

## Goals

- Thay placeholder của mục settings bằng một trang dùng chung vỏ Admin hiện tại, không sửa sidebar/header hoặc các module khác.
- Có hai tab: **Danh mục dịch vụ** và **Cấu hình đặt chỗ**.
- Tạo/sửa/ẩn (lưu trữ) danh mục, hiển thị số dịch vụ đang dùng danh mục; danh mục được dùng trong dịch vụ/booking không bị xóa cứng.
- Danh mục đang hoạt động được dùng chung trong Admin, trang khách và trang nhà cung cấp; danh mục lưu trữ không xuất hiện trong lựa chọn mới nhưng vẫn hiển thị trên dữ liệu lịch sử.
- Chỉnh sửa cấu hình giảm giá, phí dịch vụ, đặt cọc, phương thức thanh toán và các dịch vụ thêm booking.
- Bảo vệ API bằng middleware và role `admin`; xác thực dữ liệu ở server.
- Hiển thị loading, empty, error, lưu thành công/thất bại; giao diện responsive theo style Admin.
- Ghi audit log cho các thay đổi cấu hình, gồm actor, loại thay đổi, thời gian và trạng thái trước/sau.
- Booking cũ giữ nguyên `pricing_snapshot`; cấu hình mới chỉ ảnh hưởng báo giá và booking mới.
- Báo giá/create booking dùng chung một pricing service server-side, kiểm tra phiên bản cấu hình và bắt khách xác nhận lại khi giá đã đổi.
- Pricing config dùng optimistic version để từ chối ghi đè khi Admin đang sửa phiên bản cũ.
- Có tab con hoặc panel **Lịch sử thay đổi** trong tab Cấu hình đặt chỗ.
- Dùng chung `AccountDetailModalComponent` của Admin cho form thêm/sửa danh mục và add-on.
- Viết test cho pricing, quyền truy cập, lưu cấu hình/version conflict, migration danh mục, audit và tính bất biến của snapshot.

## Non-goals

- Không quản lý biến môi trường, khóa API, thông tin SMTP, OAuth secret hoặc cấu hình triển khai hosting trong UI.
- Không thay đổi luồng duyệt dịch vụ/nhà cung cấp, sidebar, dashboard, hay các trang Admin khác.
- Không thay đổi chính sách hoàn tiền, thuế, hoa hồng đối tác hoặc các cấu hình chưa có trong mô hình booking hiện tại.
- Không xóa cứng danh mục đã từng được dùng; dùng trạng thái lưu trữ để bảo toàn dữ liệu dịch vụ và booking lịch sử.

## Approaches

1. **Lưu cấu hình tập trung trong MongoDB (chọn)**: thêm catalog danh mục và document cấu hình booking, tái sử dụng model `BookingAddon`, nạp giá trị mặc định một lần nếu chưa có dữ liệu. API booking đọc cấu hình runtime. Đây là lựa chọn được đề xuất vì Admin có thể thay đổi cấu hình thật, tồn tại qua lần deploy và không cần build lại frontend/backend.
2. **Chỉ sửa các hằng số trong file cấu hình**: triển khai nhanh nhưng Admin không thể tự lưu thay đổi; mọi lần sửa đều cần deploy. Không đáp ứng mục tiêu quản trị từ màn hình.
3. **Làm bảng điều khiển toàn bộ cấu hình hệ thống**: bao gồm email, OAuth, bảo mật và vận hành. Phạm vi lớn, có rủi ro lộ secret và chưa có API quản lý tương ứng; không chọn.

## Selected design

### Admin UI

- `AdminComponent` nhận diện `settings` như một module được hỗ trợ và render component quản lý cấu hình thay cho placeholder.
- Trang có tiêu đề, mô tả ngắn, hai tab và trạng thái tải/lỗi rỗng.
- Tab **Danh mục dịch vụ** hiển thị bảng: tên, mã, trạng thái, số dịch vụ sử dụng, thứ tự; hành động thêm/sửa/lưu trữ. Form tạo/sửa dùng dialog/modal nhỏ theo component style hiện có.
- Tab **Cấu hình đặt chỗ** có các nhóm trường: giảm giá (%), phí dịch vụ (VND, toàn đơn hay mỗi khách), đặt cọc (%), phương thức thanh toán áp dụng đặt cọc; bảng add-on gồm tên, giá VND, trạng thái, thêm/sửa/ẩn.
- Có nút lưu rõ ràng, hiển thị lỗi validation cạnh trường và thông báo kết quả; thao tác thay đổi add-on hoặc giá phải yêu cầu xác nhận khi cần.
- Trên màn hình hẹp, grid chuyển thành một cột; bảng có vùng cuộn ngang riêng.

### Data and backward compatibility

- Tạo collection/model `ServiceCategory` với `id` ổn định, `name`, `active`, `sort_order`, `icon` tùy chọn và timestamps.
- Dùng `category_id` làm liên kết chuẩn mới trên dữ liệu dịch vụ. API đọc vẫn hỗ trợ dịch vụ legacy chỉ có `current_data.category`; migration/bootstrap ánh xạ các tên danh mục hiện có sang category ID ổn định, không làm mất tên hiển thị.
- Registry controls the secondary service category stored in `current_data.category`; route-level service types (`stay`, `food`, `transport`, `attraction`, `tours`) remain separate and are not renamed or dynamically created by this module.
- API danh mục dùng chung: public/provider-facing API chỉ cung cấp danh mục `active=true` cho các bộ lọc/chọn mới; Admin API trả cả active lẫn archived. Dịch vụ và booking cũ vẫn phân giải được tên đã lưu.
- Lưu một cấu hình `booking_pricing` trong MongoDB: `discount_percent`, `service_fee_vnd`, `service_fee_per_guest`, `deposit_percent`, `collect_deposit_for`, `version`, `updated_at`, `updated_by`.
- Tiếp tục dùng `BookingAddon`; seed hiện có chỉ tạo default khi collection chưa có record tương ứng, không ghi đè giá trị Admin đã chỉnh.
- Giá trị trong `booking-pricing.config.js` chỉ là default/bootstrap fallback. Khi cấu hình DB tồn tại, backend phải dùng giá trị DB cho `/bookings/quote` và lúc tạo booking; server không tin tổng tiền do client gửi.
- Mỗi booking mới lưu snapshot đầy đủ gồm cấu hình áp dụng, add-on, subtotal, discount, fee, total, deposit, remaining và amount due. Booking cũ không được tính lại.
- Legacy booking thiếu `pricing_snapshot` tiếp tục hiển thị đúng các giá trị đã lưu trên booking; không chạy migration tính lại giá bằng config hiện hành.
- Quote response chứa `configVersion` và fingerprint/token do server tạo. `createBooking` tính lại từ dữ liệu nguồn ở server và chỉ chấp nhận nếu quote vẫn khớp; khi giá/config đã đổi, trả `409 PRICING_CHANGED` cùng quote mới để UI yêu cầu khách xác nhận trước lần gửi tiếp theo.
- Pricing settings update nhận `expectedVersion`; cập nhật nguyên tử theo version hiện tại, tăng version khi thành công và trả `409 CONFIG_VERSION_CONFLICT` kèm bản mới nhất nếu Admin khác đã lưu trước.
- Công thức giữ thứ tự rõ ràng: tính giá dịch vụ/tour và itinerary trước; áp dụng global discount lên base subtotal; sau đó voucher hợp lệ tính trên phần base còn lại; cộng add-on và service fee (hai khoản này không được giảm); tính tiền cọc trên total. Các khoản global discount/voucher dùng phép làm tròn xuống VND nguyên.
- Ghi audit vào model riêng `AdminConfigAuditLog` để không làm sai nghĩa `AdminAuditLog` hiện tại (đang bắt buộc `target_user_id`).
- Lưu thay đổi config và audit trong cùng MongoDB transaction; audit chỉ ghi success sau khi cả hai ghi thành công, gồm `actor_id`, timestamp server, target, before/after và version.
- Bootstrap category migration tạo ID ổn định theo tên chuẩn hóa, bảo toàn chuỗi tên legacy, gán `category_id` khi match được và chạy idempotent. Đếm dịch vụ bằng tập ID dịch vụ duy nhất, không cộng cả category ID mới lẫn fallback text trên cùng một bản ghi.
- Không cập nhật hoặc tính lại bất kỳ booking nào trong migration; cả legacy booking thiếu snapshot vẫn giữ nguyên field tiền gốc.

### API

- `GET /api/admin/settings/categories`: danh sách danh mục kèm số lượng dịch vụ tham chiếu.
- `POST /api/admin/settings/categories`: tạo danh mục.
- `PATCH /api/admin/settings/categories/:id`: sửa tên/thứ tự/icon/trạng thái.
- `POST /api/admin/settings/categories/:id/archive`: đặt `active=false`; không xóa cứng category records. Từ chối lưu trữ nếu còn dịch vụ active đang dùng cho tới khi Admin chuyển các dịch vụ đó sang danh mục khác hoặc ngừng dịch vụ.
- `GET /api/services/categories`: danh sách danh mục active dùng chung cho lọc/chọn ở giao diện khách và nhà cung cấp.
- `GET /api/admin/settings/booking`: đọc pricing config và add-ons.
- `PATCH /api/admin/settings/booking/pricing`: cập nhật pricing config sau validation.
- `POST /api/admin/settings/booking/addons`, `PATCH /api/admin/settings/booking/addons/:id`: thêm/sửa add-on; ngừng cung cấp bằng `active=false`.
- `GET /api/admin/settings/audit`: lịch sử thay đổi có phân trang.
- `GET /api/services/categories`: danh sách danh mục active dùng chung cho lọc/chọn ở giao diện khách và nhà cung cấp.
- Mọi endpoint quản trị dùng `authMiddleware` + `checkRole(['admin'])`; public/service API chỉ nhận trường danh mục hợp lệ và không cho provider sửa config toàn hệ thống.

## Constraints and implementation calls

- Dùng Angular standalone conventions/components hiện có trong app module; không thêm dependency mới.
- Giữ API response conventions hiện có (`success`, `data`/`settings`, `message`).
- Giá VND phải là số nguyên không âm; phần trăm nằm trong khoảng 0–100; danh sách phương thức thanh toán chỉ nhận các giá trị enum server hỗ trợ. Customer service fee mặc định 0 VND do công thức thực đang chạy chưa thu khoản này; 10% provider commission giữ nguyên và ở bước settlement.
- Chỉ lưu trữ danh mục, không xóa cứng; danh mục đang được dịch vụ active sử dụng phải được gỡ khỏi các dịch vụ đó trước khi lưu trữ. Dịch vụ/booking lịch sử giữ được tên danh mục.
- Danh mục legacy chưa khớp được giữ nguyên dưới dạng danh mục được migration tạo ra; không tự ý gộp các tên gần giống nhau.
- Người triển khai cần kiểm tra hiện trạng `createBooking`/quote ở nhánh trước khi nối runtime config, vì `booking-pricing.service` và route quote trong commit gần nhất có dấu hiệu chưa được nối hoàn chỉnh.
- Migration phải unique theo service ID để không đếm trùng; legacy bookings, đặc biệt booking thiếu `pricing_snapshot`, không được tính lại.

## Acceptance criteria

- Nhấn menu **Danh mục & Cấu hình** không còn thấy placeholder.
- Admin có thể tạo/sửa/lưu trữ danh mục; danh mục active xuất hiện đồng bộ ở Admin, trang khách và trang nhà cung cấp; số lượng dịch vụ dùng danh mục hiển thị chính xác; danh mục lưu trữ không còn được chọn cho dữ liệu mới.
- Admin có thể tải và cập nhật pricing/add-on config; sau refresh trang, dữ liệu vẫn giữ nguyên từ MongoDB.
- API từ non-admin trả 401/403 và không thay đổi dữ liệu.
- Báo giá và booking mới lấy cấu hình server, từ chối giá do client tự gửi; booking lưu snapshot để lịch sử không đổi sau cập nhật config.
- Lỗi API, trạng thái không có dữ liệu và đang lưu đều có phản hồi rõ ràng; layout dùng được trên mobile.
- Thay đổi cấu hình được ghi audit với actor và before/after.
- Các module/sidebar/header Admin khác không bị thay đổi.
