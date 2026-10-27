// Only public fields from fixed loopback endpoints may leave the server.
const MAX_ROWS = 80;
const PUBLIC_STATUSES = new Set(['active', 'approved', 'published', 'available']);
const short = (value, max = 150) => typeof value === 'string' ? value.slice(0, max) : '';
const safeNumber = value => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1e9 ? n : null;
};

async function fetchCollection(url, fetchImpl, signal) {
  const response = await fetchImpl(url, {
    method: 'GET', headers: { Accept: 'application/json' }, redirect: 'error', signal
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error('Catalog unavailable'); }
  // Public API lists contain images and activities; still bound total bytes read.
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing catalog body');
  const decoder = new TextDecoder();
  let text = '', bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8 * 1024 * 1024) throw new Error('Catalog too large');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { await reader.cancel().catch(() => {}); }
  const rows = JSON.parse(text);
  if (!Array.isArray(rows)) throw new Error('Invalid catalog');
  return rows;
}

async function loadAgentCatalog({ env = process.env, fetchImpl = global.fetch, signal } = {}) {
  const unavailable = reason => ({ available: false, tours: [], services: [], reason });
  if (env.N8N_CATALOG_ENABLED !== 'true') return unavailable('disabled');
  const port = Number(env.PORT || 5055);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return unavailable('invalid_port');
  const timeout = AbortSignal.timeout(5000);
  const catalogSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const base = `http://127.0.0.1:${port}/api`;
  try {
    const [tourRows, serviceRows] = await Promise.all([
      fetchCollection(`${base}/tours`, fetchImpl, catalogSignal),
      fetchCollection(`${base}/services`, fetchImpl, catalogSignal)
    ]);
    const tours = tourRows.filter(t => t && typeof t === 'object').map(t => ({
      id: short(t.id, 80), title: short(t.title), destination: short(t.destination, 100),
      days: safeNumber(t.days), cost: safeNumber(t.cost), carbon: safeNumber(t.carbon),
      rating: safeNumber(t.rating), votesCount: safeNumber(t.votes_count), description: short(t.description, 240), imageUrl: short(t.image || t.image_url, 500),
      bookingAvailable: typeof t.bookingAvailable === 'boolean' ? t.bookingAvailable : undefined,
      highlights: Array.isArray(t.data) ? t.data.flatMap(day => Array.isArray(day) ? day : []).map(activity => short(activity?.name || activity?.title, 80)).filter(Boolean).slice(0, 5) : [],
      tags: Array.isArray(t.tags) ? t.tags.slice(0, 6).map(tag => short(tag, 40)) : []
    })).filter(t => t.id && t.title);
    const services = serviceRows.filter(s => s && PUBLIC_STATUSES.has(String(s.status || '').trim().toLowerCase())).map(s => ({
      id: short(s.id, 80), name: short(s.name), type: short(s.type, 40), destination: short(s.destination, 100),
      cost: safeNumber(s.cost), carbon: safeNumber(s.carbon), rating: safeNumber(s.rating), imageUrl: short(s.image_url || s.image, 500),
      status: String(s.status).trim().toLowerCase()
    })).filter(s => s.id && s.name);
    return {
      available: true, fetchedAt: new Date().toISOString(),
      truncated: tours.length > MAX_ROWS || services.length > MAX_ROWS,
      truncatedTours: tours.length > MAX_ROWS,
      truncatedServices: services.length > MAX_ROWS,
      tours: tours.slice(0, MAX_ROWS), services: services.slice(0, MAX_ROWS)
    };
  } catch {
    return unavailable('catalog_unavailable');
  }
}

function createCatalogLoader(options = {}) {
  let cached, expires = 0;
  return async ({ signal } = {}) => {
    signal?.throwIfAborted();
    const env = options.env || process.env;
    if (env.N8N_CATALOG_ENABLED !== 'true') return loadAgentCatalog({ ...options, signal });
    if (cached && expires > Date.now()) return cached;
    const catalog = await loadAgentCatalog({ ...options, signal });
    if (catalog.available && !signal?.aborted) {
      cached = catalog;
      const configured = Number(env.N8N_CATALOG_CACHE_MS ?? 30000);
      expires = Date.now() + (Number.isFinite(configured) ? Math.max(0, Math.min(60000, configured)) : 30000);
    }
    return catalog;
  };
}
module.exports = { loadAgentCatalog, createCatalogLoader };
