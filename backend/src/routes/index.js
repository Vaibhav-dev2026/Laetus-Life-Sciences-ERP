const router = require('express').Router();

router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/company', require('./company.routes'));
router.use('/users', require('./user.routes'));
router.use('/customers', require('./customer.routes'));
router.use('/suppliers', require('./supplier.routes'));
router.use('/products', require('./product.routes'));
router.use('/batches', require('./batch.routes'));
router.use('/purchases', require('./purchase.routes'));
router.use('/sales', require('./sale.routes'));
router.use('/payments', require('./payment.routes'));
router.use('/returns', require('./return.routes'));
router.use('/expenses', require('./expense.routes'));
router.use('/outstanding', require('./outstanding.routes'));
router.use('/ledger', require('./ledger.routes'));
router.use('/reports', require('./report.routes'));
router.use('/gst', require('./gst.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/audit-logs', require('./audit.routes'));
router.use('/backup', require('./backup.routes'));
router.use('/uploads', require('./upload.routes'));
router.use('/exports', require('./export.routes'));
router.use('/pdf', require('./pdf.routes'));
router.use('/maintenance', require('./maintenance.routes'));

module.exports = router;
