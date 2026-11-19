# GreenSteps Booking System Audit Plan

> **Execution:** Run inline in the existing isolated worktree; user requested direct implementation. Keep all changes uncommitted and do not push or deploy without fresh permission.

**Goal:** Make booking prices, persisted reservations, payment state, and user-facing history consistent across supported GreenSteps booking types.

**Architecture:** Backend catalog and pricing services remain authoritative. Booking creation persists an immutable pricing snapshot; payment creation and webhook processing reference that snapshot and verify ownership, amount, idempotency, and current payment status. Frontend screens render backend quotes or persisted bookings and never recalculate a second price for payment.

**Tech Stack:** Angular, Node.js/Express, MongoDB models/repositories, SePay, Vitest, Node test runner.

**Spec:** `C:/Users/lapto/.codex/attachments/f75a6ad8-85eb-421f-a169-5e5d59cdea9c/Pasted text.txt`

## Global Constraints

- Do not hardcode prices, create fake data, overwrite production data, or change financial policy without evidence.
- Do not trust frontend amounts or identifiers for authorization.
- Preserve existing bookings and keep legacy schema reads compatible.
- Do not perform real bank transactions, commit, push, or deploy.

## Review Focus

- Mixed `hotelId` and `tourId` must price only the selected tour.
- Cached tour data must not override the server quote.
- Deposit and VAT must follow configured product/service policy and not be applied twice.
- Refreshing payment or replaying a webhook must not create duplicate charges or mark an unpaid booking paid.
- Other users/partners must not access bookings outside their ownership.

## Tasks

### 1. Audit and reproduce

Trace Tour Detail → booking context → quote → booking persistence → payment/SePay → webhook → profile/partner/admin views. Record actual Mongo model fields, route middleware, price units, tax/deposit policies, and existing test coverage. Reproduce `SCHDL005` with the mixed hotel/tour query.

### 2. Backend pricing and booking integrity

Review and test per-person/group tour pricing, lodging per-night pricing, service/transport fares, child counts, add-ons, coupons, date/capacity checks, and legacy booking snapshots. Correct verified defects in the central pricing and booking services; add compatible snapshot fields only where absent.

### 3. Payment, SePay, and authorization

Trace QR generation and webhook authentication/idempotency. Test exact amount matching, duplicate/under/over payments, ownership, expired/revoked sessions, and status transitions. Preserve existing records and do not trigger real transfers/refunds.

### 4. Frontend quote and status consistency

Use the server quote on Tour Detail and Booking. Carry the created booking ID to Payment, fetch persisted pricing on refresh, and render the same snapshot and payment state in Profile, Partner, and Admin surfaces. Keep unsupported modules informational.

### 5. Verification and report

Run focused regression tests after each task, backend tests, Angular production build, and the available full suites. Report all failures, unresolved policy questions, schema/API changes, and deployment risks. Do not deploy or push.
