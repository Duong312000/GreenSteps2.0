# Account Security Implementation Plan

> **Superseding direction (2026-11-19):** The user later requested removal of two-factor authentication. Tasks and requirements for TOTP/MFA below are superseded: no MFA setup, challenge, or login gate is active. Legacy database fields remain for data preservation.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the profile security demo with real account security state and registry-backed, revocable sessions across all login methods.

**Architecture:** Add Mongo-backed sessions and audit events. Sign JWTs with a session ID and validate that ID on every protected request; remove userId fallback. Expose account-scoped security APIs and render only their returned state in Angular. Add password, TOTP/MFA, recovery, and WebAuthn features in separate phases that share centralized login/session issuance.

**Tech Stack:** Node 20.19+, Express 5, CommonJS, MongoDB custom `mongo-store`, bcrypt, Angular 21, Node's test runner, Angular build/tests.

**Spec:** `docs/superpowers/specs/2026-11-19-account-security-design.md`

## Global Constraints

- Preserve all existing users, bcrypt hashes, tours, bookings, and itineraries.
- Reject JWTs without an active session record; users may sign in once after deployment.
- Do not trust request-supplied user IDs for authentication or authorization.
- Do not log passwords, OTP, session tokens, recovery codes, TOTP secrets, or WebAuthn challenges.
- Do not render demo values or mark unconfigured mechanisms as enabled.
- Cookie-authenticated mutations remain protected by existing CSRF origin checks.
- Do not perform production data changes or deployment.

## Review Focus

1. Legacy/missing/expired/revoked session token rejection — Phase 1 auth middleware tests.
2. Cross-account access denial for session and audit resources — Phase 1 API tests.
3. Password/OAuth/OTP issuance parity and MFA gate — Phase 1 + Phase 3 login tests.
4. Dashboard API failure or incomplete account setup shows no stale mock state — Phase 2 component tests.
5. One-time/replayed TOTP and recovery credentials cannot be reused — Phase 3 MFA tests.

---

### Task 1: Session and Audit Persistence

**Files:**
- Modify: `backend/src/models/index.js`
- Create: `backend/src/services/auth-session.service.js`
- Create: `backend/src/services/security-audit.service.js`
- Test: `backend/test/auth-session.service.test.js`
- Test: `backend/test/security-audit.service.test.js`

**Interfaces:**
- `createSession({ userId, userAgent, ip, now }) -> { id, createdAt, expiresAt, ... }`
- `getActiveSession({ sessionId, userId, now }) -> session | null`
- `touchSession({ sessionId, now }) -> boolean`
- `revokeSession({ sessionId, userId, now }) -> boolean`
- `revokeOtherSessions({ userId, currentSessionId, now }) -> count`
- `recordSecurityEvent({ userId, sessionId, type, result, request, metadata }) -> event`
- `listSecurityEvents({ userId, page, pageSize }) -> { items, page, pageSize, total }`

- [ ] Write tests for unique session IDs, expiry, owner-scoped revoke, revoke-others preserving current, and newest-first audit pagination.
- [ ] Run `node --test test/auth-session.service.test.js test/security-audit.service.test.js` and confirm expected failures.
- [ ] Add `AuthSession` and `SecurityAuditEvent` Mongo models with unique session ID and user/date indexes.
- [ ] Implement the services using only account-owned queries and never store raw JWTs or secrets.
- [ ] Run the targeted service tests and confirm pass.

### Task 2: Registry Enforcement Across Authentication

**Files:**
- Modify: `backend/src/controllers/auth.controller.js`
- Modify: `backend/src/middlewares/auth.middleware.js`
- Modify: `backend/src/routes/auth.routes.js`
- Modify: relevant login/auth controller routes found by `rg "jwt.sign|signAuthToken" backend/src`
- Test: `backend/test/auth-session-middleware.test.js`
- Test: `backend/test/auth-session-login.test.js`

