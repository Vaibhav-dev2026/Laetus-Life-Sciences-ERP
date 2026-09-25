const router = require('express').Router();
const ctrl = require('../controllers/maintenance.controller');
const { demoCleanup } = require('../controllers/demoCleanup.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');

router.use(authenticate, requireRole('Admin'));

router.get('/diagnostics', ctrl.getDiagnostics);
router.get('/candidates', ctrl.scanCandidates);
router.post('/cleanup', ctrl.runCleanup);

// TEMPORARY: Demo data cleanup — remove after successful execution
router.post('/demo-cleanup', demoCleanup);

module.exports = router;

