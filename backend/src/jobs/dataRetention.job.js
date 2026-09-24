const fs = require('fs');
const path = require('path');
const { CronJob } = require('cron');
const dayjs = require('dayjs');
const env = require('../config/env');
const { Notification } = require('../models');

const READ_NOTIFICATION_RETENTION_DAYS = 90;
const UNREAD_NOTIFICATION_RETENTION_DAYS = 180;

function toCsv(rows, columns) {
  const headerLine = columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
  const dataLines = rows.map((row) => columns.map((c) => `"${String(row[c] ?? '').replace(/"/g, '""')}"`).join(','));
  return '\ufeff' + [headerLine, ...dataLines].join('\r\n');
}

function archiveDir() {
  const dir = path.join(process.cwd(), env.backupDir || 'backups', 'archives');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function pruneAuditLogs() {
  return { archived: 0 };
}

async function pruneNotifications() {
  const readCutoff = dayjs().subtract(READ_NOTIFICATION_RETENTION_DAYS, 'day').toDate();
  const unreadCutoff = dayjs().subtract(UNREAD_NOTIFICATION_RETENTION_DAYS, 'day').toDate();
  const filter = { $or: [{ read: true, date: { $lt: readCutoff } }, { read: false, date: { $lt: unreadCutoff } }] };

  const docs = await Notification.find(filter).lean();
  if (docs.length === 0) return { archived: 0 };

  const csv = toCsv(docs, ['id', 'type', 'message', 'read', 'date']);
  const file = path.join(archiveDir(), `notifications-archive-${dayjs().format('YYYY-MM-DD')}.csv`);
  fs.writeFileSync(file, csv);

  await Notification.deleteMany(filter);
  return { archived: docs.length, file };
}

// Monthly, on the 1st at 3:00 AM server time — deliberately offset from the
// 2:00 AM nightly backup job so the two never compete for I/O.
function scheduleDataRetention() {
  const job = new CronJob('0 3 1 * *', async () => {
    try {
      const auditResult = await pruneAuditLogs();
      const notifResult = await pruneNotifications();
      // eslint-disable-next-line no-console
      console.log(`[retention] Archived ${auditResult.archived} audit log(s), ${notifResult.archived} notification(s)`);
    } catch (err) {
      console.error('[retention] Monthly data retention job failed:', err.message);
    }
  });
  job.start();
  return job;
}

module.exports = { scheduleDataRetention, pruneAuditLogs, pruneNotifications };
