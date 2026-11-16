# Kiến trúc dữ liệu đề xuất

## Current storage facts

Backend dùng MongoDB Node driver qua custom repository `MongoStore`, không phải collection ORM chuẩn (`backend/src/db/mongo-store.js`, `backend/src/config/db.config.js`). Model `store.define` ánh xạ thành collection prefix `app_` và tên pluralized hoặc `tableName` riêng; `server.js` gọi `store.sync()` để tạo indexes từ khai báo trong code. Transport module khai báo một số collection trực tiếp ở `backend/src/transport/models.js`. Tên/records/index trong production **chưa được kiểm tra**.

Current tourism entities: `Schedule` (tour/itinerary fields, `destination`, `image_url`, `gallery`), `ScheduleSample` (cost/rating), `ScheduleActivity`, `ScheduleCustom`, `UserSchedule`, `GreenService` (type/destination/coordinates in `current_data`/Google Place ID), `TourBooking`, `ServiceBooking`. Không thấy model destinations/regions/attractions/hotels/restaurants/media assets/departures. Đây là kết luận về source declarations, không khẳng định database không có collections ngoài source.

## Design rules

- Keep stable IDs; do not key relationships by localized display names.
- Add catalog entities additively. Preserve `Schedule.destination` and existing response fields during migration.
- Separate evergreen catalog facts from mutable inventory/prices and transactional booking snapshots.
- Store source, verification, freshness and license metadata with the field/entity they qualify.
- Index only query patterns with an owner and measurable need; create/validate index migration separately from data backfill.

## Logical collections (proposed; not all must be created at once)

| Collection | Purpose / fields | Relationships | Indexes to consider |
|---|---|---|---|
| `admin_areas` | Official hierarchy/version: `_id`, `code`, `level` (`province_city`, optional commune), `name`, `parentId`, `validFrom`, `validTo`, `sourceUrl`, `sourceCheckedAt`. | Parent/child; tourism entities link to current admin area. | Unique `{code, validFrom}`; `{parentId, level}`; active lookup. |
| `regions` | GreenSteps tourism taxonomy: `slug`, `name`, `aliases`, display order, active dates. | Many-to-many with destinations. | Unique `slug`; autocomplete index. |
| `destinations` | Stable tourism entity: `slug`, localized names, `nameNormalized`, aliases, copy, media key, `adminAreaIds[]`, `regionIds[]`, GeoJSON, source/verification. | Many destinations per admin area; may reference several areas. | Unique slug; aliases; `2dsphere`; active + region. |
| `attractions` | Visit POI: name/aliases, destination IDs, type, point/address, accessibility, eco tags, source and verification. | Destination N:N; optional service link. | `{destinationIds,type,status}`; `2dsphere`; source ID unique where stable. |
| `tours` (logical view first) | Canonical tour identity, slug/title, destination IDs, status, content, media IDs, providers, source/verification. Initially a view/projection over Schedule + ScheduleSample is acceptable. | Destination N:N; itinerary; provider. | `{status,destinationIds}`; slug unique; search index. |
| `tour_departures` | Sellable occurrence: `tourId`, provider, start/end, capacity/seats, price/currency, terms version, cutoff, status, `verifiedAt`. | One tour to many departures. | `{tourId,status,startAt}`, `{providerId,startAt}`. |
| `tour_itineraries` | Ordered days/activities; service/attraction references, times, source, optional coordinates. | Tour to ordered days; activities reference catalog IDs. | `{tourId,dayNumber,sequence}` unique. |
| `services` | Existing `GreenService` may remain physical source; add typed subdocuments, status, provider, destination IDs, coordinate, pricing mode, source and verification. | Provider, destination, bookings. | `{status,type,destinationIds}`, provider/status; 2dsphere for nearby. |
| `partners` | Existing Provider/Vender identities and operations; avoid duplicate identities without migration. | Services, tours, departures, bookings. | Existing unique provider keys; measured lookup indexes. |
| `media_assets` | `storageKey`, provider, visibility, MIME/bytes/checksum, dimensions, variants, alt, `sourceType`, `sourceUrl`, `photographer`, `license`, `attribution`, `verificationStatus`, owner/entity refs and timestamps. | Tour/destination/service/partner refs. | Unique storage key; `{ownerId,createdAt}`; review status. |
| `bookings` (preserve current models) | Transaction state and immutable price/terms/entity snapshot; optional departure ID. Keep `TourBooking`/`ServiceBooking` until compatibility is proven. | User, departure/tour/service, provider, payment. | Existing unique idempotency/booking keys; user/status/date indexes after workload review. |

## Example documents

Example below illustrates the proposed shape only; ID and source URL are placeholders and do not represent seeded/verified data.

```json
{
  "_id": "dest_sapa",
  "slug": "sa-pa",
  "name": { "vi": "Sa Pa", "en": "Sa Pa" },
  "nameNormalized": "sa pa",
  "aliases": ["Sapa"],
  "adminAreaIds": ["admin_15"],
  "regionIds": ["region_northwest"],
  "verification": { "status": "verified", "sourceUrl": "https://...", "checkedAt": "2026-11-12T00:00:00Z" }
}
```

```json
{
  "_id": "media_01J...",
  "storageKey": "destinations/sa-pa/hero/01J....webp",
  "sourceType": "licensed_partner",
  "photographer": "Provider-submitted",
  "license": "pending_review",
  "attribution": "",
  "verificationStatus": "pending",
  "variants": { "card": ".../card.webp", "hero": ".../hero.webp" }
}
```

## Search, geo and migration

1. Keep `Schedule.destination` while adding `destinationIds[]` or a mapping collection. Dry-run backfill: normalize accents/case, map approved aliases, output unresolved/ambiguous rows, require human review. Never silently map old `Phú Yên` because its province boundary/name changed.
2. Add admin-area data from official codes with effective dates and historical names; do not overwrite old booking snapshots/audit records.
3. Pilot catalog on six destinations. Dual-read for existing pages; use one write path after reconciliation.
4. Add `tour_departures` only when providers supply verified schedules/prices. Existing ScheduleSample cost is not proof of future availability.
5. Search normalization: store normalized Vietnamese aliases or use a tested Atlas Search analyzer; retain raw display labels. Test no-diacritic, old-name, slug and ambiguous queries.
6. Add 2dsphere indexes only to actual GeoJSON fields. `current_data.lat/lng` or `ScheduleActivity.coordinates` strings are not automatically GeoJSON.
7. Migration stages: backup → read-only inventory → dry-run mapping report → approve counts/aliases → idempotent backfill → dual-read reconciliation → switch reads → retain rollback mapping. No destructive collection rename/drop in the first release.

## Unknowns before migration

Read-only Atlas inspection on 2026-11-12 confirmed database `GreenStepsData`, prefix `app_`, and 79 collections. Exact counts were checked only for the catalog/media, schedules/activities, users, bookings, and wallet ledger collections and are recorded in `FINAL-IMPLEMENTATION-REPORT.md`; no document fields were read. Existing index catalog, legacy schema variants, data owner, current Mongo tier/region, records outside the inspected collections, and backup/restore readiness remain unknown. No write was made.
