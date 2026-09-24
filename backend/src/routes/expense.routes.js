const router = require('express').Router();
const ctrl = require('../controllers/expense.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');

router.use(authenticate);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', requireRole('Admin', 'Accounts'), ctrl.create);
router.put('/:id', requireRole('Admin', 'Accounts'), ctrl.update);

module.exports = router;
