# Chiến lược lưu trữ ảnh

## Kết luận

Không dùng Base64 (một lần hay hai lần) làm kho ảnh. Với mục tiêu mở rộng toàn quốc và lượng ảnh lớn, lưu file gốc cùng biến thể ở object storage, phân phối qua CDN, còn MongoDB giữ metadata và khóa lưu trữ. Chọn nhà cung cấp sau khi đối chiếu khu vực triển khai, chi phí thao tác/egress, xử lý ảnh, backup và khả năng vận hành. R2 hợp lý khi ưu tiên chi phí egress thấp; S3 khi hệ thống đã ở AWS; Cloudinary khi cần quản lý biến thể và tối ưu ảnh có sẵn ngay. Đây là khuyến nghị kiến trúc, chưa phải lựa chọn đã được phê duyệt.

## Hiện trạng đã kiểm tra

- Schedule Editor đọc file thành Base64 và gọi endpoint `upload-base64`.
- Backend giải mã dữ liệu ảnh một lần, kiểm tra giới hạn khoảng 8 MiB, ghi file dưới `backend/uploads/posts`, và lưu URL/path vào dữ liệu tour/bài viết. Express nhận JSON tối đa 50 MB; static `/uploads` được phục vụ bởi backend.
- Có asset tĩnh dưới `my-app/public/image/...`. Deployment đang cần đảm bảo thư mục upload tồn tại bền vững; source không chứng minh filesystem persistence, backup hay CDN trên production.
- Chưa thấy media asset model chuẩn với nguồn, license, attribution, checksum, variants và vòng đời.
- Ảnh của Google Places có yêu cầu và hạn chế riêng. Không tải về/re-host hoặc cache Google Maps content như ảnh catalog của GreenSteps.

## Các lựa chọn

| Cách lưu | Điểm mạnh | Hạn chế | Vai trò phù hợp |
|---|---|---|---|
| Base64 trong MongoDB | Dễ truyền trong JSON, tiện demo nhỏ/offline | Base64 tăng kích thước xấp xỉ 4/3; làm phình document/index/backup, tăng RAM và payload; khó CDN/cache/resize | Không dùng cho ảnh catalog sản xuất |
| Double Base64 | Có thể thêm lớp biểu diễn/obfuscation trong một giao thức tùy biến | Mỗi vòng lại tăng kích thước; không mã hóa, không bảo mật; tốn CPU và tăng lỗi decode | Không dùng |
| MongoDB GridFS | File lớn hơn giới hạn document có thể chia chunks, giữ trong MongoDB ecosystem | DB gánh luồng file/backup/egress; chưa tự cung cấp image transforms/CDN; cần cân nhắc vận hành | Chỉ khi có lý do DB-centric và đo tải chứng minh phù hợp |
| Cloudinary | Upload, biến thể/format/resize và CDN có sẵn | Chi phí phụ thuộc gói/usage; lock-in và cần kiểm soát quyền/transform | Đội nhỏ muốn giảm vận hành ảnh |
| Cloudflare R2 + CDN | S3-compatible; không tính phí egress theo trang giá hiện hành; có chi phí lưu trữ/operation và cần thiết kế xử lý ảnh | Cần tự tích hợp upload, transform pipeline, CDN/cache headers, lifecycle | Khuyến nghị khảo sát khi traffic ảnh lớn và egress là yếu tố chính |
| Amazon S3 + CloudFront | Hệ sinh thái trưởng thành, presigned upload, lifecycle/replication, kiểm soát IAM | Cần cấu hình CDN/transform và theo dõi phí storage, request, transfer | Khuyến nghị nếu backend/deployment đã ở AWS |

Base64 là encoding, không phải encryption. Hai lần Base64 lý tưởng làm payload khoảng (4/3)² = 16/9, tức xấp xỉ 78% lớn hơn byte gốc trước overhead JSON; không tạo tính bảo mật.

## Kiến trúc đề xuất

1. Browser yêu cầu backend cấp signed upload URL ngắn hạn cho một object key ngẫu nhiên; backend xác thực user, kiểm tra quota/MIME/kích thước và phạm vi quyền.
2. Browser PUT file trực tiếp tới object storage. Không đưa secret storage key vào frontend.
3. Backend xác minh object upload (size, MIME thật/magic bytes, checksum, malware policy nếu có) rồi tạo record `media_assets` trạng thái `pending_review`/`verified`.
4. Pipeline tạo thumbnail/card/hero ở kích thước định trước, giữ bản gốc theo quyền và retention policy. Dùng immutable key/version để cache CDN lâu, purge theo quy trình khi gỡ ảnh.
5. API trả URL qua media delivery service; app lưu `mediaAssetId`/storage key, không lưu data URI. Giữ tương thích đọc `image_url` cũ trong giai đoạn chuyển đổi.

### Metadata tối thiểu

`_id`, `storageProvider`, `storageKey`, `visibility`, `mimeType`, `byteSize`, `width`, `height`, `checksum`, `variants[]`, `altText`, `sourceType` (`partner_upload`, `licensed_stock`, `official_open_data`, `google_runtime`), `sourceUrl`, `photographer`, `licenseId`, `attributionText`, `rightsEvidence`, `ownerId`, `entityRefs[]`, `verificationStatus`, `createdAt`, `updatedAt`, `deletedAt`.

Không đưa ảnh vào trạng thái publish nếu thiếu provenance/license cần thiết. Không xem việc ảnh xuất hiện trên Internet hoặc Google Maps là quyền re-host.

## Quy mô và lựa chọn chi phí

“1 triệu ảnh” chưa đủ để tính chi phí. Cần có trung bình MiB gốc, số variants, tỷ lệ ảnh được xem/tháng, request CDN, upload/tháng, retention, region/egress và nhu cầu resize. Ước lượng sơ bộ: `bytes lưu = ảnh * (gốc + tổng variants)`, `delivery = ảnh được xem * bytes variant`, rồi áp bảng giá chính thức của nhà cung cấp trong ngày phê duyệt. Dùng benchmark với sample đại diện; đừng chọn theo storage unit price riêng lẻ.

## Chuyển dữ liệu

- Lập inventory từ `image_url`/`gallery` và thư mục uploads; phân loại URL nội bộ, asset tĩnh, external URL và Google content.
- Không quét DB production trong audit này. Trước migration cần snapshot/backup, dry-run, đối chiếu số lượng, checksum, broken URL và rights review.
- Backfill object storage idempotent; ghi media IDs/metadata; giữ URL cũ đọc được.
- Bật đọc mới cho nhóm canary; theo dõi lỗi 404, latency, upload failure và CDN miss; chỉ đổi nguồn đọc sau reconciliation.
- Rollback bằng cờ chuyển về URL cũ; không xóa file cũ cho đến khi hết thời hạn xác nhận và backup.

## Nguồn

- [MongoDB GridFS](https://www.mongodb.com/docs/manual/core/gridfs/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) và [R2 overview](https://developers.cloudflare.com/r2/how-r2-works/)
- [Amazon S3 performance](https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html) và [presigned uploads](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [Cloudinary plans](https://cloudinary.com/pricing) và [billing model](https://cloudinary.com/documentation/billing_and_plans)
