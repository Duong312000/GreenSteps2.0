# Booking System Audit Ledger

Base: `7b25dde` (`origin/main` at task start). Worktree: `D:\Web2-main-push`, branch `codex/account-security-main`.

## Decisions and evidence

- Ruling: Treat backend catalog pricing as authoritative; the observed `SCHDL005` quote is VND 1,580,000 total / VND 474,000 due now (30%) for two guests, matching Tour Detail and Payment. The old VND 669,600 / 200,880 Booking figure was calculated from stale client catalog data plus an unsupported 8% VAT. No evidence supports changing the catalog price or deposit policy to force VND 200,880.
- Ruling: Ignore `hotelId` when `serviceId` is absent and `tourId` is present. Booking context may retain the legacy field, but tour quote/creation chooses `tourId` and type `tour`; verify no room pricing runs.
- No manual production data edit, real payment, push, or deployment. The full backend test command includes a Mongo integration fixture that creates and cleans up tagged rows; because a dedicated `TEST_MONGODB_URI` is absent, database test isolation cannot be certified.

## Progress

- [x] Read requested audit scope and repository state.
- [x] Reproduce stale Booking vs live server quote with a failing frontend regression test.
- [x] Load server quote before the initial booking screen and refresh it on entering payment; targeted regression passes.
- [x] Trace backend tour/service quote and remove unsupported frontend VAT and fallback amounts.
- [x] Route all supported booking create methods through the server quote and persist the quote snapshot; reject missing/past booking dates; check tour capacity before creating a booking.
- [x] Remove fake hotel/room identifiers from tour booking context and sanitize legacy drafts.
- [x] Review SePay checkout/IPN path: checkout uses persisted due-now amount; IPN checks secret, VND, exact amount, transaction reuse and pending state before settling.
- [x] Remove invented tour/service price, promotion, policy, highlight, environmental and rating defaults where reviewed.
- [x] Add focused pricing, quote source, fake-amount, and SePay rejection tests.
- [ ] Complete product policy audit for group/child pricing, tax inclusion, discounts/coupons, date-based prices, and capacity race behavior; current source has no verified child-specific rate or VAT policy.
- [ ] Complete lifecycle audit of cancellation/refunds and admin/partner/profile/email projections; cancellation rules still contain financial policy values that need a verified policy source.
- [ ] Run isolated MongoDB integration tests and browser-level UI flow against a disposable test database; `TEST_MONGODB_URI` is not configured.

## Current verification

- `node --test --test-force-exit test/booking-pricing.test.js test/tour-controller-format.test.js test/booking-controller.test.js test/sepay-payment-controller.test.js test/lodging-pricing.test.js`: pass, 17/17.
- `npx vitest run src/app/pages/tour-detail/tour-detail.booking.spec.ts src/app/pages/booking/booking.transport.spec.ts`: pass, 21/21.
- `npm run build` in `my-app`: pass.
- Full backend suite: failed with unrelated/integration mismatches, including the Flash Sale integration expecting an admin fee that was absent from its connected test store (actual quote VND 70,000 vs expected VND 190,000), and catalog/tour-search test failures. Isolated MongoDB integration suite is not safe to certify without a disposable `TEST_MONGODB_URI`.
- `git diff --check`: pass. Changes remain uncommitted; no push or deployment.
