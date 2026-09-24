const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { runBackup, runRestore, runIsolatedRestoreTest, deleteBackup } = require('../services/backup.service');
const { Backup } = require('../models');
const { logAudit } = require('../services/audit.service');

const list = asyncHandler(async (req, res) => {
  const data = await Backup.find().sort({ date: -1 });
  return ApiResponse.success(res, { data });
});

const create = asyncHandler(async (req, res) => {
  const backup = await runBackup('Manual');
  await logAudit({ user: req.user?.name, action: 'Create', module: 'Backup', reference: backup.id });
  return ApiResponse.created(res, { message: 'Backup created successfully', data: backup });
});

const restore = asyncHandler(async (req, res) => {
  if (req.body.confirm !== 'RESTORE') throw ApiError.badRequest('Type RESTORE to confirm this irreversible action');
  const backup = await runRestore(req.params.id);
  await logAudit({ user: req.user?.name, action: 'Restore', module: 'Backup', reference: backup.id });
  return ApiResponse.success(res, { message: 'Restore completed', data: backup });
});

const testRestore = asyncHandler(async (req, res) => {
  const result = await runIsolatedRestoreTest(req.params.id, req.user?.name || 'Admin');
  return ApiResponse.success(res, { message: 'Isolated restore test completed successfully', data: result });
});

const remove = asyncHandler(async (req, res) => {
  const backup = await deleteBackup(req.params.id);
  await logAudit({ user: req.user?.name, action: 'Delete', module: 'Backup', reference: req.params.id });
  return ApiResponse.success(res, { message: 'Backup deleted successfully', data: backup });
});

module.exports = { list, create, restore, testRestore, remove };
