# MoMo sandbox checkout integration

## Intent

Make the existing MoMo option in booking checkout complete a server-verified sandbox payment. A customer should be able to create a booking, pay through MoMo, return to the booking confirmation page, and see the server-confirmed result. Preserve guest checkout, booking ownership, and the existing non-MoMo payment flows.

## Current state

- The Angular checkout calls `GET /payments/momo/config` and `POST /payments/momo/create`.
- The backend has no MoMo payment routes or provider service.
- Booking payment method enums do not include `momo`.
- No MoMo environment variables are documented or configured in `backend/.env`.
- The existing booking detail endpoint requires authentication, while checkout supports guests.
- Redirect query parameters cannot be trusted as proof of payment; MoMo requires signed IPN validation.

## Goals

- Implement the MoMo wallet sandbox flow using the server-side `captureWallet` create API.
- Keep Partner Code, Access Key, and Secret Key in backend environment variables only.
- Verify MoMo create responses and IPN signatures, and match partner/order/request/amount against persisted payment attempts.
- Make payment creation and IPN handling idempotent; only a verified callback can mark a booking paid.
- Preserve guest checkout with a random, single-purpose payment capability. Persist only its hash, keep the raw capability in the browser session, and use it only to start or check that booking's payment.
- Return users to the existing booking confirmation route and display the backend's current payment status.
- Keep the integration sandbox-only; no production endpoint or real-money mode.

## Non-goals

- MoMo refunds, recurring/token payments, production onboarding, or transportation checkout.
- Treating the browser redirect as a payment confirmation.
- Changing pricing policy or accepting a client-supplied payment amount.

## Approaches considered

1. **Backend-owned sandbox flow (recommended):** backend signs requests, persists payment attempts, validates IPN, and updates bookings; frontend only redirects and displays server status. This protects credentials and supports reliable settlement.
2. **Frontend-to-MoMo requests:** simpler wiring, but exposes merchant credentials and cannot securely verify settlement; rejected.
3. **Hide MoMo until later:** lowest implementation cost but does not meet the requested integration; retained only as a possible rollback if credentials or callback hosting are unavailable.

## Proposed design

### Configuration and routes

- Add `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, and `MOMO_IPN_URL` to backend configuration and `.env.example`. `MOMO_IPN_URL` must be an externally reachable HTTPS endpoint for local sandbox testing. Use the existing `CLIENT_URL` for the redirect origin and append the booking confirmation path and booking ID.
- Pin the provider URL to `https://test-payment.momo.vn/v2/gateway/api/create`; do not provide a production endpoint override.
- Add a public readiness endpoint that returns only `configured`, `environment: "sandbox"`, and missing variable names.
- Add payment creation and status endpoints. Both accept an authenticated booking owner or the booking's guest capability. The IPN endpoint is unauthenticated at the HTTP layer but validates the signature and persisted attempt data before any state change.

### Booking access and payment attempts

- Add `momo` to service and tour booking payment method enums.
- For a MoMo checkout, generate a cryptographically random payment capability. Store only its SHA-256 hash on the booking and return the raw value once with the booking creation response. Do not expose the hash in booking API responses. The frontend keeps the raw capability in `sessionStorage`, keyed by booking ID, for payment creation and confirmation polling. Issue it only when the booking is initially created with MoMo selected; switching an existing guest booking to MoMo later is out of scope.
- Persist each MoMo attempt separately with unique `orderId` and `requestId`, booking ID, server-computed amount, and provider status/transaction ID. Reuse a pending attempt on retries; after a definitive failed result, a later retry may create a new attempt.
- Derive amount only from the persisted `booking.value`, which current booking creation computes server-side as the amount due now and stores as an integer VND amount. Do not accept the frontend `value` as authoritative. Reject amounts outside the MoMo wallet sandbox's documented VND limits (1,000–50,000,000) before calling MoMo.

### Signatures and settlement

- Build the `captureWallet` HMAC-SHA256 canonical request string in the alphabetical field order defined by MoMo. Use an HTTP timeout suitable for the provider's documented minimum timeout and never log secrets or raw signatures unnecessarily.
- Verify the create response signature before returning `payUrl`.
- For IPN, verify HMAC in constant time; require a known order/request/partner and exact amount match. A valid success callback updates the attempt and booking transactionally. For both service and tour models, represent successful MoMo settlement with existing `payment_status: deposit_paid` and `status: deposit`; leave `escrow_status` unchanged because MoMo settles to the merchant rather than the GreenSteps wallet. Duplicate callbacks return the provider-required acknowledgement without repeating effects. A failed callback leaves the booking retryable and records the failed attempt.
- A late success for a previously failed attempt may settle the booking only if it remains pending and unpaid. If the booking is already paid, cancelled, rejected, or expired, record the verified provider payment as requiring admin reconciliation; do not reactivate the booking or automatically issue a refund.
- A browser redirect only returns the customer to confirmation. The confirmation page polls the backend status endpoint and clears the guest capability when payment becomes terminal.

### Verification

- Unit tests cover canonical signatures, response/IPN verification, config readiness, amount and ownership/capability validation, pending-attempt reuse, retry, duplicate and late callbacks, and booking settlement.
- HTTP tests use injected/mock MoMo transport; tests must not call the real provider or MongoDB production data.
- Run frontend build/tests and backend independent tests. A real sandbox payment additionally requires sandbox credentials and a reachable HTTPS IPN URL; these are environment prerequisites, not source-code defaults.

## Open implementation choices

- Use native Node `fetch` already available under the backend's Node >=20.19 runtime; no new dependency.
- Keep the capability only in `sessionStorage`; users who clear the tab session can still access a booking through their authenticated account, while guest users would need to restart checkout.
- Use the existing service/tour `deposit_paid` / `deposit` states after verified settlement, without changing GreenSteps wallet escrow state.
- Do not allow existing guest bookings to switch into MoMo after creation.
- Do not change other booking status semantics.

## Approval state

User selected full sandbox integration. A design check found four questions; code inspection resolved them as follows: amount is the persisted server-computed VND `booking.value`; service and tour share the same settlement fields; late success for non-payable bookings is flagged for admin reconciliation without reactivation or automatic refund; guest capability is issued only during initial MoMo booking creation. The user then approved implementation. Production mode remains out of scope; this integration is sandbox-only.

## References

- MoMo wallet one-time payment (`captureWallet`): https://developers.momo.vn/v3/docs/payment/api/wallet/onetime/
- MoMo payment notification and IPN signature validation: https://developers.momo.vn/v3/docs/payment/api/result-handling/notification/
- MoMo API idempotency: https://developers.momo.vn/v3/docs/payment/api/result-handling/idempotency/
