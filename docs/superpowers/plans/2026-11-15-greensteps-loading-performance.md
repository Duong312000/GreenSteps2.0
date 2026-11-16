# GreenSteps Loading and Data Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not commit or push.

**Goal:** Make GreenSteps render useful data earlier, avoid redundant API work, optimize measured database queries, and show accessible loading/error/empty states without changing business logic or API responses.

**Architecture:** Keep page-local data states and the existing Angular/RxJS/Node/Mongo stack. Remove indiscriminate catalog preloads, coalesce identical in-flight reads, and defer noncritical sections. Add a small standalone loading indicator for pages and action buttons. Use read-only Mongo explain results to select backend query/index changes; preserve every response field, value, and envelope.

**Tech Stack:** Angular 21, RxJS, Angular HttpClient, CSS, Express 5, MongoDB driver and the project’s MongoStore abstraction, Vitest, Node test runner, Playwright CLI.

**Spec:** `docs/superpowers/specs/2026-11-15-greensteps-loading-performance-design.md`

## Global Constraints

- “No business-rule, authentication, authorization, API response shape/value, or persisted-data changes.”
- “No live booking, account mutation, catalog editing, seed, migration, or database writes during verification.”
- “No new package if Angular, CSS, RxJS, Node, or MongoDB capabilities already cover the need.”
- “No commit or push. Preserve existing staged, untracked, and stashed work.”
- Do not cache user-specific data; shared catalog responses stay uncached unless freshness and invalidation are proven safe.
- No full-screen loading overlay or layout redesign. Keep filters, pagination, sort order, and editorial/demo behavior.

## Review Focus

1. The six-row service/tour response contains large nested fields: preserve exact response fields and values. Pin with search-service and tour-search response-shape tests in Task 3.
2. Rapid filter changes may complete out of order: preserve latest-request behavior. Pin with service/tour page tests in Task 4.
3. A failed or timed-out request must clear loading and expose retry: pin with error-state tests in Tasks 4–6.
4. Session changes must not reuse another account’s records: pin with `api.service.spec.ts` cache-scope tests in Task 2.
5. Empty results must not look like a permanent load: pin empty-state tests in Tasks 4–6.

---

### Task 1: Confirm the baseline and complete the loading/request inventory

**Files:**
- Read: `my-app/src/app/services/auth.service.ts`
- Read: `my-app/src/app/services/api.service.ts`
- Read: API-backed components under `my-app/src/app/pages/`
- Read: API-backed shared components under `my-app/src/app/components/`
- Read: `backend/src/services/service-search.service.js`
- Read: `backend/src/services/tour-search.service.js`
- Read: Mongo index definitions in `backend/src/models/index.js`

**Interfaces:**
- Produces a route/request/state inventory and repeatable baseline commands for later tasks.
- Does not change product code or database state.

- [ ] Record loading, empty, error, retry, and action-busy state for home, tours, services, tour detail, local food, transport, booking, booking lookup, itinerary, community, profile, promotions, partner, and admin.
- [ ] Reproduce the same API GET measurements for `/api/services/search?page=1&pageSize=6`, `/api/tours/search?page=1&pageSize=6`, and `/api/destinations?page=1&pageSize=100`; record response bytes, status, successful latency samples, timeout count, and median.
- [ ] Capture browser FCP, API request URLs/counts, and console errors at the same viewport for `/home`, `/tours`, and `/services` using the Playwright CLI.
- [ ] Run `npm run build` in `my-app` to record the initial bundle and warning baseline.
- [ ] Run read-only Mongo `explain("executionStats")` for the catalog query shapes. Do not create indexes, seed, migrate, or write records.

Expected output: baseline metrics and a route-level state checklist; no code or database changes.

### Task 2: Remove eager preloads and deduplicate in-flight reads

**Files:**
- Modify: `my-app/src/app/services/auth.service.ts`
- Modify: `my-app/src/app/services/api.service.ts`
- Modify: `my-app/src/app/services/auth.service.spec.ts`
- Modify: `my-app/src/app/services/api.service.spec.ts`
- Modify: `my-app/src/app/pages/home/home.ts`
- Test: matching auth, API, and home specs

**Interfaces:**
- Existing API method signatures and decoded responses remain unchanged.
- In-flight request sharing returns the same result only while an identical request is already pending; it does not cache shared catalog responses after completion.

