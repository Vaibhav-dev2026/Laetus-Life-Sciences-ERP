const router = require('express').Router();
const ctrl = require('../controllers/purchase.controller');
const pdfCtrl = require('../controllers/pdf.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');

router.use(authenticate);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.get('/:id/pdf', pdfCtrl.downloadPurchase);
router.post('/', requireRole('Admin', 'Purchase'), ctrl.create);
router.put('/:id', requireRole('Admin', 'Purchase'), ctrl.update);
router.patch('/:id/cancel', requireRole('Admin'), ctrl.cancel);

module.exports = router;
