# Header account actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove header search controls and present account actions consistently for guests and signed-in users.

**Architecture:** Keep the existing Angular header component and responsive CSS. Remove the desktop and drawer search markup, conditionally render notifications from authentication state, and use the freed header space for account actions.

**Tech Stack:** Angular templates, TypeScript, component CSS.

**Spec:** `docs/superpowers/specs/2026-11-12-header-account-actions-design.md`

## Global Constraints
- Guest users must not see the notification bell.
- Signed-in users must see the notification bell on desktop and mobile.
- Do not change tour search behavior outside the header.
- Preserve responsive layout and visible focus styles.

## Review Focus
- Guest desktop: register, login, and eligible partner entry fit without search.
- Signed-in desktop: bell, profile, and eligible partner entry fit without overlap.
- Guest mobile: no bell; menu drawer still exposes registration/login.
- Signed-in mobile: bell remains beside the hamburger and the profile stays in the drawer.
- Notification dropdown remains usable near narrow viewport edges.

---

### Task 1: Update the responsive header controls

**Files:**
- Modify: `my-app/src/app/components/header/header.html`
- Modify: `my-app/src/app/components/header/header.css`
- Modify: `my-app/src/app/components/header/header.ts` only to remove search-only state or helpers made unused by removing both header search fields.

- [ ] Remove search inputs and suggestions from the desktop header and mobile drawer; render mobile navigation tabs without search filtering.
- [ ] Render the notification control only when `currentUser` exists and retain it on mobile.
- [ ] Adjust guest action styling and header spacing for the freed search width.
- [ ] Review responsive markup and styles for unused header-search rules.
