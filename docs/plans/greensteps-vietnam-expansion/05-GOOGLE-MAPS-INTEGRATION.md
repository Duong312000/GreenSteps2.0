# Tích hợp Google Maps

## Hiện trạng trong source

Backend có routes cho Places search/details và Routes; `maps-cache.service.js` ghi cache MongoDB TTL. Search/details cache response có thể kéo theo reviews/photo references trong 7 ngày; route results cache 14 ngày. Source có fallback API key hardcode và có URL ảnh trả ra client mang key. Không chép key vào tài liệu này; cần coi key đã lộ qua source là compromised và xử lý qua quy trình credential rotation của đội vận hành.

Audit này không gọi Google API, không kiểm tra Cloud Console, restriction, quota, billing hay key đang deploy. Các nhận định policy cần đối chiếu điều khoản Google hiện hành và cấu hình API đang dùng trước khi phát hành.

## Việc cần ưu tiên trước khi mở rộng

1. Gỡ fallback key khỏi source, history/deployment artifact theo quy trình; cấp credential mới, giới hạn theo API, application, referrer/IP và environment. Không đưa key server-side vào URL ảnh/front-end.
2. Đặt quota/budget alerts, rate limits theo user/IP/API, timeout, retry có backoff, circuit breaker và logging không chứa credential/PII.
3. Rà soát và dừng cache Places payload/ảnh không được phép. Kiểm tra cả cache Mongo, cache HTTP/CDN, browser storage, analytics và backup chứa dữ liệu cũ. Xóa theo chính sách sau đánh giá pháp lý/điều khoản.
4. Lưu Place ID làm tham chiếu khi phù hợp, kèm thời điểm kiểm tra; Place ID có ngoại lệ lưu trữ riêng nhưng cần refresh nếu cũ. Không coi Place ID là xác nhận doanh nghiệp hợp tác hoặc giá/availability.
5. Ảnh trả từ Places Photos phải fetch theo flow Google cho phép, giữ attribution và liên kết/bản đồ theo yêu cầu; photo name/reference có thể hết hạn. Không re-host vào object storage hoặc dùng làm ảnh hero cố định nếu không có quyền riêng.
6. Tách Google discovery runtime khỏi master catalog GreenSteps đã biên tập/được cấp phép.

## Thiết kế ranh giới dữ liệu

| Dữ liệu | Chủ sở hữu/nguồn | Lưu bền? | Hướng xử lý |
|---|---|---|---|
| `place_id` | Google | Có ngoại lệ theo Places policy; cần freshness | Lưu ID, checkedAt, refresh khi phù hợp; không xem là entity GreenSteps |
| Nội dung Places (name, reviews, ratings, photos, fields khác) | Google | Theo policy, field-specific | Gọi theo nhu cầu; hiển thị attribution; chỉ cache phần được phép và TTL đúng chính sách |
| Kết quả Routes/directions | Google | Chỉ theo điều khoản dịch vụ hiện hành | Kiểm tra restrictions cụ thể; cache tối thiểu hoặc tắt cache khi không được phép |
| Tour, partner, giá, departure, quyền ảnh GreenSteps | GreenSteps/provider | Có theo hợp đồng, consent và retention | Lưu nội bộ với source, verification, freshness và rights evidence |

Thời gian cache ở implementation hiện tại không tự chứng minh tuân thủ. Policy cho Places, Routes, Maps JavaScript và từng API khác nhau; legal/product owner phải phê duyệt data-field matrix trước khi bật cache.

## API và UI đề xuất

- Backend giữ proxy server-side cho API cần secret; allowlist fields, validate query/coordinates, giới hạn page size và rate.
- Bản đồ dùng Maps SDK đúng điều khoản; khóa client giới hạn referrer/API. Tính năng không cần map vẫn hoạt động nếu Maps quota/API lỗi.
- UI gắn nhãn rõ kết quả Google là thông tin Google, hiển thị attribution/source link; ảnh/đánh giá không bị trình bày như nội dung GreenSteps đã xác minh.
- Nếu Google không trả kết quả, dùng catalog nội bộ đã kiểm duyệt hoặc thông báo không có dữ liệu; không tự chế địa điểm/route.
- Không để AI suy ra giá, mở cửa, đánh giá, khoảng cách chính xác hay chỗ trống từ kết quả tìm kiếm tổng quát.

## Kiểm tra trước phát hành

- Lập danh sách API/method/fields, owner/key type, restrictions, quota, budget alerts và môi trường.
- Review chính thức terms + policies; map từng field vào thời hạn/cách hiển thị/xóa.
- Kiểm tra key scanning CI và repo history, deploy logs, source maps, client bundles.
- Kiểm thử không có gọi API ngoài ý muốn khi chạy test/build; test rate limit, outage, timeout, cache expiry và attribution bằng fixture/stub.
- Xác nhận chi phí theo console sau khi có traffic có kiểm soát; không chạy kiểm tra có thể phát sinh phí trong audit.

## Nguồn chính thức

- [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id)
- [Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos)
- [Google Maps Platform service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms/index)
