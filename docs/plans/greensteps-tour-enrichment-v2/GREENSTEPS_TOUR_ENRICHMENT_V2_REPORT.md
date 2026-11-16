# GreenSteps tour enrichment v2 report

## Delivered locally

- Added 12 tour-specific Vietnamese introductions of 234–258 words, four itinerary-based highlights per tour, distinct responsible-travel guidance, style explanations, and qualitative activity estimates with explanations.
- Preserved all demo tour identifiers, slugs, destinations, three-day durations, 36 activity IDs, and `catalog_status: demo`.
- Added `style_explanation`, `fitness_is_estimate`, and `fitness_explanation` to the Schedule model and to the allowlisted enrichment mapping. Demo group size and emissions remain unknown; serializers continue omitting commercial and measured-emissions values.
- Tour list and detail API responses carry the editorial characteristics. Angular mapping retains the estimates without applying legacy group/capacity/intensity defaults to demos.
- Restored the four overview cards and highlights for demo pages; made overview style, group-size, intensity, and emissions labels truthful. Demo detail pages now expose all five tabs and display explicit unknown states for inclusions and deposits. The demo review form is hidden; any displayed review data remains driven by actual API records.
- Made listing style/highlight copy use tour-specific values and selected a different cover for each of the six same-destination pairs.
- Added per-tour image relevance explanations to all 18 manifest records and surfaced them with existing credits in the gallery/lightbox.
- Preserved the previously fixed optional `srcset` bindings and existing booking guards.

## Photography

- Distinct licensed local source photos: **18**.
- Photos per tour: **3**; unique within a tour: **3**.
- Within each related pair: **3/3 shared (100%)**.
- Exact itinerary coverage ranges from 0 to 3 images per tour. See [photo-quality-report.md](photo-quality-report.md) for each tour's landmark coverage and missing image needs.
- No new binary was added: Wikimedia Commons API access failed from the development shell. Candidate source pages and the limitation are documented in the photo report. Do not claim the six-photo target is met.

## Audit and migration

- Root-cause and baseline data audit: [audit.md](audit.md).
- New migration mapping writes the editorial characteristic fields and uses seed version 3 with a distinct audit key. Its preflight accepts an exact legacy-v1 or enriched-v2 baseline, verifies all linked activity records, and stops on drift.
- No Atlas apply command or production write was run. The configured database-scoped `readWrite` role gate remains in force. The migration was not run against a live database; local dry-run fixtures verify the v2 transition as 12 schedule changes and 36 unchanged activities.
- No credentials or `.env` files were read or changed for this task. No deployment occurred.

## UI evidence and limitations

- Angular component tests verify four cards, all demo tabs, and unknown inclusion/deposit states.
- Captured updated UI screenshots using a deterministic checked-in seed fixture with all `/api/**` requests intercepted; these demonstrate local rendering and do not imply a live API or database check: [desktop detail](screenshots/sa-pa-detail-desktop.png), [mobile hero](screenshots/sa-pa-detail-mobile.png), [mobile overview](screenshots/sa-pa-detail-mobile-overview.png).
- Prior screenshots in `../greensteps-tour-photo-enrichment/screenshots/` depict the earlier implementation and are not presented as v2 before/after screenshots.
- The requested six-to-ten-photo galleries and <=25% pairwise sharing remain unmet; the coverage report distinguishes exact stops from destination-only context.

## Verification

- Backend suite: **311 passed, 0 failed, 8 skipped**. The skipped tests require a disposable loopback MongoDB on port 27019 (`TEST_MONGODB_URI`).
- Demo enrichment migration suite: **5 passed, 0 failed**, including the exact v2 baseline preflight and drift rejection fixtures.
- Angular suite and production build passed in the preceding verification run; no Angular application code changed during this continuation.
- `git diff --check` passed. Git reported only existing LF-to-CRLF normalization warnings.
