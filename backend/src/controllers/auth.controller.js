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

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.unauthorized('This account has been deactivated');

  const valid = await user.comparePassword(password);
  if (!valid) throw ApiError.unauthorized('Invalid email or password');

  user.lastLogin = new Date();
  await user.save();

  const accessToken = signToken(user);
  await logAudit({ user: user.name, action: 'Login', module: 'Auth', reference: user.email });

  return ApiResponse.success(res, {
    message: 'Signed in successfully',
    data: { accessToken, user: { name: user.name, email: user.email, role: user.role } },
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');
  return ApiResponse.success(res, { data: { name: user.name, email: user.email, role: user.role } });
});

const logout = asyncHandler(async (req, res) => {
  // Stateless JWT — logout is a client-side token discard. Endpoint exists
  // for API contract completeness / future token-blacklist support.
  return ApiResponse.success(res, { message: 'Logged out' });
});

module.exports = { login, me, logout };
