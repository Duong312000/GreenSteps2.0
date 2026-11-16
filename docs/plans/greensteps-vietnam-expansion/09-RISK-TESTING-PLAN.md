# Kế hoạch rủi ro và kiểm thử

## Danh mục rủi ro

| Mức | Rủi ro | Căn cứ/ảnh hưởng | Giảm thiểu và tín hiệu |
|---|---|---|---|
| P0 | Google key trong source/fallback và URL client | Đã thấy pattern trong Maps route; lạm dụng key, phát sinh chi phí hoặc truy cập trái phép | Rotate/restrict/quota, secret scan, loại khỏi bundles/logs; alert usage bất thường |
| P0 | Cache Places/photo content không đúng policy | Cache service đang lưu response Maps có thể chứa trường hạn chế; rủi ro terms và takedown | Tạm dừng cache liên quan, rà field-by-field, xóa theo quy trình sau legal review |
| P0 | Tour demo/itinerary bị hiểu là hàng có thể mua | Chưa thấy departure inventory model trong khai báo; giá itinerary không đủ chứng minh chỗ bán | Booking gate theo departure verified; UI/editorial labels; kiểm thử checkout âm |
| P1 | Danh mục địa lý sai sau đổi đơn vị hành chính | Alias/tên cũ, codes/effective dates và địa điểm du lịch không đồng nhất | Lưu version lịch sử + tourism taxonomy; đối soát nguồn chính thức và owner |
| P1 | Dữ liệu nguồn thiếu/chất lượng kém | Không truy cập DB/live provider; seed chỉ là mẫu | Profiling read-only khi được cấp quyền riêng, quarantine, completeness/verification metrics |
| P1 | Ảnh vi phạm quyền hoặc bị mất | Local upload/storage path, thiếu rights metadata; Google content có điều khoản riêng | Provenance/license gate, object storage/CDN, backup, takedown SLA |
| P1 | Client-side catalog tải toàn bộ | Tours/services lọc và chia trang trên client | Server pagination, limits/index review/cache headers, load metrics |
| P1 | Migration sai liên kết | Free-form `destination` và dữ liệu lịch sử | Mapping confidence, dry-run, idempotency, snapshots, reconciliation, rollback |
| P2 | AI bịa availability/giá/địa điểm | Planner dùng LLM + nội dung/Google data | Retrieval-only claims, evidence IDs, schema guardrails, abstain, offline eval |
| P2 | Tăng chi phí Maps/media/AI | API usage, egress, transforms và token chưa định lượng | Budget cap/alerts, staged rollout, sample cost model, rate limits |
| P2 | Regressions booking/auth/role | Nhiều flow dùng chung API và UI | Contract regression, authorization server-side, feature flags/canary |

## Ma trận kiểm thử trước triển khai

| Lớp | Nội dung |
|---|---|
| Unit | Chuẩn hóa alias, slug, state transitions, date/currency, eligibility bookable, media MIME/size, schema AI |
| API/contract | Pagination boundaries, stable sort, filters, legacy payload compatibility, authorization, rate limit, error contracts |
| Database/migration | Dry-run/rollback/resume, unique collisions, indexes, references, old/new dual-read counts; dùng fixture/staging snapshot đã che dữ liệu |
| UI/accessibility | Guest/auth nav, responsive layouts, screen reader labels, keyboard, filter URL, loading/empty/error, non-bookable CTA absent |
| Integration | Object upload/signature, CDN variants/fallback, Maps mocked responses/attribution/expiry, booking gate; không gọi API trả phí trong CI |
| AI evaluation | Alias, no inventory, stale price, impossible budget, injection, missing fields, grounding and abstention; offline fixture set |
| Performance | Search p50/p95, bounded result size, index plan, CDN hit, image LCP, concurrency; staging/load fixture only |
| Operations | Alerts/budget, credential rotation, takedown, migration checkpoint, restore backup, disable feature flags |

## Release gates

- Không có P0 chưa xử lý; owner ký policy/credential và booking gate.
- Migration dry-run có báo cáo count, duplicate, unmapped, invalid reference; snapshot/restore đã diễn tập.
- Không còn tour demo lọt checkout; regression auth/payment/wallet đạt.
- Rights/attribution đủ cho mọi ảnh được publish; Google-origin content có đường hiển thị hợp lệ.
- Dashboard/quota/rollback owner và support playbook sẵn sàng.
- Canary không tăng lỗi 404 ảnh, API p95, search zero-result hoặc booking mismatch vượt ngưỡng do owner đặt.

Không chạy test, build, migration, truy vấn production hay API trả phí trong lần audit này theo phạm vi yêu cầu.
