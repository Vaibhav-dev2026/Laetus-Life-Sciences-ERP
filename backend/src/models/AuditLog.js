const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: { type: String, required: true },
  action: {
    type: String,
    enum: ['Create', 'Update', 'Delete', 'Login', 'Cancel', 'Restore', 'Deactivate', 'Reactivate', 'MaintenanceCleanup', 'DatabaseMaintenanceCleanup', 'IsolatedRestoreTest', 'UpdatePassword', 'UpdateEmail'],
    required: true,
  },
  module: { type: String, required: true },
  reference: { type: String, default: '' },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

auditLogSchema.index({ date: -1 });
auditLogSchema.index({ module: 1, date: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
