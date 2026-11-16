function createDatabaseConnectionMiddleware({ store } = {}) {
  let connected = false;
  return async (req, res, next) => {
    try {
      if (!connected) {
        await store.authenticate();
        connected = true;
      }
      return next();
    } catch (error) {
      connected = false;
      console.warn('[DB] Initial request connection unavailable', {
        method: req.method,
        path: (req.originalUrl || req.url || '').split('?')[0],
        error: error?.name || 'MongoError',
        code: error?.code || error?.cause?.code || 'n/a',
        timestamp: new Date().toISOString()
      });
      return res.status(503).json({
        success: false,
        error: 'DatabaseUnavailable',
        message: 'GreenSteps đang tạm thời không truy cập được dữ liệu. Vui lòng thử lại sau.'
      });
    }
  };
}

module.exports = { createDatabaseConnectionMiddleware };
