# GreenSteps wallet

The `/profile` deposit/withdraw/money-transfer UI now uses the isolated **Phase 1 simulation** described in [WALLET_PHASE1.md](WALLET_PHASE1.md), including its opt-in configuration and admin-only demo settlement. The manual bank reconciliation endpoints below remain for legacy callers; they are not used by the new demo popups. Demo money never changes the existing booking wallet balance.

The existing `backend` application and its `MONGODB_URI` / `MONGODB_COLLECTION_PREFIX` are reused. No secrets or balances are embedded in the UI. Start with `npm start`; the existing startup synchronizer creates the unique indexes, including a partial unique bank verification reference. MongoDB must support transactions (Atlas or a replica set).

## Money and verification

- All wallet and voucher routes require authentication. Identity comes from the signed session, never the request's user ID.
- Deposit requests are pending. They never credit a balance automatically, including on cloud hosts. Wallet activation does not grant money.
- Withdrawals reserve funds without changing the settled balance. Wallet booking payments exclude reserved funds. Approval deducts settled funds and releases the reservation; rejection only releases the reservation.
- An administrator must independently reconcile the actual bank payment/payout and enter its unique reference in the admin approval action. The reference and administrator ID are recorded atomically with the ledger and wallet balance. A reference cannot be reused. This is **manual bank reconciliation**, not a payment gateway or automatic bank verification. No gateway credentials were supplied or introduced.
- Saved bank methods contain display information and the last four digits only. They are unverified references. Card PAN/CVV and pretend credit cards are not stored or created; card tokenization requires a real payment provider.

## Points

- A completed booking earns `floor(net booking value / 10,000)` available points and the same number of lifetime tier points. The deterministic ledger ID `points:booking:<booking ID>` prevents duplicate awards.
- Completed community challenges also award both available and tier points, using their stored reward value. The deterministic ID `points:challenge:<entry ID>` and a MongoDB transaction prevent duplicate awards.
- Available points can be transferred or redeemed; neither action changes tier points. Recipients of transferred points receive no tier points.
- A minimum of 1,000 points can be converted into a single-use fixed-value voucher, at 1 point = 1 VND. The existing checkout now accepts the code. Voucher consumption and booking writes share a MongoDB transaction.
- Tiers: Explorer at 0, Voyager at 5,000, Guardian at 15,000 tier points. These are explicit business rules, separate from account data.
- On the first wallet overview after this update, a transaction reconciles historical completed bookings and community challenge entries into tier points. Existing booking/challenge ledger entries are skipped; `tier_history_synced` prevents repeated migration. Recovery entries use `points_tier_adjustment` and change tier points only. Existing available points are never credited again. Unknown legacy balances and transferred points do not qualify without an earned source record.
- Mutating point, deposit and withdrawal requests require an `Idempotency-Key` (8–100 characters). The UI preserves the key when retrying a failed form submission. Concurrent conflicting requests fail atomically with HTTP 409; they cannot overdraw a wallet or duplicate a ledger entry.

## UI and API

Open `/profile?section=wallet`. Header and sidebar stay in the existing profile shell; the wallet uses the existing mountain and 3D wallet assets. The screen refreshes after successful mutations and every 15 seconds while visible.

`GET /api/wallet/overview` returns the wallet, available balance, methods, membership, active vouchers and up to 100 recent transactions. `POST /points/transfer`, `/points/redeem`, `/deposit`, `/withdraw`, `/methods`, and `DELETE /methods/:id` operate beneath `/api/wallet`. Existing admin deposit/withdrawal approval routes now require `verificationReference`.

QR accepts `greensteps://points?email=<recipient>`. On browsers with BarcodeDetector, users can capture or select a QR image; otherwise they can paste the decoded payload. Reading a QR only fills a transfer proposal; the user must confirm the transfer separately.

## Validation

Use an isolated replica set database for tests; do not point tests at customer data:

```powershell
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27018/WalletTests?replicaSet=rs0'
node --test test/wallet-v2.integration.test.js
```

That test generates and removes its own database. It covers authorization, pending deposits, bank verification, duplicate requests, insufficient funds/points, withdrawal reservations, point transfers, voucher checkout, completion rewards, concurrent redemptions and rollback. Frontend checks: `npm run build`, `npx vitest run src/app/pages/profile/green-wallet.spec.ts`, and `node e2e/wallet.e2e.cjs` after building. The browser test uses explicit fixtures; it does not substitute for the MongoDB integration test.
