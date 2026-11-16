# GreenSteps Verified Itinerary Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let itinerary AI select real active GreenSteps services by ID while keeping free-form suggestions explicitly unverified.

**Architecture:** The backend performs bounded, destination/type/budget/status-filtered Mongo searches and provides a small service-candidate set to V3. V3 asks for a structured itinerary containing a candidate service ID or an unlinked suggestion; the backend resolves IDs against active, destination-compatible catalog rows and fills all verified metadata from Mongo. The frontend itinerary schema remains unchanged.

**Tech Stack:** Node.js, MongoDB repositories, n8n workflow JSON, Node test runner, existing Angular itinerary contract.

**Spec:** User request in chat, “Fix GreenSteps AI Planner — Verified Database Services” (2026-11-10).

## Global Constraints

- Do not modify MongoDB Atlas data.
- Do not call the production n8n webhook or edit the hosted workflow.
- Do not verify services by name similarity; require an exact backend-supplied service ID.
- Only active, non-hidden services whose destination matches the itinerary can be verified.
- Never use Gemini-supplied cost, carbon, status, or service ID unless the ID resolves to a backend candidate; canonical metadata comes from Mongo.
- Keep the existing frontend itinerary activity fields and booking/schedule behavior.
- Do not send the full catalog to n8n; bound candidate collection and prompt size.

## Root-Cause Evidence and Limits

- The backend prompt contract currently specifies itinerary activities as `{name,time}` and does not require `serviceId`.
- V3's itinerary prompt includes at most six page services, while V3 search tools only search the supplied page; backend service pagination metadata signals that more rows may exist.
- Backend normalizes itinerary services against the current page. It currently permits exact name matching as a fallback; plain-text itinerary parsing drops all identifiers.
- Unaccented Vietnamese destination text was parsed from the request but the Mongo destination filter was accent-sensitive, so a request like `Da Lat` could exclude `Đà Lạt` records before candidate selection.
- The live execution recorded counts and final `verifiedActivities: 0`, but not the raw Gemini output. Therefore it does not prove whether Gemini omitted IDs or the returned names/destination failed verification.

## Review Focus

- Unknown, inactive, or cross-destination IDs remain unverified and unpriced.
- Exact names without IDs do not become verified services.
- Candidate collection finds services beyond the first catalog page while stopping at a fixed page bound.
- A search incomplete at the page bound remains explicitly partial.
- Mixed verified services and free-form activities preserve the existing itinerary response fields.

## Files and Responsibilities

- `backend/src/services/greensteps-agent-catalog.service.js`: bounded service-candidate pagination for itinerary requests.
- `backend/src/services/greensteps-chat.service.js`: request candidate lookup only for itinerary intent and extend the internal n8n contract.
- `backend/src/services/greensteps-chat-structured.service.js`: strict ID-based verification and canonical Mongo metadata.
- `integrations/n8n/GreenSteps_Web2_Gemini_Agent_V3_Performance.json`: V3 input normalization, service candidate tool/search context, and explicit JSON itinerary/serviceId instructions; remain inactive and credential-free.
- `backend/test/greensteps-agent-catalog-search.test.js`, `backend/test/greensteps-chat-structured.test.js`, `backend/test/greensteps-chat.test.js`, `backend/test/greensteps-n8n-workflow-compatibility.test.js`: isolated regression coverage.

## Task 1: Strict Backend Verification

- [x] Add failing tests for exact-ID verification, name-only rejection, unknown ID, inactive status, wrong destination, and mixed verified/suggested activities.
- [x] Verify the tests fail for the existing name fallback/status assumptions.
- [x] Resolve only exact service IDs present in active candidate/catalog entries; use catalog name, cost, carbon, type, and ID.
- [x] Run the structured-response tests.

## Task 2: Bounded Candidate Search and Prompt Contract

- [x] Add failing tests for bounded candidate page traversal, destination/type/budget/status filters, page-two service inclusion, and incomplete-search metadata.
- [x] Add failing chat-adapter tests proving candidates reach n8n only for itinerary requests and current catalog/response fields remain compatible.
- [x] Query up to two pages of 20 matching active services and expose at most 40 candidate rows with an explicit completeness flag. This includes page two of the existing default catalog while preserving a strict bound.
- [x] Update backend itinerary contract to require JSON activity objects with `serviceId` for verified services and null/omitted IDs for suggestions.
- [x] Match Vietnamese destinations accent-insensitively while retaining bounded Mongo search.
- [x] Run catalog and chat tests.

## Task 3: V3 Compatibility and Final Verification

- [x] Update V3 validation/tool prompt to preserve candidate IDs/status/destination and use candidates for itinerary search.
- [x] Instruct Gemini to return structured itinerary JSON and never invent service IDs; keep service-free ideas unverified.
- [x] Add static workflow tests for V3 candidate schema, service ID prompt, bounded list, inactive status, and no credentials.
- [x] Run focused tests and the full backend suite; frontend activity type requires no change because its existing schema already supports verified/serviceId.
- [x] Inspect final diff and confirm production n8n and Atlas were not called or modified.
