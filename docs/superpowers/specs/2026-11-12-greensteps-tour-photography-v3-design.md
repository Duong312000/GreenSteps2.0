# GreenSteps Tour Photography V3 Design

## Intent

Expand the existing licensed photo galleries for the twelve GreenSteps demo tours so they show real photographs tied to their itinerary locations, with meaningful differentiation between tours that share a destination.

## Goals

- Give every demo tour 6–10 different original photographs; resize variants do not count as originals.
- Keep shared gallery photos between each same-destination pair at or below 25%, and assign each tour a distinct cover.
- Prefer location-specific, itinerary-matched photos from Wikimedia Commons or another source with clear reuse terms.
- Keep local optimized assets, machine-readable provenance, attribution, seed/API mapping, accessible Angular galleries, responsive `srcset`, and source/license information aligned.
- Report actual counts, overlap, itinerary landmark coverage, and remaining gaps.

## Non-goals and constraints

- Do not create or use AI-generated images, uncertain locations, or unclear licenses.
- Do not change any tour IDs, booking guards, or booking behavior.
- Do not edit `.env`, write to MongoDB Atlas, or deploy production.
- Use Node.js for HTTPS requests because Windows Schannel fails in PowerShell/curl in this environment.

## Approaches

1. Add image URLs only in Angular: rejected because provenance, API responses, and local review would diverge.
2. Extend the existing local photo manifest and seed/API/gallery pipeline: selected because V2 already carries source pages, attribution, license, dimensions, alt text, and responsive variants end to end.
3. Register the photos in the media storage subsystem: not chosen because it adds a separate write lifecycle and database dependency, which conflicts with the no-Atlas constraint.

## Design decisions

- Target the lower accepted bound of 6 originals per tour. For two tours at one destination, permit at most one shared original, giving 1/6 overlap (16.7%) and requiring 11 originals per destination pair.
- Retain source files as the original-image identity; 480 px, 960 px, and up-to-1600 px derivatives stay attached to one manifest record.
- Include only photographs with a current Commons source page, identified author, reuse license, and location evidence in page metadata/category or a clearly named source. Record a limitation instead of filling a gap with a generic or misidentified image.
- Reuse the existing `photo_metadata` contracts and `photo-manifest.json`; add tests for gallery counts, overlap, distinct covers, unique original hashes, provenance, and responsive assets.

## Left to the implementer

Select and verify specific Commons files against the twelve checked-in itinerary activities, update the photo assets and existing pipeline, and report the exact resulting coverage.
