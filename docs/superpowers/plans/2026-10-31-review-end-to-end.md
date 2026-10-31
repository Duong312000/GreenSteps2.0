# Review System End-to-End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete secure, persistent review and provider reply flows for completed tour and service bookings.

**Architecture:** Reuse `CommentPost` and its current junction collections, add a unique sparse booking key, and derive target ownership from authenticated account relationships. Keep the API/UI contracts consistent and derive displayed statistics from real review rows.

**Tech Stack:** Angular, Node.js/Express, MongoDB Native Driver through `MongoStore`, Node test runner, Vitest/Angular build.

**Spec:** `docs/superpowers/specs/2026-10-31-review-end-to-end-design.md`

## Global Constraints

- Do not delete or seed data in the configured MongoDB.
- Do not trust user/provider/vendor IDs or role claims sent in request bodies/query strings.
- Preserve legacy comments without `booking_id`; do not infer or assign a booking to them.
- Require an authenticated owner booking in `completed` state and enforce one review per booking.
- Do not represent mock/default ratings as real review statistics.

## Review Focus

- Concurrent review requests for the same booking: unique sparse index plus transaction; assert one persisted review.
- Legacy provider records with duplicate company names: owner resolution fails closed; assert no cross-provider data.
- Legacy comments with no booking link: remain readable but cannot be replied to by an unrelated provider; assert denied.
- Review target IDs from frontend fallback catalogs: reject if no matching persisted booking/target; assert no write.
- Missing, null, zero, >5, fractional, and nonnumeric ratings or blank text: reject; assert no write or aggregate change.

---

### Task 1: Review eligibility and identity validation

**Files:**
- Modify `backend/src/controllers/tour.controller.js`
- Modify `backend/src/controllers/service.controller.js`
- Modify `backend/src/routes/reviews.routes.js`
- Test `backend/test/reviews-controller.test.js`
- Modify gated Mongo integration coverage in `backend/test/integration.test.js`

**Interfaces:**
- `POST /reviews/tour` and `POST /reviews/service` receive `{ bookingId, tourId|serviceId, rating, text }`; authenticated user ID is from `req.user.id`.
- Both return a consistent review response with `bookingId`, type, target ID, rating, text, createdAt, and aggregate score/count.

- [ ] Write controller behavior tests for completed owned booking, wrong user/target/status, invalid rating/text, and already-reviewed booking; watch them fail.
- [ ] Add a booking lookup/eligibility helper that checks both booking models without trusting body identity.
- [ ] Add sparse unique `CommentPost.booking_id` index metadata and transaction-backed review + junction writes.
- [ ] Add gated Mongo test proving duplicate-key protection and rollback when junction creation fails.
- [ ] Run focused tests and backend suite.

### Task 2: Explicit provider ownership and unified review API

**Files:**
- Modify `backend/src/models/index.js`
- Modify `backend/src/controllers/partner.controller.js`
- Modify `backend/src/controllers/auth.controller.js`
- Modify `backend/src/controllers/reviews.controller.js`
- Modify `backend/src/routes/reviews.routes.js`
- Modify `my-app/src/app/services/api.service.ts`
- Test `backend/test/reviews-controller.test.js`
- Modify gated Mongo integration coverage in `backend/test/integration.test.js`

**Interfaces:**
- Provider review list is `GET /reviews/provider`; filters may include `rating`, `type`, `tourId`, `serviceId`, and `answered`, but ownership is always derived from `req.user`.
- Return review target, customer, rating, content, timestamps, booking identity/date, and persisted replies with author roles.

- [ ] Test service and tour ownership, cross-owner filters, forged provider IDs, traveler access, and ambiguous legacy company-name matches; watch failures.
- [ ] Add optional `Provider.user_id`, link new registration paths, and resolve old records by unique exact company-name match.
- [ ] Query owned tours through Provider/ScheduleSample/CPSS and services through Vender/GreenService/CPGS; never replace the owned-target restriction with a filter.
- [ ] Restrict review listing, reply, report, and internal notes to provider role and owned resource; keep admin policy explicit.
- [ ] Run focused tests and backend suite.

### Task 3: Persistent replies and accurate review aggregates

**Files:**
- Modify `backend/src/controllers/reviews.controller.js`
- Modify `backend/src/controllers/service.controller.js`
- Modify `backend/src/controllers/tour.controller.js`
- Modify `backend/src/models/index.js`
- Modify service/tour list and detail serializers only as required
- Modify `backend/test/reviews-controller.test.js`
- Modify gated Mongo integration coverage in `backend/test/integration.test.js`

**Interfaces:**
- Provider replies are one-per-root-review per owning provider, stored as child `CommentPost`; GET service and tour endpoints expose nested reply author/timestamp/text.
- Rating/count aggregates exclude replies and never mutate `bookings_count`.

- [ ] Test persistent replies, owner-only reply, duplicate provider reply rejection, customer read round-trip, and two ratings averaging 4.0; watch failures.
- [ ] Return a uniform nested reply shape from service and tour review reads.
- [ ] Recompute rating/count from root comments; repair the service hook so it preserves the booking counter.
- [ ] Add HTTP/database integration coverage for tour and service replies and aggregates.
- [ ] Run focused tests and backend suite.

### Task 4: Customer and provider UI integration; remove false statistics

**Files:**
- Modify `my-app/src/app/pages/tour-detail/tour-detail.ts` and `.html`
- Modify `my-app/src/app/pages/partner/partner-bookings/partner-bookings.ts` and `.html`
- Modify `my-app/src/app/pages/partner/partner-ads/partner-ads.ts` and `.html`
- Modify `my-app/src/app/services/api.service.ts` and `default-data.ts`
- Modify `my-app/src/app/pages/booking/booking.html` and `services/services.html`
- Add/update component and API service tests

**Interfaces:**
- Customer can select only an eligible completed booking for the current target; POST does not send `userId`.
- Provider tabs use the owner-derived list API and persisted reply operations; reload reads server state.
- No-review and API-error states show no fabricated rating or count.

- [ ] Add frontend tests for eligibility selection, request body, persisted reply state, and no-score empty/error states; watch failures.
- [ ] Wire booking history/eligibility to the review form for both types; display backend validation errors.
- [ ] Normalize provider review rendering for both tour/service and reuse persisted reply API in both provider pages.
- [ ] Remove review-score/count fallbacks and the API-list size thresholds that discard genuine API data; strip demo review stats from default catalog records.
- [ ] Run focused frontend tests and production build.

### Task 5: Whole-flow verification and report

**Files:**
- Review all files changed by Tasks 1–4
- Update integration tests as needed

- [ ] Run backend full suite and frontend tests/build.
- [ ] Run Mongo integration tests only if an isolated test URI is available; never target the configured application database.
- [ ] Review authorization, concurrency, old-record behavior, and truthful error/empty states.
- [ ] Record exact PASS/FAIL/NOT RUN/BLOCKED outcomes and manual end-to-end steps.

## Execution Notes

- Baseline backend suite: 36 passed, 1 Mongo integration test skipped because `TEST_MONGODB_URI` is unset.
- Baseline frontend build: passed with the existing initial bundle budget warning (~82 KB over budget).
- Workspace is on `main` and `.git` is read-only in this environment; do not create a commit or write Git metadata. Work in `D:\Web2` without replacing the user's existing files.
- Existing test command `npm.cmd test` must remain runnable without a MongoDB URI; gated integration tests must report skipped rather than touching the application DB.
