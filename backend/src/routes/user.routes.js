const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permission.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { userCreateRules, userUpdateRules } = require('../validators/user.validator');

router.use(authenticate, requireRole('Admin'));
router.get('/me', ctrl.getOwnProfile);
router.patch('/me/password', ctrl.changeOwnPassword);
router.patch('/me/email', ctrl.updateOwnEmail);
router.get('/', ctrl.list);
router.post('/', userCreateRules, validate, ctrl.create);
router.put('/:id', userUpdateRules, validate, ctrl.update);

module.exports = router;
