# Direct Frontend to n8n Chat Design

## Intent

Change the GreenSteps chat widget so each chat request goes from the browser directly to the n8n webhook. Keep MongoDB Atlas as the source of truth and preserve the current chat UI response contract.

## Chosen approach

The frontend obtains a short-lived, chat-scoped token from the backend, then sends the chat request directly to n8n. The backend no longer proxies chat messages or AI responses. n8n validates the token and calls a read-only backend catalog endpoint with server-side credentials when it needs current tours or services. The existing `search_tours` tool searches that bounded catalog. n8n returns the response shape the widget already consumes (`success`, `reply`, `type`, `tours`, `itinerary`, and related fields).

## Approaches considered

- **Backend read-only catalog API (chosen):** reuses the existing Mongo query and filtering logic; the browser never receives a database credential.
- **Direct MongoDB access from n8n:** adds Atlas credentials and duplicates catalog query rules in the workflow.
- **Unauthenticated public n8n webhook:** simplest setup, but leaves the chat endpoint open to automated abuse and cannot safely use the existing Header Auth secret in browser code.

## Goals and constraints

- Browser sends chat payloads directly to n8n; no chat request/response proxy through the backend.
- Backend issues short-lived chat tokens and serves a bounded, read-only catalog to n8n.
- Keep secrets out of Angular bundles and preserve catalog-based validation and the current widget response contract.
- Configure n8n webhook authentication, CORS, and server-side catalog credentials through deployment settings.
- This repository can prepare the workflow export, but activating it and setting n8n credentials require access to the user's n8n deployment.

## Not in scope

- Moving accounts, bookings, or other application APIs to n8n.
- Giving the browser direct access to MongoDB Atlas.
- Removing the existing backend chat endpoint until the direct workflow is configured and verified in deployment.
