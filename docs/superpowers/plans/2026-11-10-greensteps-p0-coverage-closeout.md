# GreenSteps P0 Coverage Closeout Plan

> **For agentic workers:** Execute this plan inline. Use test-first changes and preserve every source Test ID in assertions and reports.

**Goal:** Raise trustworthy P0 coverage by executing every P0 case that is safe with local fixtures, fixing reproduced defects, and keeping MongoDB/n8n-dependent cases blocked until isolated environments exist.

**Architecture:** Reuse the workbook extraction, backend services, existing fixture model helpers, Angular component tests, and local Playwright interception. Add per-ID assertions and verification levels to the existing ledger; never convert fixture evidence into live integration evidence.

**Tech Stack:** Node.js `node:test`, Angular/Vitest, Playwright, CSV/JSON reports.

**Spec:** `docs/superpowers/reports/greensteps-351-test-results.csv` and attached P0-closeout task.

## Global Constraints

- Do not write to Atlas or use an unverified database credential.
- Do not call or activate production n8n workflows.
- Keep booking, Schedule Editor, frontend design, and API response contracts intact.
- A test ID is PASS only when its required behavior is asserted for that ID.
- Keep full MongoDB/n8n verification BLOCKED without approved isolated environments.
- Treat previously exposed webhook credentials as a security blocker until rotation/revocation is evidenced.

## Review Focus

- Intent precedence: explicit plan creation versus discovery and edits.
- Context freshness: destination/days, separate sessions, and late responses.
- Catalog conditions: filters, status, page completeness, and unavailable versus empty.
- Plan validation: cross-destination, wrong duration, verified service data.
- Frontend state: stale result suppression, unsafe render, booking and schedule-editor regressions.

### Task 1: Audit and test safe backend P0 behavior

**Files:** `backend/test/greensteps-chat-workbook-regression.test.js`, `backend/src/services/greensteps-chat-structured.service.js`, `backend/src/services/greensteps-chat.service.js`.

- [x] Add source-ID assertions for safe intent/context/plan/service cases before fixes.
- [x] Run focused tests to confirm reproduced failures.
- [x] Fix only confirmed defects and rerun focused plus full backend tests.

### Task 2: Audit and test local UI P0 behavior

**Files:** `my-app/e2e/greensteps-workbook-flow.e2e.cjs`, `my-app/e2e/greensteps-chat.e2e.cjs`, GreenSteps chat component tests.

- [ ] Add an assertion for a delayed old destination response replacing a newer result; FLOW-G remains NOT TESTED.
- [x] Run local browser tests and Angular unit tests; two full-suite setup timeouts passed on isolated rerun.
- [x] Preserve fixture-level verification labels.

### Task 3: Finalize the 351-case evidence ledger

**Files:** `scripts/generate-greensteps-351-coverage.cjs`, `docs/superpowers/reports/greensteps-351-test-results.csv`, `greensteps-351-test-summary.json`, `greensteps-351-e2e-flow-results.csv`, `greensteps-351-bug-tickets.md`.

- [x] Audit existing PASS rows against their exact assertions; keep incomplete behaviors BLOCKED/NOT TESTED.
- [x] Add `Verification Level`, per-ID actual/evidence, and ticket mapping.
- [x] Recompute P0/P1/P2, E2E, and release-gate summaries.
- [x] Record MongoDB/n8n/security blockers without contacting production.

### Task 4: Verify release gates

- [x] Run complete backend and frontend tests, browser fixtures, and build; record the later Angular setup timeouts and isolated retry result.
- [x] Confirm no production DB writes or webhook calls occurred.
- [x] Report NO-GO and remaining blocked IDs.
