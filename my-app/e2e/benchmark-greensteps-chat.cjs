// Real browser -> real Express -> configured n8n. No mocks or interceptions.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const questions = ['Xin chào.', 'GreenSteps có những điểm đến nào?', 'Tìm tour Đà Lạt 3 ngày dưới 3 triệu.', 'Tìm homestay tại Đà Lạt.', 'Lập lịch trình Đà Lạt 3 ngày 2 đêm.'];
const rounds = Math.max(3, Number(process.env.CHAT_BENCH_ROUNDS) || 3);
const frontend = process.env.CHAT_BENCH_FRONTEND || 'http://localhost:4200';
const api = process.env.CHAT_BENCH_API || 'http://localhost:5055/api/support/chat';
const output = path.resolve(__dirname, '../../integrations/n8n/performance-results.json');
const config = require('../../backend/node_modules/dotenv').parse(fs.readFileSync(path.resolve(__dirname, '../../backend/.env')));
const aiWorkflowPath = new URL(config.N8N_WEBHOOK_URL).pathname;

(async () => {
  const installed = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (fs.existsSync(installed) ? installed : undefined) });
  const samples = [];
  const report = () => ({ measuredAt: new Date().toISOString(), frontend, api, aiWorkflowPath, samples });
  try {
    const page = await browser.newPage();
    await page.goto(frontend + '/tours', { waitUntil: 'domcontentloaded' });
    for (let index = 0; index < questions.length; index++) {
      for (let round = 1; round <= rounds; round++) {
        const sample = await page.evaluate(async ({ api, message, sessionId }) => {
          const start = performance.now();
          try {
            const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message, sessionId, history: [] }), signal: AbortSignal.timeout(50000) });
            const body = await response.json();
            return { frontendExpressMs: Math.round((performance.now() - start) * 100) / 100, status: response.status,
              success: body.success === true, code: body.code, replyCharacters: typeof body.reply === 'string' ? body.reply.length : 0,
              path: response.headers.get('X-Chat-Path'), serverTiming: response.headers.get('Server-Timing') };
          } catch (error) { return { frontendExpressMs: Math.round((performance.now() - start) * 100) / 100, success: false, code: error.name }; }
        }, { api, message: questions[index], sessionId: `greensteps-perf-${Date.now()}-${index}-${round}` });
        const entry = { question: index + 1, round, ...sample };
        samples.push(entry);
        console.log(JSON.stringify(entry));
        fs.writeFileSync(output, JSON.stringify(report(), null, 2) + '\n');
      }
    }
    const summary = questions.map((question, index) => {
      const rows = samples.filter(row => row.question === index + 1);
      const times = rows.map(row => row.frontendExpressMs).sort((a,b) => a-b);
      return { question, timesMs: rows.map(row => row.frontendExpressMs), medianMs: times[Math.floor(times.length / 2)],
        errors: rows.filter(row => !row.success).map(row => ({ round: row.round, code: row.code, status: row.status })) };
    });
    fs.writeFileSync(output, JSON.stringify({ ...report(), summary }, null, 2) + '\n');
    console.log(JSON.stringify({ summary }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.name + ': ' + error.message); process.exitCode = 1; });
