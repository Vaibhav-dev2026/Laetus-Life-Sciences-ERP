const { body } = require('express-validator');

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

const customerRules = [
  body('partyName').trim().notEmpty().withMessage('Party name is required'),
  body('mobile').matches(MOBILE_RE).withMessage('Enter a valid 10-digit mobile number'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Enter a valid email address'),
  body('gstin').optional({ checkFalsy: true }).matches(GSTIN_RE).withMessage('Enter a valid GSTIN'),
  body('creditLimit').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Credit limit must be zero or greater'),
  body('openingOutstanding').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Opening outstanding must be zero or greater'),
];

module.exports = { customerRules, GSTIN_RE, MOBILE_RE };
