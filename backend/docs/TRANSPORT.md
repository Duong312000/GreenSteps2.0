# Transport — implementation and verification

## Architecture

The existing application uses Angular 21 and MongoDB Native Driver, not Mongoose. `server_mongodb/index.js` delegates to `backend/server.js`. Transport reuses this server, its MongoDB connection, `User`, JWT authentication and role middleware. No database, account system, payment integration or external carrier integration was created.

Transport schemas are in `backend/src/transport/models.js`; MongoDB `$jsonSchema` validators and indexes are installed on startup/seed. Transport references use ObjectId. `user_id` deliberately uses the existing User string ID; changing User IDs to ObjectId would break the existing application.

## Entry points

- `/transport`: exactly three tabs, search, database filters/sorts, pagination, URL query state, loading/empty/error handling and 15-second client timeout.
- `/transport/trips/:id`: shared/bus detail fetched by ID.
- `/transport/rentals/:id`: rental detail, availability, time-based quote and optional distance-based emissions.
- `/profile?section=tickets`: existing Tour tickets plus Transport requests in the same account.
- `/transport-bookings/:id`: request detail and cancellation.
- `/booking/payment?transportBookingId=:id`: the existing service payment page (`BookingComponent`), populated from the server-side Transport booking. No Admin approval is required.
- `/booking/confirm?transportBookingId=:id`: the existing confirmation page, loaded from MongoDB and safe to refresh.
- `/admin/transport`: partners, vehicles, routes, trips, rentals, bookings and emission parameters.
- `/services?type=transport` redirects to `/transport`.

The existing schedule planner remains accessible and unchanged.

## Database and seed

Existing configured MongoDB database is reused. Collections:

| Collection | Seed records |
|---|---:|
| transport_partners | 8 |
| transport_vehicles | 64 |
| transport_routes | 5 |
| transport_trips | 200 (100 shared, 100 bus) |
| transport_rentals | 24 |
| transport_emission_factors | 4 |
| transport_bookings | 0 retained test bookings |

All inserted seed records carry `is_seed_data: true` and namespaced `seed_key`. Contacts use `.invalid` addresses and internal development numbers. No real carrier brand or external booking URL is used. Seed uses insert-if-absent, preserves existing records/reservations and adds future dated trips when run on a later date. It does not reset inventory or overwrite real data. Re-running on the same date inserted zero records; totals stayed unchanged.

Seed produced departures on 7–11 November 2026 (Asia/Ho_Chi_Minh), including sold-out/suspended cases. Existing project image assets are reused; these are illustrative images rather than actual vehicle photographs.

```powershell
npm.cmd --prefix backend run seed:transport
```

Atlas SRV DNS timed out inside the restricted environment. Seed and integration tests succeeded outside that restriction with the project's existing process-only DNS override:

```powershell
$env:MONGODB_DNS_SERVERS='1.1.1.1,8.8.8.8'
npm.cmd --prefix backend run seed:transport
```

No connection string, credentials or environment file was changed.

## API

Both `/api/transport` and `/api/v1/transport` are mounted.

| Method | Path relative to prefix | Behavior |
|---|---|---|
| GET | /trips | type, origin, destination, date, passengers, price, departure period, seats, vehicle/fuel, lowEmission, sorting and pagination |
| GET | /trips/:id | fresh detail, availability and emissions; inactive/deleted references return 404 |
| GET | /rentals | location, pickupDate/returnDate, vehicle/fuel, price, seats, sorting and pagination |
| GET | /rentals/:id | fresh detail; optional time interval returns quote/availability |
| GET | /partners | public partner fields |
| GET | /filters | current location and vehicle/energy options |
| GET | /emissions/compare | tripId, or rentalId plus distanceKm |
| POST | /bookings | authenticated; trip_id + passenger_count, or rental_id + rental_start/rental_end |
| GET | /bookings/me | authenticated user's paginated requests |
| GET | /bookings/:id | ownership enforced |
| POST | /bookings/:id/cancel | ownership, cancellation window and transactional inventory release |
| POST | /bookings/:id/payment | owned, idempotent internal payment for seed bookings; confirms booking automatically, never debits a real wallet or calls a bank/carrier |
| GET | /admin/schema | admin form field metadata |
| GET, POST | /admin/:resource | admin list/create for partners, vehicles, routes, trips, rentals, emission_factors |
| GET, PATCH, DELETE | /admin/:resource/:id | admin detail/update/soft-delete; emission factors cannot be deleted |
| GET | /admin/bookings | admin list/filter/search/pagination |
| GET, PATCH | /admin/bookings/:id | admin detail or valid booking_status transition |

