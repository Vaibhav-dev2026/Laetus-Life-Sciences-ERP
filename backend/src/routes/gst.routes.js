const router = require('express').Router();
const ctrl = require('../controllers/gst.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');

router.use(authenticate);
router.get('/gstr1', ctrl.gstr1);
router.get('/gstr2b', ctrl.gstr2bReconciliation);
router.get('/gstr2b-reconciliation', ctrl.gstr2bReconciliation);
router.get('/itc-reconciliation', ctrl.gstr2bReconciliation);
router.post('/gstr2b/import', requireRole('Admin', 'Accounts'), ctrl.importGstr2b);
router.get('/gstr3b', ctrl.gstr3bSummary);
router.get('/cross-reconciliation', ctrl.crossReconciliation);

module.exports = router;
