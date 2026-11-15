# GreenSteps demo tour photography and content enrichment plan

## Goal and constraints

Enrich the twelve checked-in `catalog_status: demo` tours with researched Vietnamese editorial copy and real, traceable destination photography. Keep IDs, slugs derived from existing IDs, activity IDs, existing API contracts, and the non-bookable guard. Keep price, reviews, supplier, capacity, and carbon unverified. Do not connect to or write Atlas; provide an opt-in, dry-run-first migration for later review.

## Existing implementation

- `backend/src/data/demo-tours.seed.js` generates exactly twelve schedules and thirty-six activity records from six destination groups.
- `backend/src/services/national-catalog-seed.service.js` is insert-only. Existing records are preserved, so an additive, conflict-detecting migration is needed for already-seeded Atlas data.
- `backend/src/controllers/tour.controller.js` and `backend/src/services/tour-search.service.js` expose tour photos and descriptions, but not photo credits consistently.
- `my-app/src/app/services/api.service.ts` maps both list and detail data. Demo covers currently become a placeholder unless `coverMediaVerified` is true.
- `my-app/src/app/pages/tour-detail/tour-detail.ts/html` already have gallery/lightbox behavior. Tour cards are in `tours.html`.
- `assertTourBookable` blocks demo tours. Preserve this unchanged.

## Approaches

1. Put image URLs in the UI only: low backend impact, but APIs, seed/migration, and attribution become inconsistent.
2. Store local image paths and a per-tour photo-credit manifest in the seed; return the same fields from list/detail APIs; add a guarded UI path for local licensed demo media. Recommended because the data remains traceable, portable, and backward compatible.
3. Register every image in the existing media-asset subsystem: offers stronger centralized rights administration, but requires media records and a separate registration lifecycle beyond this demo enrichment.

Use approach 2. Sources must be independently checked and each photo matched to a destination or documented itinerary stop. No asset with unclear reuse terms is included.

## Implementation sequence

1. Complete the audit report from checked-in seed/fixtures, including all IDs, titles, destinations, actual itinerary labels, existing image state, and verification gaps.
2. Research and license-check suitable Commons (or similarly documented) photographs; create a machine-readable manifest and human-readable attribution record. Download only approved photos and optimize to local supported derivatives.
3. Add destination-specific Vietnamese editorial fields and explicit proposed-itinerary labels in version-controlled seed data without changing IDs, commercial values, carbon values, or demo status.
4. Add a dry-run-by-default, explicit-apply migration with an exact 12-ID allowlist, per-record conflict checks, before/after diff and audit entries. Do not run it against Atlas.
5. Return photo fields and credits consistently through list/detail API responses and map them in the Angular model/service.
6. Update tour cards and detail gallery for local images, captions/credits, missing-image fallback, price status, demo status, unverified carbon, and responsive accessible interactions.
7. Add focused tests for inventory/mapping, attribution completeness, file existence/duplication, API consistency, no invented commerce/carbon/reviews, migration idempotency/conflicts, and booking safety.
8. Run requested local backend/frontend tests and builds, capture desktop/mobile screenshots if browser tooling and a local app fixture are available, and document exactly what was and was not verified.

## Files expected to change

- `backend/src/data/demo-tours.seed.js`
- focused seed/migration services and scripts under `backend/src/services` and `backend/scripts`
- focused tests under `backend/test`
- `my-app/src/app/models/models.ts`, `services/api.service.ts`, and tour list/detail templates/styles/logic/specs
- local tour photo derivatives under `my-app/public/image/greensteps/tours/`
- photo manifest, attribution, audit report, and final implementation report under `docs/plans/greensteps-tour-photo-enrichment/`

## Acceptance and safety

All twelve tours are inventoried; local UI images are real, source-linked, licensed, and location-matched; APIs carry gallery and attribution metadata; IDs remain stable; missing commercial and emissions data stay absent; demo bookings remain blocked. Atlas and production remain untouched. Atlas migration behavior can only be described as prepared, not executed.
