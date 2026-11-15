# GreenSteps Tour Photography V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Expand the twelve demo-tour galleries to 6–10 licensed original photos per tour with no more than 25% overlap inside same-destination pairs.

**Architecture:** Extend the existing Commons photo manifest and local public assets. Keep tour seed, API response, Angular model and galleries on the existing `photo_metadata` contract. Serve proportional local JPEG derivatives through the existing responsive `srcset` fields and document attribution per original.

**Tech Stack:** Node.js 20+, Wikimedia Commons API, JSON, Angular, Node test runner, ImageMagick or the existing local image tooling.

**Spec:** `docs/superpowers/specs/2026-11-12-greensteps-tour-photography-v3-design.md`

## Global Constraints

- Keep all 12 existing tour IDs and the current booking guard unchanged.
- Include only real photos with verified locations, identified authors, and clear reuse licenses.
- Use Node.js for HTTPS asset/API requests; do not use PowerShell/curl HTTPS downloads.
- Do not edit `.env`, write to MongoDB Atlas, or deploy production.
- Count source originals, not responsive derivatives.

## Review Focus

- Same-destination pairs must have different covers and no more than 25% shared gallery originals; assert both in the enrichment test.
- Local derivative files must not inflate original counts or share duplicate bytes; assert using manifest identity and SHA-256 hashes.
- Source metadata may be missing or change; reject incomplete API metadata before download and test required provenance fields.
- Tour itinerary activities may be broad editorial suggestions; report exact-landmark versus destination-context matches instead of overclaiming coverage.
- Any tours without six sufficiently verified images must remain below target and be listed honestly in the V3 report.

---

### Task 1: Pin V3 gallery and provenance requirements

**Files:**
- Modify: `backend/test/demo-tour-enrichment.test.js`
- Read: `backend/src/data/demo-tours.seed.js`, `backend/src/data/demo-tour-editorial.js`

**Interfaces:** Preserve existing `demoTours` and manifest exports.

- [x] Change gallery assertion to 6–10 source images per tour; add assertions for same-destination overlap ≤25%, unique covers, distinct original files, and provenance/license metadata.
- [x] Run `node --test backend/test/demo-tour-enrichment.test.js` and confirm expected failures against current three-image galleries.

### Task 2: Research and retrieve approved Commons originals

**Files:**
- Modify: `docs/plans/greensteps-tour-photo-enrichment/photo-manifest.json`
- Modify: `docs/plans/greensteps-tour-photo-enrichment/attributions.md`
- Create: local originals under `my-app/public/image/greensteps/tours/<destination>/`
- Modify only if needed: `backend/scripts/download-demo-tour-photos.js`

**Interfaces:** Manifest entries retain `assetPath`, `tourSlugs`, `sourcePage`, `author`, `licenseId`, `licenseUrl`, `attribution`, `subjectLocation`, `caption`, `alt`, `tourRelevance`, and `responsiveVariants`.

- [x] Match candidates to the checked-in activities; verify Commons page title, author, license and location evidence through Node.js/API and visual inspection.
- [x] Download only approved originals with Node.js; verify response type, JPEG signature, nontrivial size, and unique SHA-256 before accepting.
- [x] Ensure each pair has at least 11 distinct approved originals, no more than one shared original, and different covers; document any shortfall instead of weakening location/license checks.

### Task 3: Optimize variants and map the galleries

**Files:**
- Modify: `docs/plans/greensteps-tour-photo-enrichment/photo-manifest.json`
- Modify: `backend/src/data/demo-tours.seed.js` only if its existing mapping cannot consume expanded manifest membership
- Modify: `my-app/src/app/pages/tours/tours.html`, `tour-detail.html`, and related model/service only if attribution/srcset fields are missing
- Create: proportional 480 px, 960 px, and maximum-1600 px variants for each approved original

**Interfaces:** Continue to provide the V2 gallery/photo metadata contract through list and detail API results.

- [x] Generate proportional variants without cropping; record source dimensions and per-variant dimensions.
- [x] Assign six photos per tour with at most one shared photo per destination pair and distinct cover paths.
- [x] Preserve alt text, captions, attribution, source links, license links, responsive loading, and missing-photo fallback behavior.

### Task 4: Verify and report V3 coverage

**Files:**
- Modify: `backend/test/demo-tour-enrichment.test.js` and relevant existing tour API/gallery tests
- Create: `docs/plans/greensteps-tour-photo-enrichment/GREENSTEPS_TOUR_PHOTOGRAPHY_V3_REPORT.md`

- [x] Run focused backend tests, relevant API tests, Angular gallery/card tests, Angular production build. The full backend suite was not run because its application bootstrap loads `.env`, which the task forbids reading.
- [x] Audit all local gallery paths, derivative dimensions/signatures, SHA-256 original uniqueness, coverage, overlap, covers, source attribution, and license links.
- [x] Report actual source count per tour, overlap per pair, exact-landmark coverage, destination-context coverage, and any unmet targets; state that Atlas and production were untouched.
