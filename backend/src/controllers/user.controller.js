const jwt = require('jsonwebtoken');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { User } = require('../models');
const { logAudit } = require('../services/audit.service');

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

const list = asyncHandler(async (req, res) => {
  const data = await User.find().sort({ createdAt: -1 });
  return ApiResponse.success(res, { data });
});

const create = asyncHandler(async (req, res) => {
  const { name, email, role, password } = req.body;
  if (!password || password.length < 6) throw ApiError.badRequest('A password of at least 6 characters is required');
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw ApiError.conflict('A user with this email already exists');
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email, role, passwordHash });
  await logAudit({ user: req.user?.name, action: 'Create', module: 'Users', reference: user.email, after: { name, email, role } });
  return ApiResponse.created(res, { message: 'User created successfully', data: user });
});

const update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  const before = { name: user.name, role: user.role, isActive: user.isActive };
  if (req.body.name) user.name = req.body.name;
  if (req.body.role) user.role = req.body.role;
  if (req.body.status) user.isActive = req.body.status === 'Active';
  await user.save();
  await logAudit({ user: req.user?.name, action: 'Update', module: 'Users', reference: user.email, before, after: { name: user.name, role: user.role, isActive: user.isActive } });
  return ApiResponse.success(res, { message: 'User updated successfully', data: user });
});

const changeOwnPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) throw ApiError.badRequest('New password must be at least 6 characters');
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');
  const valid = await user.comparePassword(currentPassword || '');
  if (!valid) throw ApiError.unauthorized('Current password is incorrect');
  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();
  await logAudit({ user: user.name, action: 'UpdatePassword', module: 'Users', reference: user.email, after: { passwordChanged: true } });
  return ApiResponse.success(res, { message: 'Password updated successfully' });
});

const updateOwnEmail = asyncHandler(async (req, res) => {
  const { currentPassword, newEmail } = req.body;
  if (!newEmail || !newEmail.includes('@')) throw ApiError.badRequest('A valid email address is required');
  if (!currentPassword) throw ApiError.badRequest('Current password is required to change email address');

  const normalized = newEmail.trim().toLowerCase();
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');

  const valid = await user.comparePassword(currentPassword || '');
  if (!valid) throw ApiError.unauthorized('Current password is incorrect');

  const existing = await User.findOne({ email: normalized, _id: { $ne: user._id } });
  if (existing) throw ApiError.conflict('An account with this email address already exists');

  const oldEmail = user.email;
  user.email = normalized;
  await user.save();

  await logAudit({
    user: user.name,
    action: 'UpdateEmail',
    module: 'Users',
    reference: user.email,
    before: { email: oldEmail },
    after: { email: normalized },
  });

  const accessToken = signToken(user);
  const updatedUser = { id: user._id, name: user.name, email: user.email, role: user.role };

  return ApiResponse.success(res, {
    message: 'Email address updated successfully',
    data: { user: updatedUser, accessToken },
  });
});

const getOwnProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');
  return ApiResponse.success(res, { data: { id: user._id, name: user.name, email: user.email, role: user.role } });
});

module.exports = { list, create, update, changeOwnPassword, updateOwnEmail, getOwnProfile };
