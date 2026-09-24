const router = require('express').Router();
const ctrl = require('../controllers/payment.controller');
const pdfCtrl = require('../controllers/pdf.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');

router.use(authenticate);
router.get('/', ctrl.list);
router.get('/:id/pdf', pdfCtrl.downloadPayment);
router.post('/', requireRole('Admin', 'Accounts', 'Billing'), ctrl.create);

module.exports = router;
