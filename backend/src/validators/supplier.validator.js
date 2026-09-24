const { body } = require('express-validator');
const { GSTIN_RE, MOBILE_RE } = require('./customer.validator');

const supplierRules = [
  body('company').trim().notEmpty().withMessage('Company name is required'),
  body('mobile').matches(MOBILE_RE).withMessage('Enter a valid 10-digit mobile number'),
  body('gstin').optional({ checkFalsy: true }).matches(GSTIN_RE).withMessage('Enter a valid GSTIN'),
  body('openingPayable').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Opening payable must be zero or greater'),
];

module.exports = { supplierRules };
