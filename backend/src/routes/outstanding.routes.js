const router = require('express').Router();
const { outstandingReport } = require('../controllers/outstanding.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);
router.get('/', outstandingReport);

module.exports = router;
