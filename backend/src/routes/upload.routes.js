const router = require('express').Router();
const { upload } = require('../middlewares/upload.middleware');
const { uploadFile } = require('../controllers/upload.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');

router.post('/logo', authenticate, requireRole('Admin'), upload.single('file'), uploadFile);

module.exports = router;
