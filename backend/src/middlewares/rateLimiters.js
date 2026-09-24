const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const isTest = env.nodeEnv === 'test' || process.env.NODE_ENV === 'test';


const isDev = env.nodeEnv === 'development' || process.env.NODE_ENV === 'development';

const loginLimiter = isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: env.loginRateLimitWindowMin * 60 * 1000,
      max: isDev ? 200 : (env.loginRateLimitMax || 50),
      skipSuccessfulRequests: true, // Successful logins never count against failed attempt rate limit
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Too many failed login attempts. Please try again in a few minutes.' },
    });

const apiLimiter = isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 600,
      standardHeaders: true,
      legacyHeaders: false,
    });

module.exports = { loginLimiter, apiLimiter };

