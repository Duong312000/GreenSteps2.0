# Public-source catalog import — 2026-11-05

`data/official-service-catalog.json` contains six listings researched from the
official websites linked in each record. `scripts/import-official-services.js`
validates the manifest; `--apply` backs up the existing records and writes the
updates to the configured Atlas database. It refuses unrelated IDs or listings
with reviews. User accounts and vendor ownership are not changed.

Applied to `GreenStepsData` on 2026-11-05:

- Six former sample services now describe actual businesses or services.
- Two older sample listings are suspended and excluded from the public catalog.
- Original documents are retained in `app_catalog_import_backups`.
- Stable service IDs preserve existing URLs; some IDs retain the historical
  `srv_demo_detail_` prefix. The published content has no sample/demo claims.
- 46 other existing services remain unreviewed. This import does not certify them
  as real, current, complete or commercially available.

Published website prices for Afternoon Tea and bike rental are reference prices,
not GreenSteps offers. Hotel nightly rates and date-specific inventory are left
absent. Missing emission and capacity data are marked unconfirmed; zeros required
by the legacy schema are never presented as measured emissions or free services.
Public-source records reject GreenSteps quote/booking requests until commercial
availability is confirmed. Website sources do not establish a supplier agreement.

Both provider and traveler screens read the same record. Provider policy edits
also update structured policy rows so the two presentations stay consistent.
No personal account names, credentials, phone numbers or emails were modified.
