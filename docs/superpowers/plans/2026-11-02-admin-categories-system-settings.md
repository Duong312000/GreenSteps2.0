# Admin Categories and Booking Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Admin settings placeholder with MongoDB-backed service category and booking-pricing management, using server-calculated quotes and preserving existing booking history and effective prices.

**Architecture:** Add stable service-category records with idempotent legacy mapping, persistent versioned booking pricing settings, and audit records. One backend pricing service will calculate both quotes and bookings from current Mongo data; Angular will provide the settings page, extend the shared Admin modal for forms, and consume active categories in customer/provider service flows.

**Tech Stack:** Express 5, Node.js test runner, MongoStore/MongoDB transactions, Angular 21, RxJS, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-admin-categories-system-settings-design.md`

## Global Constraints

- Effective global discount, customer service fee, and deposit default to 0 to preserve current live booking prices; do not activate the unused 8%, 120,000 VND, or 30% constants implicitly.
- Preserve the existing per-voucher discount formula and provider settlement commission; the 10% provider commission is not a customer fee.
- Do not recompute any existing booking, including legacy bookings without `pricing_snapshot`.
- Only active categories are available for new customer/provider choices; archived categories remain readable in historical records and cannot be hard-deleted.
- Admin writes require `authMiddleware` and `checkRole(['admin'])`; config writes use optimistic versions and audit in the same transaction.
- Reuse `AccountDetailModalComponent`; do not change Admin shell, sidebar, header, or unrelated modules.
- No new dependencies.

## Review Focus

- A booking created from a stale quote must return a fresh price and require renewed customer confirmation; test `createBooking_rejectsStaleQuoteWithFreshQuote`.
- A concurrent Admin save must not overwrite a newer config version; test `updatePricing_returnsConflictWhenExpectedVersionIsStale`.
- Category migration must be repeatable, preserve every distinct legacy label, and count each service once; test `migration_isIdempotentAndCountsEachServiceOnce`.
- A legacy booking without a snapshot must retain its stored value and stay snapshot-less on reads; test `legacyBookingRead_doesNotRepriceOrBackfillSnapshot`.
- An audit write failure must not leave a successful config mutation without its matching audit; test `updatePricing_rollsBackConfigWhenAuditInsertFails`.

---

## File Map

- `backend/src/models/index.js` — define service category, booking settings, audit, and quote/idempotency fields.
- `backend/src/services/service-category.service.js` — legacy category discovery/migration and unique reference counts.
- `backend/src/services/booking-pricing.service.js` — effective runtime settings and the shared server-side pricing calculation.
- `backend/server.js` — run the idempotent category migration after Mongo sync and preserve current add-on seeding.
- `backend/src/controllers/admin-settings.controller.js` / `backend/src/routes/admin-settings.routes.js` — admin category/settings/add-on/audit endpoints.
- `backend/src/controllers/service.controller.js` / `backend/src/routes/service.routes.js` / `backend/src/routes/index.js` — active public category API, validated category linkage, and mounted settings routes.
- `backend/src/controllers/booking.controller.js` / `backend/src/routes/booking.routes.js` — quote endpoint, stale quote handling, and shared pricing in booking creation.
- `backend/test/service-category-migration.test.js`, `backend/test/admin-settings-controller.test.js`, `backend/test/booking-pricing.test.js`, `backend/test/booking-controller.test.js` — migrations, authorization, persistence/version/audit, pricing, and booking snapshots.
- `my-app/src/app/services/api.service.ts` — category and Admin settings API methods.
- `my-app/src/app/pages/admin/admin.ts` / `admin.html` — route the existing settings section to the new module without changing the shell.
- `my-app/src/app/app-module.ts` — import the standalone settings component into the existing Admin module.
- `my-app/src/app/pages/admin/admin-settings.component.ts/html/css` — two-tab settings page, validation, loading/error states, configuration history.
- `my-app/src/app/pages/admin/account-detail-modal.component.ts/html/css` — generic settings form variant and field types needed by category/add-on forms.
- `my-app/src/app/pages/services/services.ts/html` — load active categories and filter listed services by the secondary category.
- `my-app/src/app/pages/partner/partner-services/partner-services.ts/html` — load and submit selected active category IDs.
- `my-app/src/app/pages/booking/booking.ts/html` — fetch quote, show changed-price confirmation, submit only after acceptance.
- Corresponding `*.spec.ts` files — API, modal, Admin settings, and category consumer behavior.

## Task 1: Category records and safe legacy migration

**Files:**
- Modify: `backend/src/models/index.js`
- Create: `backend/src/services/service-category.service.js`
- Modify: `backend/server.js`
- Test: `backend/test/service-category-migration.test.js`

**Interfaces:**
- Produces `ensureServiceCategories()` for one-time/idempotent legacy import and `countServicesByCategory()` returning counts keyed by category ID.
- `ServiceCategory` has a stable string `id`, `name`, `active`, `sort_order`, optional `icon`, and timestamps. `GreenService` gets `category_id`; retain `current_data.category` for legacy/historical display.

- [ ] **Step 1: Write failing migration tests** for stable IDs, preserving distinct category spellings, assigning missing `category_id` without rewriting legacy name, repeat-run no-op behavior, and one-count-per-service when both fields exist.
- [ ] **Step 2: Run `node --test test/service-category-migration.test.js` from `backend/`** and confirm the new imports/functions fail for the expected missing implementation.
- [ ] **Step 3: Implement model fields and migration/count helpers.** Derive deterministic collision-safe IDs; use a Set of service IDs for counts; do not touch booking collections.
- [ ] **Step 4: Re-run `node --test test/service-category-migration.test.js`** and confirm all migration and count assertions pass.

## Task 2: Runtime pricing configuration and shared pricing service

**Files:**
- Modify: `backend/src/models/index.js`, `backend/src/services/booking-pricing.service.js`, `backend/src/config/booking-pricing.config.js`
- Test: `backend/test/booking-pricing.test.js`

**Interfaces:**
- Add `BookingSetting` record `id='booking_pricing'`, fields `discount_percent`, `service_fee_vnd`, `service_fee_per_guest`, `deposit_percent`, `collect_deposit_for`, `version`, `updated_at`, `updated_by`.
- Export `createBookingPricingService({ BookingSetting, BookingAddon, GreenService, Schedule, ScheduleSample, ScheduleActivity, Voucher })`, plus default-instance `getBookingPricingSettings()` and `calculatePricing({ type, targetId, guestCount, addonIds, paymentMethod, voucherCode, userId })`.
- Calculation returns a snapshot with base subtotal, voucher/global discounts, add-ons, service fee, total, deposit, remaining, amount due, config version, and price fingerprint.
- Formula: apply global discount to base tour/service/itinerary subtotal; apply valid voucher to the remaining base; add-ons and service fee are not discounted; compute deposit on the resulting total. Round percentage reductions down to whole VND.

- [ ] **Step 1: Write failing unit tests** for current live-price defaults (global discount/fee/deposit all 0), service price times guests, shared/per-guest itinerary activities, valid voucher discount, add-on prices from Mongo, integer-VND validation, and deposit only when explicitly configured.
- [ ] **Step 2: Run `node --test test/booking-pricing.test.js` from `backend/`** and confirm failures identify the missing runtime setting reader and expected legacy-preserving defaults.
- [ ] **Step 3: Implement runtime settings bootstrap and pricing calculation.** Never seed effective settings from the currently unused 8%/120,000/30% constants; preserve voucher discount behavior and exclude provider commission from customer pricing.
- [ ] **Step 4: Re-run `node --test test/booking-pricing.test.js`** and confirm all pricing cases pass.

## Task 3: Admin categories, settings, add-ons, versioning, and audit APIs

**Files:**
- Create: `backend/src/controllers/admin-settings.controller.js`, `backend/src/routes/admin-settings.routes.js`
- Modify: `backend/src/routes/index.js`, `backend/src/models/index.js`
- Test: `backend/test/admin-settings-controller.test.js`

**Interfaces:**
- Routes under `/api/admin/settings`: category list/create/update/archive; booking config read/update; add-on list/create/update; paginated audit read.
- `PATCH /booking/pricing` requires `expectedVersion`; success increments version, stale version returns 409 with latest settings.
- Every mutation writes exact before/after, actor ID, server timestamp, target/action, and resulting version in `AdminConfigAuditLog` in the same Mongo transaction.

- [ ] **Step 1: Write failing controller tests** for unauthenticated/non-admin rejection, category CRUD and archive constraints, pricing validation, version conflict, add-on persistence, audit actor/time/before/after, and rollback when audit insertion fails.
- [ ] **Step 2: Run `node --test test/admin-settings-controller.test.js` from `backend/`** and verify expected authorization/persistence failures.
- [ ] **Step 3: Implement models, admin-only routes and transactional controllers.** Category archive is blocked while active services refer to it; no hard-delete endpoint is added.
- [ ] **Step 4: Re-run `node --test test/admin-settings-controller.test.js`** and confirm all authorization, conflict, persistence and audit assertions pass.

## Task 4: Quote-to-booking consistency and immutable snapshots

**Files:**
- Modify: `backend/src/controllers/booking.controller.js`, `backend/src/routes/booking.routes.js`, `backend/src/models/index.js`
- Test: `backend/test/booking-controller.test.js`, `backend/test/integration.test.js`

**Interfaces:**
- Export `quoteBooking`; `/bookings/quote` and `createBooking` both call `calculatePricing()`.
- Quote returns server-calculated snapshot, `configVersion`, and `priceFingerprint`.
- Create recomputes price from Mongo data. A mismatch returns 409 `{ code: 'PRICING_CHANGED', pricing: freshQuote }`; frontend must obtain customer acceptance and resubmit the fresh quote data.
- Successful new bookings store `pricing_snapshot` and category/name/order snapshots; `value` remains the actual amount due now. Existing rows are never backfilled or repriced.
- Honor the existing `Idempotency-Key` model fields: same key and same request replays the same booking; same key with different request returns 409.

- [ ] **Step 1: Write failing tests** for quote endpoint registration, server ignores client-supplied totals, quote/create use identical service, stale config/source price returns 409 with fresh pricing, accepted fresh quote persists snapshot, legacy read does not backfill, and idempotent replay/conflict.
- [ ] **Step 2: Run `node --test test/booking-controller.test.js` from `backend/`** and verify each failure matches the absent quote/create behavior.
- [ ] **Step 3: Wire the shared pricing service into quote and create paths.** Keep existing capacity checks, voucher ownership/usage, wallet transaction, notifications, email and unrelated provider behavior intact; apply effective zero-fee/full-payment defaults unless Admin configured otherwise.
- [ ] **Step 4: Re-run `node --test test/booking-controller.test.js`**; then run `node --test test/booking-pricing.test.js test/booking-controller.test.js` and confirm both pass.

## Task 5: Shared modal and Admin settings UI

**Files:**
- Modify: `my-app/src/app/app-module.ts`, `my-app/src/app/pages/admin/account-detail-modal.component.ts/html/css`, `my-app/src/app/pages/admin/admin.ts/html`, `my-app/src/app/services/api.service.ts`
- Create: `my-app/src/app/pages/admin/admin-settings.component.ts/html/css`
- Test: `my-app/src/app/pages/admin/admin.spec.ts`, new `admin-settings.component.spec.ts`, and `api.service.spec.ts`

**Interfaces:**
- `AdminSettingsComponent` owns categories/pricing/add-ons/history state and calls ApiService; it is rendered only when `activeSection === 'settings'`.
- Extend shared modal with a settings variant, numeric/select/checkbox fields, generic title/subtitle, and create/edit/save events; preserve existing user/provider modal behavior.
- Pricing save sends `expectedVersion`; on 409 the UI reloads latest values and explains that another Admin changed the config.

- [ ] **Step 1: Write failing frontend tests** for settings section routing, load/error/empty states, version conflict display, history loading, shared modal settings variant and numeric/select/checkbox inputs.
- [ ] **Step 2: Run targeted Vitest tests** from `my-app/` and confirm failures are the missing settings module/modal variant.
- [ ] **Step 3: Implement Admin settings component, API methods and shared modal extension.** Reuse the existing Admin styles and modal shell; add categories/add-on forms with a required audit reason.
- [ ] **Step 4: Re-run targeted Vitest tests** and confirm settings behaviors pass without breaking current account modal tests.

## Task 6: System-wide active categories and customer price confirmation

**Files:**
- Modify: `backend/src/controllers/service.controller.js`, `backend/src/routes/service.routes.js`, `my-app/src/app/services/api.service.ts`, `my-app/src/app/pages/services/services.ts/html`, `my-app/src/app/pages/partner/partner-services/partner-services.ts/html`, `my-app/src/app/pages/booking/booking.ts/html`
- Test: `backend/test/service-category-migration.test.js`, `my-app/src/app/pages/services/services.spec.ts`, `my-app/src/app/pages/partner/partner-services/partner-services.spec.ts`, `my-app/src/app/pages/booking/booking.spec.ts`

**Interfaces:**
- `GET /api/services/categories` returns active categories for customer/provider choices; Admin endpoint returns active and archived categories with unique reference counts.
- Keep route-level `serviceType` navigation separate from the managed secondary category.
- Booking UI accepts a quote fingerprint/version and, on `PRICING_CHANGED`, displays the full revised total/deposit/line items and requires a fresh explicit confirmation before retry.

- [ ] **Step 1: Write failing tests** for active-category-only customer/provider choices, archived category labels retained for old service cards, selected category ID in provider create/update payload, and customer confirmation on changed quote.
- [ ] **Step 2: Run the targeted backend/frontend tests** and confirm expected category/quote behavior is missing.
- [ ] **Step 3: Implement public category read and update customer/provider forms and booking confirmation flow.** Preserve existing route-level category tabs and booking draft behavior.
- [ ] **Step 4: Re-run targeted tests** and confirm category propagation and price reconfirmation pass.

## Task 7: Full verification and regression review

**Files:** all files above.

- [ ] Run the complete backend suite with `npm test` from `backend/`; record any Mongo-dependent tests that are skipped due environment.
- [ ] Run all changed frontend specs with `npx vitest run` from `my-app/`.
- [ ] Run `npm run build` from `my-app/` and inspect the full result, including any bundle-budget warning.
- [ ] Run `git diff --check` and review the final diff against the spec; verify unrelated pre-existing workspace edits remain untouched and unstaged.

## Self-review

- Spec coverage: Tasks 1–2 cover category/config persistence, actual formula and migrations; Task 3 covers admin authorization, optimistic locking and audit; Task 4 covers price freshness and immutable booking snapshots; Tasks 5–6 cover shared modal, UI history, responsive settings, category consumers and customer reconfirmation; Task 7 verifies regression and scope.
- Review Focus tests are assigned to Tasks 1–4 as named above.
- Pricing contracts use one server calculation function and one persisted version contract from quote through create.
- Existing provider 10% settlement calculation and all legacy booking money fields remain outside migration/repricing.
