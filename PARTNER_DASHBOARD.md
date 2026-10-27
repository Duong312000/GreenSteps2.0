# GreenSteps Partner Dashboard

## Phạm vi và cấu trúc

Frontend hiện tại: Angular 21, NgModule + standalone components, Angular Router,
AuthService dùng BehaviorSubject, HttpClient và ApiService. Các trang cũ dùng
Tailwind CDN, Bootstrap Icons và stylesheet chung; biểu đồ dashboard là SVG tự
vẽ, không có thư viện chart riêng. Đợt này không thêm dependency, không sửa API,
backend, schema MongoDB, roleGuard hoặc các thao tác booking/thanh toán.

```text
App shell
├── HeaderComponent (navbar cũ, một instance)
├── Router outlet
│   └── PartnerLayoutComponent (chỉ 5 route quản lý)
│       ├── Sidebar dùng chung / drawer mobile
│       └── Router outlet
│           ├── /partner-dashboard  → Dashboard thiết kế lại
│           ├── /partner-services   → Trang dịch vụ hiện có
│           ├── /partner-bookings   → Trang booking hiện có
│           ├── /partner-ads        → Trang tiếp thị hiện có
│           └── /partner-promotions → Trang quảng bá hiện có
├── FooterComponent hiện có
└── GreenSteps chat (giữ cơ chế ẩn trên trang đối tác)
```

URL giữ nguyên; mỗi child route tiếp tục dùng roleGuard cũ, chỉ chấp nhận provider.
Navbar “Đối tác” là link SPA trực tiếp tới dashboard, không có dropdown; active
trên các route partner. Đăng ký đối tác ở /partner-register giữ layout riêng cũ.
Sidebar hiển thị tên doanh nghiệp/tài khoản và avatar thực từ AuthService; không
gán tên homestay hoặc huy hiệu đã duyệt theo ảnh. Tên dài có ellipsis và title.

Desktop sidebar rộng 254px, tablet 216px; mobile dưới 768px dùng drawer có overlay,
Escape, trả focus về nút menu, giữ Tab trong menu đang mở. Chọn một route đóng
drawer. Icon là một component SVG nhỏ dùng lại cho sidebar và dashboard. Ảnh
thiên nhiên lấy từ asset có sẵn greensteps_wallet_mountain_bg.png.

## Dashboard và nguồn số liệu

Giữ hai API đang dùng: getBookings(providerId), getMyServices(providerId).
Không có dữ liệu demo trong component chạy thật.

- KPI 4 thẻ: số booking, tổng doanh thu theo quy tắc cũ, dịch vụ active/pending,
  trung bình điểm của những dịch vụ có rating hợp lệ.
- Bộ lọc thời gian dùng các tháng có ngày booking hợp lệ trong dữ liệu đã trả về,
  lọc tại frontend; mặc định tất cả thời gian để giữ phạm vi thống kê ban đầu.
  Không thêm endpoint/query backend. Chỉ booking được lọc theo tháng; danh mục
  và điểm dịch vụ vẫn là dữ liệu hiện tại.
- Tổng doanh thu KPI giữ cách cộng booking trạng thái pending/deposit/completed.
  Đây là định nghĩa hiện có, không phải doanh thu đã quyết toán. Caption nêu rõ
  nhóm trạng thái được cộng.
- Biểu đồ doanh thu giữ phép cộng giá trị tất cả booking theo nhóm lưu trú và
  các sản phẩm còn lại của dashboard cũ. Vì vậy tổng biểu đồ có thể khác KPI.
  Nhóm sản phẩm vẫn được suy ra từ tên theo quy tắc cũ vì Booking không có type.
- Biểu đồ Lượt xem & Đặt chỗ giữ khu vực báo cáo nhưng chỉ vẽ chuỗi booking thật
  theo tháng. Tổng views có trên Service, chưa có lịch sử views/inquiries theo
  tháng nên không vẽ đường giả. SVG responsive, màu xanh, legend và title tooltip.
