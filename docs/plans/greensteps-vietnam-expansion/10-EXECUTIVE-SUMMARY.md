# Tóm tắt điều hành

## Quyết định được đề xuất

Mở rộng GreenSteps Travel theo từng phase, bắt đầu bằng một catalog điểm đến độc lập với tỉnh/thành và khoảng 12 tour demo không thể đặt. Giữ nguyên booking/auth/payment hiện tại cho đến khi có departure inventory và dữ liệu nhà cung cấp được xác minh. Trước khi tăng traffic, xử lý credential/cache Google Maps và đóng booking gate cho nội dung demo.

## Audit hiện trạng

- Nền tảng là Angular 21 + Express + MongoDB driver/custom store; có sẵn tour, dịch vụ, AI Planner, Maps, booking/payment và community.
- Tour/services hiện lọc và phân trang phần lớn ở trình duyệt; danh sách điểm đến hiện suy từ chuỗi `Schedule.destination` và các card hardcode, chưa phải geo catalog chuẩn.
- `GreenService` chứa nhiều subtype dịch vụ; chưa thấy khai báo model riêng cho destination/region/attraction/media assets/departure trong source đã kiểm tra.
- Ảnh upload được gửi qua Base64, ghi local `backend/uploads`; chưa thấy media metadata đủ cho provenance/license/CDN lifecycle.
- Maps route có cache Places và key fallback trong source; đây là vấn đề ưu tiên cao cần xử lý trước mở rộng.

## Tầm nhìn dữ liệu và sản phẩm

Tách 3 lớp: administrative areas có mã và phiên bản; GreenSteps tourism destinations/regions; catalog & inventory tour/service. Tỉnh/thành là bộ lọc/quan hệ, không định nghĩa toàn bộ điểm đến. Tour chỉ đặt được khi có departure, provider, giá, currency, điều khoản và availability còn hiệu lực.

Đối với ảnh, dùng object storage + CDN + metadata MongoDB; không dùng Base64 hoặc double Base64 làm kho, không re-host Google Photos trái điều khoản. Đối với AI, retrieval từ catalog đã xác minh, trích entity IDs và thể hiện phần còn thiếu như gợi ý.

## Roadmap

1. P0: xử lý Maps credentials/cache policy và ngăn demo vào checkout.
2. P1: catalog hành chính phiên bản hóa, tourism destinations/aliases, API phân trang server-side và media pipeline.
3. Phase A: sáu điểm đến, khoảng 12 slot biên tập không thể bán.
4. Phase B: landmarks/dịch vụ với provenance, moderation và owner.
5. Phase C: rollout nationwide có theo dõi chất lượng, chi phí và vận hành; bật bán từng departure sau xác minh.

## Hạn chế bằng chứng

Audit chỉ đọc source/seed/config mẫu và tài liệu trong working tree; không mở `.env`, không kết nối MongoDB, không gọi Maps/AI/API tính phí, không chạy build/test/migration và không sửa application code. Vì vậy chưa thể báo số record production, tình trạng giá/availability, quota/billing thực tế, quyền ảnh từng file, hiệu năng runtime hay trạng thái main. Mọi dữ liệu nationwide cần đối chiếu nguồn chính thức và người sở hữu nội dung trước khi publish.