**Interfaces:**
- Replace token issuer with one central async `issueAuthenticatedSession({ user, req, res })` that persists a session, signs `{ id, sid, ... }`, sets cookie, and returns the existing response token for Angular compatibility.
- Attach `req.authSession = { id, ... }` after middleware verifies JWT and active session ownership.

- [ ] Write tests proving missing, malformed, legacy-without-sid, expired, and revoked JWTs fail; a live JWT with live session succeeds.
- [ ] Write login tests proving password, Google, Facebook, registration OTP, checkout OTP, and other token issuers create registry-backed sessions.
- [ ] Run the targeted tests and confirm they fail for missing registry behavior.
- [ ] Remove `tryFallbackUser` and all request userId authentication paths from standard auth middleware; make every JWT middleware consult the session registry.
- [ ] Centralize all successful token issuance and add logout/revoke-current behavior backed by Mongo.
- [ ] Run targeted tests plus existing `auth-profile`, Google auth, Facebook auth, and CSRF tests.

### Task 3: Security API and Backend Overview

**Files:**
- Create: `backend/src/controllers/account-security.controller.js`
- Create: `backend/src/routes/account-security.routes.js`
- Create: `backend/src/services/account-security.service.js`
- Modify: `backend/src/routes/index.js`
- Modify: `backend/src/models/index.js`
- Test: `backend/test/account-security.routes.test.js`
- Test: `backend/test/account-security.service.test.js`

**Interfaces:**
- `GET /api/account/security/overview`
- `GET /api/account/security/sessions`
- `DELETE /api/account/security/sessions/:sessionId`
- `POST /api/account/security/sessions/revoke-others`
- `GET /api/account/security/activity?page=&pageSize=`
- `PUT /api/account/security/preferences` for security-email notifications.
- `getSecurityOverview(userId) -> { score, measures, password, mfa, passkeys, recovery, sessions, recommendations }`

- [ ] Write route tests for auth required, owner isolation, current-session marker, revoke-other behavior, activity pagination, and no sensitive fields in responses.
- [ ] Run tests and confirm they fail before implementation.
- [ ] Implement overview scoring from persisted verifiable state only. Do not infer password strength from bcrypt hash or OAuth provider for old accounts.
- [ ] Add session list/revoke APIs and account-scoped activity APIs.
- [ ] Run route/service tests and auth regressions.

### Task 4: Angular Security Dashboard Integration

**Files:**
- Create: `my-app/src/app/services/security.service.ts`
- Modify: `my-app/src/app/pages/profile/profile.ts`
- Modify: `my-app/src/app/pages/profile/profile.html`
- Modify: `my-app/src/app/pages/profile/profile.css`
- Test: `my-app/src/app/services/security.service.spec.ts`
- Test: `my-app/src/app/pages/profile/profile.security.spec.ts`

**Interfaces:**
- `SecurityService.getOverview()`, `getSessions()`, `revokeSession(id)`, `revokeOtherSessions()`, `getActivity(page,pageSize)`, and `updatePreferences(...)`.
- Profile security state includes loading/error/empty states and API-backed overview, device/session list, activity, recommendations, and recovery indicators.

- [ ] Write frontend tests confirming no score, devices, 2FA, recovery, event, or recommendation demo is shown before API success or after API failure.
- [ ] Run the targeted Angular tests and confirm the current hardcoded markup fails.
- [ ] Replace demo markup bindings while preserving the existing layout and CSS design.
- [ ] Add loading, empty, error, and action feedback states and connect revoke/preferences controls.
- [ ] Run targeted Angular tests and production build.

### Task 5: Password Changes, Audit, and Notifications

**Files:**
- Modify: `backend/src/controllers/auth.controller.js`
- Modify: `backend/src/routes/auth.routes.js`
- Modify: `backend/src/services/account-security.service.js`
- Modify: `backend/src/services/email.service.js` only if existing notification API cannot be reused
- Modify: `my-app/src/app/services/security.service.ts`
- Modify: `my-app/src/app/pages/profile/profile.ts` and `.html`
- Test: `backend/test/account-security-password.test.js`

