# Kế hoạch UX frontend

## Mục tiêu

Giúp khách chọn nơi đi và lịch trình trên quy mô toàn quốc, phân biệt rõ ý tưởng tham khảo với tour thật có thể đặt, và không làm các màn hình hiện tại mất tương thích. Giữ thương hiệu GreenSteps hiện có; mở rộng theo dữ liệu và hành vi thay vì đưa danh sách tỉnh dài lên mọi màn hình.

## Khung trải nghiệm

1. **Home:** hero và CTA tìm hành trình; nhóm vùng du lịch; điểm đến nổi bật có nguồn/ảnh hợp lệ; bộ lọc cơ bản. Có thể cho khách chưa đăng nhập tìm tour.
2. **Explore:** tìm theo từ khóa/alias, vùng, tỉnh/thành hiện hành, loại hình, ngân sách và thời lượng; filter nằm trong query URL để chia sẻ/quay lại; server pagination.
3. **Destination page:** nội dung điểm đến độc lập với ranh giới hành chính, overview, mùa phù hợp nếu có nguồn, địa danh/dịch vụ và tour gắn ID. Thể hiện nơi chưa có inventory.
4. **Tour detail:** gallery có attribution; lịch trình; provider; ngày/giá/điều kiện từ departure đã xác minh; nút đặt chỉ xuất hiện khi còn sellable inventory.
5. **AI Planner:** đề xuất kế hoạch và liên kết catalog ID; mỗi phần được đánh nhãn “đã xác minh” hoặc “gợi ý”; user xác nhận trước khi tạo/đặt.

## Hiển thị tour và dữ liệu thiếu

- Dùng trạng thái rõ: `draft`, `editorial`, `verified`, `bookable`, `paused`. Chỉ `bookable` có provider active, giá/currency, departure/availability, điều khoản và thời điểm xác minh hợp lệ.
- 6 điểm đến/12 tour slot trong giai đoạn demo là placeholder nội dung nội bộ, không index như hàng bán và không hiển thị CTA đặt chỗ.
- Thiếu ảnh: dùng placeholder thương hiệu trung tính, không tạo ảnh AI giả làm địa danh có thật.
- Thiếu tỉnh/alias: cho tìm theo slug/alias quản trị, gợi ý sửa chính tả; không hardcode mapping tỉnh cũ trong template.
- Không có kết quả: gợi ý mở rộng vùng/thời gian/giá; không biến địa điểm Google thành inventory.

## Điều hướng và trạng thái đăng nhập

- Khách: Khuyến mãi, Cộng đồng, Chuyến đi trọn gói, Dịch vụ du lịch; CTA Đăng ký/Đăng nhập; giữ thông báo chuông ẩn theo yêu cầu sản phẩm đã ghi nhận từ trao đổi trước.
- Đã đăng nhập: dùng avatar/tên/menu tài khoản và hiển thị chuông thông báo; không lặp CTA đăng nhập/đăng ký. Giữ điểm vào đặt tour và lịch trình ở vị trí nổi bật.
- Loại bỏ thanh tìm kiếm nhỏ trên header như yêu cầu trước; search chính đặt trong hero/explore để tránh chật nav. Header co gọn theo breakpoint và giữ focus/keyboard access.
- Các quyền partner/admin chỉ xuất hiện theo role/route authorization, không chỉ dựa vào ẩn UI.

## Responsive, tốc độ và accessibility

- Desktop: vùng lọc bên trái hoặc drawer; danh sách card có ảnh ratio cố định và nội dung dễ quét.
- Mobile: một cột, filter bottom sheet, thanh tìm kiếm trong nội dung; ưu tiên tap targets >= 44 CSS px, không khóa thao tác bằng hover.
- Ảnh: `<picture>` variants responsive, width/height hoặc aspect ratio để giảm layout shift, lazy-load dưới fold, ưu tiên hero/LCP, fallback onerror.
- Hiển thị loading skeleton, empty/error/retry và pagination state; không tải toàn bộ catalog để lọc ở browser.
- Keyboard navigation, focus ring, label cho icon-only button, contrast, alt text có ý nghĩa và reduced motion.

## Analytics không xâm phạm

Theo dõi sự kiện tổng hợp: search submitted, filter used, destination opened, tour detail viewed, booking CTA shown/clicked, empty result, image error. Không đưa email, access token, query nhạy cảm hay dữ liệu Google không được phép vào analytics.

## Acceptance criteria

- Danh sách tỉnh/điểm đến đến từ catalog API, alias tìm được tên mới và cũ, không duplicate kết quả.
- Không có tour demo nào có thể đi vào checkout; chỉ departure hợp lệ mới cho đặt.
- Header không có search mini; trạng thái chuông đúng theo đăng nhập; nav hoạt động ở desktop/mobile.
- Bộ lọc/pagination được giữ trong URL và hoạt động khi refresh/back.
- Ảnh, attribution, skeleton, empty/error states và keyboard access có kiểm thử UI ở các viewport mục tiêu.
