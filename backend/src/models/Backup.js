const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  date: { type: Date, default: Date.now },
  size: { type: String, default: '' },
  sizeBytes: { type: Number, default: 0 },
  type: { type: String, enum: ['Automatic', 'Manual'], default: 'Manual' },
  checksum: { type: String, default: '' },
  collectionCount: { type: Number, default: 0 },
  docCount: { type: Number, default: 0 },
  status: { type: String, enum: ['VERIFIED', 'PENDING', 'FAILED', 'Completed'], default: 'VERIFIED' },
  restoreTestStatus: { type: String, enum: ['NOT_TESTED', 'PASSED', 'FAILED'], default: 'NOT_TESTED' },
  lastTestedAt: { type: Date, default: null },
  restoredAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Backup', backupSchema);
