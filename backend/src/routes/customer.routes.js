const router = require('express').Router();
const ctrl = require('../controllers/customer.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { customerRules } = require('../validators/customer.validator');

router.use(authenticate);
router.get('/', ctrl.list);
router.get('/:id/outstanding', ctrl.getOutstanding);
router.get('/:id', ctrl.getById);
router.post('/', requireRole('Admin', 'Billing'), customerRules, validate, ctrl.create);
router.put('/:id', requireRole('Admin', 'Billing'), customerRules, validate, ctrl.update);
router.patch('/:id/status', requireRole('Admin', 'Billing'), ctrl.setStatus);
router.patch('/:id/deactivate', requireRole('Admin', 'Billing'), ctrl.deactivate);
router.patch('/:id/reactivate', requireRole('Admin', 'Billing'), ctrl.reactivate);
router.delete('/:id', requireRole('Admin'), ctrl.remove);

module.exports = router;
