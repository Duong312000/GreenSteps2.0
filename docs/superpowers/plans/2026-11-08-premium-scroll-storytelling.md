# Premium Scroll Storytelling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add restrained, responsive scroll reveals and staggered entrances across the existing GreenSteps home landing page without changing its content, layout, imagery, colors, or navigation.

**Architecture:** Reuse `HomeComponent`'s existing one-shot `IntersectionObserver` and `data-reveal` hooks. Add section-local reveal targets in the home template and tune the existing reveal transitions in the home stylesheet; leave native scrolling, anchor behavior, the itinerary's established wheel storytelling, and existing lightweight parallax intact.

**Tech Stack:** Angular templates and component lifecycle, scoped home CSS, native `IntersectionObserver`, Playwright/browser preview, Angular production build.

**Spec:** User-provided request in `C:/Users/lapto/.codex/attachments/353cf2e8-275e-4337-ba7f-d3f2815baf83/Pasted text.txt`.

## Global Constraints

- Preserve all existing content, primary layouts, brand colors, images, routes, and controls.
- Do not add animation dependencies or globally change scrolling behavior.
- Keep content visible when JavaScript or `IntersectionObserver` is unavailable and honor `prefers-reduced-motion`.
- Keep animations to opacity and small transforms; reveal on approach, stagger in 100 ms steps, and do not replay on scroll-up.
- Scope changes to `home.html`, `home.css`, and `home.ts`.

## Review Focus

- Reduced-motion preference: all reveal targets remain immediately visible.
- Browser without `IntersectionObserver`: all reveal targets remain immediately visible.
- Fast scroll across a section: its targets reveal once and stay visible.
- Existing itinerary wheel storytelling and anchor links remain usable.
- Small/mobile viewports: no horizontal overflow or content hidden during initialization.

---

### Task 1: Add a section-by-section reveal sequence

**Files:**
- Modify: `my-app/src/app/pages/home/home.html`
- Modify: `my-app/src/app/pages/home/home.css`
- Modify: `my-app/src/app/pages/home/home.ts`
- Test: `my-app/e2e/home-scroll-reveal.e2e.cjs`

**Interfaces:**
- Consumes: existing `[data-reveal]`, `HomeComponent.ngAfterViewInit`, `.gs-motion-ready`, and `IntersectionObserver` lifecycle.
- Produces: one-shot near-viewport reveals, a 100 ms stagger scale for section content, and a hero entrance sequence.

- [x] **Step 1: Write a Playwright smoke check for landing-page scroll behavior** asserting reveal targets resolve to visible after intersection, reduced motion never leaves content hidden, anchors still work, and the home content has no horizontal overflow across the requested viewport range.
- [x] **Step 2: Inspect the current behavior and record the baseline:** the home component already has a one-shot observer, while only select content has reveal markers; hero has a single load animation; the observer triggers at the viewport edge.
- [x] **Step 3: Mark hero, proof strip, destination heading, itinerary intro/preview, AI planner intro/result, ecosystem, reviews gallery/story, and final CTA content in an editorial reading order using `data-reveal`/`data-delay`; retain existing CTA/carousel bindings.**
- [x] **Step 4: Update the existing observer to trigger shortly before targets enter the viewport, preserve the reduced-motion/unsupported-browser visible fallback, and keep one-shot observation and cleanup.**
- [x] **Step 5: Refine scoped reveal transitions to 600–1000 ms with `cubic-bezier(0.22, 1, 0.36, 1)` and 100 ms stagger increments; retain the existing destination-image reveal and subtle parallax.**
- [x] **Step 6: Run the Playwright checks at 360×640, 390×844, 768×1024, 1024×768, 1280×720, 1366×768, 1920×1080, and 2560×1440; verify reveal sequence, reduced-motion, anchor scrolling, and horizontal overflow.**
- [x] **Step 7: Run `npm run build` from `my-app` and inspect the scoped diff.**

**Expected result:** The landing page reveals its existing content in a clear, restrained sequence as each area approaches, with no layout changes, dependencies, blocked native scrolling, or inaccessible hidden content.
