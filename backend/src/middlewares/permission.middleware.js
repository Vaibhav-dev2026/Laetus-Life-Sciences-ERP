const ApiError = require('../utils/ApiError');

// Single-admin app: there is now only one role ('Admin'), so per-module
// role gating has been removed. requireRole(...) is kept as a thin
// authentication check (rather than deleted outright) so existing route
// files that call requireRole('Admin') etc. don't all need their imports
// rewritten — it just confirms the request is authenticated at all.
// If a second staff member is ever added, re-introduce real per-role
// checks here using req.user.role.
function requireRole(...roles) { // eslint-disable-line no-unused-vars
  return function permissionCheck(req, res, next) {
    if (!req.user) return next(ApiError.unauthorized());
    next();
  };
}

module.exports = { requireRole };
