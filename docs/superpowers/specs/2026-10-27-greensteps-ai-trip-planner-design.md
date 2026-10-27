# GreenSteps AI Trip Planner: design

## Intent

Help travelers find real GreenSteps tours in the existing AI chat, compare options, and turn an AI itinerary proposal into a draft in the existing itinerary editor. The interface should follow the supplied Booking.com AI Trip Planner reference and GreenSteps forest green styling.

## Goals

- Replace only the chat's visual shell with an Angular conversation view so tour cards and itinerary summaries appear in the message flow.
- Keep the existing chat service, backend chat adapter, session behavior, authentication, booking flow, itinerary feature, and router.
- Return structured tour recommendations backed by existing catalog/API records, with real IDs, images, prices, and verified labels.
- Show at most three highlighted tours at first, support more results, preserve tour context for follow-up questions, and show useful loading, empty, error, and retry states.
- Save an accepted itinerary proposal through the current itinerary API and open the returned itinerary ID in the existing editor.

## Non-goals

- Rebuild chat persistence, booking, authentication, itinerary editing, or any tour-detail page.
- Add a second itinerary planner inside the chatbot.
- Create or seed production tour records, synthetic IDs, availability, prices, images, or eco labels.
- Change the existing provider's operating rules or create a new booking confirmation flow.

## Anti-goals

- Do not display a proposal as a tour for sale.
- Do not claim availability or verified sustainability without an explicit source field.
- Do not render the full day-by-day proposal in the transcript; show a compact summary and let the existing editor handle details.
- Do not add nested vertical scrolling inside a tour card or allow the composer to scroll out of view.

## Current state and constraints

- The customer application is Angular 21. `GreenStepsChatComponent` is mounted at the app root and currently wraps the `aura-ai-chat` web component.
- `GreenStepsChatService` owns the in-memory conversation manager, provider adapter, `/api/support/chat` request, latest result, and request context. Conversations survive opening/closing and route changes for the lifetime of the service; a page reload starts a fresh in-memory session.
- The Express `/api/support/chat` adapter can load tours and services from the existing public APIs, use a fast path for a small explicit query grammar, send other requests and a compact real catalog to the existing n8n AI, and normalize structured responses against catalog records.
- Tour detail uses the existing `/tours/:id` route. Booking uses `/booking` and the current booking controller. The itinerary endpoint accepts the existing AI draft flow and the editor is at `/schedule/:id`.
- The current uncommitted workspace already contains chatbot and booking related changes. Implementation must preserve them and avoid reverting unrelated changes.
- The catalog loader is opt-in via `N8N_CATALOG_ENABLED`. Tour list records currently do not expose a reliable availability or remaining-capacity field. The card must therefore omit “Đặt tour” unless an explicit trusted backend field is available; ID plus price alone is not proof of bookability.
- Existing itinerary creation requires authentication, assigns the ID on the server, revalidates active service IDs, stores a draft, and returns the itinerary ID. This behavior remains authoritative.

## Approaches

1. **Keep Aura and adapt the planner panel.** Reserve measured space for cards above the composer and keep the current Aura chat. This minimizes the presentation changes, but cards remain separate from the message stream and can compete with transcript space.
2. **Replace only the visual shell with Angular (selected).** Use an Angular transcript, message bubbles, result cards, suggestion chips, and fixed composer while reusing `GreenStepsChatService`, its conversation manager/provider contract, existing backend, auth service, API service, and routes. This better matches the reference and supports inline cards and a single scrollable transcript. It touches more frontend presentation code, so the existing in-memory history and send/cancel/error behavior need explicit preservation.

The user selected approach 2. It is a visual shell change; it does not replace the chat/backend behavior.

## Design

### Conversation shell and state

- Keep the global launcher and route visibility behavior. Opening it shows an Angular panel with a branded header, a single scrollable transcript, and a composer fixed at the bottom of the panel.
- Render user and assistant bubbles in chronological order. Render the structured result attached to each assistant response so earlier recommendations remain visible after follow-up questions.
- Continue to use the active in-memory conversation ID, conversation manager, and existing chat service transport. A sent message is added once; the assistant response and its structured payload are stored once. Opening/closing or navigating must not clear the current conversation.
- Preserve the current endpoint, rate limiting, response validation, timeout, cancellation, and retry behavior. Contextual suggestions send through the same chat path and include the IDs of the latest real recommendations.
- Use the current session-memory lifetime; do not add local-storage or database chat persistence.

