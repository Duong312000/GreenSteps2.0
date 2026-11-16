# GreenSteps Admin User Management Implementation Plan

> **For agentic workers:** This plan is being executed inline under test-driven development. Steps use checkbox syntax for tracking.

**Goal:** Replace the Admin “Người dùng” placeholder with a real MongoDB-backed management workflow that enforces admin permissions and records administrative changes.

**Architecture:** Add an admin-only Express router/controller using the existing `store.define` models and Mongo operator layer. Extend User documents with account status, add a small audit collection, and make authentication re-read the account so status and role changes take effect for existing JWTs. Connect the Angular AdminComponent and ApiService to server-side list, stats, detail, booking/activity, export, create/invite, and account-action endpoints; keep other admin sections intact.

**Tech Stack:** Angular 21, Node.js/Express 5, existing MongoDB store compatibility layer, `node:test`, Bootstrap Icons.

**Spec:** `C:/Users/lapto/.codex/attachments/04237637-b4dd-4bea-a7e6-b45b79615322/Pasted text.txt` and the user-provided screenshot.

## Global Constraints

- No production code may be written before a test that fails for the intended missing behavior.
- Preserve existing booking, provider, payments, promotions, reporting, and admin dashboard behavior.
- Do not hard delete users or expose password hashes, tokens, or OTPs.
- Apply authentication and admin role checks server-side; never trust UI visibility as authorization.
- Do not fabricate growth, activity, deletion-request, or review data when no source collection exists.
- Do not write to production MongoDB or perform destructive migrations.
- Preserve all existing uncommitted user changes and do not commit/push.

## Review Focus

- A valid non-admin or forged target must not read or mutate user data (test route/controller denial and no writes).
- Self-lock/self-deactivation and unsupported privilege escalation must be rejected (test).
- Existing JWT sessions must stop working after account suspension/deactivation and reflect role changes (test).
- Search, filters, sort, pagination and CSV must constrain/escape untrusted input (test).
- Counts/details must query real booking/review collections and return empty values instead of invented history (test).

---

### Task 1: Admin user API and audit model

**Files:**
- Modify `backend/src/models/index.js` (User account state, AdminAuditLog model/exports).
- Create `backend/src/controllers/admin-users.controller.js`.
- Create `backend/src/routes/admin-users.routes.js` and mount it in `backend/src/routes/index.js`.
- Create `backend/test/admin-users-controller.test.js`.
- Modify `backend/src/middlewares/auth.middleware.js` and `backend/src/controllers/auth.controller.js` for current-account status/role enforcement.

**Interfaces:**
- `GET /admin/users`, `/stats`, `/:id`, `/:id/activity`, `/:id/bookings`, `/export`.
- `POST /admin/users` creates a verified account with an unguessable generated password hash and sends a password-reset OTP using the existing reset flow; plaintext credentials are never returned.
- `PATCH /admin/users/:id`, `PATCH /:id/role`, `POST /:id/suspend`, `/unsuspend`, `/deactivate`, `/reactivate`.
- Every mutation stores actor, target, action, reason, old/new state, result, timestamp in `AdminAuditLog`.
- List response is `{ success, data, pagination }`; stats response exposes only real counts and supported roles/statuses.

- [ ] Write tests for admin-only access, server-side filters/pagination, safe projection, detail counts, mutation/audit, self-protection, escalation protection, CSV formula escaping, and auth status refresh.
- [ ] Run the new tests and observe expected failures.
- [ ] Implement the endpoints using existing models and Mongo store operators; no hard deletes.
- [ ] Run focused tests and backend unit suite.

### Task 2: Angular service and user-management view

**Files:**
- Modify `my-app/src/app/services/api.service.ts` with typed admin-user API methods.
- Modify `my-app/src/app/pages/admin/admin.ts`, `.html`, `.css`, and `.spec.ts`.

**Interfaces:**
- Admin users section uses `ApiService` only; normal production rendering never uses preview/demo user rows.
- Search/filter/sort/pagination are server-side; selection is limited to the current page.
- Detail drawer tabs use `/activity` and `/bookings`; show actual data or an explicit empty/error state.
- Role/status actions require a reason and the existing in-app confirmation dialog; successes refresh list and KPIs.

- [ ] Add tests for user section routing, API data state, search/filter/page interactions, empty/error/retry, and no preview data in live mode.
- [ ] Run focused Admin tests and observe expected failures.
- [ ] Implement the responsive user table, KPI, toolbar, pagination, detail drawer, safe create form, CSV export, and confirmed account actions.
- [ ] Run focused tests and Angular build.

### Task 3: Regression and security verification

**Files:** No additional files unless a test reveals a defect.

- [ ] Run `npm test` in `backend`.
- [ ] Run the Admin-focused frontend tests and `npm run build` in `my-app`.
- [ ] Confirm no production DB was used; report any unavailable integration checks and unsupported existing workflows (such as deletion requests without a request model).

## Scope notes

- Existing role values are `traveler`, `provider`, `admin`; provider approval remains separate from role assignment.
- Existing models include `TourBooking`, `ServiceBooking`, and `CommentPost`; there is no account-deletion request model or existing user activity collection.
- A KPI for deletion requests and a deletion-request workflow must remain unavailable until that domain model/workflow exists; UI must say so rather than show fabricated numbers.
- User creation reuses the current forgot-password OTP/password-reset system and email service. It does not create a default plaintext password or bypass provider approval.
