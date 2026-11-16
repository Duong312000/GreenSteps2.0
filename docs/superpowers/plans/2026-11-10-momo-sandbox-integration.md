# MoMo Sandbox Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete a server-verified MoMo sandbox checkout for tour and service bookings, including guest checkout and confirmation status.

**Architecture:** Backend owns merchant credentials, signs and verifies provider messages, stores idempotent attempts, and settles only after verified IPN. Angular sends the booking capability when needed, redirects to MoMo, and reads server status on return.

**Tech Stack:** Node.js 20, Express, MongoDB-backed model store, Angular, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-10-momo-sandbox-integration-design.md`

## Global Constraints

- Sandbox endpoint is fixed to `https://test-payment.momo.vn/v2/gateway/api/create`.
- Never trust browser redirects or client payment amounts as proof of payment.
- Persist only a SHA-256 hash of guest payment capability.
- Never modify or disclose existing user changes, secrets, or unrelated work.
- No commit, push, reset, clean, or branch-reference changes.

## Review Focus

- Invalid provider signatures never settle a booking (signature tests).
- IPN amount/order/partner mismatch never changes state (IPN tests).
- Guest capability only authorizes its own booking (ownership tests).
- Duplicate and late callbacks are idempotent (callback tests).
- Unreachable localhost IPN configuration is reported as incomplete (readiness test).

### Task 1: Provider signatures and readiness

**Files:** Create `backend/src/services/momo-payment.service.js`; create `backend/test/momo-payment.test.js`; update `backend/.env.example`.

- [x] Test canonical HMAC, response/IPN signature verification, limits, and readiness.
- [x] Run focused tests and confirm expected failures.
- [x] Implement signing, constant-time verification, sandbox readiness and timeout-bound request transport.
- [x] Run focused tests.

### Task 2: Booking capability and payment attempts

**Files:** Modify `backend/src/models/index.js`, `backend/src/controllers/booking.controller.js`; create MoMo attempt model and payment controller/routes/tests as needed.

- [x] Test authenticated owner and guest-capability access, attempt reuse, amount source, and callback settlement.
- [x] Run focused tests and confirm expected failures.
- [x] Implement booking capability issuance, attempt persistence, create/status/IPN endpoints, signature checks, and idempotent settlement.
- [x] Run focused tests.

### Task 3: Checkout and confirmation

**Files:** Modify `my-app/src/app/services/api.service.ts` and `my-app/src/app/pages/booking/booking.ts`; add/update focused frontend tests.

- [x] Test capability header and payment status API behavior.
- [x] Confirm tests fail before implementation.
- [x] Implement session-only capability handling and confirmation polling.
- [x] Run focused frontend tests and build.

### Task 4: Configuration and full verification

**Files:** Configure local `backend/.env` without printing secrets; update documentation if needed.

- [x] Configure known credentials; leave public IPN URL pending HTTPS tunnel.
- [x] Run backend independent tests, frontend test/build, and inspect final diff/status.
- [x] Report remaining tunnel/IPN setup required for live sandbox payment.
