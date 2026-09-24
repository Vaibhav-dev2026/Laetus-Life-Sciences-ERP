const router = require('express').Router();
const {
  downloadInvoice,
  downloadPurchase,
  downloadPayment,
  downloadCustomerLedger,
  downloadSupplierLedger,
} = require('../controllers/pdf.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);
router.get('/invoice/:id', downloadInvoice);
router.get('/purchase/:id', downloadPurchase);
router.get('/payment/:id', downloadPayment);
router.get('/customer-ledger', downloadCustomerLedger);
router.get('/supplier-ledger', downloadSupplierLedger);

module.exports = router;
