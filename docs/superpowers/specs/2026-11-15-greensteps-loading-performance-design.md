# GreenSteps Loading and Data Performance Design

## Intent

Make GreenSteps show useful content as soon as its data is ready, clearly indicate real waits, prevent duplicate requests and repeated button submissions, and reduce measured API and database work without changing business behavior or existing API response contracts.

## Current Findings and Baseline

Measurements were taken against the locally running frontend and backend on 2026-11-15. API response sizes are the decoded JSON body size; timings are local wall time, not production-user latency.

| Measurement | Baseline |
| --- | --- |
| `GET /api/services/search?page=1&pageSize=6` | 6,200,234 bytes; three successful samples at 2.97 s, 3.07 s, and 3.87 s (median 3.07 s); one of four attempts timed out |
| `GET /api/tours/search?page=1&pageSize=6` | 6,581,067 bytes; three successful samples at 2.41 s, 3.25 s, and 4.15 s (median 3.25 s); one of four attempts timed out |
| Largest response fields | Services: `current_data` totals 5,683,861 bytes across six rows. Tours: `data` totals 6,565,069 bytes across six rows. |
| `GET /api/destinations?page=1&pageSize=100` | 3,569 bytes; median 70 ms across three samples |
| Browser first contentful paint | Home: 3.89 s; tours: 1.08 s; services: 0.70 s in the sampled navigations. These are single local-browser observations. |
| Home API requests | The browser recorded two `/api/services` requests and two identical `/api/destinations?page=1&pageSize=100` requests, in addition to tours, community posts, and maintenance status. |
| Production build bundle | Initial bundle 2.13 MB raw / 390.44 KB estimated transfer, exceeding the configured 2.00 MB raw budget by 126.89 KB. |

Likely causes supported by code inspection:

- `AuthService` calls `ApiService.preloadAppData()` during construction and after session changes. That method eagerly requests tours, services, community posts, and destinations; pages independently request the same data. The shared catalog cache deliberately bypasses those keys, so warming it does not prevent another request.
- Service and tour search return large nested fields (`current_data` and activity `data`). The current response is several megabytes for only six results.
- Tour search currently reads up to 5,000 schedules and samples, then filters, sorts, joins, and paginates in application memory.
- Loading state is inconsistent. Several pages already have local loading flags and lazy routes are in place, while home, profile, admin, partner service/booking, wallet, and settings flows do not consistently expose loading, empty, and error states.
- Database index definitions exist, but no query `explain` baseline or per-query timing instrumentation has yet established which indexes or database stages dominate.

The database was only read through public GET endpoints for this baseline. No database writes or index changes were made.

## Goals

- Provide a small, accessible, GreenSteps-colored loading indicator and stable local loading regions without redesigning existing pages.
- Make API-backed pages and async actions explicitly handle loading, success, empty, and error states; stop duplicate submissions while requests are active.
- Remove redundant eager network work and share identical in-flight requests where doing so does not serve stale cross-account data.
- Reduce repeated catalog transfers and backend work while preserving every response contract and field; use transport compression only if measured transfer cost improves without changing decoded JSON.
- Use measured query plans before adding indexes or changing database query patterns.
- Compare the same API, browser, and bundle metrics after changes; report only measured improvements.
- Verify representative home, tour/service search, login, booking, itinerary, partner, and admin flows without writing to the live local database.

## Non-Goals and Constraints

- No visual redesign beyond loading and operation status indicators.
- No business-rule, authentication, authorization, API response shape/value, or persisted-data changes.
- No live booking, account mutation, catalog editing, seed, migration, or database writes during verification.
- No new package if Angular, CSS, RxJS, Node, or MongoDB capabilities already cover the need.
- No commit or push. Preserve existing staged, untracked, and stashed work.
- Do not add cache for user-specific or mutable shared data without a clear TTL and invalidation rule.

## Approaches Considered

