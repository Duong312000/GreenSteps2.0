# GS-001 — checklist cần hoàn tất ngoài repository

**Trạng thái: BLOCKED — cần người có quyền Google Cloud/production secrets và chủ sở hữu chính sách dữ liệu.** Không có cấu hình production, credential, database hay Google API nào được thao tác trong milestone này.

## 1. Xử lý credential đã xuất hiện trong source

- [ ] **Cloud/Platform owner:** xác định project và các browser/server credentials từng được nhúng trong repository hoặc artifact; chỉ thao tác trong secret manager/Cloud Console, không gửi giá trị key qua chat, issue hay log.
- [ ] **Cloud owner:** tạo credential thay thế theo đúng loại sử dụng. Browser key chỉ cho Maps JavaScript API cần thiết và giới hạn HTTP referrer; server key chỉ cho Places API/Routes API cần thiết và giới hạn IP/môi trường.
- [ ] **Platform owner:** cập nhật secret store/deployment pipeline; xác nhận staging bằng health/config status không chứa giá trị secret.
- [ ] **Cloud owner:** sau khi rollout có kiểm soát, vô hiệu hóa credential cũ; kiểm tra quota/billing để phát hiện sử dụng bất thường.
- [ ] **Repo owner:** rà soát commit history, release bundles, source maps, CI artifacts và log. Ưu tiên rotation trước; chỉ rewrite history sau đánh giá tác động/approval riêng.

**Pass khi:** credential cũ bị thu hồi; credentials mới bị giới hạn đúng API/app/IP/referrer; không có secret trong working tree, build artifact, response hoặc log; có người nhận cảnh báo usage.

## 2. Quota và ngân sách Google Maps

- [ ] **Cloud owner:** xác nhận billing project và API được bật thật sự.
- [ ] **Cloud owner:** đặt quota theo API/credential, daily budget alerts và thông báo người nhận; giới hạn request ở proxy và theo dõi 429/5xx.
- [ ] **Product/Platform:** xác định traffic rollout tối đa và ngưỡng dừng trước khi bật public traffic.

**Pass khi:** có quota/budget alert kiểm chứng được trong console và rollback owner. Chưa thể xác nhận từ repository.

## 3. Dữ liệu/cache Google cũ và điều khoản

- [ ] **Legal/Data owner:** phân loại `google_maps_cache` theo từng field/API và xác định việc xóa/retention cần thiết.
- [ ] **DB owner:** sau approval, lên lịch xử lý records cache cũ có backup/reconciliation phù hợp. Không chạy xóa collection trong milestone này.
- [ ] **Content owner:** rà ảnh dưới `my-app/public/image/places` và nội dung có nguồn Google trong DB/backup; cách ly ảnh chưa chứng minh quyền sử dụng, giữ lại cho đến khi có quyết định lưu trữ/xóa.
- [ ] **Product/Legal:** xác nhận Terms of Use/Privacy Policy, attribution và đường truy cập nội dung nguồn trên Google Maps trước khi bật lại photos/reviews.

**Pass khi:** policy matrix có owner/retention cho từng API field; ảnh có rights evidence hoặc được ẩn khỏi publish; dữ liệu cũ được xử lý theo phê duyệt. Trước đó ảnh/reviews Places tiếp tục tắt trong API demo.

## 4. Places content đang đi vào itinerary do người dùng lưu

- [ ] **Legal/Data owner:** xác định điều khoản hiện hành có cho phép lưu Google Places name/address/rating/opening information/coordinates trong itinerary cá nhân do khách tạo hay không, và field nào phải refresh/xóa.
- [ ] **Product owner:** nếu không được lưu, chọn trải nghiệm thay thế: giữ Place ID rồi tải chi tiết khi xem, hoặc để kết quả Maps ở trạng thái chỉ xem và không đưa vào itinerary đã lưu. Place ID có ngoại lệ riêng; nội dung đi kèm không tự được miễn theo.
- [ ] **Engineering owner:** sau quyết định, kiểm soát cả frontend itinerary editor và API ghi `ScheduleActivity`; chỉ sửa một phía là không đủ vì client có thể gọi API trực tiếp.
- [ ] **Data owner:** sau approval, đối soát nội dung Google đã lưu trong itinerary/backup theo phạm vi và chính sách retention.

**Trạng thái:** BLOCKED. Places search/details hiện vẫn trả một số field Google cho chức năng xem bản đồ; audit source cũng thấy itinerary editor gửi hoạt động/lịch trình lên API để lưu. Chưa có xác nhận điều khoản cho đường dữ liệu này, nên chưa thể đánh dấu GS-001 đạt điều kiện để mở rộng catalog.

## Kết quả có thể xác minh trong code

- Server Maps không còn fallback key, không trả key trong response, fail-closed khi thiếu `GOOGLE_MAPS_API_KEY`.
- Places/Routes không đọc/ghi persistent cache; mọi response đặt `Cache-Control: no-store`.
- Places photos/reviews không được yêu cầu hoặc trả về; photo sync/rehost script fail-closed, không kết nối DB hay gọi Google.
- Browser Maps script chỉ tải khi deployment cung cấp browser key tại slot trống, key đó phải được referrer-restricted trước release.

## Rollback cho milestone hiện tại

- Milestone này không ghi database và không triển khai production.
- Nếu proxy Maps có lỗi, giữ endpoint fail-closed/ẩn tính năng Maps; không khôi phục source hoặc bundle cũ có credential nhúng.
- GS-002 chỉ thêm field tùy chọn và guard code; legacy documents không được backfill. Trước khi có record demo, có thể hoàn nguyên riêng guard hỏng sau khi xác nhận chưa có record `catalog_status` mới. Sau khi tạo demo record, giữ nguyên guard cho đến khi inventory được xác minh hoặc record được unpublish.

