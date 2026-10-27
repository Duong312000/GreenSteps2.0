# GreenSteps AI Trip Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for native execution or `superpowers:subagent-driven-development` for subagent-driven execution. Complete the plan task-by-task.

**Goal:** Upgrade GreenSteps AI to show real tour recommendations and itinerary proposals inline in an Angular chat while preserving the existing services, routes, booking, authentication, and chat session behavior.

**Architecture:** Replace only the current Aura presentation shell with Angular transcript and composer components. Extend the existing chat service to manage transcript messages and structured results while reusing its request adapter and memory-only conversation manager. Keep the Express catalog and itinerary APIs authoritative, and pass through booking availability only when the public backend explicitly supplies it.

**Tech Stack:** Angular 21, TypeScript, Express, Node.js built-in test runner, Vitest via Angular CLI, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-greensteps-ai-trip-planner-design.md`

## Global Constraints

- Keep the existing chat service, backend chat adapter, session behavior, authentication, booking flow, itinerary feature, and router.
- Backend remains the source of truth. An assistant-provided tour reference is resolved to an ID in the loaded catalog before it is returned to the browser.
- Do not create or seed production tour records, synthetic IDs, availability, prices, images, or eco labels.
- Show the booking action only when a trusted backend response explicitly confirms bookability.
- The transcript is the only vertically scrolling area. Cards may use a horizontal rail where width is constrained, but individual cards do not scroll vertically.
- Preserve current uncommitted work and existing contracts. Any new response fields must be optional/backward compatible.
- Keep chat history in service memory and attach structured response data to its corresponding assistant turn using a type-safe representation.

## Review Focus

1. A recommendation references an unknown tour ID or supplies conflicting price/image data; only catalog-backed records and fields should render. Pin this in backend normalization tests and the e2e card assertions.
2. A tour has an ID and price but no confirmed availability; it must not get a booking CTA. Pin this in canonical tour tests and e2e.
3. A response is empty, the catalog is unavailable, or the AI endpoint fails; distinguish no-match from error and keep retry functional. Pin these cases in e2e.
4. A follow-up compares prior recommendations or a new chat/history item is selected; preserve earlier result cards and only send valid current tour IDs. Pin this in service tests and e2e.
5. The mobile visual viewport shrinks or the user submits repeatedly; keep the composer visible, prevent duplicate requests, and keep vertical scrolling in the transcript. Pin this in e2e.

---

### Task 1: Trust backend tour availability

**Files:**
- Modify: `backend/src/services/greensteps-agent-catalog.service.js`
- Modify: `backend/src/services/greensteps-chat-structured.service.js`
- Modify: `backend/test/greensteps-chat-structured.test.js`
- Modify: `backend/test/greensteps-agent-catalog.test.js`

**Interfaces:**
- Catalog tour input may carry optional `bookingAvailable?: boolean` from the existing public tour API.
- `canonicalTour(tour)` continues returning `ChatTour` data and sets `bookingAvailable` to true only for an explicit boolean `true` from the canonical catalog row.

- [x] **Step 1: Write failing availability tests**

Add assertions that a catalog tour with a real ID and numeric price but no availability flag yields `bookingAvailable: false`; explicit `true` yields true; explicit `false` remains false. Add a loader assertion that only a literal backend boolean is retained.

- [x] **Step 2: Run the focused tests and verify they fail**

Run from `backend`: `node --test test/greensteps-chat-structured.test.js test/greensteps-agent-catalog.test.js`

Expected: the missing-availability assertion fails because the current canonical mapper infers bookability from ID and price.

- [x] **Step 3: Implement explicit availability pass-through**

In the catalog loader, copy only an existing literal boolean availability field from the public tour row. In `canonicalTour`, use only `tour.bookingAvailable === true`; do not infer from ID, price, or prose.

- [x] **Step 4: Re-run focused and full backend tests**

Run from `backend`: `node --test test/greensteps-chat-structured.test.js test/greensteps-agent-catalog.test.js`, then `npm test`.

Expected: both commands exit 0; existing real ID/price/image/eco-label normalization remains unchanged.

### Task 2: Add typed in-memory transcript operations

**Files:**
- Modify: `my-app/src/app/components/greensteps-chat/greensteps-chat.types.ts`
- Modify: `my-app/src/app/components/greensteps-chat/greensteps-chat.service.ts`
- Create: `my-app/src/app/components/greensteps-chat/greensteps-chat.service.spec.ts`

**Interfaces:**
- Add `ChatTranscriptMessage` with `id: string`, `role: 'user' | 'assistant'`, `content: string`, optional `result: GreenStepsChatResult`, and `createdAt: number`.
- Expose `transcript: Signal<ChatTranscriptMessage[]>`, `sendMessage(message: string): Promise<void>`, `cancelMessage(): void`, `startNewConversation(): Promise<void>`, `loadConversation(id: string): Promise<void>`, and `listConversations(): Promise<Conversation[]>` on `GreenStepsChatService`.
- Structured results remain attached to their assistant turn in conversation message metadata; latest tour IDs and itinerary proposal continue to feed the current backend request fields.

- [x] **Step 1: Add focused service tests**

Test that sending a message appends one user and one assistant entry, stores the structured result on the assistant entry, and keeps the active session ID stable. Test that a follow-up request includes only current canonical tour IDs. Test that cancelling aborts the in-flight request and does not add a fabricated assistant reply. Test that starting a new conversation keeps the prior item in the list and loading it restores its transcript and latest structured context.

- [x] **Step 2: Run the service tests and verify they fail**

Run from `my-app`: `npm test -- --include src/app/components/greensteps-chat/greensteps-chat.service.spec.ts`

Expected: the tests fail because transcript and conversation operations are not exposed for a custom shell.

- [x] **Step 3: Implement typed transcript and conversation methods**

Use the existing `Conversation` map and `conversationManager` for memory-only storage. On send, persist the user entry before calling the existing request adapter, then persist the assistant reply with a cloned structured result. On loading a conversation, derive the transcript and latest result from stored messages. On new conversation, create a new ID and clear active result/itinerary state without deleting older conversations. Keep request validation, timeout, abort, and error state behavior in the current adapter; expose cancellation to the Angular stop action by aborting the active request signal.

- [x] **Step 4: Re-run the focused service tests**

Run from `my-app`: `npm test -- --include src/app/components/greensteps-chat/greensteps-chat.service.spec.ts`

Expected: all service tests pass; a second message includes the first turn in history but does not duplicate the current user message.

### Task 3: Replace Aura's visual shell with Angular chat UI

**Files:**
- Modify: `my-app/src/app/components/greensteps-chat/greensteps-chat.component.ts`
- Modify: `my-app/src/app/components/greensteps-chat/greensteps-chat.component.html`
- Modify: `my-app/src/app/components/greensteps-chat/greensteps-chat.component.css`
- Modify: `my-app/e2e/greensteps-chat.e2e.cjs`

**Interfaces:**
- The component consumes `transcript`, `sendMessage`, `startNewConversation`, and `listConversations` from Task 2.
- Keep existing router navigation, `AuthService`, `LoginModalService`, `ApiService.createAiItinerary`, route visibility, launcher, and responsive visual viewport behavior.

- [x] **Step 1: Update the Playwright scenario before replacing the shell**

Change the existing e2e script to expect an Angular transcript/composer instead of `<aura-chat>`. Add checks for welcome prompts, sending a normal text turn, one structured result attached inline, new chat/history controls, no API call on open/reopen, and retention of the same active session across close/open and route navigation.

- [x] **Step 2: Build the current app and run e2e to verify the new expectations fail**

Run from `my-app`: `npm run build`, then `npm run test:chat:e2e`.

Expected: the build succeeds and the browser test fails on the missing Angular transcript/composer selectors while the current Aura shell is still present.

- [x] **Step 3: Implement the native Angular shell**

Keep the existing root launcher and route visibility rules. Render a branded header with new-chat, history, and close controls; a welcome state with suggested prompts; chronological user/assistant bubbles; and a composer fixed to the bottom of the panel. Only the transcript container scrolls vertically. Use the existing service methods, prevent duplicate sends while pending, show a stop action during a request, keep the latest user message for retry, and preserve outside-click, Escape, focus restoration, mobile viewport, safe-area, and reduced-motion behavior without traversing Aura shadow DOM.

- [x] **Step 4: Re-run the shell e2e checks**

Run from `my-app`: `npm run build`, then `npm run test:chat:e2e`.

Expected: the Angular shell renders; open/close/new/history/reopen/route behavior passes without page errors or unintended requests.

### Task 4: Integrate inline recommendations, follow-ups, and itinerary actions

**Files:**
- Modify: `my-app/src/app/components/greensteps-chat/greensteps-chat.component.html`
- Modify: `my-app/src/app/components/greensteps-chat/greensteps-chat.component.ts`
- Modify: `my-app/src/app/components/greensteps-chat/greensteps-chat.component.css`
- Modify: `my-app/src/app/components/greensteps-chat/tour-card.component.ts`
- Modify: `my-app/e2e/greensteps-chat.e2e.cjs`

**Interfaces:**
- Each assistant transcript entry may include `GreenStepsChatResult`; `ChatTour` remains the existing card model and `ChatItineraryDraft` remains the existing save payload.
- The tour detail link remains `/tours/:id`; the booking link remains `/booking` with `tourId`, `bookingType: 'tour'`, and `guestCount: 1`; tours directory filtering uses the `dest` query parameter already consumed by `ToursComponent`.
- Itinerary saving continues through `ApiService.createAiItinerary(plan)` and navigates only to the ID returned by the backend.

- [x] **Step 1: Add failing e2e assertions for recommendation and itinerary states**

Mock structured API replies and assert: three initial cards maximum; real card fields; no booking link without explicit availability but a booking link when explicitly true; the selected tour detail and existing booking routes; reveal-more and destination-directory link; no-match state with zero fake cards; API error and retry; follow-up request includes current tour IDs while prior cards stay visible; itinerary proposal is a summary; unauthenticated save opens the existing login modal; authenticated save POSTs to the existing endpoint and navigates to the returned itinerary ID.

- [x] **Step 2: Run the expanded e2e and resolve assertion failures**

Run from `my-app`: `npm run build`, then `npm run test:chat:e2e`.

The expanded browser run exercised the new result, booking, empty/error/retry, and itinerary paths. Its first failure was a selector targeting the hidden Angular modal host instead of the visible overlay; the test now targets the overlay and the complete E2E run passes. The UI wiring had been implemented alongside this test expansion, so this run did not produce the planned pre-implementation RED state.

- [x] **Step 3: Render structured results and actions inline**

Render each assistant turn's result directly beneath its text. Show the first three tours and reveal more in batches of three; after the returned set is exhausted, navigate to `/tours?dest=<destination>`. Retain `TourCardComponent` fields from canonical catalog data and hide the booking action unless `bookingAvailable` is true. Render empty results separately from unavailable/API failure and provide a retry that resends the last user text once. Render itinerary proposals as compact summary cards with adjust/save actions; preserve login, save-error, and server-ID navigation behavior.

- [x] **Step 4: Run final verification for all requested scenarios**

Run from `backend`: `npm test`.

Run from `my-app`: `npm test`, `npm run build`, then `npm run test:chat:e2e`.

Expected: backend tests, production build, and browser scenarios pass. The full Angular suite is recorded against its pre-existing baseline (17 failures, 17 passing tests, 2 unhandled fixture errors); failures are outside this chat change and include missing `ngModel`/`ActivatedRoute` test setup.

---

## Spec coverage self-review

- Existing chat/API/auth/booking/itinerary preservation: Tasks 2–4.
- Catalog-backed search, structured types, no fake tours, and real detail navigation: Tasks 1 and 4; existing backend adapter remains in use.
- Conditional booking CTA based on explicit signal: Task 1 and Task 4.
- Itinerary summary/save/auth/ID navigation: Task 4.
- Contextual suggestions and follow-up history: Tasks 2 and 4.
- Responsive inline UI, loading/empty/error/retry, transcript-only scroll: Tasks 3 and 4.
- Requested scenarios A–G and API failures: Task 4's e2e cases and full verification.

## Proportion and implementation notes

The scope is one integrated chat feature with separate backend normalization, service state, shell, and result presentation tasks. Do not change unrelated dirty files or commit the workspace's pre-existing edits. The test commands in this plan are requested by the user and are part of delivery.
