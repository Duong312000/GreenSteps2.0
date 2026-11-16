# GreenSteps tour enrichment v2 design

## Intent

Bring the twelve editorial demo tours closer to the established tour-detail experience while keeping all claims truthful. Restore the four overview cards and complete overview, itinerary, inclusions, deposit, and review tabs for demos. Improve the image mapping only with locally available, source- and license-verified photographs.

## Goals

- Preserve tour IDs, slugs, destinations, all 36 activity IDs, three-day durations, demo status, and booking/payment guards.
- Expose editorial style, intensity estimate, unknown group size and emissions, tour highlights, detail copy, practical notes, itinerary, and per-photo attribution consistently from seed through list/detail APIs to Angular.
- Use explicit honest states for unverified capacity, emissions, inclusions, and deposit terms; use only actual review data.
- Keep current GreenSteps navigation, visual language, responsive layout, and legacy tour behavior.
- Produce an audit, photo coverage report, dry-run migration output where available, and test/build evidence.

## Non-goals and constraints

- No production or Atlas writes, deployment, credentials edits, or changes to booking, payment, wallet, customer, or protected records.
- Do not invent prices, suppliers, group limits, emissions, reviews, inclusions, or policies.
- Do not add photos without verifying the original source, destination/landmark match, redistribution license, and attribution. If research/download is unavailable, report the gap and continue with local UI/data improvements.
- No unrelated redesign or new dependencies.

## Approaches

1. Patch the Angular templates alone. This is quick but leaves seed, APIs, migrations, and attribution inconsistent.
2. Extend the existing editorial seed/schema and API response fields, then render those fields through the existing shared tour-detail UI. This maintains a single source of truth and is the selected approach.
3. Register demo photos through the general media subsystem. This requires a new registration lifecycle and does not improve tour copy or tab behavior.

## Architecture and decisions

The existing `demo-tour-editorial.js` remains the source for editorial copy, highlights, activity notes, responsible travel, practical notes, style explanation, and estimated activity intensity. The shared seed continues generating the existing 12 IDs and 36 activity IDs. Schedule JSON fields require no relational schema change. Both the tour-search list formatter and detail formatter return the same editorial/photo fields and explicitly suppress commercial fields for demos. Angular keeps one detail page, adding demo-aware labels and states to its current overview/tabs; verified legacy values retain their current paths.

Photo metadata remains in the checked-in manifest. Only verified local assets enter the UI. Any coverage shortfall is described in the final report; destination photos are not relabeled as exact itinerary landmarks.

## Visual direction

Keep the existing GreenSteps green/neutral palette, typography, cards, spacing, navigation, and responsive breakpoints. Restore four information cards, the existing two-column highlight checklist, readable editorial sections, a compact demo notice, and the current day selector/gallery. Demo tabs reuse the existing underline tab system and show truthful empty states.

## Open implementation calls

- Missing capacity and measured emissions render as “Chưa xác nhận” and “Chưa có dữ liệu phát thải”.
- Activity intensity is a qualitative editorial estimate based on the proposed activities, not a verified operator itinerary.
- Editorial inclusions and deposits are unknown; display the supplied truthful messages and disable commercial actions for demo records.
- Atlas migration work stays dry-run/local only for this task, as the brief requires separate approval for any apply command.
