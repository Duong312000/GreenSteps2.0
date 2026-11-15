# GreenSteps tour enrichment v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all twelve demo tours data-complete and visually consistent with legacy detail pages without inventing commercial facts or touching production.

**Architecture:** Extend the current editorial seed with supported editorial fields; preserve generated identifiers and JSONB storage. Keep one API contract and one Angular detail page, with honest demo-specific unknown/empty states. Use only locally available photos whose attribution and license can be verified.

**Tech Stack:** Node.js, existing Mongo-compatible Sequelize models, Angular, TypeScript, Jasmine/Karma, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-12-greensteps-tour-enrichment-v2-design.md`; user brief supplied as attachment `Pasted text.txt`.

## Global Constraints

- Preserve all 12 demo IDs, destination slugs, 36 activity IDs, three-day durations, `catalog_status: demo`, and booking guard.
- Do not fabricate prices, ratings, reviews, suppliers, group capacities, inclusions, deposit rules, or emissions.
- Do not write to Atlas/production or deploy; do not touch booking/payment/wallet/customer collections.
- Keep existing GreenSteps design, legacy behavior, and dependencies.
- Only use authentic photos with verified source, rights, destination match, and attribution; report unmet coverage.

## Review Focus

- Legacy records without responsive-photo metadata still load their original cover (`tours.spec.ts`, `tour-detail.spec.ts`).
- Demo values never fall back to invented legacy defaults (`demo-tour-enrichment.test.js`, API format tests).
- Empty demo inclusions, policies, and reviews show honest states and no booking controls (`tour-detail.spec.ts`, booking guard tests).
- List and detail APIs agree on editorial, gallery, and itinerary fields (`tour-search.test.js`, `tour-controller-format.test.js`).
- All three days render the correct existing activity without ID changes (`demo-tour-enrichment.test.js`, `tour-detail.spec.ts`).

---

### Task 1: Audit current tour, image, and API data

**Files:**
- Modify: `docs/plans/greensteps-tour-photo-enrichment/audit.md`
- Read: demo seed/editorial, photo manifest/attributions, serializers, models, Angular models and templates, booking guard.

- [ ] Record each tour ID/slug/destination/title/activity IDs, photo count, image reuse, editorial field counts, and response behavior.
- [ ] Record root causes: detail template hides demo cards/highlights and two tabs; seed has generic style/shared responsibility copy/short descriptions; response formatters have separate shapes; capacity/intensity need explicit editorial semantics.
- [ ] Write audit with observed facts and distinguish verified facts from coverage gaps.

### Task 2: Add explicit editorial tour characteristics and API consistency

**Files:**
- Modify: `backend/src/data/demo-tour-editorial.js`, `backend/src/data/demo-tours.seed.js`, `backend/src/services/tour-search.service.js`, `backend/src/controllers/tour.controller.js`, `my-app/src/app/models/models.ts`, `my-app/src/app/services/api.service.ts`
- Test: `backend/test/demo-tour-enrichment.test.js`, `backend/test/tour-search.test.js`, `backend/test/tour-controller-format.test.js`, relevant Angular API specs.

- [ ] Add failing tests for style explanation, editorial intensity level/estimate marker, unknown capacity/emissions, responsible travel, practical notes, photo metadata, and full three-day data in list/detail shapes.
- [ ] Run focused tests and confirm expected failures.
- [ ] Add 4–6 itinerary-grounded highlights and destination/tour-specific responsible-travel copy; add concise 180–300 word introductions where sources/data support it.
- [ ] Set an existing-compatible style per tour; add qualitative `fitness_level` plus an explicit editorial-estimate marker/explanation. Keep `group_size` and `carbon` unknown (`null`/absent) for demos.
- [ ] Preserve all generated IDs, three days, relationships, catalog status, and booking protections.
- [ ] Return the same safe editorial fields from list and detail formatters and map them with strict Angular types.
- [ ] Run focused seed/API tests; verify metadata and generated assets.

### Task 3: Restore demo overview and truthful detail tabs

**Files:**
- Modify: `my-app/src/app/pages/tour-detail/tour-detail.ts`, `.html`, `.css`, `.spec.ts`; `my-app/src/app/pages/tours/tours.ts`, `.html`, `.css`, `.spec.ts`

- [ ] Add failing component tests for four demo overview cards, 4–6 highlights, the editorial estimate label, unknown values, all five tabs, and no fabricated inclusion/policy/review content.
- [ ] Run focused Angular tests and confirm expected failures.
- [ ] Render four cards for legacy and demo tours, using explicit unknown states and tour-specific explanations.
- [ ] Render highlights and responsible/practical sections for demos; remove repeated generic disclaimer text in favor of one compact notice.
- [ ] Show itinerary, inclusions, deposit, and reviews tabs for demos with proposed-day content and safe empty states; no demo payments or booking controls.
- [ ] Preserve the current gallery, carousel, src/srcset fallback fix, and responsive styles.
- [ ] Improve listing cards with mapped tour style and honest pricing status when data exists, retaining legacy behavior.
- [ ] Run focused Angular tests and build.

### Task 4: Verify photo coverage and add only validated assets

**Files:**
- Modify only if evidence supports it: `docs/plans/greensteps-tour-photo-enrichment/photo-manifest.json`, `attributions.md`, `backend/src/data/demo-tours.seed.js`, local photo assets.
- Create/update: `docs/plans/greensteps-tour-enrichment-v2/photo-quality-report.md`
- Test: `backend/test/demo-tour-enrichment.test.js`, local asset manifest checks.

- [ ] Calculate actual/unique images per tour, pairwise shared percentage, exact-landmark coverage, broken/missing files, and metadata completeness.
- [ ] Research image source pages and licenses; add/download photos only if every required attribution and location relationship is verified.
- [ ] If source/network/license verification blocks expansion, document exact coverage and preserve existing valid assets rather than substituting unrelated imagery.
- [ ] Verify every manifest path exists and each photo URL/license/credit is complete.

### Task 5: Keep migration safe and produce reports/evidence

**Files:**
- Review/update: `backend/src/services/demo-tour-enrichment-migration.service.js`, `backend/scripts/enrich-demo-tours.js` only if needed to map new fields safely.
- Create: `docs/plans/greensteps-tour-enrichment-v2/README.md`, `GREENSTEPS_TOUR_ENRICHMENT_V2_REPORT.md`, screenshots/before-after evidence if local server/browser is available.

- [ ] Add migration mapping coverage for new editorial fields and tests for dry-run, idempotency, conflicts, exact allowlist, and protected collections.
- [ ] Run only dry-run/preflight locally; do not invoke an Atlas apply command.
- [ ] Run focused and full requested backend/frontend suites, Angular build, static photo checks, and `git diff --check`.
- [ ] Capture local desktop/mobile screenshots if the app and browser are available; label fixture vs live API evidence accurately.
- [ ] Complete report with image counts/shared percentages/landmarks, fields and UI files changed, tests, dry-run status, Atlas untouched status, and remaining issues.

### Task 6: Final review

- [ ] Compare changed files against this plan and preserve unrelated workspace modifications.
- [ ] Verify all IDs, slugs, activity IDs, days, demo status, and booking restrictions from current source/tests.
- [ ] Report only freshly verified results and list blockers/limitations explicitly.
