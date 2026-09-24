const router = require('express').Router();
const ctrl = require('../controllers/company.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');

router.get('/', authenticate, ctrl.get);
router.put('/', authenticate, requireRole('Admin'), ctrl.update);

module.exports = router;
