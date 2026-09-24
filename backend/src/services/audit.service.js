// Audit logging system has been disabled for single-user low-resource operation.
// logAudit is a safe no-op that performs zero DB operations.
async function logAudit() {
  return null;
}

module.exports = { logAudit };
