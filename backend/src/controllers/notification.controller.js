const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const { Notification } = require('../models');
const { syncSystemNotifications } = require('../services/notification.service');

const list = asyncHandler(async (req, res) => {
  await syncSystemNotifications();
  const data = await Notification.find().sort({ date: -1 }).limit(100);
  return ApiResponse.success(res, { data });
});

const markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ id: req.params.id }, { $set: { read: true } });
  const data = await Notification.find().sort({ date: -1 }).limit(100);
  return ApiResponse.success(res, { data });
});

const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({}, { $set: { read: true } });
  const data = await Notification.find().sort({ date: -1 }).limit(100);
  return ApiResponse.success(res, { data });
});

module.exports = { list, markRead, markAllRead };
