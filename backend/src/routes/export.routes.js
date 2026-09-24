const router = require('express').Router();
const { exportReport } = require('../controllers/export.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);
router.get('/:report/:format', exportReport);

module.exports = router;
