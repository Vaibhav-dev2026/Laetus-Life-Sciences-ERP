const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');

// Audit logs have been removed to optimize database storage and performance.
const list = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, { data: [] });
});

module.exports = { list };
