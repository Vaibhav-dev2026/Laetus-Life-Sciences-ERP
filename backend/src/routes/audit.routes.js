const router = require('express').Router();
const { list } = require('../controllers/audit.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');

router.use(authenticate, requireRole('Admin'));
router.get('/', list);

module.exports = router;
