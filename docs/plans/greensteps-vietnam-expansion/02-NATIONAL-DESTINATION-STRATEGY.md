# Chiến lược danh mục điểm đến toàn Việt Nam

## Nguyên tắc dữ liệu

Tách **đơn vị hành chính** khỏi **địa danh du lịch**. Một tỉnh có nhiều điểm đến; một điểm đến có thể trải qua ranh giới hoặc được biết bằng tên vùng/cũ. Tỉnh/thành dùng stable administrative code và thời hạn hiệu lực; destination dùng stable internal ID/slug, tên hiển thị, aliases và liên kết hành chính tùy chọn.

Từ 01/07/2025, danh mục hành chính cấp tỉnh hiện hành có 34 đơn vị (28 tỉnh, 6 thành phố), theo Quyết định 19/2025/QĐ-TTg; danh mục pháp lý xuất phát từ Nghị quyết 202/2025/QH15. Không dùng danh sách 63 tỉnh cũ làm danh mục hành chính hiện hành. Giữ tên cũ như alias/lịch sử du lịch, ví dụ Phú Yên → địa danh du lịch thuộc tỉnh Đắk Lắk; Hà Giang → vùng/địa danh thuộc tỉnh Tuyên Quang; Sa Pa → destination thuộc Lào Cai; Đà Lạt → destination thuộc Lâm Đồng. Đây là alias mapping cần kiểm duyệt, không phải phép thay string hàng loạt. Nguồn: [Nghị quyết 202/2025/QH15](https://vanban.chinhphu.vn/?classid=1&docid=213930&orggroupid=1&pageid=27160), [danh mục/mã số 34 đơn vị hành chính theo Quyết định 19/2025/QĐ-TTg](https://baochinhphu.vn/bang-danh-muc-va-ma-so-cua-34-tinh-thanh-moi-3321-don-vi-hanh-chinh-cap-xa-moi-102250704153652947.htm).

Danh sách hành chính cấp tỉnh cần đồng bộ đúng mã chính thức: **An Giang, Bắc Ninh, Cà Mau, Cao Bằng, Đắk Lắk, Điện Biên, Đồng Nai, Đồng Tháp, Gia Lai, Hà Tĩnh, Hưng Yên, Khánh Hòa, Lai Châu, Lâm Đồng, Lạng Sơn, Lào Cai, Nghệ An, Ninh Bình, Phú Thọ, Quảng Ngãi, Quảng Ninh, Quảng Trị, Sơn La, Tây Ninh, Thái Nguyên, Thanh Hóa, Tuyên Quang, Vĩnh Long; Cần Thơ, Đà Nẵng, Hải Phòng, Hà Nội, Huế, Thành phố Hồ Chí Minh.**

## Proposed discovery taxonomy

Vietnam → Tourism regions (GreenSteps taxonomy) → Province/City (official code) → Tourist destinations → Attractions/services/tours.

Tourism regions are product groupings, not official administrative levels. A destination can belong to multiple region groups and can have multiple places within a province or span adjoining areas. Avoid “one province = one destination.”

## Rollout recommendation

### A — six-destination demo catalog

Keep the three existing tourism identities and add three manageable pilots: **Đà Lạt, Phú Yên, Đà Nẵng - Hội An, Sa Pa, Ninh Bình, Phú Quốc**. This offers highland, coast, heritage, karst/nature and island cases for search, gallery, map and itinerary testing. It is a product/testing mix, not a claim these are objectively highest-demand markets. Proposed current administrative parents: Lâm Đồng, Đắk Lắk, Đà Nẵng, Lào Cai, Ninh Bình and An Giang; verify exact boundaries and aliases as data-entry work.

Plan 12 **demo slots** (2 per destination) for UI/API testing. Keep them `demo`, `unpublished` or otherwise non-bookable until a named provider, current price, dates/availability, itinerary and cancellation terms are verified. Do not insert invented sale inventory.

### B — priority expansion

After the six-destination pilot passes quality gates, prioritize groups based on verified local partners, customer demand and content readiness. Candidate groups: Hà Nội, Hạ Long, Hà Giang (alias/region; verify current admin mapping), Cao Bằng, Mộc Châu, Huế, Phong Nha, Quy Nhơn, Nha Trang, Buôn Ma Thuột, Phan Thiết, TP.HCM, Cần Thơ and Côn Đảo. Score by partner coverage, transport access, seasonality, rights-ready photos, booking readiness and eco-experience fit. The list is a backlog, not accepted catalog data.

### C — national coverage

Maintain a province-level checklist for all 34 current units, but publish destinations only after content/partner verification. Add destination records as demand and partner supply justify them; do not create 34 empty city pages simply to claim national coverage. Support islands/rural areas as tourism destinations without requiring every province to have exactly one city-card.

## Source and quality rules

1. Administrative code/name/effective date: official Government/Quốc hội decisions; store source URL and retrieval timestamp.
2. Tourist place name/location/coordinates: official tourism department, official site/operator or field-verified partner. A Google Place ID is an external reference, not proof of GreenSteps editorial verification.
3. Commercial claims (price, schedule, open status, room/seat availability): provider feed or explicit partner/admin verification with `verifiedAt`/expiry; never infer from Google Maps.
4. Names: keep `displayName`, `slug`, `nameNormalized`, `aliases[]`, `adminAreaId`, `legacyAdminAreaNames[]`; never use mutable display text as a foreign key.
5. Geographic queries: use GeoJSON/2dsphere only after coordinate source and datum are checked; keep address separate from destination label.
6. Dedupe by stable source IDs and reviewed entity resolution; do not merge similarly named places by text alone.

## Current-state implication

Today `GET /api/tours/destinations` derives values from distinct `Schedule.destination`, and home special-cases a small set of names (`backend/src/controllers/tour.controller.js`, `my-app/src/app/pages/home/home.ts`). First migration should add normalized catalog IDs and aliases while preserving old strings for legacy UI/bookings. Source database counts and duplicates remain unknown because no DB was queried.