### Tour recommendations

- Backend remains the source of truth. An assistant-provided tour reference is resolved to an ID in the loaded catalog before it is returned to the browser. Reject unknown IDs and do not infer a sale listing from ordinary prose.
- Keep each card compact and responsive: database image when present, name, destination, duration, actual price/currency, labels only from returned tags, and a router link to the existing detail route.
- Show up to three cards initially. Reveal additional returned cards in small increments; when the backend has additional results or the returned set is exhausted, link to the existing tours page with its existing destination filter parameter.
- Show the booking action only when a trusted backend response explicitly confirms bookability. Use the existing booking route and its current revalidation/authentication behavior. The current tour catalog does not provide a capacity signal, so cards without such a field have no booking button.
- Empty catalog results show a no-match message and a path to the real tour directory. Catalog/API failures show an error with retry. No default/mock tour data is used in chat.

### Itinerary proposals

- Keep `itinerary_proposal` separate from `tour_recommendations`. Display a compact summary, activity count, verified service cost only, and an explicit note that a proposal is not a booking.
- “Để AI tạo lịch trình” uses the latest proposal and existing `createAiItinerary` API. The backend validates the authenticated user, day/activity bounds, and service IDs, creates the draft, returns its server-generated ID, and the router opens `/schedule/:id`.
- If unauthenticated, use the existing login modal and keep the proposal in chat memory. On API failure, show an inline retryable message.
- “Điều chỉnh phương án” focuses the existing composer; no second itinerary editor is added.

### Visual and accessibility behavior

- Use forest green `#103F33`, white and light gray surfaces, 14–18px card corners, clear text hierarchy, and the existing Vietnamese font stack.
- The transcript is the only vertically scrolling area. Cards may use a horizontal rail where width is constrained, but individual cards do not scroll vertically.
- Keep composer at the panel bottom, adapt the panel to mobile viewport/keyboard/safe-area insets, and retain accessible labels, focus handling, keyboard close, and reduced-motion support.
- Include skeleton/loading, empty, error, retry, disabled/saving itinerary, and success navigation states.

## Constraints and implementation calls left to the builder

- Reuse the existing Angular, Express, n8n, router, booking, and itinerary code; do not add dependencies unless source inspection proves an existing capability cannot be used.
- Preserve current uncommitted work and existing contracts. Any new response fields must be optional/backward compatible.
- Use the actual current route parameter consumed by the tours page when linking to more results; no new search page/API is required for this design.
- Keep chat history in service memory and attach structured response data to its corresponding assistant turn using a type-safe representation.
- The UI can present up to nine canonical results already permitted by the server adapter; a separate pagination API is outside scope.

## Acceptance and verification

1. A matching search displays real catalog IDs, names, images, prices, and only catalog-backed labels, with no more than three cards initially.
2. “Xem chi tiết” navigates to the selected tour's existing detail route.
3. When no catalog record matches, show an empty state and no synthetic listing.
4. Availability absent from the server means no “Đặt tour” action; when explicitly present, use the existing booking route without auto-confirming a booking.
5. An itinerary proposal is shown as a summary, not a sold tour or full itinerary transcript. Saving it uses the existing authenticated API and opens the server-returned ID in the editor.
6. Follow-up questions preserve the latest tour context and are sent through the existing endpoint.
7. API/network failure shows an error and a retry path. Loading keeps the composer usable according to the current cancel/send contract.
8. The UI works at desktop and mobile widths, with transcript-only vertical scrolling and the composer fixed at the bottom.

The user requested verification of these scenarios. Verification commands and results will be reported with the implementation; no new synthetic production data will be introduced to make scenarios pass.

## Known limitation

The current tour listing API does not confirm remaining seats or a bookable status. Until the backend exposes a trustworthy signal, the “Đặt tour” CTA is intentionally suppressed for those tour records. Booking can still be started from the real tour-detail page where the existing flow performs its checks.
