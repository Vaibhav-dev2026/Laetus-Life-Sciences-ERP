const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { User } = require('../models');

const mongoose = require('mongoose');

// Verifies the JWT, loads the current user fresh from the DB (so a
// deactivated user is rejected immediately, not just when the token expires),
// and attaches it to req.user for downstream permission checks.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  let user = null;
  if (mongoose.Types.ObjectId.isValid(payload.sub)) {
    user = await User.findById(payload.sub);
  }
  if (!user) {
    user = await User.findOne({ id: payload.sub });
  }

  if (!user || !user.isActive) throw ApiError.unauthorized('Account is inactive or no longer exists');

  req.user = { id: user._id.toString(), customId: user.id, name: user.name, email: user.email, role: user.role };
  next();
});

module.exports = { authenticate };
