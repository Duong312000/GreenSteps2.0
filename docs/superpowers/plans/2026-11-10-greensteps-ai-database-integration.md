# GreenSteps AI Database Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure catalog-dependent GreenSteps advice and itinerary planning uses a bounded MongoDB-backed catalog through the backend on every UI path, and refuses to claim unverified business data.

**Architecture:** Replace the self-HTTP/full-list catalog load with a shared search service that queries the existing Mongo repositories using destination, duration, budget, service type, and canonical service status filters. Keep the new support chat contract, and adapt the legacy AI endpoint to use the shared chat adapter only for catalog-dependent travel prompts while retaining booking, FAQ, and schedule actions and the legacy response shape. Do not touch the remotely managed n8n workflow; its export is absent.

**Tech Stack:** Node.js, Express, MongoStore repositories, Angular, Node test runner, isolated local MongoDB replica set.

**Spec:** User request in chat, “Fix GreenSteps AI Chatbot Database Integration” (2026-11-10).

## Global Constraints

- Preserve existing UI and legacy response fields `{success, reply, recommendation, action}`.
- Do not change or seed production data; use only a dedicated `TEST_MONGODB_URI` database for integration tests.
- Do not send the full catalog to n8n; query and return a bounded, relevant page.
- Treat only `active` services as publicly bookable/displayable; pending, suspended, and unknown statuses are excluded.
- Preserve existing booking lookup, static FAQ, and schedule time-adjustment behavior.
- Never attach service ID, price, carbon, or availability to an activity unless it matches a live catalog record.
- Do not modify production n8n; only assess or create a separate import file if the source export is available.
- Preserve all unrelated pre-existing working-tree changes.

## Review Focus

- Database unavailable or one catalog query fails: return a safe unavailable response and do not call AI with an empty catalog.
- Search returns no records: state no matching catalog items rather than inventing one.
- More matching records exist than one page: return a bounded page and accurate pagination/truncation metadata.
- Legacy booking, FAQ, and schedule actions: keep their existing response shape and dispatch behavior.
- Client-supplied itinerary activity data: treat as unverified unless matched to the queried catalog.

## Files and Responsibilities

- `backend/src/services/greensteps-agent-catalog.service.js`: bounded Mongo search, canonical status filtering, paging, and short cache.
- `backend/src/services/greensteps-chat.service.js`: use the catalog search for each request; fail closed for catalog-dependent prompts.
- `backend/src/services/ai-router.service.js` and `backend/src/controllers/ai.controller.js`: route legacy travel advice through the shared adapter while preserving old features and response shape; remove identity forwarding and hard-coded auth fallback.
- `backend/src/app.js`: sanitize the existing database-unavailable response without disturbing current security middleware.
- `backend/test/greensteps-agent-catalog.test.js`, `backend/test/greensteps-chat.test.js`, and new focused tests: pin filter, status, pagination, legacy routing, privacy, and unavailable behavior.
- `my-app/src/app/pages/schedule-editor/schedule-editor.ts`: display a curated backend unavailable message rather than masking it; preserve chat UI.
- `backend/test/greensteps-catalog-mongo.integration.test.js`: use isolated test-only MongoDB records to compare search and chat payload data with source records.

## Task 1: Mongo Catalog Search

**Interfaces:** `loadAgentCatalog({ query, models, signal })` returns `{available, fetchedAt, truncated, nextPage, tours, services}`. Filters are validated and bounded; only service status `active` qualifies. Tests inject repositories; integration tests use an isolated MongoStore.

- [ ] Add failing tests for destination, budget, duration, service type, status, page-size limits, and next-page metadata.
- [ ] Run the focused tests and confirm they fail for the missing search contract.
- [ ] Implement bounded repository queries and map only public fields.
- [ ] Re-run focused catalog tests; verify all filters and limits.

## Task 2: Catalog-Backed Chat and Legacy Adapter

**Interfaces:** `createChatAdapter` accepts a catalog query; catalog-dependent requests fail with `CHAT_CATALOG_UNAVAILABLE` when Mongo reads fail. Add an exported legacy adapter that maps the shared response into `{success, reply, recommendation, action}`.

- [ ] Add failing tests for no-match and unavailable fail-closed behavior, legacy travel routing, and booking/FAQ/action preservation.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement shared catalog routing, strict status, no user ID forwarding, and removal of hard-coded auth fallback.
- [ ] Run chat and legacy router tests; verify old response shape.

## Task 3: Error and Frontend Behavior

- [ ] Add failing API/controller tests proving DB error details are not returned and legacy catalog failures map to a safe status/message.
- [ ] Verify RED.
- [ ] Sanitize the global DB error and surface curated backend failure text in the existing Schedule Editor transcript.
- [ ] Run backend and Angular focused tests; ensure UI templates and schemas remain unchanged.

## Task 4: Isolated Mongo Integration and Final Verification

- [ ] Add an integration test using unique IDs and a dedicated test database/prefix; compare returned price, duration, destination, carbon, and service status to inserted records.
- [ ] Start or use only a disposable local replica set on the documented test URI; never point at app or production DB.
- [ ] Verify tour, service, non-existent tour, three-day itinerary payload, truncation/page behavior, database unavailable behavior, and all three UI/API paths.
- [ ] Run relevant backend and Angular suites, inspect changed-file diff, and report any unavailable live n8n check as `NOT TESTED`.

## n8n Workflow

The referenced workflow export is not present in the workspace, and repository notes say the active workflow is hosted remotely. Do not infer node behavior or generate an importable workflow from guesswork. Confirm that the backend payload remains compatible; report a separate workflow update as required only if the deployed workflow fails to consume the bounded `context.catalog` contract.
