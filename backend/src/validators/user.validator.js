const { body } = require('express-validator');
const { User } = require('../models');

const userCreateRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
  body('role').isIn(User.ROLES).withMessage('Invalid role'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const userUpdateRules = [
  body('name').optional().trim().notEmpty().withMessage('Name is required'),
  body('role').optional().isIn(User.ROLES).withMessage('Invalid role'),
];

module.exports = { userCreateRules, userUpdateRules };
