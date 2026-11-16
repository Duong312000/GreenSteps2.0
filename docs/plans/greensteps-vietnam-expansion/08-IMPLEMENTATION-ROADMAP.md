# Roadmap triển khai

Roadmap là kế hoạch, không phải lệnh chạy migration. Việc triển khai chỉ bắt đầu sau khi chủ sản phẩm xác nhận scope, nguồn dữ liệu và lựa chọn hạ tầng. Không có thay đổi source/DB được thực hiện trong audit.

| ID | Ưu tiên | Phạm vi/file chính | Phụ thuộc | Rủi ro | Tiêu chí nghiệm thu | Test và rollback |
|---|---|---|---|---|---|---|
| GS-001 | P0 | Credential/Maps review: `backend/src/routes/maps.routes.js`, maps services, secret config/deployment | Owner Maps, Cloud Console access | Key bị lộ, cache policy | Không còn fallback key; key restrictions/quota/budget được xác nhận; cache field matrix được phê duyệt | Secret scan, mocked route tests, config check; rollback bằng key mới/feature flag, không phục hồi key lộ |
| GS-002 | P0 | Inventory status/booking gate: tour, booking, checkout UI/API | Product/provider xác định điều kiện bán | Tour demo bị mua nhầm | Chỉ `bookable` departure có ngày/giá/provider/availability/terms hợp lệ đi checkout | Unit/API/UI regression; flag tắt CTA/booking mới nếu lỗi |
| GS-003 | P1 | `admin_areas` import/versioning; migration scripts mới dưới `backend/src/...` | Official source, normalization review | Tên/codes sai hoặc mất lịch sử | 34 tỉnh/thành đúng nguồn, code/version/effective date, aliases và reconciliation report | Dry-run fixtures + uniqueness; revert import/version mà không xóa historical refs |
| GS-004 | P1 | `regions`, `destinations` catalog + endpoints/controllers/models | GS-003; destination taxonomy/content owner | Trùng slug, sai ranh giới du lịch | Stable IDs, aliases, relationships; legacy tour string vẫn đọc được | API contract, alias/duplicate tests; feature flag về query cũ |
| GS-005 | P1 | Server pagination/search cho tours/services (`tour.controller.js`, service route/controller, API service, pages) | GS-004, index review | Sai kết quả, query chậm | Page size cap, stable sort, filters/URL state, index evidence; response compatibility | API/UX tests + explain/benchmark; giữ endpoint cũ/canary |
| GS-006 | P1 | Media upload/storage adapter, `media_assets`, editor, tour/service image rendering | Vendor choice, rights model, credentials | Broken media, cost, rights | Signed upload, size/type validation, variants, metadata and attribution | Upload fixture, checksum/404, security checks; read fallback to old URL until reconciliation |
| GS-007 | P1 | Curated six destinations + ~12 non-bookable editorial tour slots; catalog admin workflow | GS-003/004, editorial & image rights | Demo interpreted as sellable | Slots tagged editorial/demo, no price/availability claim, real licensed images and provenance | Content validation; unpublish by status/feature flag |
| GS-008 | P2 | Destination/tour detail UX, responsive filters, lazy loading/accessibility | GS-004/005/006 | UX regressions, heavy assets | Desktop/mobile states, URL filters, image fallbacks, empty/error/loading, keyboard use | Component/UI tests + visual review; route/feature flag rollback |
| GS-009 | P2 | AI retrieval by destination IDs and evidence schema (`greensteps-agent-catalog.service.js`, router, planner UI) | GS-004/005; guardrail and eval set | Hallucinated price/inventory; cost | Grounded IDs/status/source; no booking without verified departure; unknown handled honestly | Offline fixture eval, adversarial tests; disable expanded intent/return current planner |
| GS-010 | P2 | Nationwide content moderation, import and partner verification operations | Admin ownership, data agreements, support process | Stale/illegal content | Audit trail, provenance, freshness SLA, takedown workflow and owner per category | Operational tabletop, audit sample; pause ingestion/publishing |
| GS-011 | P2 | Observability/performance and rollout | GS-005 through GS-009 | Cost/latency incident | p95, error, cache, upload, search-zero-result and booking funnel dashboards/alerts | Load test in staging only; lower rollout percentage or disable feature |

## Trình tự và gates

### Gate 0 — An toàn và sự thật inventory

Hoàn thành GS-001 và GS-002 trước khi mở audience/traffic; review credential và booking semantics với owner.

### Phase A — 6 điểm đến, khoảng 12 tour demo

Chọn 6 điểm đến sau khi editorial owner xác nhận taxonomy; nhập các slot ở trạng thái `editorial`, không giá/availability giả, không thể đặt. Chỉ publish khi ảnh và nội dung có provenance/license. Dùng để xác nhận tìm kiếm, card, detail và AI gợi ý.

### Phase B — Danh mục địa danh/dịch vụ

Mở landmarks/attractions và service subtypes qua GreenService hoặc catalog chuẩn hóa; không nhập hàng loạt dữ liệu Google thành bản sao. GS-003/004/006 làm nền trước nội dung.

### Phase C — Nationwide

Rollout theo vùng/nhóm dữ liệu, partner verification, theo dõi search coverage, chất lượng, latency, media cost và support burden. Cân nhắc mở booking theo departure riêng sau đối soát hợp đồng/giá/availability.

## Trình tự migration dữ liệu

Backup và snapshot → dry-run counts/duplicate report → tạo collections/indexes additively → backfill IDs + alias mapping → dual-read/compare → canary → verify reconciliation/metrics → switch read → giữ rollback window → dọn legacy theo quyết định riêng. Mỗi bước có batch size, checkpoint, resumability và người chịu trách nhiệm. Không chạy migration từ request này.
