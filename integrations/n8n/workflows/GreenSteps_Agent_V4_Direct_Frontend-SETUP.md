# GreenSteps Agent V4 direct frontend setup

This workflow is an inactive, credential-free import artifact. It keeps the Downloads export unchanged and uses a separate webhook path so the current workflow can remain available during setup.

## Configure the backend

On the backend service that the frontend uses, set:

- `N8N_CHAT_WEBHOOK_URL` to the new production webhook URL after importing and publishing this workflow.
- `N8N_CHAT_JWT_SECRET` to a random value at least 32 characters long.
- `N8N_CATALOG_API_KEY` to a different random value.

The backend issues a two-minute HS256 token for the browser. The browser sends that token to the webhook using `Authorization: Bearer`. The catalog key is used only between n8n and the backend.

## Configure the imported workflow

1. Attach a JWT Auth credential to `Webhook Chat1`. Use HS256 and the same passphrase as `N8N_CHAT_JWT_SECRET`.
2. Set Webhook **Allowed Origins (CORS)** to the exact deployed frontend origin, replacing `https://YOUR-FRONTEND-DOMAIN`.
3. Attach a Generic Credential Type → Header Auth credential to `Fetch Catalog1`. Set the header name to `X-GreenSteps-Catalog-Key` and the value to `N8N_CATALOG_API_KEY`.
4. Set `Fetch Catalog1` URL to the deployed backend catalog endpoint, for example `https://YOUR-RENDER-SERVICE.onrender.com/api/support/catalog`.
5. Reconnect the Google Gemini credential on `Google Gemini Chat Model1`; credentials are intentionally omitted from the export.
6. Publish the workflow, copy its production webhook URL, and set that URL as the backend's `N8N_CHAT_WEBHOOK_URL`.

`Fetch Catalog1` obtains the bounded Mongo-backed catalog before validation. The browser sends a detected `catalogDestination` separately so requests that put the destination after the duration (for example, “tour 3 ngày 2 đêm Đà Lạt”) still filter the backend catalog to the right destination. For `requestIntent: tour_search`, the agent is instructed to call `search_tours1` with the requested destination and day count. The final Code node maps selected tour IDs and itinerary service IDs back to records in that catalog before returning the widget response fields.

## Browser request contract

The browser first calls `POST /api/support/chat-access`, then posts the chat body directly to the returned `webhookUrl` with the returned Bearer token. Chat body fields are `message`, `sessionId`, `history`, `requestIntent`, `catalogDestination`, `catalogPage`, `currentTours`, and `plannerState`. The workflow returns `success`, `reply`, `output`, `type`, `tours`, `itinerary`, `totalTours`, `hasMoreTours`, `catalogAvailable`, and `suggestedQuestions`.

The repo contains no n8n deployment credentials. Import, credential attachment, origin configuration, and publishing must be completed in the n8n instance.
