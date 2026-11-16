# GreenSteps Help Center Premium Redesign Plan

**Goal:** Refine the existing Angular Help Center into a premium, responsive travel support experience while preserving its current routes, search, filters, and AI chat handoff.

**Architecture:** Keep the existing Help Center components and content catalog. Add catalog-derived topic counts and a working all-guides state, then restyle the index, article, and contact views with component-scoped CSS. Preserve the shared sticky header, authentication actions, and footer links.

**Tech Stack:** Angular 21, TypeScript, Angular Router, component HTML/CSS, Vitest through Angular's unit-test builder.

**Global Constraints:** Preserve existing application behavior and routes; use only current real article data; retain GreenSteps colors, Vietnamese copy, keyboard access, responsive layouts, and reduced-motion support.

**Review Focus:** Search and category filtering remain combined; “view all” exposes every catalog article; unknown article routes remain recoverable; contact opens the existing AI chat; narrow viewports have no horizontal overflow.

## Files

- Modify `my-app/src/app/pages/help-center/help-center.ts` for article view state and catalog-derived counts.
- Modify `my-app/src/app/pages/help-center/help-center.html` for hero, topic, knowledge-base, AI support, and article layouts.
- Modify `my-app/src/app/pages/help-center/help-center.css` for the responsive GreenSteps visual system and focus/motion states.
- Modify `my-app/src/app/pages/help-center/contact.html` and `contact.css` to align the contact destination with the refreshed design.
- Modify `my-app/src/app/pages/help-center/help-center.spec.ts` to cover all-guides and topic counts.

## Implementation Steps

1. Add failing component tests for the all-guides state and catalog-derived topic counts; run them through Angular's unit-test builder.
2. Implement the minimal component state and getters, then rerun the focused tests.
3. Update the Help Center and contact markup/styles while retaining current routes, handlers, and article content.
4. Run the Angular production build and focused Help Center tests; launch the app and inspect desktop/mobile layouts and browser console when browser tooling is available.
