// 404 for unknown API routes.
const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// Central error handler — converts known errors into consistent JSON and never
// leaks internal details (stack traces, driver messages) for unexpected errors.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const status = err.path === '_id' ? 404 : 400;
    const message = status === 404 ? 'Resource not found' : `Invalid value for '${err.path}'`;
    return res.status(status).json({ success: false, message });
  }

  // Mongo duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'field';
    return res.status(409).json({ success: false, message: `A record with this ${field} already exists.` });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') || 'Validation failed', errors: messages });
  }

  // Optimistic concurrency conflict
  if (err.name === 'VersionError') {
    return res.status(409).json({ success: false, message: 'This record was modified by someone else. Please reload and try again.' });
  }

  if (err.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Invalid token' });
  if (err.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired' });

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON in request body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large' });
  }

  // Multer upload errors
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 5 MB)' : err.message });
  }

  const status = err.statusCode || err.status || 500;
  if (status >= 500) {
    console.error(`❌ ${req.method} ${req.originalUrl}:`, err);
  }

  const body = {
    success: false,
    message: status >= 500 && isProd ? 'Internal Server Error' : (err.message || 'Internal Server Error')
  };
  if (err.details && status < 500) body.errors = err.details;
  res.status(status).json(body);
};

module.exports = errorHandler;
module.exports.notFound = notFound;
