# GreenSteps Vietnam Demo Expansion — Completion Report

**Updated:** 2026-11-12  
**Scope:** additive Atlas demo seed and repository implementation. No production deployment, paid API call, or payment attempt was made. Existing workspace changes were preserved.

## Production seed status

**Atlas seed applied: YES.** The configured database was `GreenStepsData`, using collection prefix `app_`. The authenticated MongoDB role was `atlasAdmin@admin`; this was used under the user's direct instruction to proceed. It is broader than the requested least-privilege `readWrite` role, so access compliance remains **PARTIAL** and should be remediated after the seed.

Before applying, a read-only inventory found 79 collections and the target collections had no catalog ID/slug conflicts. A local logical backup captured all 79 collections (2,902 documents), indexes and collection options. It was restored to an isolated local MongoDB replica set; all collection counts, indexes and SHA-256 document checksums matched. This verifies the backup and restore procedure, but is not an Atlas snapshot. The temporary plaintext dump and local restore files were removed after verification and seed completion.

The seed used bounded insert-only batches and per-document audit entries. The write created 96 catalog/demo documents and 96 audit records; no existing records were intentionally updated. The post-write Atlas read observed:

| Collection | Before | After | Added |
|---|---:|---:|---:|
| `app_admin_areas` | 0 | 34 | 34 |
| `app_regions` | 0 | 8 | 8 |
| `app_destinations` | 0 | 6 | 6 |
| `app_schedules` | 92 | 104 | 12 |
| `app_scheduleactivities` | 466 | 502 | 36 |
| Demo price records (`app_schedulesamples`) | 14 | 14 | 0 |
| Seed audit entries (`app_adminconfigauditlogs`) | — | 96 | 96 |

All 34/8/6/12/36 expected IDs were present in the post-write read; 36 activities link to demo tours. The seeded tours are marked `catalog_status: demo`; the existing bookability guard rejects demo tours before quote/payment effects. No user, booking, payment or wallet writes were part of the seed. The seed runner performs a second insert-only pass and checks that it creates zero additional records. A separately invoked idempotency report did not return captured output, so that separate verification is **NOT CONFIRMED**. A fresh protected-collection checksum comparison after apply also could not be captured after the Atlas connection became unavailable; the runner contains this check, but this report does not claim its result.

## Safety and verification results

| Gate | Result | Evidence / limitation |
|---|---|---|
| Backup and restore | **PASS (local logical restore)** | 79/79 collections, 2,902 documents, indexes and checksums matched an isolated local restore. No Atlas snapshot/restore was available. Temporary plaintext backup was removed. |
| Database access | **PARTIAL** | Atlas connection and target identity were verified before apply; role was `atlasAdmin@admin`, not database-scoped `readWrite`. |
| Seed apply | **PASS** | 96 records inserted, no intended updates; IDs, final counts, audit count and zero new price records were read back from Atlas. |
| Seed idempotency | **PARTIAL** | Apply runner includes a zero-write second pass. Separate rerun command produced no captured result. |
| Protected user/booking/payment/wallet data | **NOT RECONFIRMED AFTER APPLY** | No such collections were seed targets. Post-apply checksum comparison could not be captured after Atlas connectivity timed out. |
| Backend/API on Atlas | **BLOCKED** | A fresh HTTP smoke run could not connect to MongoDB Atlas (`MongoServerSelectionError`), so regions/provinces, Sa Pa/Sapa search, tour search and 12 demo quote rejections were not verified over HTTP in this run. No booking or payment was created. |
| Frontend populated browse flow | **NOT TESTED** | Browser/UI was not run against an Atlas-connected backend. |
| Admin CMS write flow | **NOT TESTED** | No production CMS mutations were attempted. |
| AI Planner against Atlas | **NOT TESTED** | No Atlas-backed planner request was run. |
| GS-001 Maps | **PARTIAL / external action open** | No key was printed and no paid Maps API was called. Historical credential/cache review and any necessary key rotation require the Cloud/Platform owner. |
| GS-002 booking safety | **PASS in focused local tests; Atlas API check pending** | Demo tour guard is in place and focused tests pass. No payment integration was invoked. |

Focused backend tests for seed behavior and Atlas safety: **12/12 PASS**. Earlier full local backend run: **312/314 passed, 2 failed, 0 skipped**; the remaining failure is the existing booking retry/idempotency behavior documented below. Frontend suite/build results from the prior implementation remain as recorded in the earlier verification section; they do not verify a populated Atlas browser flow.

## Repository changes

This run added/updated the additive seed runner, role/target/backup safety checks, audited insert-only MongoStore seeding, focused tests, and this report. The runner defaults to dry-run and requires explicit runtime apply flags; no flags or credentials were written to `.env` or this report.

Relevant files:
- `backend/scripts/seed-atlas-catalog.js`
- `backend/src/services/national-catalog-seed.service.js`
- `backend/src/services/atlas-seed-safety.service.js`
- `backend/test/national-catalog.test.js`
- `backend/test/atlas-seed-safety.test.js`

## Remaining work

1. Replace the seed credential with a dedicated MongoDB database user limited to `readWrite` on `GreenStepsData`, then verify the authenticated role.
2. Reconnect to Atlas and independently rerun seed idempotency plus post-apply protected collection checksums.
3. Re-run the safe HTTP smoke checks (regions, provinces, `Sa Pa`/`Sapa`, tours, and demo quote rejection) when Atlas connectivity is available.
4. Run browser, CMS authorization, and AI Planner checks against a non-production or explicitly approved read-only environment. Any write-capable CMS and payment tests belong on a disposable database.
5. Close the separate GS-001 Cloud Console review/rotation decision. Do not claim it is complete from repository checks.
6. Fix the existing booking `Idempotency-Key` retry behavior before treating the complete backend integration suite as passing.

No production deployment was performed.
