const { gzipSync, constants } = require('node:zlib');

const PUBLIC_CATALOG_PATH = /^\/api(?:\/v1)?\/(?:services(?:\/search)?|tours(?:\/search)?|destinations)\/?$/;
const MINIMUM_JSON_BYTES = 1024;

function compressPublicCatalogJson(req, res, next) {
  const originalSend = res.send;
  // Routers mounted at /api temporarily strip that prefix from req.path while
  // handlers run. Capture the original path before the router changes it.
  const requestPath = (req.originalUrl || req.url || '').split('?')[0];

  res.send = function sendPublicCatalogJson(body) {
    const isPublicCatalogGet = req.method === 'GET' && PUBLIC_CATALOG_PATH.test(requestPath);
    if (isPublicCatalogGet) res.vary('Accept-Encoding');
    const acceptsGzip = typeof req.acceptsEncodings === 'function' && req.acceptsEncodings('gzip');
    const isJson = String(res.getHeader('Content-Type') || '').includes('json');
    if (!isPublicCatalogGet || !acceptsGzip || !isJson || body == null) {
      return originalSend.call(this, body);
    }

    const content = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    if (content.length < MINIMUM_JSON_BYTES) return originalSend.call(this, body);

    const compressed = gzipSync(content, { level: constants.Z_BEST_SPEED });
    res.setHeader('Content-Encoding', 'gzip');
    return originalSend.call(this, compressed);
  };

  next();
}

module.exports = { compressPublicCatalogJson, MINIMUM_JSON_BYTES };