- Booking gần đây lấy tối đa 5 bản ghi, sắp ngày giảm dần; giữ trường thiếu là
  “Chưa có thông tin”, nhãn trạng thái theo enum thật. Xem tất cả dẫn về trang cũ.
- Công việc cần xử lý lấy pending booking và pending services; badge đếm nhóm
  công việc, không gán số khuyến mãi. Link đi đúng trang xử lý hiện có.
- Truy cập nhanh “Thêm dịch vụ mới” tới /partner-services?action=add, sử dụng
  openAddModal() hiện có. Không tạo wizard mới. Các nút còn lại tới route cũ.
- Giữ báo cáo bổ sung về cấu trúc booking, khách hàng/xu hướng, dịch vụ được đặt
  nhiều và tác động xanh/tiếp thị phía dưới; không loại bỏ khu vực báo cáo chỉ vì
  không có trong ảnh mẫu.
- Nút CSV xuất những booking đang hiển thị theo bộ lọc; escape dấu nháy và chống
  công thức CSV ở trường văn bản. Không gọi API ghi dữ liệu.

## Dữ liệu thiếu và giới hạn

Dashboard cũ có Math.random() cho lượt xem/tư vấn, tăng trưởng cố định +12/+8.5,
rating fallback 4.8/5, khuếch đại conversion ×120, carbon giả định 5.5kg/khách,
chiến dịch và nhân khẩu học mẫu. Các phần đó không còn được hiển thị như dữ liệu
thật trong dashboard mới. Rating thiếu hiện “Chưa có đánh giá”; views thiếu,
carbon giảm thiểu, hiệu suất marketing và nhân khẩu học hiện thiếu dữ liệu.
Conversion chỉ là booking/views từ trường đã có, không khuếch đại.

Không thêm API để bù dữ liệu: chưa có tăng trưởng đáng tin, views/inquiries lịch
sử, baseline carbon, attribution marketing, khuyến mãi sắp hết hạn. Các trang
quảng bá/tiếp thị cũ giữ nguyên nghiệp vụ và dữ liệu sẵn có; đợt này không xây
backend cho những dữ liệu demo đã tồn tại ở các trang đó.

ApiService hiện bắt lỗi getBookings/getMyServices rồi trả []; dashboard không
thể phân biệt response rỗng thật với lỗi đã bị service nuốt. Giữ hành vi service
cũ, dùng thông báo trống trung tính; không khẳng định một lần fetch lỗi là dữ liệu
không tồn tại. Nhánh loadError xử lý được lỗi ném ra nhưng không khắc phục giới
hạn này. Phạm vi dữ liệu và phân quyền thực tế phụ thuộc API đang có.
Endpoint /services/provider/:id hiện chưa trả trường rating. Nếu không có điểm
trong response, KPI đánh giá hiển thị “Chưa có đánh giá”; không lấy rating mẫu
hoặc tự thêm endpoint để lấp số liệu.

## File thay đổi