Search and sorting run in MongoDB aggregation pipelines, rather than filtering client-side. Public partner contacts are excluded. Booking prices are calculated from current MongoDB rates; frontend totals are ignored.

## Reservation and sustainability rules

- Replica-set transactions are required; standalone MongoDB is rejected with 503 instead of falling back to unsafe writes.
- Trips decrement seats conditionally in the same transaction as booking insertion.
- Rentals serialize writes on the vehicle, then check overlapping PENDING/CONFIRMED intervals. Half-open intervals allow one rental to end exactly when another starts.
- Related partner/vehicle/route state participates in transactional writes, preventing a booking from racing past an administrative suspension.
- Cancellation is idempotent and restores seats once. User cancellation requires the configured lead time. Admin transitions follow PENDING → CONFIRMED/CANCELLED/FAILED and CONFIRMED → CANCELLED/COMPLETED. Completion is blocked before the service ends.
- Capacity changes with held seats preserve the reserved count; incompatible reference changes are rejected.
- Hourly rental billing rounds up hours, charges full 24-hour days and caps the final partial day at the daily rate. Deposit is shown separately.
- New bookings start with UNPAID payment status and redirect directly to the existing service payment page. Seed checkout records SIMULATED_PAID and automatically sets CONFIRMED inside a MongoDB transaction; it never calls the real wallet ledger, card/QR gateways, external carriers, email or SMS. Cancelling a settled seed booking records SIMULATED_REFUNDED without a real-money refund. Legacy pending bookings with NOT_REQUIRED can resume checkout. The UI explicitly identifies internal settlement and states that no real money or external carrier reservation is involved.
- Trip CO2e = distance × vehicle operating-energy factor / assumed allocated passengers. The private-car baseline uses the same distance and system boundary. Assumptions, allocation, source and scope are disclosed.
- Factors live in MongoDB and are editable by Admin. Electric energy has a non-zero factor. Rental estimates require distance and do not claim a reduction without a comparison basis.

## Verification

- Production Angular build: PASS; initial bundle approximately 2.79 MB, with the existing 2 MB warning threshold exceeded. Error threshold (4 MB) is not exceeded.
- Development Angular build: PASS.
- Backend full suite with working Atlas access: 91 passed, 5 explicitly skipped, 0 failed. The initial restricted run had DNS-related failures in existing community/promotions integrations; the network-enabled repeat passed.
- Transport unit tests: 3 passed (emissions, hourly/daily billing and input validation).
- Transport MongoDB/API integration: parent + 5 subtests passed. Covers search/type/price/seats, sorting request, ID errors, emissions, authentication, ownership, server price, 9 concurrent requests for 6 seats, concurrent cancellation, rental overlap/adjacency, rental quote and Admin persistence/soft deletion.
- Public Playwright browser flow: PASS for three tabs, backend detail, rental quote, empty state, old URL redirect and 390px mobile overflow check; no Transport console errors or page errors observed.
- Authenticated Playwright browser flow: PASS for creating an internal booking, account display, cancellation and Admin form persistence; no page errors observed.
- Seed repeat: zero inserts; record totals unchanged.
- Temporary integration/UI accounts and their bookings/fixtures were cleaned up; no user or partner data was deleted.

Screenshots: `tmp/transport-artifacts/search-desktop.png`, `detail-desktop.png`, `search-mobile.png`.

### Vehicle image refresh

