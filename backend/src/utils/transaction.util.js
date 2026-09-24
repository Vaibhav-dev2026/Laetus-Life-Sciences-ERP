const mongoose = require('mongoose');

/**
 * Executes a callback within a MongoDB session/transaction if supported by the cluster,
 * or safely executes without a session if running on a standalone local MongoDB instance.
 */
async function withTransaction(workFn) {
  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await workFn(session);
      });
    } catch (err) {
      if (err.message && (err.message.includes('Transaction numbers are only allowed') || err.message.includes('replica set'))) {
        // Fallback for standalone MongoDB instances without replica set
        result = await workFn(null);
      } else {
        throw err;
      }
    }
    return result;
  } finally {
    session.endSession();
  }
}

module.exports = { withTransaction };
