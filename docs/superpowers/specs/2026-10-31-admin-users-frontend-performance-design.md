# Admin User Page Frontend Performance

## Intent

Make the Admin > Users page feel faster on localhost, both the first time it is opened and when an admin returns to it.

## Current behavior

- The Admin shell starts five queue requests when it initializes.
- The Users component starts separate list and stats requests when rendered.
- The API service does not cache admin user list or stats responses, so returning to Users waits for both requests again.
- Direct measurements of the current list handler were under one second; the frontend can reduce perceived waiting, but this work does not change server query time.

## Approaches considered

1. **Prefetch on intent:** start list and stats requests when the Users navigation item receives pointer hover or keyboard focus. This can make the first click faster, but does not help if the user opens the page before the requests finish.
2. **Short-lived cache:** reuse recent list and stats responses. This makes returning fast, but does not help a cold first visit and can briefly show old data.
3. **Combine both (selected):** prefetch on hover/focus and reuse in-flight requests; keep a 30-second in-memory cache for list queries and stats. Mutations invalidate the relevant cache so the page refreshes with current data.

## Behavior and constraints

- Keep the existing API response shape, filters, pagination, and page layout.
- Cache keys include the normalized list query; stats have a shared key.
- A cache hit renders immediately. A refresh may run in the background; latest successful data replaces the cached result.
- Creating, editing, changing role, suspending, unsuspending, deactivating, or reactivating a user invalidates user-list and stats entries.
- Prefetching is limited to the Users section and must deduplicate concurrent requests so clicking does not send a second copy.
- No backend or MongoDB changes are part of this design.

## Acceptance criteria

- Hovering or focusing the Users navigation item starts at most one list request and one stats request.
- Clicking Users while prefetch is running reuses those requests.
- Returning within 30 seconds displays cached users and stats without waiting for the API.
- User mutations invalidate cached data and the refreshed page shows the updated state.
- Existing search, filter, sort, pagination, and error states continue to work.

## Selected approach

Implement the combined prefetch and short-lived cache in the Angular Admin component and `ApiService`. The 30-second lifetime is the initial default and can be adjusted after use.
