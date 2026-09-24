const env = require('../config/env');

// Centralized error handler — every route funnels here via asyncHandler/next(err).
// Never leaks stack traces or internal messages in production.
function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.name === 'ValidationError') { // mongoose validation
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }
  if (err.name === 'CastError') { // malformed ObjectId in a route param, e.g. GET /api/users/not-an-id
    return res.status(400).json({ success: false, message: `Invalid ${err.path || 'id'}: "${err.value}"` });
  }
  if (err.code === 11000) { // duplicate key
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    const val = err.keyValue ? Object.values(err.keyValue)[0] : '';
    const errmsg = err.errmsg || err.message || '';
    
    let message = `Duplicate value for ${field}`;
    if (errmsg.includes('.users')) {
      message = `A user with email "${err.keyValue?.email || val}" already exists.`;
    } else if (errmsg.includes('.products')) {
      message = `A product with SKU "${err.keyValue?.sku || val}" already exists.`;
    } else if (errmsg.includes('.productbatches')) {
      message = `Batch "${err.keyValue?.batchNo || val}" already exists for this product.`;
    } else if (errmsg.includes('.customers')) {
      if (err.keyPattern?.partyName) {
        message = `A customer with party name "${err.keyValue?.partyName || val}" already exists.`;
      } else {
        message = `A customer with ID "${err.keyValue?.id || val}" already exists.`;
      }
    } else if (errmsg.includes('.suppliers')) {
      if (err.keyPattern?.company) {
        message = `A supplier with company name "${err.keyValue?.company || val}" already exists.`;
      } else {
        message = `A supplier with ID "${err.keyValue?.id || val}" already exists.`;
      }
    } else if (errmsg.includes('.sales')) {
      message = `Invoice number "${err.keyValue?.invoiceNo || val}" already exists.`;
    } else if (val) {
      message = `The value "${val}" for field "${field}" already exists.`;
    }

    return res.status(409).json({
      success: false,
      message,
      errors: [{ field, message: 'Already exists', value: val }]
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.isApiError || statusCode < 500 ? err.message : 'Internal server error';

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  const body = { success: false, message };
  if (err.errors?.length) body.errors = err.errors;
  if (env.nodeEnv !== 'production' && statusCode >= 500) body.stack = err.stack;

  res.status(statusCode).json(body);
}

module.exports = { notFoundHandler, errorHandler };
