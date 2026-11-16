const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'docs/superpowers/reports/greensteps-351-workbook-extracted.json'), 'utf8'));
const passed = new Map();
for (const id of ['INT-001','INT-002','INT-019','INT-037','DEST-001','DEST-007','DEST-011','DEST-013',
  'SLOT-001','SLOT-002','SLOT-004','SLOT-005','SLOT-008','SLOT-009','CTX-001','CTX-002','CTX-003','CTX-005','CTX-006',
  'VER-006','VER-017','VER-030','PLAN-001']) {
  passed.set(id, { evidence: 'node --test backend/test/greensteps-chat-workbook-regression.test.js; source Test ID assertion executed on isolated fixture only.', bug: '' });
}
const unitEvidence = 'node --test backend/test/greensteps-chat-workbook-regression.test.js; fixture assertion checks this Test ID behavior; no live MongoDB/n8n claim.';
const closeoutUnitEvidence = 'node --test backend/test/greensteps-p0-closeout.test.js; named Test ID assertion executed against isolated fixtures only.';
const closeoutUiEvidence = 'npm.cmd test -- --watch=false --include=src/app/components/greensteps-chat/greensteps-chat.service.spec.ts --include=src/app/components/greensteps-chat/itinerary-timeline.component.spec.ts; local Angular test fixture, no live service.';
const closeoutBrowserEvidence = 'node my-app/e2e/greensteps-workbook-flow.e2e.cjs; local Chrome with intercepted API fixtures, no MongoDB/n8n.';
for (const id of ['DEST-006','DEST-021','DEST-022','SLOT-011','SLOT-014','SLOT-027','SLOT-034','SLOT-035',
  'CTX-004','CTX-014','CTX-016','CTX-029','PLAN-002','PLAN-003','PLAN-004','PLAN-021','PLAN-022','PLAN-024','PLAN-025','PLAN-035',
  'VER-003','VER-007','VER-009','VER-010','VER-011','VER-015','VER-021','VER-022','VER-025',
  'SEC-001','SEC-003','SEC-006','SEC-012','SEC-019','SEC-023']) {
  passed.set(id, { evidence: closeoutUnitEvidence, bug: '' });
}
for (const id of ['UI-011','UI-014','UI-017','UI-025','VER-020']) passed.set(id, { evidence: closeoutUiEvidence, bug: '' });
passed.set('TOUR-023', { evidence: closeoutBrowserEvidence, bug: 'GSCHAT-010' });
passed.set('CTX-020', { evidence: closeoutUiEvidence + ' The composer rejects a second submit while the first request is pending; no concurrent responses can replace the selected view.', bug: '' });
const blockedOverrides = {
  'VER-001': 'BLOCKED: GreenService schema has no service URL field; the AI-supplied URL is discarded, and no authoritative catalog URL can be asserted without a supported data source.',
  'VER-012': 'BLOCKED: carbon is stored as a numeric field but the current schema exposes no measurement unit or scope; do not claim unit compatibility.'
};
for (const id of ['INT-038','INT-039','INT-040','DEST-008','DEST-012','DEST-030','DEST-018','SLOT-003',
  'DEST-019','CTX-018','CTX-026','CTX-019','CTX-007','CTX-008','CTX-013','SLOT-017','SLOT-018',
  'TOUR-002','TOUR-004','TOUR-005','TOUR-006','TOUR-017','TOUR-021','TOUR-022',
  'PLAN-006','PLAN-019','PLAN-023','PLAN-020','VER-002','VER-004','VER-005','VER-030','SEC-021']) {
  passed.set(id, { evidence: unitEvidence, bug: '' });
}
passed.set('DEST-005', { evidence: unitEvidence + ' Unique one-edit destination suggestion is returned as a confirmation question.', bug: '' });
passed.set('TOUR-002', { evidence: unitEvidence + ' Empty completed search yields zero tour cards and retains self-plan CTA.', bug: 'GSCHAT-010' });
passed.set('PLAN-020', { evidence: unitEvidence + ' Regression first failed because Phú Yên title rendered under Đà Nẵng; validator now rejects it and returns a safe correction.', bug: 'GSCHAT-011' });
passed.set('TOUR-017', { evidence: unitEvidence + ' Two page queries preserve destination, return unique IDs, and signal remaining results.', bug: '' });
passed.set('SEC-002', { evidence: 'node --test backend/test/error-sanitization.test.js; production error log and response redact credentials and omit stack.', bug: '' });
passed.set('SEC-007', { evidence: 'node my-app/e2e/greensteps-chat.e2e.cjs; fixture script output does not execute in local Chrome.', bug: '' });
passed.set('UI-010', { evidence: 'npm.cmd test -- --watch=false (my-app); GreenStepsChatService spec verifies active request cancellation does not append a fabricated assistant response.', bug: '' });
passed.get('INT-019').bug = 'GSCHAT-001';
for (const id of ['DEST-001','DEST-011','DEST-013']) passed.get(id).bug = 'GSCHAT-001';
passed.get('DEST-007').bug = 'GSCHAT-005';
for (const id of ['SLOT-008','SLOT-009']) passed.get(id).bug = 'GSCHAT-004';
for (const id of ['CTX-001','CTX-002','CTX-003']) passed.get(id).bug = 'GSCHAT-008';
for (const id of ['CTX-005','CTX-006']) passed.get(id).bug = 'GSCHAT-003';
passed.get('VER-006').bug = 'GSCHAT-007';
passed.get('VER-030').bug = 'GSCHAT-007';
for (const id of ['INT-003','INT-004','INT-005','INT-006','INT-007','INT-008','INT-009','INT-010',
  'INT-011','INT-012','INT-013','INT-014','INT-015','INT-016','INT-017','INT-018']) {
  passed.set(id, { evidence: 'node --test backend/test/greensteps-chat-workbook-regression.test.js; source utterance from this Test ID asserted against intent/clarification behavior; fixture-only.', bug: 'GSCHAT-009' });
}
for (const id of ['UI-001','UI-002','UI-003','UI-004','UI-006','UI-013','UI-019','UI-029']) {
  passed.set(id, { evidence: 'Local Angular browser with intercepted fixture API; no MongoDB/n8n calls.', bug: '' });
}
for (const id of ['UI-001','UI-003','UI-004']) passed.get(id).bug = 'GSCHAT-003';
passed.get('UI-019').evidence = 'node my-app/e2e/greensteps-chat.e2e.cjs; script tag in intercepted reply did not execute in Chrome; no backend security claim.';
passed.get('UI-002').evidence = 'node my-app/e2e/greensteps-workbook-flow.e2e.cjs; mobile viewport and responsive chat panel checked with local fixture API.';
passed.get('UI-029').evidence = 'node my-app/e2e/greensteps-workbook-flow.e2e.cjs; fixture itinerary rendered exactly three day sections.';
const blockedByRow = row => {
  if (row.B === 'CAT') return 'MongoDB isolation is unavailable: TEST_MONGODB_URI is unset. Only in-memory model fixture tests ran; no real MongoDB integration was attempted.';
  if (row.B === 'API') return 'n8n sandbox/API contract runtime is unavailable. No production webhook was called; endpoint-level behavior remains unverified.';
  if (row.A === 'SEC-020') return 'SECURITY BLOCKER: A webhook credential was exposed in the conversation; rotation and revocation are not evidenced. This was not re-used.';
  if (['SEC-010','SEC-011'].includes(row.A)) return 'A separately isolated MongoDB is required; TEST_MONGODB_URI is unset, so no database integration was attempted.';
  return '';
};
const csv = value => '"' + String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
const coverageGaps = {
  'TOUR-001': ['The API unit assertion checks three fixture IDs and CTA, but the required F01 frontend assertion rendering exactly those three cards was not executed.', 'backend/test/greensteps-p0-closeout.test.js checks fixture IDs; browser flow currently covers one tour card.'],
  'TOUR-003': ['Destination filtering passed at unit level in the closeout assertion, but the required frontend display of only the actual Phu Yen result set was not exercised.', 'backend/test/greensteps-p0-closeout.test.js; isolated catalog fixture only.'],
  'TOUR-012': ['Unit assertion proves AI availability/seats claims are stripped, but no frontend rendering assertion confirms the final user-visible availability wording.', 'backend/test/greensteps-p0-closeout.test.js; normalized fixture response only.'],
  'PLAN-009': ['The test canonicalizes an existing itinerary but does not invoke the Schedule Editor day-two-only edit operation; full edit behavior remains untested.', 'backend/test/greensteps-p0-closeout.test.js test named PLAN-009 does not call an edit endpoint/component.'],
  'PLAN-030': ['No itinerary-version field/contract is currently exercised; the fixture accepts the model destination and cannot prove stale-version rejection.', 'backend/test/greensteps-p0-closeout.test.js; implementation contract inspection and weak fixture assertion.'],
  'UI-012': ['A prior local conversation restores its transcript, but cross-user card isolation was not asserted; therefore this case is not PASS.', 'my-app/src/app/components/greensteps-chat/greensteps-chat.service.spec.ts; restore test does not simulate a different user.'],
  'SEC-004': ['Poison-text fixture is accepted as catalog content; there is no prompt-boundary/runtime assertion proving database text cannot act as an instruction.', 'backend/test/greensteps-p0-closeout.test.js SEC-004 only verifies ID normalization; no model boundary was invoked.'],
  'SEC-005': ['The chat fast path does not expose another booking, but authenticated booking route authorization and cross-user record access were not exercised.', 'backend/test/greensteps-p0-closeout.test.js SEC-005 is a chat adapter assertion, not a booking authorization test.'],
  'UI-024': ['Accessible tour title and detail link were checked, but price and CTA accessible names were not all asserted.', 'node my-app/e2e/greensteps-chat.e2e.cjs; heading and detail-link labels checked on fixture card.'],
  'VER-001': ['BLOCKED: GreenService schema has no service URL field; this test requires an authoritative service link, so the AI-provided URL is discarded.', 'backend/src/models/index.js GreenService schema inspection; backend/test/greensteps-p0-closeout.test.js confirms model URL is discarded.'],
  'VER-012': ['BLOCKED: carbon is numeric but has no unit/scope metadata in the GreenService schema; compatibility cannot be asserted safely.', 'backend/src/models/index.js GreenService schema inspection; backend/test/greensteps-p0-closeout.test.js sources only catalog carbon.'],
  'VER-003': ['Wrong-destination service ID was rejected, serviceId cleared, and user-facing mismatch warning asserted.', 'node --test backend/test/greensteps-p0-closeout.test.js; VER-003 named assertion.'],
  'VER-011': ['Catalog price replaced the AI value; mismatch warning names only fields and does not log supplied values.', 'node --test backend/test/greensteps-p0-closeout.test.js; grouped VER-001/007/010/011/012 assertion.'],
  'VER-015': ['Zero verified activities were returned and the reply labels remaining activities as reference suggestions.', 'node --test backend/test/greensteps-p0-closeout.test.js; VER-015 named assertion.']
};
const rows = workbook.sheets.TestCases.slice(1).map(source => {
  const c = source.cells;
  const execution = passed.get(c.A);
  const blocked = blockedOverrides[c.A] || blockedByRow(c);
  const status = execution ? 'PASS' : blocked ? 'BLOCKED' : 'NOT TESTED';
  const verificationLevel = execution
    ? execution.evidence.startsWith('Local Angular') || execution.evidence.startsWith('node my-app') || execution.evidence.startsWith('npm.cmd test') ? 'PASS_UI_FIXTURE'
      : execution.evidence.includes('endpoint') ? 'PASS_CONTRACT' : 'PASS_UNIT'
    : blocked ? 'BLOCKED' : 'NOT TESTED';
  let actual = execution
    ? 'Automated assertion passed on isolated fixture; this does not establish live MongoDB/n8n data.'
    : blocked || 'No case-specific executable assertion was run for this ID.';
  if (c.A === 'API-001' || c.A === 'API-002' || c.A === 'API-006') {
    actual = 'Adapter/normalizer fixture checks ran, but the specified HTTP endpoint or n8n sandbox contract was not fully exercised.';
  }
  if (c.A === 'TOUR-002') actual = 'Completed empty fixture search returned zero tours and retained the self-planning CTA.';
  if (c.A === 'PLAN-020') actual = 'Mismatched known destination in itinerary title is rejected; backend returns a safe correction and null itinerary.';
  if (c.A === 'SEC-021') actual = 'Catalog-unavailable path returned CHAT_CATALOG_UNAVAILABLE and did not call the model webhook.';
  if (c.A === 'SEC-002') actual = 'Production-mode error output and logs were checked for redaction; stack and secret values were absent.';
  if (c.A === 'SEC-007') actual = 'Local browser fixture confirmed script markup in assistant output did not execute.';
  if (c.A === 'UI-010') actual = 'Canceling an active chat request aborts it and appends no fabricated assistant response.';
  if (c.A === 'UI-012') actual = 'Loading the prior local conversation restores its transcript and result context.';
  if (c.A === 'SEC-020') actual = 'Credential rotation/revocation evidence was not available; production release remains blocked.';
  if ((!execution || blocked) && coverageGaps[c.A]) actual = coverageGaps[c.A][0];
  return {
    testId: c.A, group: c.B, priority: c.C, layer: c.D, expectedIntent: c.G, expectedBehavior: c.I, technicalAssertion: c.K,
    status, verificationLevel, actualResult: actual,
    evidence: execution?.evidence || coverageGaps[c.A]?.[1] || (c.B === 'CAT'
      ? 'Existing backend fixture-query tests ran in npm test; live MongoDB cases skipped because TEST_MONGODB_URI is unset.'
      : ['API-001','API-002','API-006'].includes(c.A)
        ? 'Adapter/normalizer fixture assertions ran in greensteps-chat-workbook-regression.test.js; API endpoint and n8n sandbox not run.'
        : blocked ? 'Environment audit; no test invocation against live service.' : 'No execution evidence.'),
    bugTicket: execution?.bug || ''
  };
});
const flows = workbook.sheets.E2E_Flows.slice(1).map(source => {
  const c = source.cells;
  const fixtureUiPass = (c.A === 'FLOW-01' && [1,2,3,4].includes(Number(c.D)))
    || (c.A === 'FLOW-02' && [1,2,3,4].includes(Number(c.D)));
  return {
    flowId: c.A, step: c.D, event: c.E, expected: c.G,
    status: fixtureUiPass ? 'PASS' : 'NOT TESTED',
    verificationLevel: fixtureUiPass ? 'PASS_UI_FIXTURE' : 'NOT TESTED',
    actualResult: fixtureUiPass
      ? 'Frontend segment passed with local fixture interception; full MongoDB → backend → n8n → Gemini flow was not run.'
      : 'No execution evidence for this flow.',
    evidence: fixtureUiPass ? 'my-app/e2e/greensteps-workbook-flow.e2e.cjs (UI fixture only)' : ''
  };
});
flows.push(
  { flowId: 'FLOW-A', step: 'end-to-end fixture', event: 'Tour discovery → CTA → duration → three-day plan', expected: 'Destination and three days retained through visible UI flow.', status: 'PASS', verificationLevel: 'PASS_UI_FIXTURE', actualResult: 'Local Angular browser flow passed with intercepted API fixtures; no live database or n8n.', evidence: 'node my-app/e2e/greensteps-workbook-flow.e2e.cjs; FLOW-01 and UI-001/003/004/006/013 assertions.' },
  { flowId: 'FLOW-B', step: 'complete fixture', event: 'Empty discovery → CTA → two-day plan', expected: 'No fake tour; self-plan remains available and then creates the requested two-day plan.', status: 'PASS', verificationLevel: 'PASS_UI_FIXTURE', actualResult: 'Browser fixture completed empty discovery, clicked self-plan, selected two days, and rendered exactly two Hà Giang days; API was intercepted.', evidence: 'node my-app/e2e/greensteps-workbook-flow.e2e.cjs; FLOW-B complete, fixture only.' },
  { flowId: 'FLOW-C', step: 'backend fixture', event: 'Phú Yên two-day plan → change destination to Đà Nẵng', expected: 'Retain two days and use latest requested destination.', status: 'PASS', verificationLevel: 'PASS_UNIT', actualResult: 'Two-day correction normalized to Đà Nẵng; no Phú Yên activity and no live model call.', evidence: 'backend/test/greensteps-chat-workbook-regression.test.js; FLOW-C and CTX-007/008/013.' },
  { flowId: 'FLOW-D', step: 'repository fixture', event: 'Budgeted Da Nang tour query with later pages', expected: 'Apply destination/duration/budget filters and preserve pagination.', status: 'PASS', verificationLevel: 'PASS_UNIT', actualResult: 'Fixture repository returned only AND-matching tours and unique next-page results.', evidence: 'backend/test/greensteps-chat-workbook-regression.test.js; TOUR-004/005/006/017.' },
  { flowId: 'FLOW-E', step: 'backend contract fixture', event: 'AI returns mismatched destination and duration', expected: 'Reject wrong itinerary; do not render it.', status: 'PASS', verificationLevel: 'PASS_UNIT', actualResult: 'Known destination conflict and invalid day shape return null itinerary and safe reply.', evidence: 'backend/test/greensteps-chat-workbook-regression.test.js; PLAN-019/020/023.' },
  { flowId: 'FLOW-F', step: 'catalog fixture', event: 'AI selects a verified service ID', expected: 'Verify ID/destination/status and take price/carbon from catalog.', status: 'PASS', verificationLevel: 'PASS_UNIT', actualResult: 'Valid ID was accepted with catalog values; unknown, wrong-destination, hidden, pending and approved IDs were rejected.', evidence: 'backend/test/greensteps-chat-workbook-regression.test.js; VER-001/002/003/004/005/006/011/015/030.' },
  { flowId: 'FLOW-G', step: 'frontend concurrency', event: 'Destination changes while previous response is delayed', expected: 'Late old response must not replace the current destination result.', status: 'NOT TESTED', verificationLevel: 'NOT TESTED', actualResult: 'The frontend disables composer submission while a request is active; no delayed-response replacement scenario was executed.', evidence: 'No execution evidence for a delayed destination-change request.' }
);
flows.push(
  { flowId: 'FLOW-03-UI', step: 'browser fixture', event: 'Equivalent itinerary wording variants through UI', expected: 'Render matching three-day itinerary response for each phrase.', status: 'PASS', verificationLevel: 'PASS_UI_FIXTURE', actualResult: 'Three scripted equivalent prompts rendered three-day plans in separate conversations; messages were fixture-driven and do not test backend intent classification.', evidence: 'node my-app/e2e/greensteps-p0-flows.e2e.cjs; local browser, API interception.' },
  { flowId: 'FLOW-04-UI', step: 'browser fixture', event: 'Missing destination -> destination answer -> duration answer', expected: 'Render two-day Phu Yen itinerary in the same chat session.', status: 'PASS', verificationLevel: 'PASS_UI_FIXTURE', actualResult: 'Browser selected the destination and duration clarification options, then rendered the two-day plan; scripted API fixture.', evidence: 'node my-app/e2e/greensteps-p0-flows.e2e.cjs; local browser, API interception.' },
  { flowId: 'FLOW-05-UI', step: 'browser fixture', event: 'Create plan -> set budget -> remove budget', expected: 'Retain Da Nang and three days through budget updates.', status: 'PASS', verificationLevel: 'PASS_UI_FIXTURE', actualResult: 'The same session rendered the plan after each budget turn; scripted API fixture, no backend slot-state assertion.', evidence: 'node my-app/e2e/greensteps-p0-flows.e2e.cjs; local browser, API interception.' },
  { flowId: 'FLOW-06-UI', step: 'browser fixture', event: 'Phu Yen plan -> change destination to Da Nang', expected: 'Render Da Nang itinerary while retaining two days.', status: 'PASS', verificationLevel: 'PASS_UI_FIXTURE', actualResult: 'The browser rendered the two-day Da Nang correction; scripted API fixture, no actual delayed old response in this case.', evidence: 'node my-app/e2e/greensteps-p0-flows.e2e.cjs; local browser, API interception.' },
  { flowId: 'FLOW-07-UI', step: 'browser fixture', event: 'Ambiguous destinations -> select Da Nang -> tour CTA -> plan', expected: 'Render Da Nang plan after user selection.', status: 'PASS', verificationLevel: 'PASS_UI_FIXTURE', actualResult: 'The browser used the choice, tour card CTA, duration option, and rendered the three-day plan; scripted API fixture.', evidence: 'node my-app/e2e/greensteps-p0-flows.e2e.cjs; local browser, API interception.' },
  { flowId: 'FLOW-09-UI', step: 'browser fixture', event: 'Render a service marked verified in API fixture', expected: 'Show verified-service label in the itinerary card.', status: 'PASS', verificationLevel: 'PASS_UI_FIXTURE', actualResult: 'The browser rendered the verified labels for an injected fixture ID; backend catalog lookup and MongoDB verification were not called.', evidence: 'node my-app/e2e/greensteps-p0-flows.e2e.cjs; local browser, API interception.' },
  { flowId: 'FLOW-10-UI', step: 'browser fixture', event: 'Return wrong-destination itinerary to frontend', expected: 'Do not render the Phu Yen plan for Da Nang request.', status: 'PASS', verificationLevel: 'PASS_UI_FIXTURE', actualResult: 'The frontend rejected the mismatched fixture itinerary and rendered no plan card; backend retry/reject contract remains untested end to end.', evidence: 'node my-app/e2e/greensteps-p0-flows.e2e.cjs; local browser, API interception.' },
  { flowId: 'FLOW-G-UI', step: 'browser fixture', event: 'Cancel delayed response, reset chat, render a new plan, release stale response', expected: 'Keep the new plan visible after stale response release.', status: 'PASS', verificationLevel: 'PASS_UI_FIXTURE', actualResult: 'The browser canceled the old request, started a new conversation, rendered the one-day Da Nang plan, then released the old fixture response without replacing the plan.', evidence: 'node my-app/e2e/greensteps-p0-flows.e2e.cjs; local browser, API interception.' }
);
const counts = (values, key) => values.reduce((out, row) => { const k = row[key]; out[k] = (out[k] || 0) + 1; return out; }, {});
const summary = {
  sourceWorkbook: 'GreenSteps_AI_Chatbot_351_Testcases_Full_Coverage.xlsx',
  totalCases: rows.length,
  uniqueTestIds: new Set(rows.map(row => row.testId)).size,
  statuses: counts(rows, 'status'),
  verificationLevels: counts(rows, 'verificationLevel'),
  byPriority: Object.fromEntries(['P0','P1','P2'].map(priority => [priority, {
    total: rows.filter(row => row.priority === priority).length,
    statuses: counts(rows.filter(row => row.priority === priority), 'status')
  }])),
  byGroup: Object.fromEntries([...new Set(rows.map(row => row.group))].sort().map(group => [group, {
    total: rows.filter(row => row.group === group).length,
    statuses: counts(rows.filter(row => row.group === group), 'status')
  }])),
  p0NotPassed: rows.filter(row => row.priority === 'P0' && row.status !== 'PASS').map(row => row.testId),
  e2eFlows: { totalRows: flows.length, uniqueFlows: [...new Set(flows.map(row => row.flowId))].length, statuses: counts(flows, 'status') },
  verificationRuns: [
    { command: 'node --test backend/test/greensteps-p0-closeout.test.js', result: 'PASS: 41 tests, 0 failed; named closeout assertions run on isolated fixtures.' },
    { command: 'node --test backend/test/greensteps-chat-workbook-regression.test.js', result: 'PASS: 34 tests, 0 failed; source workbook utterances exercised against isolated catalog fixtures.' },
    { command: 'npm.cmd test (backend)', result: 'PASS: 247 passed, 0 failed, 8 skipped; 255 total. Eight skips require TEST_MONGODB_URI at loopback:27019.' },
    { command: 'npm.cmd test -- --watch=false (my-app)', result: 'PASS: 127 tests across 40 files; fixture/unit suite, no live database or n8n.' },
    { command: 'npm.cmd run build (my-app)', result: 'PASS; existing NG8107 warning and initial bundle exceeds 2 MB budget by 1.29 MB.' },
    { command: 'node my-app/e2e/greensteps-workbook-flow.e2e.cjs', result: 'PASS: local Angular/Chrome fixture UI for discovery, CTA, slot filling, empty results, three-day FLOW-01 and completed two-day FLOW-02; API intercepted.' },
    { command: 'node my-app/e2e/greensteps-p0-flows.e2e.cjs', result: 'PASS_UI_FIXTURE: browser scenarios FLOW-03/04/05/06/07/09/10/G passed with intercepted API responses; no live backend, database, n8n, Gemini or production webhook.' },
    { command: 'node my-app/e2e/greensteps-chat.e2e.cjs', result: 'PASS after close-focus correction: local browser fixture checks cards, history, retry, booking CTA, save/login, XSS output and mobile layout.' },
    { command: 'node my-app/e2e/itinerary-proposal.e2e.cjs', result: 'PASS: local fixture browser checks budget label, unverified cost, 1/3/5-day rendering, mobile overflow, adjust, save and schedule route.' }
  ],
  p0InitialNotTested: 52,
  p0NewPassesThisCloseout: rows.filter(row => row.priority === 'P0' && row.status === 'PASS').length - 67,
  p0StillNotTested: rows.filter(row => row.priority === 'P0' && row.status === 'NOT TESTED').length,
  p0BlockedThisCloseout: rows.filter(row => row.priority === 'P0' && row.status === 'BLOCKED').length - 37,
  p0PassBaseline: 67,
  p0PassIncrease: rows.filter(row => row.priority === 'P0' && row.status === 'PASS').length - 67,
  releaseDecision: 'NO-GO',
  releaseBlockers: ['Exposed webhook credential rotation/revocation is not evidenced.', 'TEST_MONGODB_URI is unset; live MongoDB cases remain blocked.', 'No isolated n8n sandbox runtime was exercised.', 'Frontend browser flows use intercepted API fixtures, not end-to-end live services.', 'GreenService schema does not provide a service URL or carbon unit/scope metadata.'],
  limitations: ['No Atlas writes or production webhook calls were made.', 'PASS statuses are limited to the verification level recorded per row.', 'No full live MongoDB → backend → n8n → Gemini conversation was verified.']
};
const reportDir = path.join(root, 'docs/superpowers/reports');
fs.writeFileSync(path.join(reportDir, 'greensteps-351-test-results.csv'), [
  ['Test ID','Group','Priority','Test layer','Expected intent','Expected behavior','Technical assertion','Status','Verification Level','Actual result','Evidence','Bug ticket'].join(','),
  ...rows.map(row => [row.testId,row.group,row.priority,row.layer,row.expectedIntent,row.expectedBehavior,row.technicalAssertion,row.status,row.verificationLevel,row.actualResult,row.evidence,row.bugTicket].map(csv).join(','))
].join('\n') + '\n');
fs.writeFileSync(path.join(reportDir, 'greensteps-351-e2e-flow-results.csv'), [
  ['Flow ID','Step','Event','Expected','Status','Verification Level','Actual result','Evidence'].join(','),
  ...flows.map(row => [row.flowId,row.step,row.event,row.expected,row.status,row.verificationLevel,row.actualResult,row.evidence].map(csv).join(','))
].join('\n') + '\n');
fs.writeFileSync(path.join(reportDir, 'greensteps-351-test-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
