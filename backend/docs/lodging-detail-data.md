# Lodging detail data

The existing `GET /api/services/:id` returns `current_data`. No sample rooms are
added to real service records. Providers can supply the following optional data
through the existing service update API:

- `rooms`: array of room types. Each room has `id`, `name`, optional `images`
  (image URLs), `area` (m²), `beds` (text), `amenities` (text array), `policies`
  (text array), plus `capacity`, `price_per_night` (integer VND) and
  `available_rooms` (integer inventory ceiling).
- `amenityGroups`: array of `{ name, items: string[] }`.
- `policies`: array of service-specific policy text, displayed above the existing
  GreenSteps booking guidance.
- `address`, `lat`, `lng`, `areaDescription`, `nearby` (text array).
- `popularAmenities`: optional featured amenities. Amenity items in this array
  and `amenityGroups[].items` accept either text or
  `{ name, fee?: 'free' | 'paid', available?: boolean, note?: string }`.
- `policyGroups`: optional `{ title, lines: string[] }` rows for detailed policies.
  Existing `policies` text arrays remain supported when rows are absent.
- `nearbyGroups`: optional `{ name, items: { name, distance?: string }[] }`.
  Distances are displayed only if provided; existing `nearby` text arrays work too.
- `greenFeatures`: optional `{ title, description?: string }` partner-supplied
  environmental practices; the UI does not infer certification or savings.

Room booking is enabled only when the room ID, nightly price, capacity and
inventory are present and valid. Missing data produces a visible empty or
updating state. An inventory of zero disables booking.

`POST /api/bookings/quote` and `POST /api/bookings` accept `roomId`, `roomCount`,
`bookingDate`, `checkOutDate` alongside the existing request fields. The server
reads the room price from the catalog, calculates calendar nights, validates
capacity, and subtracts overlapping reservations from the inventory ceiling.
The existing pricing configuration supplies fees, discounts and deposit rates.
Room identity, count, checkout and the pricing snapshot are stored on the booking.

Inventory shown on detail is the catalog ceiling; availability for the dates is
checked again at quote and booking creation. This does not introduce a channel
manager or an atomic inventory lock across simultaneous checkout requests.
