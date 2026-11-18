# GreenSteps Account Security Design

> **Superseding direction (2026-11-19):** The user later requested removal of two-factor authentication. TOTP setup and login challenges are removed from the implementation; legacy account fields are retained without being read for authentication so existing accounts remain accessible.

## Goal

Replace the profile security dashboard's demo claims with account-owned security state and enforce revocable server-side sessions across all existing login methods without changing or deleting existing user, booking, tour, or itinerary data.

## Current Architecture

- Express 5 backend, Node 20.19+, MongoDB through the repository's custom `mongo-store` model adapter.
- Angular 21 sends JWTs from `localStorage` as Bearer tokens; the backend also sets an HttpOnly cookie.
- Auth tokens currently last seven days and contain no session identifier. Existing middleware has a legacy `userId` fallback.
- Local passwords use bcrypt. Google, Facebook, password login, registration verification, and checkout OTP all issue tokens through `signAuthToken`; the forgot-password flow changes the hash without a session revocation hook.
- `/profile` security markup currently embeds demo score, MFA, devices, activity, recovery phone, and recommendations.

## Architecture Decisions

1. Add an `AuthSession` Mongo collection with random session ID, user ID, creation/last activity/expiry timestamps, user-agent-derived browser/device class, optional IP metadata, and revocation metadata. Add indexes for unique session ID and user/revocation/creation queries. No existing collections or account records are deleted or rewritten.
2. Put the session ID (`sid`) in every newly issued auth JWT. Authenticated middleware must require a valid JWT and an active, unexpired session owned by the token's user. JWTs without a matching session are rejected, which invalidates legacy tokens and requires one sign-in after deployment.
3. Remove request-supplied user ID authentication fallback. Soft authentication remains optional by definition; all protected routes use strict token authentication and authorization.
4. Centralize all successful login issuance so password, Google, Facebook, registration/OTP, and checkout OTP cannot bypass session creation or later MFA policy. Preserve current bcrypt hashes and existing profile data.
5. Build `/api/account/security` endpoints and a backend security overview service. The dashboard renders only API state; missing recovery/SMS/WebAuthn configuration is shown as not configured or unavailable, never as enabled.
6. Keep the current Bearer-token client contract for this migration while retaining an HttpOnly cookie. Every Bearer or cookie JWT is checked against Mongo on each protected request. Moving token storage fully to an HttpOnly-only contract can follow after all token-dependent Angular consumers are migrated.
7. Add TOTP setup/confirm/disable with encrypted-at-rest secret, one-time hashed recovery codes, replay protection, and a pending-login challenge. Every password/OAuth/OTP completion path must use the same MFA-aware login service before full session issuance.
8. Add password change with current-password reauthentication, policy validation, per-user rate limiting, session revocation policy, audit event, and best-effort notification through the existing email service.
9. Add WebAuthn only after verifying maintained package compatibility with Node 20.19 and current CommonJS backend. Persist public credentials and one-time server challenges; never persist private keys.
10. Record account-scoped audit events with server timestamps and bounded pagination. Store minimal IP/UA metadata; do not persist passwords, OTPs, raw tokens, recovery codes, or provisioning secrets in logs.

## Phases and Acceptance

### Phase 1: Session Registry and Audit Foundation

- Session model/service, session-aware JWT issuance, strict middleware, all issuance routes, logout/revoke endpoints, audit model/service.
- Legacy JWTs are rejected; missing/invalid/revoked/expired session claims return 401. Cross-account session identifiers cannot be read or revoked.
- Existing password/OAuth/OTP login routes issue registry-backed sessions.

### Phase 2: Security API and Honest Dashboard

- Overview, session list/revoke/revoke-others, audit pagination, security notification preference, computed score/recommendations.
- Replace every security-dashboard demo value with API data and loading/error/empty states.

### Phase 3: Password and TOTP MFA

- Reauthenticated password updates, bcrypt preserved, audit and best-effort email.
- TOTP enroll/confirm/disable, one-time recovery codes, anti-replay and bounded attempts.
- Login challenge flow covers password, OAuth, and email OTP completions before issuing a full session.

### Phase 4: Recovery and Passkeys

- Implement real WebAuthn registration/verification/list/rename/delete and reauthentication.
- Recovery contacts are not marked verified without an actual one-time verification challenge. Do not claim phone verification absent an SMS provider.

### Phase 5: Verification and Operational Notes

- Run phase-specific backend tests and Angular production build; run full backend suite and Angular tests at the end.
- Document required environment variables and exact local verification flow. No production data migration/deployment is performed.

## Security and Compatibility Constraints

- No seeded/mock security records.
- Session registry enforcement applies to all token-protected API paths, including strict and ordinary authentication middleware.
- Existing Mongo account data and password hashes remain unchanged.
- OAuth accounts with unknown password provenance are not described as having a strong password.
- Security email failures never roll back password/session security changes.
- Cookie-authenticated mutations retain existing CSRF origin enforcement.

## Review Focus

1. Missing, malformed, legacy, expired, and revoked JWTs must not authenticate.
2. A user cannot list, revoke, or infer another user's sessions or audit entries.
3. OAuth and OTP routes must use the same session/MFA issuance path as password login.
4. Database/email failures must not leak secrets or report a successful session revocation that did not persist.
5. Dashboard API errors and incomplete security setup must never fall back to the screenshot's sample data.

## Runtime Configuration and Safe Rollback

- Keep `JWT_SECRET` stable and identical across API instances. Existing stateless JWTs without a registered `sid` are intentionally rejected after this release; users sign in once to receive a registered session.
- Set a stable 32-byte hex `ACCOUNT_SECURITY_ENCRYPTION_KEY` before enabling TOTP. Losing or rotating this key without decrypting/re-encrypting user secrets will prevent enrolled users from completing MFA.
- Set `WEBAUTHN_RP_ID` to the public site hostname and `WEBAUTHN_ORIGIN` to the exact HTTPS frontend origin before using production passkeys. Local defaults target `localhost:4200`.
- Configure SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) if users enable security email alerts.
- No production data migration or deployment is part of this implementation. New Mongo collections/indexes are created through the normal model initialization path; existing user, bcrypt, tour, booking, and itinerary records are not rewritten.
- If deployment is later approved and a rollback is needed, keep the session collections and encryption key intact. Roll back the frontend independently if needed. The backend may only be rolled back to a build that still rejects unregistered/legacy JWTs; restoring stateless authentication would undo session revocation and MFA guarantees.
