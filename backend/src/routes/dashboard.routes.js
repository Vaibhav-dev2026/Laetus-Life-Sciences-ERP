const router = require('express').Router();
const ctrl = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);
router.get('/summary', ctrl.summary);
router.get('/sales-trend', ctrl.salesTrend);
router.get('/purchase-vs-sales', ctrl.purchaseVsSales);
router.get('/top-products', ctrl.topProducts);
router.get('/outstanding-ageing', ctrl.outstandingAgeing);
router.get('/gst-summary', ctrl.gstSummary);

module.exports = router;
