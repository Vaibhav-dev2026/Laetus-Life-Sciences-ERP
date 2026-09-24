const { body } = require('express-validator');

const loginRules = [
  body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
  body('password').isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
];

module.exports = { loginRules };
