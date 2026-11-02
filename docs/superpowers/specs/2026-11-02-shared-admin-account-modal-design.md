# Shared Admin Account Detail Modal

## Intent

Replace the user management side drawer and add provider row details with one centered, reusable account modal. Keep account-specific tabs and actions configurable while preserving the surrounding Admin navigation, header, tables, and queue actions.

## Goals and constraints

- One standalone modal component serves traveler/user and provider account details.
- The modal is centered, white, 900px maximum width, 90vh maximum height, 12px radius, dim overlay, and independently scrollable content; it adapts to narrow screens.
- User tabs: general information, bookings, activity, and admin history. Provider tabs: general information, legal profile, business activity, and admin history.
- Header presents identity, account code, avatar/logo, account status, and provider verification status where available.
- Edit and lock/unlock actions use authenticated admin APIs and refresh their list after success.
- Display values stored in MongoDB; absent legal/business data is shown as unavailable, never fabricated.
- Loading, empty, and error states are visible; detail failures can be retried.
- Reuse the current `ApiService`, admin account API patterns, and existing page styles. Do not change unrelated Admin sections or list presentation.

## Existing constraints found

- User detail, bookings, audit, profile update, and account status APIs already exist under `/admin/users`.
- Provider queue is served by `/partner/pending`; it currently has no detail/edit/status routes. Provider records contain `name_provider`, `field`, `destination`, `image_url`, and `provider_status`; provider contracts contain `name_contract` and `text`.
- Provider rows identify the account by `User.id`. Provider account details and actions therefore resolve by user ID and combine the User, Provider, provider contract, and stored business activity data that exists.
- Do not change the provider list table or its approval flow.

## Approaches

1. Keep separate page-owned detail logic and share only modal markup. This minimizes wiring changes but leaves data loading, tab state, and actions duplicated.
2. Use one configurable modal component with account type, detail data, tab configuration, and typed action events; page containers supply API data and handle list refreshes. Extend the existing admin API surface for provider detail/edit/status/audit. This preserves page responsibilities while sharing the complete presentation and interaction model.

## Chosen approach

Use approach 2. The shared component owns modal presentation, tab rendering, loading/empty/error states, and edit form UI; each existing page remains the data/action adapter and calls `ApiService`. Provider backend operations are added to the existing admin users controller/router, keyed by user ID, and record admin audit entries. The provider model's stored fields are editable; no new legal fields are invented.

## Open implementation choices

- Render the shared component from both the Admin provider queue and Admin users component; preserve all existing list markup and actions.
- For provider history, query admin audit records by target user ID and show provider business counts from persisted services/bookings.
- Provider lock/unlock uses the existing user `account_status` mechanism; provider approval status remains a separate verification state.