Ten generated, unbranded catalog photos are saved in `my-app/public/image/transport/` as optimized 960×640 JPEGs. The generation prompt set is recorded in `generation.json` in that folder. Six shared-vehicle photos alternate by capacity and color, and coaches and motor scooters have their own images. Remaining bicycle/electric-car photos reuse existing assets.

`backend/src/transport/seed-images.js` supplies the same image assignments to the initial seed and `backend/scripts/refresh-transport-images.js`. Run `npm.cmd --prefix backend run seed:transport-images -- --apply` to refresh existing namespaced seed vehicles. This refresh matched 64 records and changed only the image fields (plus updatedAt) on 52 records; it did not change trips, seats, prices or bookings.

Commands:

```powershell
npm.cmd --prefix backend run test:transport
$env:TRANSPORT_INTEGRATION='1'
node --test backend/test/transport.integration.test.js
npm.cmd --prefix backend test
npm.cmd --prefix my-app run build
node my-app/e2e/transport.e2e.cjs
node my-app/e2e/transport-auth.e2e.cjs
```

For browser tests with a separate backend port:

```powershell
$env:TRANSPORT_E2E_API='http://127.0.0.1:5057/api/transport'
```

## Files introduced

- `backend/src/transport/models.js`
- `backend/src/transport/service.js`
- `backend/src/transport/routes.js`
- `backend/scripts/seed-transport.js`
- `backend/test/transport.test.js`
- `backend/test/transport.integration.test.js`
- `backend/docs/TRANSPORT.md`
- `my-app/src/app/services/transport.service.ts`
- `my-app/src/app/pages/transport/transport.ts`
- `my-app/src/app/pages/transport/transport.html`
- `my-app/src/app/pages/transport/transport.css`
- `my-app/src/app/pages/transport/transport-bookings.ts`
- `my-app/src/app/pages/transport/transport-admin.ts`
- `my-app/src/app/pages/transport/transport-admin.html`
- `my-app/src/app/pages/transport/transport-admin.css`
- `my-app/e2e/transport.e2e.cjs`
- `my-app/e2e/transport-auth.e2e.cjs`

## Existing files changed for integration

- `backend/package.json`: seed/test commands; pre-existing scripts preserved.
- `backend/server.js`: initialize Transport validation/indexes.
- `backend/src/routes/index.js`: mount Transport router.
- `my-app/src/app/app-routing-module.ts`: lazy Transport routes.
- `my-app/src/app/app-module.ts`: import reusable Transport booking component.
- `my-app/src/app/components/header/header.html`: Transport entry link.
- `my-app/src/app/pages/services/services.ts`: redirect old Transport entry.
- `my-app/src/app/pages/profile/profile.html`: show Transport bookings alongside existing Tour tickets.
- `my-app/src/app/pages/admin/admin.html`: Transport management navigation link.

The repository contained other uncommitted changes before this task; those were preserved and are not part of this file list.

## Practical limits

No real carrier contract, carrier dispatch, payment, SMS or email confirmation is implemented or invoked. Seed emission parameters are consistent internal technical assumptions, not measured/certified environmental claims. Ratings are omitted because no verified review records exist. Image assets are reused illustrations. This is an internally functioning reservation module; it is not authorization to provide a real-world transport service.

The normal Backend on port 5055 has been restarted with the Transport checkout endpoint. The existing service payment page is reused; no frontend API configuration or default port was changed. Checkout verification passed against the isolated test backend before restarting the normal process.

Checkout follow-up verification: Transport integration passed 7 tests including ownership, concurrent/idempotent internal settlement, server-authoritative amounts, legacy pending checkout and cancellation reversal. Focused frontend tests passed 11 tests across Transport checkout and existing Tour booking. The authenticated browser flow passed on the existing payment/confirmation pages, including refresh recovery and no real payment requests. The overall Angular test build is blocked by pre-existing errors in `admin-users.spec.ts` (private cdr access) and `community.spec.ts` (incorrect export import); these unrelated files were left unchanged.
