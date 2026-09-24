const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  return ApiResponse.success(res, {
    message: 'File uploaded successfully',
    data: { fileName: req.file.filename, originalName: req.file.originalname, size: req.file.size, url: `/uploads/${req.file.filename}` },
  });
});

module.exports = { uploadFile };