| File | Vai trò |
| --- | --- |
| my-app/src/app/components/partner-layout/partner-layout.ts | Shell dùng chung, state drawer, auth state |
| my-app/src/app/components/partner-layout/partner-layout.html | Sidebar, danh tính, outlet |
| my-app/src/app/components/partner-layout/partner-layout.css | Responsive và khoảng cách scoped cho trang cũ |
| my-app/src/app/components/partner-layout/partner-icon.ts | Icon SVG tái sử dụng |
| my-app/src/app/pages/partner/partner-dashboard/partner-dashboard.ts | View state, lọc, gọi API cũ, CSV; giữ action booking |
| my-app/src/app/pages/partner/partner-dashboard/partner-dashboard.html | Bố cục KPI/chart/bảng/tác vụ/báo cáo |
| my-app/src/app/pages/partner/partner-dashboard/partner-dashboard.css | Design system và responsive cục bộ |
| my-app/src/app/pages/partner/partner-dashboard/partner-dashboard.analytics.ts | View aggregation từ trường API hiện có |
| my-app/src/app/pages/partner/partner-dashboard/partner-dashboard.analytics.spec.ts | Kiểm tra ngày, giá trị, missing data và tính ổn định |
| my-app/src/app/pages/partner/partner-services/partner-services.ts | Mở wizard cũ theo action=add |
| my-app/src/app/components/header/header.html | Active Đối tác theo nhóm route |
| my-app/src/app/components/header/header.css | Mint pill cho Đối tác active và tương phản navbar trong dark mode của khu vực đối tác |
| my-app/src/app/app-routing-module.ts | Bọc 5 route bằng layout, giữ guard/URL |
| my-app/src/app/app-module.ts | Import icon standalone để dùng ở trang cũ |
| my-app/e2e/partner-dashboard.e2e.cjs | Kiểm thử giao diện/routing/role/responsive bằng fixture riêng |
| my-app/e2e/greensteps-chat.e2e.cjs | Chờ DOM sẵn sàng thay vì chờ toàn bộ ảnh/CDN khi kiểm tra hồi quy |
| my-app/package.json | Lệnh kiểm thử partner |
| PARTNER_DASHBOARD.md | Báo cáo triển khai |

Các thay đổi chatbot/n8n/backend có từ công việc trước không thuộc đợt redesign
dashboard này. Không sửa hoặc đưa vào commit những file người dùng thêm riêng.

## Kiểm tra

Chạy local bằng hai terminal, đăng nhập tài khoản có role provider rồi chọn
“Đối tác” hoặc mở http://localhost:4200/partner-dashboard:

```powershell
# Terminal backend
cd D:\Web2\backend
npm.cmd run db:local
npm.cmd start

# Terminal frontend
cd D:\Web2\my-app
npm.cmd start
```

Các lệnh kiểm thử:

```powershell
cd D:\Web2\my-app
npm.cmd run build
npm.cmd run test:partner:unit
npm.cmd run test:partner:e2e
npm.cmd run test:chat:e2e
```

Unit tests kiểm tra 5 nhóm trường hợp: ngày DD/MM và ISO, quy tắc trạng thái doanh
thu/biểu đồ riêng biệt, không bịa rating/traffic/conversion, allocation/pending/
khách hàng, sắp thứ tự qua năm và không mutate input.

E2E dùng Chrome cài sẵn hoặc PLAYWRIGHT_CHROMIUM_EXECUTABLE. Dữ liệu kiểm thử và
session giả chỉ tồn tại trong browser context riêng; mọi /api request được
intercept. Request ghi ngoài kịch bản làm test thất bại và bị chặn. Riêng POST
/api/ai/chat do trang chủ cũ tự gọi sau khi guard chuyển hướng được trả 503
trong test để không gọi AI thật. Không ghi DB hay bypass auth của backend thật.
Kiểm tra cả 5 route, một navbar/sidebar, active state, không reload trang, lọc
tháng/KPI/CSV, mở wizard hiện có, empty state, guard traveler/admin, ba viewport
1536/1024/390, drawer/Escape, light/dark mode và không tràn ngang. Ảnh preview trong
tmp/partner-dashboard-artifacts dùng tài khoản ghi rõ “kiểm thử giao diện”, không
là bằng chứng số liệu kinh doanh thật. Dashboard runtime vẫn gọi API thật.

Dự án chưa có script lint; production build kiểm tra TypeScript/template.
Dashboard và layout dùng thuộc tính data-theme hiện có của website để đổi
light/dark, không thêm cơ chế theme mới. Không cài lint/theme/chart library mới.

Kết quả xác minh ngày 25/10/2026: production build đạt; 5 nhóm unit tests đạt;
Partner E2E đạt và Chat E2E đạt; Prettier check các file mới đạt. Không có lỗi
pageerror trong kịch bản Partner E2E. Chưa chạy phiên đăng nhập thật của một nhà
cung cấp trong đợt kiểm thử này; các số trên ảnh preview là fixture có ghi rõ
“kiểm thử”, không phải số liệu kinh doanh của người dùng.
