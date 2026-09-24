const router = require('express').Router();
const ctrl = require('../controllers/backup.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');

router.use(authenticate, requireRole('Admin'));

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.post('/:id/restore', ctrl.restore);
router.post('/:id/test-restore', ctrl.testRestore);
router.delete('/:id', ctrl.remove);

module.exports = router;
