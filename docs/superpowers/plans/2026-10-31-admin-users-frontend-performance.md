# Admin User Page Frontend Performance Implementation Plan

> **For agentic workers:** Follow this plan task by task in the current workspace. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Admin > Users open sooner by prefetching on navigation intent and reusing recent user list and stats responses.

**Architecture:** Add a 30-second in-memory cache and in-flight request deduplication for only the admin user list and stats GETs in `ApiService`. Start those same service calls on pointer hover or keyboard focus of the Users navigation item; the component's normal calls reuse the prefetch. Clear the related cache after successful user mutations.

**Tech Stack:** Angular, TypeScript, existing `HttpClient` and in-memory `ApiService` cache.

**Spec:** `docs/superpowers/specs/2026-10-31-admin-users-frontend-performance-design.md`

## Global Constraints

- Keep the existing API response shape, filters, pagination, and page layout.
- Cache keys include the normalized list query; stats have a shared key.
- A cache hit renders immediately; cache lifetime is 30 seconds.
- Creating, editing, changing role, suspending, unsuspending, deactivating, or reactivating a user invalidates user-list and stats entries.
- Prefetch is limited to the Users section and deduplicates concurrent requests.
- No backend or MongoDB changes.

## Review Focus

- **Different page/filter/sort queries:** cache keys must not return rows from a different query; inspect keys produced by `adminUserQuery`.
- **Pointer and keyboard navigation:** both hover and focus trigger one prefetch; repeated events reuse in-flight promises.
- **Failed prefetch:** rejected requests must be removed from the in-flight map and remain retryable.
- **User mutations:** all successful create/profile/role/status mutations clear both list and stats cache prefixes; failed mutations do not cache new data.
- **Cache expiry:** entries older than 30 seconds must fetch again.

---

### Task 1: Cache and deduplicate admin user GET requests

**Files:**
- Modify: `my-app/src/app/services/api.service.ts`

**Interfaces:**
- Consumes: Existing `AdminUserQuery`, `adminUserQuery`, `getCachedData`, `setCachedData`, and `clearCache`.
- Produces: `getAdminUsers(query)` and `getAdminUserStats()` use stable cache keys and share pending promises; successful user mutations invalidate `admin_users:` and `admin_user_stats`.

- [ ] Add a private pending-request map and a private helper that returns an unexpired cached value, shares a pending promise by key, caches only successful results for 30,000 ms, and removes settled promises on both success and failure.
- [ ] Route `getAdminUsers(query)` through the helper using key `admin_users:${adminUserQuery(query)}` without changing its URL or HTTP options.
- [ ] Route `getAdminUserStats()` through the helper using key `admin_user_stats` without changing its URL or HTTP options.
- [ ] After successful create, profile update, role change, and status change requests, clear both cache prefixes; leave cache untouched when a mutation rejects.
- [ ] Manually inspect the methods to confirm different normalized query strings produce different keys and failed requests are retryable.

### Task 2: Prefetch when Users navigation is likely

**Files:**
- Modify: `my-app/src/app/pages/admin/admin.ts`
- Modify: `my-app/src/app/pages/admin/admin.html`

**Interfaces:**
- Consumes: Task 1's cached `ApiService.getAdminUsers(query)` and `getAdminUserStats()`.
- Produces: A guarded `prefetchUsers()` method invoked by pointer hover and keyboard focus on the Users sidebar item.

- [ ] Add `prefetchUsers()` to start the default query `{ page: 1, limit: 10, sort: 'createdAt', order: 'desc' }` and stats calls together; swallow prefetch errors so the page's normal load path can retry.
- [ ] Bind pointer-enter and focus events on the Users navigation button only, invoking `prefetchUsers()`.
- [ ] Manually verify clicking Users while prefetch is pending does not issue duplicate HTTP requests, and that keyboard focus triggers the same prefetch.

### Task 3: Review affected navigation and mutation flows

**Files:**
- Review: `my-app/src/app/pages/admin/admin-users.ts`
- Review: `my-app/src/app/services/api.service.ts`

- [ ] Confirm existing page load, search, filters, sort, pagination, and mutation refresh behavior remains unchanged.
- [ ] Confirm a successful user mutation is followed by fresh list/stats requests, while returning to Users within 30 seconds without a mutation reuses cached data.
