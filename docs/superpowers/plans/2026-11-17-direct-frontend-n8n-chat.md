# Direct Frontend to n8n Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Send chat requests from the GreenSteps browser widget directly to the n8n production webhook while retaining Atlas catalog data and the existing widget response contract.

**Architecture:** The backend issues a short-lived HS256 chat token and exposes a bounded catalog endpoint for server-to-server n8n calls. Angular obtains the token, then posts chat directly to the n8n webhook. n8n validates JWT auth, fetches catalog from the backend with a server-side API key, calls `search_tours` for explicit tour searches, and returns the widget's `success`/`reply`/structured result fields.

**Tech Stack:** Angular HttpClient, Express, existing `jsonwebtoken` dependency, MongoDB repositories, n8n Webhook/HTTP Request/Code/LangChain nodes.

**Spec:** `docs/superpowers/specs/2026-11-17-direct-frontend-n8n-chat-design.md`

## Global Constraints

- Never place a long-lived secret in Angular code or workflow export JSON.
- Frontend chat POSTs go directly to the n8n webhook; backend endpoints only issue access tokens and serve read-only catalog data.
- n8n and the backend share `N8N_CHAT_JWT_SECRET` for short-lived webhook JWTs; n8n and the backend share `N8N_CATALOG_API_KEY` for catalog reads.
- Keep catalog reads bounded to the existing page limits and response fields.
- Preserve the widget response fields `success`, `reply`, `type`, `tours`, `itinerary`, `totalTours`, `hasMoreTours`, `catalogAvailable`, and `suggestedQuestions`.
- Do not edit `backend/.env`; retain all pre-existing working-tree changes.
- Do not add or run tests unless requested; use syntax, JSON, and diff checks only.

## Review Focus

- Missing or expired JWT: n8n rejects the request and the widget shows a useful retry error.
- Browser preflight: only the configured production frontend origin can read webhook responses.
- Missing catalog API credential or unavailable Atlas: workflow returns a bounded, explicit catalog error and does not invent tours/prices.
- Explicit tour search: the agent calls `search_tours` with destination and `days`, then only returns selected tour IDs that exist in the fetched catalog.
- Plain-text or malformed model output: workflow still returns a valid `success` and `reply` response without fabricated structured tour or itinerary data.

---

### Task 1: Add backend chat access and catalog endpoints

**Files:**
- Create: `backend/src/services/n8n-chat-access.service.js`
- Modify: `backend/src/routes/support.routes.js`
- Modify: `backend/.env.example`
- Modify: `backend/README.md`

**Interfaces:**
- `POST /api/support/chat-access` returns `{ success: true, webhookUrl, token, expiresIn }`, where the token is HS256, has a 120-second expiry, and is signed with `N8N_CHAT_JWT_SECRET`.
- `POST /api/support/catalog` accepts `{ message, requestIntent, catalogPage }`, requires `X-GreenSteps-Catalog-Key` matching `N8N_CATALOG_API_KEY`, and returns `{ success: true, catalog }` using `queryFromRequest` and `loadAgentCatalog`.
- Catalog endpoint returns no more than the existing 20-row page per collection; itinerary requests may include bounded service candidates.

- [x] Implement token issuance with missing-config handling; include only a short-lived chat scope and optional user subject.
- [x] Add rate limiting to token issuance using the existing support chat request pattern.
- [x] Add constant-time API-key validation for the server-to-server catalog route and return only catalog fields already approved by `loadAgentCatalog`.
- [x] Document `N8N_CHAT_WEBHOOK_URL`, `N8N_CHAT_JWT_SECRET`, and `N8N_CATALOG_API_KEY` without adding secret values.
- [x] Check JavaScript syntax and review the route diff.

### Task 2: Update the n8n import artifact

**Files:**
- Create: `integrations/n8n/workflows/GreenSteps_Agent_V4_Direct_Frontend.json`
- Create: `integrations/n8n/workflows/GreenSteps_Agent_V4_Direct_Frontend-SETUP.md`

**Interfaces:**
- Webhook uses JWT Auth with HS256 and the `N8N_CHAT_JWT_SECRET` credential; its Allowed Origins is the configured frontend origin.
- An HTTP Request node calls `POST /api/support/catalog` using an n8n-managed Header Auth credential for `N8N_CATALOG_API_KEY` and merges the result into the validated request as `context.catalog`.
- Explicit `requestIntent: tour_search` instructs the agent to call `search_tours`; for a three-day request, pass `days: 3`.
- Final response includes the widget contract fields; selected tour IDs are resolved against `context.catalog.tours` before returning records.

- [x] Copy the user-provided V4 export into a credential-free repository artifact; retain the original file untouched.
- [x] Change webhook auth to JWT Auth and configure the allowed-origin placeholder without embedding any credential values.
- [x] Add catalog HTTP fetch/merge nodes and update the input normalization to retain the original message/session/history.
- [x] Update the agent instructions to require `search_tours` for explicit tour search and map structured selections back to catalog records.
- [x] Make the final reply include `reply` plus `output` compatibility and only validated structured records.
- [x] Add setup instructions for the two n8n credentials, backend catalog URL, webhook production URL, and CORS origin.
- [x] Parse the exported workflow as JSON and inspect node connections and credential references.

### Task 3: Send widget chat directly to n8n

**Files:**
- Modify: `my-app/src/app/components/greensteps-chat/greensteps-chat.service.ts`

**Interfaces:**
- Before each chat request, call `${getApiUrl()}/support/chat-access`; use the returned `webhookUrl` and Bearer `token` for the chat POST.
- Send message, session ID, bounded history, planner state, current tour IDs, and explicit request intent to n8n.
- Normalize the n8n JSON object or one-item JSON array into the existing frontend `GreenStepsChatResponse` contract.

- [x] Remove `/support/chat` as the widget's chat POST target while retaining the backend base URL for token issuance.
- [x] Add token retrieval and direct n8n POST with `Authorization: Bearer <short-lived token>`.
- [x] Preserve cancellation, timeout, transcript, and displayed error behavior across the two-request token/chat sequence.
- [x] Keep the public webhook URL dynamic from the backend response; do not embed authentication secrets in the Angular bundle.
- [x] Check TypeScript syntax via available compiler-only tooling only if it does not run tests; inspect the final diff.

### Task 4: Handoff deployment configuration

**Files:**
- Modify: `integrations/n8n/workflows/GreenSteps_Agent_V4_Direct_Frontend-SETUP.md`
- Modify: `backend/README.md`

- [x] Document required backend environment variable names and matching n8n credential setup.
- [x] Document importing and activating the new workflow, allowed frontend origin, catalog API URL, and production webhook URL.
- [x] State that deployment activation and credential creation must be completed in the user's n8n instance; they are not present in this repository.
