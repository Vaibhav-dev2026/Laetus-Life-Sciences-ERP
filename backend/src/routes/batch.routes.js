const router = require('express').Router();
const ctrl = require('../controllers/batch.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');

router.use(authenticate);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/adjust', requireRole('Admin', 'Inventory'), ctrl.adjust);
router.delete('/:id', requireRole('Admin'), ctrl.remove);

module.exports = router;
