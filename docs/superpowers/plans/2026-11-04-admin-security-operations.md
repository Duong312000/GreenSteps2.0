# FR-ADM-14 Security and Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Harden authentication/deployment boundaries and deliver a real, admin-only security and operations dashboard backed by verified MongoDB events and health checks.

**Architecture:** Keep JWT and current Express/MongoStore conventions. Reuse existing audit collections, add one TTL-retained operational event collection, expose admin-only paginated endpoints, and build a tab-lazy Angular component using the admin design system.

**Tech Stack:** Node.js 20.19+, Express 5, MongoDB Native Driver through `mongo-store`, Angular 21, Vitest, Node test runner.

> Historical implementation plan: the Admin UI and read-only monitoring endpoints were later removed on 2026-11-04. Security middleware, public health check, event logging, and MongoDB log data remain active.

**Spec:** `docs/superpowers/specs/2026-11-04-admin-security-operations-design.md`

## Global Constraints

- Do not change booking, payment, provider, or tour business behavior outside necessary security boundaries.
- Do not deploy or alter production environment values; document required environment migration.
- Admin APIs require backend authentication and admin authorization.
- Public health returns minimal details; detailed monitoring is admin-only.
- No mock records, simulated timers, secret disclosure, or unbounded log loading.
- Logs must omit tokens, passwords, cookies, request bodies, and secret values.

## Review Focus

- Missing/short JWT secret must fail startup instead of signing/verifying with a known constant; test the configuration boundary without importing a production server.
- Unlisted CORS origins and cookie-authenticated cross-origin mutations must be rejected while listed frontend origins with credentials continue working; test exact origin and preflight behavior.
- Bearer-authenticated clients must remain CSRF-exempt while cookie-authenticated unsafe requests require an allowed origin; pin both cases.
- Login abuse must be throttled without persistent account lockout; pin cooldown expiry/reset and malformed identifier behavior.
- Sanitization must remove credential-like values from error text, event metadata, and HTTP responses; tests assert absence of sample secrets.

---

### Task 1: Security configuration and request protections

**Files:**
- Modify: `backend/src/config/env.js`, `backend/src/app.js`, `backend/src/middlewares/auth.middleware.js`, `backend/src/controllers/auth.controller.js`, `backend/src/routes/auth.routes.js`, `backend/src/middlewares/errorHandler.js`, `.env.example`, `backend/README.md`
- Create: `backend/src/middlewares/security.middleware.js`
- Test: `backend/test/security-config.test.js`, `backend/test/security-middleware.test.js`, `backend/test/auth-rate-limit.test.js`

**Interfaces:** `parseAllowedOrigins(env)`, `createCorsOptions(config)`, cookie-auth CSRF middleware, bounded in-process login limiter. Keep existing JWT Bearer and cookie interfaces.

- [x] Write failing tests for required JWT secret, exact CORS/preflight, cookie CSRF vs Bearer, login throttling, and sanitized production errors.
- [x] Run the focused backend tests and confirm expected failures.
- [x] Implement fail-fast runtime config, exact CORS allowlist, CSRF origin guard for cookie-auth unsafe methods, bounded login throttle, and safe errors.
- [x] Re-run focused tests; run the existing backend unit suite for regressions.
- [x] Document local/production `JWT_SECRET` and `CORS_ALLOWED_ORIGINS` setup and the JWT/cookie architecture.

### Task 2: Operational event storage and secure admin APIs

**Files:**
- Modify: `backend/src/models/index.js`, `backend/src/app.js`, `backend/src/middlewares/auth.middleware.js`, `backend/src/middlewares/errorHandler.js`, `backend/src/controllers/auth.controller.js`, `backend/src/controllers/admin-users.controller.js`, `backend/src/controllers/admin-settings.controller.js`, `backend/src/routes/index.js`
- Create: `backend/src/services/security-operations.service.js`, `backend/src/controllers/security-operations.controller.js`, `backend/src/routes/security-operations.routes.js`
- Test: `backend/test/security-operations.service.test.js`, `backend/test/security-operations-controller.test.js`, `backend/test/app-security-csrf.test.js`

**Interfaces:** `recordSystemEvent(event)`, `recordAdminAudit(event)`, `getHealthSnapshot()`, and admin endpoints for overview, audit logs, security events, errors, and derived alerts.

- [x] Write failing service/controller tests for log sanitization, audit union, filters, pagination, empty history, health outage, and authorization.
- [x] Run focused tests and confirm expected failures.
- [x] Add one TTL-retained `SystemEventLog` for runtime security/errors; reuse existing audit collections and record admin login/config/role changes.
- [x] Add request IDs, structured sanitized error/security records, admin-only route guards, and real event/threshold-derived alerts.
- [x] Keep public health minimal and expose uptime and MongoDB status only through admin overview.
- [x] Re-run focused tests and existing backend unit suite.

### Task 3: Angular Admin security and operations workspace

**Files:**
- Modify: `my-app/src/app/pages/admin/admin.ts`, `admin.html`, `admin.css`, `my-app/src/app/services/api.service.ts`, `api.service.spec.ts`
- Create: `my-app/src/app/pages/admin/admin-security-operations.component.ts`, `.html`, `.css`, `.spec.ts`

**Interfaces:** `ApiService.getAdminSecurityOverview()`, `getAdminSecurityAuditLogs(query)`, `getAdminSecurityEvents(query)`, `getAdminSecurityErrors(query)`, `getAdminSecurityAlerts()`.

- [x] Write failing component/API tests for loading, ready, empty, error/retry, filters, pagination, and active-tab-only fetches.
- [x] Run focused Angular tests and confirm expected failures.
- [x] Replace the security section placeholder with four lazy-loaded tabs and real API data.
- [x] Add server-side pagination/filter controls, timestamps, safe detail views, and empty/loading/error states using the current admin visual system.
- [x] Re-run focused Angular tests and build.

### Task 4: Integration verification and documentation

**Files:**
- Modify: `backend/README.md`, `backend/.env.example`, `docs/superpowers/specs/2026-11-04-admin-security-operations-design.md`
- Test: existing backend/frontend suites and builds.

- [x] Run backend unit tests, skip Mongo integration tests without an explicitly disposable replica set, run focused Angular tests, and build the production frontend.
- [x] Record exact PASS/FAIL/NOT RUN outcomes and remaining deployment configuration requirements.
- [x] Review all endpoint guards, log fields, public health shape, and UI loading transitions against FR-ADM-14.

## Verification outcome

- Backend full suite: 129 passed, 0 failed, 6 Mongo integration tests skipped because `TEST_MONGODB_URI` was not configured.
- Angular production build: passed; existing initial bundle budget warning remains (2.73 MB versus 2.00 MB).
- Angular focused FR-ADM-14 component tests: 4 passed. The full Angular suite was attempted but worker processes exhausted available memory; the two unrelated stale-spec compile errors were corrected before the memory failure.
- MongoDB startup TLS alert: not reproducible from this sandbox, which is blocked from the configured remote host with `EACCES`; no production TLS-verification bypass was added.
- Limiter review accepted the bounded overflow fallback: exact counters cover 10,000 active IPs; additional IPs share 10,000 attempts per 15 minutes. For larger deployments, use a shared per-IP rate-limit store.
- Code review confirmed the cookie parser order, CSRF integration test, secret minimum, redaction, audit query bound, and limiter policy; no open Critical or Important findings remain.
