# GreenSteps Admin Dashboard Redesign

## Intent

Redesign the Angular admin page to match the supplied GreenSteps dashboard reference, giving administrators one responsive place to see operational queues and navigate the wider admin modules.

## Goals

- Build the sidebar, topbar, overview, six KPI cards, urgent-work panel, queue workspace, and right insights column in the existing Angular app.
- Keep the existing provider, deposit, withdrawal, wallet activation, and booking API calls and approval behavior.
- Show real values only when the frontend already has a supporting API. Use an em dash and an unavailable label where no API exists.
- Add an explicitly requested, development-only preview mode with a visible illustrative-data label; it must not call write APIs.
- Preserve logout and admin-role gating, and hide the public app header/footer/chat while the admin shell is active.
- Support desktop, laptop, tablet, mobile drawer, compact sidebar, and horizontally scrollable data tables.

## Non-goals

- No backend, database, model, endpoint, financial, booking, user-management, or moderation behavior changes.
- No new approval/rejection flows for modules that do not already have them.
- No fabricated live metrics, system-health status, recent events, or moderation counts.
- No design changes to customer or provider pages.

## Approaches

1. Keep the current single admin component and add the dashboard layout and local presentation helpers. This follows the existing app and minimizes integration risk; it leaves the admin page in one component.
2. Split every dashboard region into shared Angular components. This gives more reuse but adds declarations, inputs, and files for a single page before the design stabilizes.

**Chosen:** Approach 1, with focused CSS and typed local presentation data. The current admin page is already a single declared Angular component, and no other page needs these dashboard-specific regions yet.

## Design decisions

- Use the reference's white surfaces, pale gray background, GreenSteps green accent, restrained status colors, compact cards, and three-column desktop layout.
- Use existing Bootstrap Icons, project fonts, and logo asset; add no UI framework or chart dependency.
- Map navigation entries to existing queue tabs where an API exists; otherwise show a clear “Đang phát triển” placeholder without a fake count.
- Use a CSS donut only when actual complete booking-status data exists. The current pending-only booking API cannot supply a complete distribution, so live mode shows an unavailable state. Preview mode may show an illustrative chart.
- Preview activates only in development with `?adminPreview=1`, remains visible as illustrative data, and disables all API actions. Admin role gating still applies.
- Global search and date range are presentation controls only until a matching API exists; they do not claim to filter backend metrics.

## Constraints and verification

- Work in `D:/Web2` as requested; leave unrelated dirty booking/provider files untouched.
- Keep existing backend routes and mutation calls unchanged.
- Build the Angular app and inspect the rendered desktop/mobile layouts when the local toolchain permits.

## Builder decisions

- Keep navigation and dashboard state in `AdminComponent` instead of adding a new shared component layer.
- Use explicit unavailable/error queue states where the existing API client can distinguish failures; do not display failed loads as real zero counts.
