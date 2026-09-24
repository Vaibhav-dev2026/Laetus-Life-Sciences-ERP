const router = require('express').Router();
const ctrl = require('../controllers/product.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { productRules } = require('../validators/product.validator');

router.use(authenticate);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', requireRole('Admin', 'Inventory'), productRules, validate, ctrl.create);
router.put('/:id', requireRole('Admin', 'Inventory'), productRules, validate, ctrl.update);
router.patch('/:id/status', requireRole('Admin', 'Inventory'), ctrl.setStatus);
router.patch('/:id/deactivate', requireRole('Admin', 'Inventory'), ctrl.deactivate);
router.patch('/:id/reactivate', requireRole('Admin', 'Inventory'), ctrl.reactivate);
router.delete('/:id', requireRole('Admin'), ctrl.remove);

module.exports = router;
