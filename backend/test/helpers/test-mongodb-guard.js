function isIsolatedLoopbackMongoUri(uri) {
  if (typeof uri !== 'string') return false;
  const match = uri.match(/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27019\/([^/?]+)(?:[/?]|$)/i);
  return match?.[1].toLowerCase() === 'greenstepsintegrationtest';
}

const uri = process.env.TEST_MONGODB_URI || '';
const isolatedLoopback = isIsolatedLoopbackMongoUri(uri);

if (isolatedLoopback) process.env.MONGODB_URI = uri;

module.exports = {
  testMongoAvailable: isolatedLoopback,
  skipReason: 'Set TEST_MONGODB_URI to the disposable loopback database GreenStepsIntegrationTest on port 27019.',
  isIsolatedLoopbackMongoUri
};
