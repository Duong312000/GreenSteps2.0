# Shared Admin Account Detail Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the user detail drawer and add provider detail access with one configurable, centered account modal backed by real admin APIs.

**Architecture:** A standalone Angular modal receives account type, detail record, tab data, busy states, and action outputs. Existing page components remain API adapters and refresh their own list after successful updates. Provider detail/edit/status/history endpoints are added to the existing admin controller and router, using MongoDB-backed models and audit logs.

**Tech Stack:** Angular standalone components, TypeScript, existing `ApiService`, Express, Mongo-backed model store.

**Spec:** `docs/superpowers/specs/2026-11-02-shared-admin-account-modal-design.md`

## Global Constraints

- Modal maximum width 900px, maximum height 90vh, 12px radius, centered white surface, dim overlay, independent content scrolling.
- User and provider tabs/actions are selected by account type and share one modal component.
- Display only data persisted in MongoDB; missing values use an empty/unavailable state.
- Preserve Admin sidebar, header, tables, provider approval flow, and unrelated sections.
- No tests are added or run in this plan; implementation verification uses build and syntax checks only.

## Review Focus

- A stale detail response after closing or switching accounts must not overwrite the active modal; preserve request identity guards.
- A provider row may lack a linked User or Provider document; show a retryable not-found/error state and do not fabricate details.
- Missing provider legal fields and empty audit/business history must render as unavailable/empty.
- Provider lock/unlock must modify account access without changing provider verification status.
- Narrow screens must keep modal controls reachable and content scrollable.

---

### Task 1: Provider account admin APIs

**Files:**
- Modify: `backend/src/controllers/admin-users.controller.js`
- Modify: `backend/src/routes/admin-users.routes.js`
- Modify: `my-app/src/app/services/api.service.ts`

**Interfaces:**
- Add provider detail by user ID, returning safe user, provider profile, contract data, provider business counts, and admin audit history.
- Add provider profile update with reason, provider account suspend/unsuspend using existing account status fields, and audited status changes.
- Add matching `ApiService` provider detail/update/status calls and invalidate provider/user admin caches after success.

- [ ] Add admin-only GET/PATCH endpoints under `/admin/providers/:userId`, plus POST `/suspend` and `/unsuspend` endpoints; validate user/provider existence and editable fields, exclude password fields, and record `AdminAuditLog` entries.
- [ ] Implement Mongo-backed detail aggregation from User, Provider, VenderContract, GreenService, ServiceBooking, TourBooking, and AdminAuditLog; return only fields used by the modal and persisted counts.
- [ ] Add typed `ApiService` methods and cache invalidation for these routes.
- [ ] Run backend JavaScript syntax checks and Angular build.

### Task 2: Shared account modal component

**Files:**
- Create: `my-app/src/app/pages/admin/account-detail-modal.component.ts`
- Create: `my-app/src/app/pages/admin/account-detail-modal.component.html`
- Create: `my-app/src/app/pages/admin/account-detail-modal.component.css`

**Interfaces:**
- Inputs: account type (`user` or `provider`), detail object, active tab, tab definitions, loading/error/busy/edit state.
- Outputs: tab selection, retry, edit start/save, lock/unlock, close.
- Render all information from supplied detail data; do not call APIs or hardcode account records inside the component.

- [ ] Define typed account/tab configuration and event contracts.
- [ ] Implement accessible modal overlay, centered responsive dialog, identity header/statuses, account-type tabs, two-column detail grids, loading/error/empty states, edit form, and footer actions.
- [ ] Add escape/backdrop close handling and restore body scrolling on destroy.
- [ ] Run Angular build.

### Task 3: User management integration

**Files:**
- Modify: `my-app/src/app/pages/admin/admin-users.ts`
- Modify: `my-app/src/app/pages/admin/admin-users.html`
- Modify: `my-app/src/app/pages/admin/admin-users.css`

**Interfaces:**
- Use existing user detail, activity, booking, profile update, and status APIs.
- Adapt user tab labels to General information, Booking history, Activity history, and Admin history, using audit records for the two history views where appropriate.

- [ ] Replace the drawer markup with the shared modal while preserving user detail request guards, pagination, and admin action reason flow.
- [ ] Map user edit/status operations to modal outputs and refresh the table after successful changes.
- [ ] Ensure general details, activity, bookings, and admin history have loading, empty, and error states.
- [ ] Run Angular build.

### Task 4: Provider queue integration

**Files:**
- Modify: `my-app/src/app/pages/admin/admin.ts`
- Modify: `my-app/src/app/pages/admin/admin.html`
- Modify: `my-app/src/app/pages/admin/admin.css`

**Interfaces:**
- Open the modal from clicking a provider row; stop propagation from existing approve controls.
- Load detail by provider row `actionId` (linked user ID); use provider APIs from Task 1.
- Keep existing list/approval flow unchanged.

- [ ] Add provider modal state, detail loading/retry guards, tab data, edit form, action reason handling, and list refresh after successful actions.
- [ ] Make provider table rows open the shared modal without changing their appearance or existing approval buttons.
- [ ] Map stored provider/company/legal fields and activity counts to General, Legal profile, Business activity, and Admin history tabs.
- [ ] Run Angular build and backend syntax checks.

### Task 5: Responsive and integration verification

**Files:**
- Modify: modal/page styles only if needed.

- [ ] Confirm visually by code review that modal sizing, overlay, scroll container, responsive grid, and footer behavior meet the spec.
- [ ] Confirm provider lock/unlock leaves `provider_status` unchanged and provider edit/status actions refresh the visible provider queue.
- [ ] Confirm user modal, create-user dialog, bulk actions, provider approval, and unrelated Admin sections remain wired to their existing behavior.
- [ ] Run final Angular production build and backend syntax checks; report any unrelated baseline limitation separately.
