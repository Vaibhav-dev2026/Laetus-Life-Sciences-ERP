const { CronJob } = require('cron');
const { runBackup } = require('../services/backup.service');

// Nightly automatic backup at 2:00 AM server time, per the implementation plan.
function scheduleNightlyBackup() {
  const job = new CronJob('0 2 * * *', async () => {
    try {
      await runBackup('Automatic');
      // eslint-disable-next-line no-console
      console.log('[backup] Nightly backup completed');
    } catch (err) {
      console.error('[backup] Nightly backup failed:', err.message);
    }
  });
  job.start();
  return job;
}

module.exports = { scheduleNightlyBackup };
