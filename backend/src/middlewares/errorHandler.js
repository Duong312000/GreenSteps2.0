const errorHandler = (err, req, res, next) => {
  console.error('Unhandled System Error:', err);

  const conflict = err.code === 11000 || err.hasErrorLabel?.('TransientTransactionError');
  const statusCode = conflict ? 409 : err.statusCode || err.status || 500;
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
