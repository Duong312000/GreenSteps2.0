# Admin User Management Performance Plan

> **For agentic workers:** Use this plan task by task in the current workspace. The request authorizes implementation; retain existing local changes and verify each behavior.

**Goal:** Make Admin > Users responsive on first open, return visits, search/filter/sort, and detail history without stale cross-session data.

**Architecture:** Keep server-side pagination and the current API contract. Use short-lived in-memory cache and request deduplication in `ApiService`; guard component state by request identity; refresh related cache on mutations or explicit refresh. Keep drawer history lazy, project list fields, and add only indexes supported by observed query plans.

**Tech Stack:** Angular 21, RxJS/HttpClient, Node.js/Express, MongoDB native driver through `MongoStore`, Vitest, Node test runner.

**Spec:** User-provided task `OPTIMIZE ADMIN USER MANAGEMENT PERFORMANCE – GREENSTEPS TRAVEL`.

## Global Constraints

- Keep server-side pagination, filters, sort behavior, response shape, authentication, authorization, and sensitive action confirmations.
- Keep cache in memory only, with a 30-second TTL, keyed by all query parameters and invalidated on account/session changes and successful mutations.
- Do not add speculative or duplicate indexes; substring regex search remains server-side and unchanged.
- Do not modify MongoDB documents or use mock data in the application.

## Review Focus

- Older list/stats responses must not overwrite a newer query; verify reversed completion order.
- Cache and in-flight requests must not cross admin identities; verify account switch and logout.
- Failed/canceled requests must remain retryable and must not leave loading stuck.
- Explicit refresh and successful create/edit/role/status changes must invalidate list and stats.
- Opening a drawer or changing tabs must not let a response for a prior user/tab overwrite current details.

## Baseline Evidence

- Atlas contains 39 users at planning time. Warm direct list handlers took about 126–196 ms across sort fields; cold/default was about 575 ms. Stats handler was about 57 ms.
- List response had 10 rows and was about 3.7 KB.
- `createdAt` sort uses `createdAt_1` (10 keys/docs examined); `last_login_at` sort used `SORT` + `COLLSCAN` (39 docs examined, under 1 ms execution time at current size).
- Current page starts list and stats in parallel, has a 30-second list/stats cache and hover/focus prefetch, but component requests lack identity guards. Auth clears cache on logout but not when replacing one non-null user with another. Detail/activity/bookings are lazy but overlapping requests can race.

## Tasks

### Task 1: Harden session-scoped cache and explicit refresh

**Files:** `my-app/src/app/services/api.service.ts`, `my-app/src/app/services/auth.service.ts`, their specs.

- [ ] Keep cache keys normalized across all list query fields and deduplicate in-flight identical requests.
- [ ] Clear admin-user list/stats entries when the authenticated identity changes, as well as logout.
- [ ] Add a force-refresh path that invalidates list and stats while preventing an old pending response from repopulating cache.
- [ ] Verify TTL, deduplication, mutation invalidation, account switch, logout, and retry after failure.

### Task 2: Prevent stale component responses and improve loading/retry UX

**Files:** `my-app/src/app/pages/admin/admin-users.ts`, `.html`, `.css`, and `admin-users.spec.ts`.

- [ ] Track request identities for list, stats, and selected-user detail/history; apply results only to the current query/identity.
- [ ] Clear search debounce timers and invalidate outstanding view requests when the component is destroyed.
- [ ] Retain visible table rows while a query refreshes; show loading separately for KPI and table; add table skeleton rows for the first load and a refresh action.
- [ ] Keep detail/activity/booking requests lazy and make tab/user changes safe against older responses.
- [ ] Verify list and stats independence, race ordering, retry, pagination/filter reset, and drawer switching.

### Task 3: Reduce list payload and inspect MongoDB query plans

**Files:** `backend/src/controllers/admin-users.controller.js`, `backend/src/models/index.js`, backend tests.

- [ ] Project only fields displayed in the list while preserving detail fields and response shape.
- [ ] Add the observed `last_login_at` sort index; retain existing `createdAt` index and avoid unsupported substring-search indexes.
- [ ] Verify index metadata and query semantics in tests; run `explain('executionStats')` for default and last-login sorts plus representative role/status filters.
- [ ] Keep booking counts batched across the page, not per-user, and verify no history collections are loaded by list calls.

### Task 4: Measure and verify end-to-end changes

**Files:** Relevant frontend/backend specs and this plan.

- [ ] Measure local HTTP list/stats/detail/activity/bookings endpoints with authenticated requests before and after changes; do not expose credentials or response PII in logs.
- [ ] Run targeted frontend and backend tests, then production frontend build.
- [ ] Report available timings and clearly call out browser-only route/network timings that cannot be measured in this shell.

