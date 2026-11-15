# GreenSteps tour enrichment v2 audit

Audited against the checked-in seed, manifest, API formatters, Angular mapping, and detail template on 2026-11-12. This is a local source audit; it is not an Atlas read.

## Inventory and root causes

The seed generates 12 fixed records from six destinations and 36 fixed itinerary activity IDs. Each tour is three days, `catalog_status: demo`, and has exactly three distinct local photo records. The two tours at each destination share the same three photographs, so within each related pair the shared-gallery rate is 100%. Across all tours the manifest contains 18 distinct photos. The current galleries do not meet the requested six unique photographs per tour.

| ID suffix | Destination | Activity IDs (day 1–3) | Photos | Highlights | Intro words |
|---|---|---|---:|---:|---:|
| `dalat-1` | Đà Lạt | `...dalat-1-activity-1` to `-3` | 3 | 3 | 73 |
| `dalat-2` | Đà Lạt | `...dalat-2-activity-1` to `-3` | 3 | 3 | 76 |
| `phu-yen-1` | Phú Yên | `...phu-yen-1-activity-1` to `-3` | 3 | 3 | 75 |
| `phu-yen-2` | Phú Yên | `...phu-yen-2-activity-1` to `-3` | 3 | 3 | 71 |
| `da-nang-hoi-an-1` | Đà Nẵng – Hội An | `...da-nang-hoi-an-1-activity-1` to `-3` | 3 | 3 | 88 |
| `da-nang-hoi-an-2` | Đà Nẵng – Hội An | `...da-nang-hoi-an-2-activity-1` to `-3` | 3 | 3 | 85 |
| `sa-pa-1` | Sa Pa | `...sa-pa-1-activity-1` to `-3` | 3 | 3 | 78 |
| `sa-pa-2` | Sa Pa | `...sa-pa-2-activity-1` to `-3` | 3 | 3 | 82 |
| `ninh-binh-1` | Ninh Bình | `...ninh-binh-1-activity-1` to `-3` | 3 | 3 | 76 |
| `ninh-binh-2` | Ninh Bình | `...ninh-binh-2-activity-1` to `-3` | 3 | 3 | 85 |
| `phu-quoc-1` | Phú Quốc | `...phu-quoc-1-activity-1` to `-3` | 3 | 3 | 82 |
| `phu-quoc-2` | Phú Quốc | `...phu-quoc-2-activity-1` to `-3` | 3 | 3 | 82 |

Activity IDs use the deterministic `demo-vn-tour-<slug>-activity-<day>` form. All 36 IDs and their day assignments are generated in `backend/src/data/demo-tours.seed.js`; the itinerary record is the proposed content in `demo-tour-editorial.js`, not a supplier commitment.

## Findings

1. **Tour characteristics are absent from demo seeds.** All twelve use the same `Trải nghiệm địa phương` style without an explanation. Group capacity and measured emissions are unavailable. The detail template hides the whole four-card grid for demo tours; component fallbacks also say “Nhóm nhỏ thân mật” and “Nhẹ nhàng”, which imply unverified facts if used for demos.
2. **Overview sections are suppressed for demos.** Demo highlights are not rendered. Demo descriptions are 71–88 words and frequently use repeated disclaimer copy. Responsible-travel guidance is currently one shared paragraph for every tour.
3. **List/detail response shapes differ.** `formatTourResponse` returns editorial fields plus activities, while `searchTours` has a separate demo mapping that omits style and some detail metadata. API mapping has a guarded demo branch, so new editorial fields need an explicit mapping rather than legacy defaults.
4. **Two required tabs are hidden for demos.** The detail page only renders Overview, Itinerary, and Reviews; Inclusions and Deposit Policy are omitted. This is safer than showing legacy commercial claims, but it does not match the requested tab architecture or state the correct unknown status.
5. **Itinerary is three activities, one per day, but activities lack photo/practical-note bindings.** The current day selector and IDs can be retained; no need to duplicate stops.
6. **Photography is validly attributed in the checked-in manifest, but too sparse and shared.** There are 18 verified Commons records/54 local responsive files according to the prior report. Three photos are assigned to each tour, and every pair of tours at the same destination shares all three. Some place photographs are explicitly contextual rather than proof of an itinerary stop. Any additions require source-page/license verification before downloading.
7. **Demo booking guard exists.** API returns `bookingEnabled: false` and booking code has an explicit demo guard. Preserve both.
8. **Storage can support the fields.** Schedule model has JSON fields for editorial arrays/photos and columns for style/group-size/fitness. Avoid model defaults that turn unknown carbon into a displayed zero; serializers must suppress or normalize that legacy storage default for demos.

## Photo-to-tour shortfall

Actual: 3 photos / tour, 3 unique / tour, 18 total distinct assets, 100% shared within each same-destination pair. Exact landmark coverage depends on the manifest's `subjectLocation` and itinerary labels; broader regional imagery must not be presented as an exact stop. Requested: target 6 distinct photos / tour and at most 25% shared within pairs. Current shortfall: three photos per tour, six additional distinct verified photos per destination pair on average to reach 6 each, and all pairs exceed the reuse target. No unrelated photo should be substituted to fill this gap.

## Files in scope

- Seed/content: `backend/src/data/demo-tours.seed.js`, `backend/src/data/demo-tour-editorial.js`.
- API/model: `backend/src/services/tour-search.service.js`, `backend/src/controllers/tour.controller.js`, Schedule JSON fields in `backend/src/models/index.js`, Angular `models.ts` and `api.service.ts`.
- UI: `my-app/src/app/pages/tours/*` and `my-app/src/app/pages/tour-detail/*`.
- Photo records: `docs/plans/greensteps-tour-photo-enrichment/photo-manifest.json`, `attributions.md`, local assets in `my-app/public/image/greensteps/tours/`.
- Booking/payment safety: inspect and test only; do not modify.

## External state

This audit did not query or change MongoDB/Atlas and did not deploy. The newer task brief requires explicit approval before any Atlas apply command.