- [ ] Add `does not preload every public catalog when AuthService starts` to `auth.service.spec.ts` and `shares an identical pending catalog GET without caching its completed response` to `api.service.spec.ts`.
- [ ] Run the focused Vitest specs and confirm the new assertions fail for the duplicate/eager request behavior.
- [ ] Make `preloadAppData()` opt-in and noncritical; remove automatic broad preload calls from auth construction and session changes. Keep any data the user explicitly opens loaded by that page.
- [ ] Add in-flight de-duplication for identical public catalog requests without changing completed-response cache behavior or account scoping.
- [ ] Let Home render primary content independently from noncritical catalog/recommendation data; preserve destination selection and planner behavior.
- [ ] Re-run the focused specs and confirm same-URL API request counts fall without adding cross-session caching.

Run: `npx vitest run src/app/services/auth.service.spec.ts src/app/services/api.service.spec.ts src/app/pages/home/home.spec.ts` from `my-app`.

### Task 3: Optimize only measured backend query work

**Files:**
- Inspect/modify only if `explain` supports it: `backend/src/services/service-search.service.js`
- Inspect/modify only if `explain` supports it: `backend/src/services/tour-search.service.js`
- Modify index definitions only if supported by measured query plans: `backend/src/models/index.js`
- Test: `backend/test/service-search.test.js`
- Test: `backend/test/tour-search.test.js`

**Interfaces:**
- Preserve endpoint paths, query parameters, response envelopes, all returned row fields/values, totals, ordering, and demo/editorial rules.
- Any new index definition is code only during this task; do not execute index creation or any migration against the running database.

- [ ] Add `bounds candidate reads without changing the complete response fields` to `service-search.test.js` and `preserves response fields, sort order, and pagination while bounding candidate reads` to `tour-search.test.js`.
- [ ] Run `node --test test/service-search.test.js test/tour-search.test.js` from `backend` and confirm the new performance assertions fail against the current broad reads.
- [ ] Change only query stages shown by the read-only explain/baseline to be expensive. Prefer database-side filtering/order/page limits while preserving complete result rows. If the query plan does not justify a code/index change, record that and leave that query alone.
- [ ] Re-run both focused tests and compare query count/candidate count using test instrumentation; repeat the same read-only explain queries.

### Task 4: Shared loader and public discovery pages

**Files:**
- Create: `my-app/src/app/components/loading-indicator/loading-indicator.ts`
- Create: `my-app/src/app/components/loading-indicator/loading-indicator.html`
- Create: `my-app/src/app/components/loading-indicator/loading-indicator.css`
- Test: `my-app/src/app/components/loading-indicator/loading-indicator.spec.ts`
- Modify as needed: `my-app/src/app/app-module.ts` and lazy feature module imports (`admin.module.ts`, `booking.module.ts`, `partner.module.ts`, `profile.module.ts`, `schedule-editor.module.ts`)
- Modify: `my-app/src/app/pages/home/{home.ts,home.html,home.css,home.spec.ts}`
- Modify: `my-app/src/app/pages/tours/{tours.ts,tours.html,tours.css,tours.spec.ts}`
- Modify: `my-app/src/app/pages/services/{services.ts,services.html,services.css,services.spec.ts}`
- Modify: `my-app/src/app/pages/tour-detail/{tour-detail.ts,tour-detail.html,tour-detail.css,tour-detail.spec.ts}`

**Interfaces:**
- Standalone component inputs: `label: string = 'Đang tải dữ liệu...'`, `compact: boolean = false`.
- Accessible output: a reserved local region with `role="status"`, `aria-live="polite"`, and a visible GreenSteps-green spinner; respect reduced motion.

- [ ] Write a failing `renders its label and accessible status in compact and regular modes` component test; verify reduced-motion behavior in the rendered CSS/media check.
- [ ] Run the focused component spec and confirm it fails because the shared component does not exist.
- [ ] Implement the component in Angular/CSS without adding a package or changing surrounding page design.
- [ ] Add local loading, empty, and retry states to discovery pages where the inventory found gaps; keep old content visible during quiet refreshes when valid.
- [ ] Add `keeps home primary content available when optional catalog requests fail` to `home.spec.ts`, `clears tour loading after search failure` to `tours.spec.ts`, `shows service empty state and retry after search failure` to `services.spec.ts`, and `keeps latest detail request when the route id changes` to `tour-detail.spec.ts`.
- [ ] Run the component and four page specs.

### Task 5: User, booking, itinerary, community, and catalog utility states

