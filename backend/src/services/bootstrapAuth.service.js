const { User } = require('../models');
const env = require('../config/env');

const PRODUCTION_ADMIN_EMAIL = 'laetuslifesciences@gmail.com';

/**
 * Idempotently ensures the production admin user account exists.
 * If the user already exists, it is NOT overwritten or reset on server startup.
 * Preserves existing MongoDB _id and business data relationships.
 */
async function ensureProductionAdmin() {
  try {
    const targetEmail = (env.seedAdminEmail || PRODUCTION_ADMIN_EMAIL).toLowerCase().trim();
    // 1. Check if production user already exists
    let prodUser = await User.findOne({ email: targetEmail });
    if (prodUser) {
      // Production admin already configured. Do not overwrite credentials.
      return prodUser;
    }

    if (!env.seedAdminPassword) {
      console.warn('[auth-bootstrap] SEED_ADMIN_PASSWORD environment variable is missing. Skipping default admin account creation.');
      return null;
    }

    const targetPassword = env.seedAdminPassword;
    const oldSeededUser = await User.findOne({ email: 'admin@example.com' });
    if (oldSeededUser) {
      const passwordHash = await User.hashPassword(targetPassword);
      oldSeededUser.email = targetEmail;
      oldSeededUser.name = 'L LAETUS LIFE SCIENCES';
      oldSeededUser.passwordHash = passwordHash;
      oldSeededUser.isActive = true;
      await oldSeededUser.save();
      console.log(`[auth-bootstrap] Migrated default admin user to production email: ${targetEmail}`);
      return oldSeededUser;
    }

    // 3. If no admin exists at all, create fresh production admin
    const passwordHash = await User.hashPassword(targetPassword);
    prodUser = await User.create({
      name: 'L LAETUS LIFE SCIENCES',
      email: targetEmail,
      role: 'Admin',
      passwordHash,
      isActive: true,
    });
    console.log(`[auth-bootstrap] Created fresh production admin user: ${targetEmail}`);
    return prodUser;
  } catch (err) {
    console.error('[auth-bootstrap] Error ensuring production admin account:', err.message);
  }
}

module.exports = {
  ensureProductionAdmin,
  PRODUCTION_ADMIN_EMAIL,
};
