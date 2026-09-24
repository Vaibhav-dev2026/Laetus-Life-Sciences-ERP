const router = require('express').Router();
const ctrl = require('../controllers/sale.controller');
const pdfCtrl = require('../controllers/pdf.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');

router.use(authenticate);
router.get('/', ctrl.list);
router.get('/:id/pdf', pdfCtrl.downloadInvoice);
router.get('/:id', ctrl.getById);
router.post('/', requireRole('Admin', 'Billing'), ctrl.create);
router.put('/:id', requireRole('Admin', 'Billing'), ctrl.update);
router.patch('/:id/cancel', requireRole('Admin'), ctrl.cancel);

module.exports = router;