**Files:**
- Modify as needed: `my-app/src/app/pages/booking/`
- Modify as needed: `my-app/src/app/pages/booking-lookup/`
- Modify as needed: `my-app/src/app/pages/schedule-editor/`
- Modify as needed: `my-app/src/app/pages/profile/`
- Modify as needed: `my-app/src/app/pages/community/`
- Modify as needed: `my-app/src/app/pages/promotions/`
- Modify as needed: `my-app/src/app/components/login-modal/`
- Modify as needed: `my-app/src/app/components/header/`
- Modify as needed: `my-app/src/app/components/favorites/`
- Modify only where inventory finds gaps: `my-app/src/app/pages/local-food/`, `my-app/src/app/pages/transport/`
- Test: each affected page’s existing `*.spec.ts`

**Interfaces:**
- Keep the current API calls, input validation, state transitions, and response shapes.
- Busy buttons become disabled while the same operation is pending and restore on success/error.

- [ ] Add `booking submit is disabled while the request is pending` to `booking.spec.ts`, `lookup clears loading and offers retry on failure` to `booking-lookup.spec.ts`, and `login submit is disabled while authentication is pending` to `login-modal.spec.ts`.
- [ ] Add `shows loading then empty state for no saved itineraries` to `schedule-editor.spec.ts`, `clears wallet loading and exposes retry after failure` to `profile.spec.ts`, and loading/empty/error assertions to the community and promotions specs.
- [ ] Where the inventory finds missing states, add tests for the header notification list and favorites collection without changing their authorization or cache scope.
- [ ] Run the relevant focused Vitest specs and confirm the new assertions fail.
- [ ] Add the shared local indicator and page-level success/empty/error states where missing; add busy text/disabled state to login/register, booking, save/update/delete, and itinerary actions.
- [ ] Confirm existing pages that already have adequate local loading states remain visually unchanged.
- [ ] Run the affected specs; use mocked API responses for booking and admin writes.

### Task 6: Partner and admin states

**Files:**
- Modify as needed: `my-app/src/app/pages/partner/partner-dashboard/`
- Modify as needed: `my-app/src/app/pages/partner/partner-bookings/`
- Modify as needed: `my-app/src/app/pages/partner/partner-services/`
- Modify as needed: `my-app/src/app/pages/partner/partner-ads/`
- Modify as needed: `my-app/src/app/pages/partner/partner-promotions/`
- Modify as needed: `my-app/src/app/pages/partner/partner-register/`
- Modify as needed: `my-app/src/app/pages/admin/`
- Test: affected page `*.spec.ts` files

**Interfaces:**
- Keep role guards, authorization calls, queue actions, API contracts, and existing pagination.
- Do not perform admin/partner writes against the live local database.

- [ ] Add `partner bookings exposes loading empty and retry states` to the partner-bookings spec, `registration submit is disabled while saving` to the partner-register spec, and `admin action disables duplicate submissions while pending` to the admin spec; add list-state assertions to partner services, dashboard, and admin catalog/settings specs where the inventory finds a gap.
- [ ] Run the focused page specs and confirm the assertions fail.
- [ ] Add compact local loading/retry/empty states and per-action busy flags; do not use a global overlay.
- [ ] Run admin and partner specs, including the existing catalog, promotions, and dashboard analytics tests.

### Task 7: Full verification and before/after report

**Files:**
- Read: modified files and their tests; no additional production files unless a failing check identifies a regression.

**Interfaces:**
- No API or database writes are allowed during verification.
- Do not commit or push.

- [ ] Run `npm run build` and compare bundle output/budget warnings with Task 1.
- [ ] Run `npm test` from `my-app` and `npm test` from `backend`; record the full suite totals and any pre-existing failures.
- [ ] Run safe existing Playwright flows for home, tour/service search, login, itinerary, partner, and admin. Use mocks/isolated fixtures for write flows; skip live booking/database writes.
- [ ] Repeat Task 1 API GET samples and browser routes under the same conditions. Compare request count, duplicate URLs, response-body bytes, successful latency median, timeout count, FCP, and console errors.
- [ ] Record unverified flows and any remaining query-plan or bundle-budget issues. Report no improvement unless the before/after measurements show it.
- [ ] Review `git diff` and `git status` against the initial inventory; distinguish this task’s files from the user’s pre-existing staged/untracked work, remove only build artifacts created by this task, and leave everything uncommitted and unpushed.
