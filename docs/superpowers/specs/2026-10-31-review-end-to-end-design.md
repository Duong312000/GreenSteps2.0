# Review System End-to-End Design

## Intent

Complete the review lifecycle for tours and services: only the authenticated customer who owns a completed booking may submit one 1–5 star review per booking; the review is persisted with its booking and target, visible to the owning provider, and receives a persistent provider reply visible to the customer. Ratings, counts, and review states must reflect stored records rather than fabricated defaults.

## Goals and constraints

- Reuse the current MongoDB `CommentPost`, `CPSS`, and `CPGS` records; preserve legacy comments that have no `booking_id`.
- Resolve a provider from the authenticated account. Services are owned through `User → Vender → GreenService`; tours are owned through `User → Provider → ScheduleSample`.
- Add an explicit optional `Provider.user_id` link for new registrations. Resolve legacy provider records by exact company name only when that match is unique; ambiguous ownership fails closed.
- Use the existing completed booking status (`status === 'completed'`) and the booking's service/tour foreign key. Do not create completion transitions.
- Persist review, junction record, and aggregates consistently; a unique sparse booking index protects against concurrent duplicate review requests.
- Provider replies are persisted child `CommentPost` rows and are limited to one provider reply per root review. Existing customer comment threads remain supported.
- No startup data migration, destructive cleanup, or database seeding. Existing reviews without booking links remain readable but cannot be newly attributed to a booking.
- Catalog fallbacks may not invent review data or replace a shorter real API result. Empty/error states must not display fabricated stars or counts.

## Approaches considered

1. **Extend `CommentPost` with its existing `booking_id` field (chosen).** Add the sparse unique index, owner links and transaction-backed writes while keeping current read APIs and collection relationships. This preserves current records and minimizes migration risk.
2. **Create a new `Review` collection.** This would make the domain clearer but duplicate existing reviews and require a migration/reconciliation of `CommentPost`, CPSS, and CPGS. Rejected for this change.
3. **Store review text and score on booking documents.** This avoids a junction write but cannot represent current comment threads and would split provider/customer reads. Rejected for compatibility.

## Design decisions

- Both review POST routes accept `bookingId`, target ID, rating, and text; identity comes only from `req.user.id`.
- The backend finds the matching service or tour booking by ID, checks owner, completion, target equality, and existing review before writing.
- `GET /reviews/provider` derives ownership from the authenticated user and returns both target kinds. A supplied provider ID is ignored/rejected; optional target filters are verified against owned records.
- Service and tour review reads return consistent nested replies with user role and timestamp. Provider UI uses these persisted replies; no local-only success state remains.
- Review counts and averages are computed from non-reply review records. `GreenService.bookings_count` remains a booking metric and is never updated by review hooks.
- A target with no reviews has `reviews_count: 0` and no average score (`null`/omitted); the frontend renders an unrated state.
- If an existing duplicate string `booking_id` prevents the unique index from being created, startup fails with a clear error. Do not silently omit the index or mutate old records; manual review is required.
- Preserve existing customer and provider page styling; only add the booking selector/eligibility state, review type and truthful loading/error/empty states where needed.

## Out of scope

- Changing booking payment, approval, or completion policy.
- Deleting or rewriting existing MongoDB records.
- Redesigning the review pages or catalog content beyond removing misleading review statistics.
