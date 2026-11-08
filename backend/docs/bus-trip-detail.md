# Bus trip detail and stop selection

Bus and shared-trip detail pages use `BusTripDetailComponent` inside the existing
transport route, with a service-specific label and the same stop-selection flow.
Rentals use `RentalDetailComponent` with the same layout and shared gallery,
while retaining rental availability, hourly/daily pricing, deposit separation and
the existing checkout. `VehicleGalleryComponent` handles image previews and the
keyboard-accessible full-size dialog for all three services. Detail data and
gallery sources continue to come from Atlas through the existing APIs.

Changing rental dates immediately invalidates the quote and consent. A new
server availability check is required before continuing, and booking submits the
exact interval used for the quote. Outdated quote responses are ignored after a
date edit or navigation.

`transport_trips.stops` contains 2–40 ordered stops:

```js
{
  id: 'stable-stop-id', order: 0, name: 'Stop name', address: 'Optional address',
  estimated_time: new Date(), allow_pickup: true, allow_dropoff: false
}
```

The service validates unique IDs/orders, chronological times inside the trip,
pickup/dropoff permissions and a downstream destination. Booking requests send
`pickup_stop_id`, `dropoff_stop_id` and `passenger_count`. The server derives and
saves both stop snapshots and selected service times. Price and seat reservation
still apply to the whole trip. Cancellation uses the original departure time.
Old trips without stored stops receive stable start/end IDs automatically; old
clients may omit both IDs only on those legacy trips. Active reservations prevent
an administrator from changing the itinerary.

## Atlas demo data

```powershell
cd backend
node scripts/import-bus-detail.js --download
node scripts/import-bus-detail.js
node scripts/import-bus-detail.js --apply
```

The script downloads four CC0 photographs by Ypy31 from Wikimedia Commons,
validates the image responses and stores base64 JPEG data URLs in the existing
`transport_vehicles.images` field. Credits and license URLs are stored in
`image_sources` and shown in the gallery dialog. These are illustrative photos,
not verified photographs of the demo operators' fleets.

Sources:

- https://commons.wikimedia.org/wiki/File:Toyota_Coaster_EX_XZB70.jpg
- https://commons.wikimedia.org/wiki/File:Toyota_Coaster_GX_XZB70_interior_rear.jpg
- https://commons.wikimedia.org/wiki/File:Toyota_Coaster_GX_XZB70_interior.jpg
- https://commons.wikimedia.org/wiki/File:Toyota_Coaster_EX_XZB70_rear.jpg

The migration only updates existing seeded bus vehicles and trips. It retains
existing stop data and skips trips with active reservations. Da Nang–Hoi An demo
trips receive four illustrative stops; other routes retain their two endpoints.
Before applying changes it stores a BSON-preserving backup under
`tmp/bus-detail/atlas-before-*.json`. Repeating it leaves migrated records unchanged.
The older image refresh script preserves this imported gallery.

## Verification

```powershell
# backend
node --test test/transport.test.js test/transport-stops.test.js
$env:TRANSPORT_INTEGRATION='1'
node --test test/transport.integration.test.js

# my-app
npx.cmd vitest run src/app/pages/transport/bus-trip-detail.spec.ts src/app/pages/transport/rental-detail.spec.ts src/app/pages/booking/booking.transport.spec.ts
npm.cmd run build
node e2e/bus-trip-detail.e2e.cjs
node e2e/shared-rental-detail.e2e.cjs
```

The browser check expects the frontend on 127.0.0.1:4200 and the current backend
on localhost:5055. It creates its own temporary account and bookings, cancels
reservations and removes only its test records. Legacy two-stop/single-image
responses are simulated in the browser without changing Atlas data. Screenshots
are saved under `tmp/bus-detail/`.
