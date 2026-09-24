// Thrown intentionally from controllers/services and caught by the central
// error handler. Anything else (programmer errors) is treated as a 500 and
// never leaks its message/stack to the client in production.
class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isApiError = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, errors = []) { return new ApiError(400, message, errors); }
  static unauthorized(message = 'Authentication required') { return new ApiError(401, message); }
  static forbidden(message = 'You do not have permission to perform this action') { return new ApiError(403, message); }
  static notFound(message = 'Resource not found') { return new ApiError(404, message); }
  static conflict(message) { return new ApiError(409, message); }
  static internal(message = 'Internal server error') { return new ApiError(500, message); }
}

module.exports = ApiError;