- [ ] Test wrong current password, valid password update, policy rejection, provider-only account without local password, session policy, audit event, and email failure isolation.
- [ ] Run targeted tests to see expected failures.
- [ ] Require reauthentication and matching new password confirmation; preserve bcrypt cost/format; revoke other sessions after password change.
- [ ] Record audit event and enqueue/send best-effort security notification to verified email.
- [ ] Connect the existing password panel/modal to the API and run targeted tests/build.

### Task 6: TOTP, Recovery Codes, and MFA Login Gate

**Files:**
- Modify: `backend/src/models/index.js`
- Create: `backend/src/services/totp.service.js`
- Modify: `backend/src/services/account-security.service.js`
- Modify: `backend/src/controllers/auth.controller.js`
- Modify: `backend/src/routes/account-security.routes.js`
- Modify: `backend/src/routes/auth.routes.js`
- Modify: `my-app/src/app/services/security.service.ts`
- Modify: `my-app/src/app/pages/profile/profile.ts` and `.html`
- Test: `backend/test/account-security-totp.test.js`
- Test: `backend/test/auth-mfa-login.test.js`

- [ ] Test provisioning/confirm, invalid code, replayed code, rate limits, disable reauthentication, hashed one-time recovery code, and every login method returning a pending challenge instead of a full session when MFA is enabled.
- [ ] Run tests to establish expected failures before implementation.
- [ ] Add encrypted TOTP secrets, one-time challenge records, replay-step tracking, recovery-code hashes, and login challenge records with TTL/unique indexes.
- [ ] Implement a maintained TOTP library compatible with Node 20.19; encrypt secrets using a required application key and do not log provisioning data.
- [ ] Route password, OAuth, registration/OTP, checkout OTP, and any additional login completion through a shared MFA-aware issuance function.
- [ ] Add frontend setup/confirm/disable and recovery-code reveal-once flows; show enabled only from backend state.
- [ ] Run targeted tests and auth suites.

### Task 7: WebAuthn Passkeys and Recovery Contacts

**Files:**
- Modify: `backend/package.json` and lockfile only after verifying package/runtime compatibility
- Modify: `backend/src/models/index.js`
- Create: `backend/src/services/webauthn.service.js`
- Modify: `backend/src/services/account-security.service.js`
- Modify: `backend/src/routes/account-security.routes.js`
- Modify: `my-app/src/app/services/security.service.ts`
- Modify: `my-app/src/app/pages/profile/profile.ts` and `.html`
- Test: `backend/test/account-security-webauthn.test.js`

- [ ] Verify the selected maintained WebAuthn package supports the current Node/CommonJS stack; test bad, expired, reused challenges and credential ownership.
- [ ] Add registration/authentication option and verify routes with origin/RP ID configuration; store public key/counter only.
- [ ] Add authenticated list, rename, and reauthenticated delete flows. Add passkey count to overview only after persisted credentials exist.
- [ ] Add one-time expiring email recovery contact verification using existing email service. Keep phone unverified/unsupported unless an SMS provider exists.
- [ ] Run WebAuthn and security integration tests plus Angular production build.

### Task 8: Full Security Verification and Report

**Files:**
- Test: all new security tests and affected auth suites
- Modify: `docs/superpowers/specs/2026-11-19-account-security-design.md` with actual limits/configuration

- [ ] Run complete `npm test` in `backend` and report every failure by name.
- [ ] Run complete `npm test`/Angular tests and `npm run build` in `my-app`.
- [ ] Review `git diff --check`, grep for remaining dashboard demo strings/secret logging, and verify no existing production collection is destructively migrated.
- [ ] Document local/Postman sign-in, revoke, cross-account, MFA, and logout verification plus environment variable names only.
- [ ] Summarize implemented, incomplete, tested, and production-blocking items; do not deploy.
