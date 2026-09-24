const router = require('express').Router();
const { customerLedger, supplierLedger } = require('../controllers/ledger.controller');
const pdfCtrl = require('../controllers/pdf.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);
router.get('/customer', customerLedger);
router.get('/customer/pdf', pdfCtrl.downloadCustomerLedger);
router.get('/supplier', supplierLedger);
router.get('/supplier/pdf', pdfCtrl.downloadSupplierLedger);

module.exports = router;