1. **Measure and optimize by flow (selected):** establish a repeatable baseline, fix duplicate requests and unnecessary preloads first, then address only query plans that show database work is a bottleneck. Add local loading states where the measured routes still wait. This keeps changes narrow and comparable. The user selected this approach.
2. **Add a global loading interceptor first:** broad coverage with fewer template edits, but it can show a spinner for every small request, obscure page-specific errors, and cannot prevent duplicate or oversized work.
3. **Rewrite backend queries and add indexes first:** may reduce query time, but does not address the observed duplicate requests, multi-megabyte payloads, or inconsistent loading feedback; index changes also require operational rollout.

## Proposed Design

### 1. Frontend request and rendering flow

- Inventory API-backed page initialization and async actions, recording the required fields and current states before editing.
- Replace eager, app-wide catalog preloads with route-aware or narrowly scoped loading. Add in-flight de-duplication for identical requests; keep shared catalog responses uncached unless freshness and invalidation are proven safe.
- Let primary content render independently of recommendations, community content, and other noncritical sections. Keep pagination and current filter behavior.
- Add a reusable standalone loading indicator with a compact variant, `role="status"`, `aria-live="polite"`, reduced-motion handling, and reserved space. Use it inside existing page regions and buttons, not as a blocking full-screen overlay.
- Keep page-specific empty and retry states. Add `trackBy` only where stable IDs already exist and repeated rendering is measurable.
- Use per-action busy flags and disabled buttons for login/register, booking, save/update/delete, and moderation actions; preserve current validation and API behavior.

### 2. Catalog API and backend data flow

- Trace each byte-heavy nested response field to its actual frontend consumers, but preserve every existing API response field, value, and envelope. Optimize request count, query execution, concurrency, and transport only; do not add a compact response mode.
- Measure service and tour query stages and MongoDB `explain("executionStats")` for the same representative queries. Establish whether the 5,000-row in-memory tour cap or full destination reads are material at current data volume.
- If plans confirm collection scans or oversized candidate work, add bounded database-side filtering, sorting, and pagination while retaining the complete response rows, order, totals, and editorial/demo behavior.
- Add index definitions only for query shapes supported by `explain`; do not execute index creation or migrations as part of this work.
- Keep independent reads parallel only where results are both needed before the visible section can render.

### 3. Verification and measurement

- Re-run the same GET endpoints with the same query and sample count; record body bytes, success/timeout count, and median successful latency.
- Re-run the same browser routes at the same viewport; capture FCP, key content readiness, request counts, duplicate URLs, and errors.
- Re-run the production build and record raw/estimated-transfer bundle size and budget warnings.
- Run frontend unit tests, backend focused tests, and existing safe E2E flows. Exercise login, booking, itinerary, partner, and admin with mocks or isolated fixtures; do not mutate the live local database.
- If an environment cannot support a requested flow, record it as unverified rather than claiming it passed.

## Implementation Sequence

1. Add baseline instrumentation/report helpers and finish the loading/request inventory.
2. Remove redundant startup preloads and deduplicate identical in-flight catalog requests; test request counts and cache freshness behavior.
3. Trace the measured service/tour payload composition, prevent redundant transfers, and test built-in transport compression only if it reduces wire bytes while preserving decoded response shape.
4. Use query plans to target backend search/index changes only if justified; add tests for pagination, sort, filters, and response shape.
5. Add the shared spinner and fill missing page/action states, prioritizing home, tours, services, tour detail, booking, schedule, profile, partner, and admin.
6. Run the requested verification set and compare baseline to after measurements.

## Open Implementation Details

- The exact nested fields accounting for most `current_data` and tour `data` bytes still need identification; repeated small-page requests timed out during follow-up inspection. The response schema and values must remain unchanged, as requested. This limits payload-size reduction to transport compression if measurements show it helps; work should prioritize duplicate requests, query execution, and noncritical preloads.
- The backend is locally running, but query-plan access and isolated test fixtures need confirmation before any database-facing optimization.
- Functional tests that write a booking or admin change must use a mock or isolated database, not the running application database.
