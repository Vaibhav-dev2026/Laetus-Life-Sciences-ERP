const router = require('express').Router();
const { login, me, logout } = require('../controllers/auth.controller');
const { loginRules } = require('../validators/auth.validator');
const { validate } = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { loginLimiter } = require('../middlewares/rateLimiters');

router.post('/login', loginLimiter, loginRules, validate, login);
router.get('/me', authenticate, me);
router.post('/logout', authenticate, logout);

module.exports = router;
