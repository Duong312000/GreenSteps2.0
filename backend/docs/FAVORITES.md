# Unified favorites

Favorites for Tour, catalog services, custom itineraries, places and Transport share one authenticated API and the existing MongoDB connection. The collection is `${MONGODB_COLLECTION_PREFIX}favorites` (`app_favorites` by default). `backend/scripts/init-favorites.js` can initialize its JSON schema and indexes independently; normal server startup also initializes it.

Each document contains `user_id`, `target_type`, `target_id`, a display-only snapshot and timestamps. A unique compound index on user/type/target plus a deterministic document ID make repeated/concurrent saves idempotent. Users are always taken from the existing verified authentication middleware, never from request bodies. Private itineraries require ownership or a collaborator membership.

## API

Both existing API prefixes support:

- `GET /api/favorites?page=1&limit=30&type=service`
- `PUT /api/favorites/:type/:targetId`
- `DELETE /api/favorites/:type/:targetId`

Types are `tour`, `service`, `itinerary`, `place`, `transport_trip`, `transport_rental`. Only `place` accepts a display snapshot (name, image, destination, coordinates, reference cost). Catalog prices, titles and links are resolved by the server. List responses refresh catalog data and mark deleted/inaccessible/inactive targets unavailable while allowing their removal. Pagination is enforced in MongoDB.

## Frontend

- Reusable heart buttons on Tour/service list and detail pages, promotions, Transport list/detail and saved/custom itineraries.
- Planner place favorites now use the same account-backed service. Catalog suggestions retain their real service IDs.
- `/profile?section=favorites` displays actual saved items, type counts, search, filters, pagination, details/map links, loading/error/empty states and removal.
- Guests use the existing sign-in modal. Logout/account changes immediately clear the previous account's favorites; stale responses cannot restore them.
- Root state updates list/detail/profile hearts together. BroadcastChannel refreshes other tabs and page focus reloads server data. Completed writes cannot be overwritten by an earlier list refresh.
- The old unscoped `greensteps_favorite_places` storage is not silently assigned to a user. The collection offers an explicit import action for the currently signed-in account, and only removes the old storage after all records are saved successfully.
- Existing Community saved-post functionality remains separate.

## Verification

- Backend unit tests: 4 passed (scoping/validation, snapshot safety, server-authoritative metadata, private itinerary access).
- MongoDB/API integration: passed (real persistence, concurrent saves, account isolation, authorization, pagination/filtering, unavailable targets, idempotent removal). Temporary fixtures are cleaned up.
- Frontend favorites and related booking/catalog tests: 20 passed, including account changes and refresh/write races.
- Real-MongoDB browser test: passed for service/Tour/itinerary hearts, refresh persistence, profile filters/search, detail synchronization, mobile width, unavailable removal and account switching. Account/catalog surroundings are isolated from payments and messaging; favorites use the real backend/database.
- Production build passed. Existing bundle-size and Schedule editor optional-chain warnings remain.

```powershell
node --test backend/test/favorites.test.js
$env:FAVORITES_INTEGRATION='1'
node --test backend/test/favorites.integration.test.js
node my-app/e2e/favorites.e2e.cjs
npm.cmd --prefix my-app run build
```

Atlas access in the restricted environment may require running outside the sandbox with the project's process-only `MONGODB_DNS_SERVERS` setting. No environment file, real account or real booking was changed by these checks.
