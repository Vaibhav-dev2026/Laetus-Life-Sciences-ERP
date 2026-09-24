const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const maintenanceService = require('../services/maintenance.service');

const getDiagnostics = asyncHandler(async (req, res) => {
  const data = await maintenanceService.getDiagnostics();
  return ApiResponse.success(res, { data });
});

const scanCandidates = asyncHandler(async (req, res) => {
  const retentionMonths = parseInt(req.query.retentionMonths || '12', 10);
  const data = await maintenanceService.scanCandidates({ retentionMonths });
  return ApiResponse.success(res, { data });
});

const runCleanup = asyncHandler(async (req, res) => {
  const { cleanOrphans, cleanNotifications, cleanTempExports, cleanQaData, cleanQaTestRunId } = req.body;
  const data = await maintenanceService.runCleanup({
    cleanOrphans: Boolean(cleanOrphans),
    cleanNotifications: Boolean(cleanNotifications),
    cleanTempExports: Boolean(cleanTempExports),
    cleanQaData: Boolean(cleanQaData),
    cleanQaTestRunId: cleanQaTestRunId || null,
    userName: req.user?.name || 'Admin',
  });
  return ApiResponse.success(res, { message: 'Database maintenance cleanup executed successfully', data });
});

module.exports = {
  getDiagnostics,
  scanCandidates,
  runCleanup,
};
