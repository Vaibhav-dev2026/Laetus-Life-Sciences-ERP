const router = require('express').Router();
const ctrl = require('../controllers/report.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);
router.get('/sales', ctrl.salesReport);
router.get('/purchases', ctrl.purchaseReport);
router.get('/stock', ctrl.stockReport);
router.get('/financial', ctrl.financialReport);

module.exports = router;
