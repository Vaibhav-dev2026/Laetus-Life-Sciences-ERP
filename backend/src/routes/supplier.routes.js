const router = require('express').Router();
const ctrl = require('../controllers/supplier.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { supplierRules } = require('../validators/supplier.validator');

router.use(authenticate);
router.get('/', ctrl.list);
router.get('/:id/outstanding', ctrl.getOutstanding);
router.get('/:id', ctrl.getById);
router.post('/', requireRole('Admin', 'Purchase'), supplierRules, validate, ctrl.create);
router.put('/:id', requireRole('Admin', 'Purchase'), supplierRules, validate, ctrl.update);
router.patch('/:id/status', requireRole('Admin', 'Purchase'), ctrl.setStatus);
router.patch('/:id/deactivate', requireRole('Admin', 'Purchase'), ctrl.deactivate);
router.patch('/:id/reactivate', requireRole('Admin', 'Purchase'), ctrl.reactivate);
router.delete('/:id', requireRole('Admin'), ctrl.remove);

module.exports = router;
