# GreenSteps Tour Photography V3 report

**Date:** 2026-11-12
**Scope:** 12 existing demo tours; local photography, Commons metadata, seed/API/gallery mapping and verification.

## Result

- **66 distinct licensed source photographs** downloaded from Wikimedia Commons and mapped into **72 gallery slots** (6 per tour). The six shared photographs are each used by one same-destination pair; responsive size variants are not counted as additional originals.
- The local collection contains **198 JPEG files** (66 base images and 132 responsive derivatives), totaling **75,188,388 bytes**. All 66 Commons source SHA-1 values are unique; all local JPEG signatures, paths and recorded dimensions passed the asset audit.
- All **12/12 tours** meet the target of 6–10 source photographs. Each of the six same-destination pairs shares **1 of 6 images (16.7%)**, below the 25% ceiling. All six pairs have different cover photos.
- Source-page author, license and file metadata are recorded in the manifest. The local attribution register links each image to its Commons page and license. JPEG signature, response MIME, file size and local responsive variants were checked.
- Original cover ID, tour IDs, and booking guard were retained. The existing seed and API format deliver photo credits and responsive variants; the existing Angular tour card/detail gallery renders the expanded photo data.
- **Exact named itinerary coverage:** 8 of 12 tours have at least one specifically named stop in the schedule, and those named stops are represented by location-matched photos. Four Sa Pa and Phú Quốc itineraries describe broad experiences rather than named stops; their galleries contain verified destination-specific subjects but cannot be matched to a named scheduled landmark without inventing itinerary details.

## Gallery inventory and itinerary fit

“Exact” and “Context” below are per-photo relevance labels in the manifest. Named-stop coverage is assessed separately from those labels: a place may be verifiably in the destination while not appearing by name in the itinerary.

| Tour ID | Originals | Exact | Context | Cover | Named itinerary stop |
|---|---:|---:|---:|---|---|
| `demo-vn-tour-dalat-1` | 6 | 3 | 3 | Hồ Xuân Hương | Yes: Hồ Xuân Hương |
| `demo-vn-tour-dalat-2` | 6 | 5 | 1 | Trung tâm Đà Lạt và hồ Xuân Hương | Yes: hồ and central square |
| `demo-vn-tour-phu-yen-1` | 6 | 6 | 0 | Gành Đá Đĩa | Yes: Tuy Hòa, Gành Đá Đĩa, Vũng Rô |
| `demo-vn-tour-phu-yen-2` | 6 | 6 | 0 | Tuy Hòa coast | Yes: Tuy Hòa, Gành Đá Đĩa, Vũng Rô |
| `demo-vn-tour-da-nang-hoi-an-1` | 6 | 6 | 0 | Hội An old town | Yes: Hội An, Mỹ Khê, Sơn Trà |
| `demo-vn-tour-da-nang-hoi-an-2` | 6 | 6 | 0 | Mỹ Khê beach | Yes: itinerary locations represented |
| `demo-vn-tour-sa-pa-1` | 6 | 3 | 3 | Sa Pa rice terraces | Broad Sa Pa experiences; no landmark named |
| `demo-vn-tour-sa-pa-2` | 6 | 2 | 4 | Sa Pa rice terraces | Broad Sa Pa experiences; no landmark named |
| `demo-vn-tour-ninh-binh-1` | 6 | 5 | 1 | Tràng An | Yes: Tràng An and Tam Cốc |
| `demo-vn-tour-ninh-binh-2` | 6 | 6 | 0 | Tam Cốc | Yes: Tràng An and Tam Cốc |
| `demo-vn-tour-phu-quoc-1` | 6 | 2 | 4 | Bãi Sao | Broad coast, traditional work and ecology; no landmark named |
| `demo-vn-tour-phu-quoc-2` | 6 | 2 | 4 | Phú Quốc beach | Broad coast, local community and ecology; no landmark named |

Two Phú Yên tours include Gành Đá Đĩa and Vũng Rô among the mapped locations, with each tour’s Tuy Hòa beach image retained as a location match. The photo count is based on Commons source file identities, checked for uniqueness through source SHA-1 metadata; proportional 480/960/up-to-1600 px derivatives remain variants of the same source.

## Files and verification

- [Photo manifest](./photo-manifest.json) — 66 source records, SHA-1 and source URLs, author/license metadata, locations, relevance, alt text and responsive dimensions.
- [Attribution register](./attributions.md) — source page, author, license and local asset for each original.
- Local JPEG originals and variants: `my-app/public/image/greensteps/tours/`.
- Seed mapping consumes the expanded manifest; API and Angular photo attribution/srcset contracts were already present and remain in use.
- The frontend now overlays the checked-in V3 photo mapping for the twelve fixed demo IDs when it maps API results, so cards and details can show six V3 images even when a stored record still has the older gallery.
- Backend checks: 30 relevant tests passed, covering enrichment, download validation, API formatting/search, and booking guard behavior.
- Angular tour card/detail tests: **13 passed**.
- Angular production build completed successfully on 2026-11-12; output was generated under the local ignored `my-app/dist` directory.
- The full backend suite was not run; the relevant isolated backend tests ran without bootstrapping the app or database. `.env` was later read only after the user explicitly authorized a migration preflight.

## Limitations and safety

- Sa Pa and Phú Quốc schedules do not specify named landmarks. Their images are confirmed to depict the named destination or a specific place in it, but no additional stop is asserted.
- Follow-up runtime inspection found the API at `127.0.0.1:5055` still returns 3 photos for each of the 12 demo records. After authorization to read `.env`, a remote migration dry-run connected but stopped before reading tour rows because the configured database account does not have the required dedicated `readWrite` role on `GreenStepsData`. No database write was made. The local frontend build contains the V3 overlay; a refresh/restart of the local frontend is needed to load that build.
- A verified Commons license grants reuse under its terms; the register preserves the specific author credit and license link for each image.
- `.env` was read only after the user explicitly authorized it; it was not edited and no secret values were printed. A read-only migration preflight ran and failed its role check before reading or changing tour rows. No database write or production deployment occurred.
