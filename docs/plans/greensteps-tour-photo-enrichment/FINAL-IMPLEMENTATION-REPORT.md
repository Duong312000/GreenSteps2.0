# GreenSteps tour photo and content enrichment

## Delivered

- Enriched the existing 12 demo tours while preserving their IDs, destination slugs, three-day duration, and linked activity IDs. Each tour now has destination-specific Vietnamese editorial copy, highlights, a proposed itinerary with three activities, practical notes, and responsible-travel guidance.
- Added 18 verified Wikimedia Commons photographs, three per destination, shared across the two tours for that destination. There are 54 self-hosted JPEG files including proportional 480 px, 960 px, and source-size variants (10.7 MB total). No AI-generated or synthetic images were used; images were not cropped.
- Added machine-readable provenance and a human-readable attribution register with file pages, author credits, licenses, captions, alt text, tour mappings, verification dates, and derivative notes. The detail gallery presents the selected image's credit and license links.
- Added responsive `srcset` usage, explicit image dimaensions, lazy-loaded card and thumbnail images, a detail hero gallery and lightbox, and verified-image fallback behavior.
- Demo tours remain explicitly `demo` and non-bookable. Prices, discounts, reviews, ratings, seats/group sizes, supplier claims, and CO₂ data are not presented as verified. The list and detail response formatters suppress stray commercial or carbon fields on editorial records, and the existing quote/booking guard remains covered.
- Added a separate allowlisted, transactional migration. It is dry-run by default, preflights exact legacy seed state, stops on conflicts, writes only the 12 schedules and 36 linked activities plus audit records, and supports idempotent retry. It was not run against Atlas.

## Audit and photo records

- [12-tour seed audit](audit.md)
- [Photo manifest](photo-manifest.json)
- [Photo credits and licenses](attributions.md)
- [Editorial fact sources](sources.md)
- [Migration script](../../../backend/scripts/enrich-demo-tours.js)
- [Migration safety service](../../../backend/src/services/demo-tour-enrichment-migration.service.js)

## Screenshots

Screenshots were captured locally in Microsoft Edge using checked-in tour fixtures; no database was connected. The listing page used intercepted fixture API responses. The detail page was hydrated with the checked-in tour fixture in the Angular component because no API server was available, so these images verify presentation rather than live API connectivity. Listing captures cover desktop, tablet, and mobile, and detail captures cover desktop and mobile. The original before-state had no checked-in screenshot, so no historical before image is claimed.

- [Tour cards — desktop](screenshots/tours-desktop.png)
- [Tour cards — tablet](screenshots/tours-tablet.png)
- [Tour cards — mobile](screenshots/tours-mobile.png)
- [Sa Pa detail — desktop](screenshots/tour-detail-desktop.png)
- [Sa Pa detail — mobile](screenshots/tour-detail-mobile.png)

## Verification

- Backend focused tests: **22/22 passed**, including the seed/photo manifest, all local assets and variants, migration dry-run/apply/conflict/idempotency, list/detail response fields, and the non-bookable guard.
- Angular unit tests: **135/135 passed** across 42 spec files.
- Angular production build: **passed** (`npm.cmd run build`).
- Local Edge fixture screenshots were captured at 1440 px, 768 px, and 390 px widths. This is visual inspection against fixture data, not an Atlas or live API test.
- Atlas connectivity and current database contents were not verified. The audit accurately labels its source as the checked-in legacy seed baseline.
- No production write or deployment occurred.

## Task-specific implementation files

- Backend: `backend/src/data/demo-tours.seed.js`, `backend/src/data/demo-tour-editorial.js`, `backend/src/data/demo-tours-legacy.seed.js`, `backend/src/services/demo-tour-enrichment-migration.service.js`, `backend/src/services/tour-search.service.js`, `backend/src/controllers/tour.controller.js`, `backend/src/models/index.js`, and `backend/scripts/enrich-demo-tours.js`.
- Frontend: `my-app/src/app/models/models.ts`, `my-app/src/app/services/api.service.ts`, `my-app/src/app/pages/tours/tours.ts`, `tours.html`, `my-app/src/app/pages/tour-detail/tour-detail.ts`, and `tour-detail.html`.
- Tests: `backend/test/demo-tour-enrichment.test.js`, `demo-tour-enrichment-migration.test.js`, `tour-search.test.js`, `tour-controller-format.test.js`, `tour-bookability.test.js`; `my-app/src/app/services/api.service.spec.ts` and `my-app/src/app/pages/tour-detail/tour-detail.spec.ts`.
- Assets: `my-app/public/image/greensteps/tours/`.
