const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['Admin'];

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, required: true, default: 'Admin' },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date, default: null },
}, { timestamps: true });

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
};

// Never leak passwordHash even if a query forgets to .select('-passwordHash')
userSchema.set('toJSON', {
  transform: (_doc, ret) => { delete ret.passwordHash; return ret; },
});

userSchema.statics.ROLES = ROLES;

module.exports = mongoose.model('User', userSchema);
