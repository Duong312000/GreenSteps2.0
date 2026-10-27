// One live request through the same catalog/proxy adapter used by Aura.
// Output only status and counts, never credentials or upstream response bodies.
require('../src/config/env');
const { createChatAdapter } = require('../src/services/greensteps-chat.service');

(async () => {
  let catalog, upstreamStatus;
  const send = createChatAdapter({ fetchImpl: async (url, options) => {
    if (options.method === 'POST') catalog = JSON.parse(options.body).context.catalog;
    const response = await fetch(url, options);
    if (options.method === 'POST') upstreamStatus = response.status;
    return response;
  } });
  try {
    const result = await send({
      message: 'GreenSteps hiện có tour ở những điểm đến nào? Hãy kiểm tra danh mục bằng công cụ.',
      sessionId: `greensteps-live-check-${Date.now()}`, history: []
    });
    console.log(JSON.stringify({ success: result.success, upstreamStatus, replyCharacters: result.reply.length, catalog: summarize(catalog) }));
  } catch (error) {
    console.log(JSON.stringify({ success: false, upstreamStatus, code: error.code || 'CHECK_FAILED', catalog: summarize(catalog) }));
    process.exitCode = 1;
  }
})();

function summarize(catalog) {
  return catalog && { available: catalog.available, tours: catalog.tours.length, services: catalog.services.length, truncated: catalog.truncated, reason: catalog.reason };
}
