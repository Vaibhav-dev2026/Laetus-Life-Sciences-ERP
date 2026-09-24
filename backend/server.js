const env = require('./src/config/env');
const connectDB = require('./src/config/db');
const app = require('./src/app');
const { ensureProductionAdmin } = require('./src/services/bootstrapAuth.service');
const { scheduleNightlyBackup } = require('./src/jobs/nightlyBackup.job');
const { scheduleDataRetention } = require('./src/jobs/dataRetention.job');

let server;

async function start() {
  // Do not accept traffic before the DB connection succeeds.
  await connectDB();
  await ensureProductionAdmin();

  // Bind to 0.0.0.0 explicitly so the server accepts traffic on all network
  // interfaces, which is required on cloud hosts such as Render.
  server = app.listen(env.port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Laetus Life Sciences ERP API running in ${env.nodeEnv} mode on port ${env.port}`);
  });

  if (env.nodeEnv === 'production') {
    try { scheduleNightlyBackup(); } catch (err) { console.warn('[backup] Nightly backup not scheduled:', err.message); }
    try { scheduleDataRetention(); } catch (err) { console.warn('[retention] Data retention job not scheduled:', err.message); }
  }
}

function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`[server] Received ${signal}, shutting down gracefully…`);
  if (server) {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => { console.error('[fatal] Unhandled rejection:', reason); });

start().catch((err) => {
  console.error('[fatal] Failed to start server:', err);
  process.exit(1);
});
