# GreenSteps Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the GreenSteps Angular admin page to match the supplied dashboard reference while retaining the existing API and approval behavior.

**Architecture:** Keep dashboard state in the existing `AdminComponent`; use the existing `ApiService` and add only frontend response-state helpers if necessary. Render unsupported modules as explicit placeholders and isolate synthetic rows behind an explicit development preview switch.

**Tech Stack:** Angular 21, TypeScript, Angular templates, component CSS, Bootstrap Icons, existing `ApiService`.

**Spec:** `docs/superpowers/specs/2026-10-31-greensteps-admin-dashboard-design.md`

## Global Constraints

- Frontend UI only; do not change backend, database, models, or API endpoints.
- Do not replace live API data with mock data.
- Preview data must be development-only, explicitly activated, visibly labeled, and unable to send mutations.
- Preserve admin gating, logout, and existing provider, wallet, and booking actions.
- Do not modify customer/provider pages or unrelated uncommitted files.

## Review Focus

- Admin shell suppresses global public header/footer/chat only on `/admin`; other routes retain them.
- No live KPI or right-panel metric is fabricated when an API is absent.
- Existing API response shapes render correctly, especially wrapped withdrawal responses.
- Preview mode never calls action APIs and cannot appear automatically in a production build.
- Desktop, narrow laptop, tablet, mobile drawer, and 125% zoom layouts remain usable.

---

### Task 1: Admin shell and responsive navigation

**Files:**
- Modify: `my-app/src/app/app.ts`
- Modify: `my-app/src/app/app.html`
- Modify: `my-app/src/app/pages/admin/admin.ts`
- Modify: `my-app/src/app/pages/admin/admin.html`
- Modify: `my-app/src/app/pages/admin/admin.css`

**Interfaces:**
- `App.isAdminRoute: boolean` controls public shell visibility.
- `AdminComponent` owns active navigation, compact sidebar, mobile drawer, and preview state.

- [ ] Add a focused component spec for route-shell visibility and admin navigation state; run it and confirm expected initial failure.
- [ ] Hide the global header/footer/chat on `/admin` only.
- [ ] Add the 14-item sidebar, compact and mobile-drawer controls, and route/tab mapping.
- [ ] Run the focused spec and Angular build.

### Task 2: Real queue loading and dashboard data states

**Files:**
- Modify: `my-app/src/app/services/api.service.ts`
- Modify: `my-app/src/app/pages/admin/admin.ts`
- Modify: `my-app/src/app/pages/admin/admin.html`

**Interfaces:**
- Add frontend-only queue result helpers returning `{ data, available }` for provider, deposit, withdrawal, wallet-activation, and booking queues.
- Preserve all existing mutation methods and backend endpoint paths.

- [ ] Add a focused spec for wrapped withdrawal response normalization and unavailable queue state; run it and confirm expected initial failure.
- [ ] Normalize the actual withdrawal response `{ success, withdrawals }` and expose loading/unavailable states without changing backend APIs.
- [ ] Bind KPI counts only to real loaded queues; render em dashes for unsupported metrics and empty/failed states.
- [ ] Run the focused spec and Angular build.

### Task 3: Overview, queues, insights, and preview mode

**Files:**
- Modify: `my-app/src/app/pages/admin/admin.ts`
- Modify: `my-app/src/app/pages/admin/admin.html`
- Modify: `my-app/src/app/pages/admin/admin.css`
- Modify: `my-app/src/app/pages/admin/admin.spec.ts`

**Interfaces:**
- Preview is enabled only when `isDevMode()` and query parameter `adminPreview=1` are both true.
- Unsupported management tabs and system widgets show explicit “Đang phát triển” or “Chưa kết nối giám sát” states.
- Existing confirm dialogs and mutation handlers remain available only for live API-backed rows.

- [ ] Add a spec proving preview is off by default and disallows mutation handlers; run it and confirm expected initial failure.
- [ ] Implement the six KPI cards, urgent-work empty state, management tabs/tables, right insights cards, and development-only illustrative preview rows.
- [ ] Add local search, filters, pagination, alert/profile dropdowns, and date control as UI-only interactions without inventing search results or metric updates.
- [ ] Complete CSS for desktop/laptop/tablet/mobile and 125% zoom behavior.
- [ ] Run focused specs and Angular build; inspect the rendered admin route at desktop and mobile sizes when browser tooling is available.

### Task 4: Final frontend regression review

**Files:**
- Review changes in the files above only.

- [ ] Confirm git diff contains no backend/database or unrelated page edits.
- [ ] Run the Angular build and focused admin specs; report any unavailable visual/runtime checks honestly.
- [ ] Verify live mode uses API results, preview mode has a persistent illustrative label, and preview actions do not write.
