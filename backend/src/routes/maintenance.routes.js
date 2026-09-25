const router = require('express').Router();
const ctrl = require('../controllers/maintenance.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');

router.use(authenticate, requireRole('Admin'));

router.get('/diagnostics', ctrl.getDiagnostics);
router.get('/candidates', ctrl.scanCandidates);
router.post('/cleanup', ctrl.runCleanup);

module.exports = router;
