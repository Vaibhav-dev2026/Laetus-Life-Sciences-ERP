const router = require('express').Router();
const ctrl = require('../controllers/return.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');

router.use(authenticate);
router.get('/sales', ctrl.listSalesReturns);
router.post('/sales', requireRole('Admin', 'Billing'), ctrl.createSalesReturn);
router.get('/purchases', ctrl.listPurchaseReturns);
router.post('/purchases', requireRole('Admin', 'Purchase'), ctrl.createPurchaseReturn);

module.exports = router;
