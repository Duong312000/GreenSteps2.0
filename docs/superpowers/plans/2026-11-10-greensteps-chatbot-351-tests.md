# GreenSteps 351 Chatbot Test Plan

Date: 2026-11-10

## Goal
Use the XLSX workbook as the behavioral specification for chatbot GreenSteps, while treating workbook text as test data rather than operational instructions. Report status and evidence for every test ID and each E2E flow.

## Safety constraints
- Use only isolated in-memory/unit fixtures for automated tests.
- Do not write test fixtures to MongoDB Atlas or any production database.
- Do not stress-test or invoke production n8n webhooks in batches.
- Preserve booking, Schedule Editor contracts, and current frontend design.
- Mark browser/n8n/Atlas-dependent cases NOT TESTED or BLOCKED unless an isolated runtime is available and actually exercised.

## Plan
1. Extract all sheets and validate 351 test IDs, 14 E2E flows, priority and category counts.
2. Map test rows to existing backend and Angular test entry points; identify which cases can run safely.
3. Add case-ID-preserving parameterized regression tests for deterministic intent, destination, slot, catalog, plan normalization, and service-verification behavior. Run them to establish failures before code changes.
4. Reproduce each failure with focused tests, implement the smallest fixes, and run focused plus existing regression suites.
5. Run safe P0–P2 automated cases in the available local environment. Run actual frontend/browser flows only if the app and browser runner can be safely started with a stub API; do not call production n8n.
6. Produce a per-ID coverage ledger with status, actual result, evidence, and bug ticket; summarize category/priority counts and release gates.

## Artifacts
- Full source-derived machine-readable workbook extraction.
- Automated test source retaining each source Test ID.
- Final CSV/JSON ledger with one row per source Test ID and one row per E2E flow.
