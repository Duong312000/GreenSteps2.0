const errorHandler = (err, req, res, next) => {
  console.error('Unhandled System Error:', err);

  const statusCode = err.statusCode || 500;
  const errorName = err.name || 'InternalServerError';
  const errorMessage = err.message || 'Có lỗi hệ thống xảy ra, vui lòng thử lại sau!';

  res.status(statusCode).json({
    success: false,
    error: errorName,
    code: err.code,
    message: errorMessage,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;
