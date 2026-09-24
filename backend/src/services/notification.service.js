const dayjs = require('dayjs');
const { Notification, ProductBatch, Product } = require('../models');
const { generateId } = require('../utils/idGenerator');

/**
 * Pushes a notification while preventing spam / duplicate unread notifications.
 */
async function pushNotification({ type, message, session }) {
  if (!type || !message) return null;

  // Check if an unread notification with the exact same message already exists
  const existing = await Notification.findOne({ type, message, read: false });
  if (existing) {
    return existing; // Skip duplicate notification creation
  }

  const id = await generateId('NTF', 'notification', 6, session, Notification);
  const opts = session ? { session } : {};
  const [notif] = await Notification.create([{ id, type, message, read: false, date: new Date() }], opts);
  return notif;
}

/**
 * Scans active product batches for Low Stock, Near Expiry, and Expired status,
 * creating deduplicated system notifications when thresholds are breached.
 */
async function syncSystemNotifications() {
  try {
    const today = dayjs().startOf('day');
    const sixtyDaysLater = today.add(60, 'day').endOf('day');

    const batches = await ProductBatch.find({ currentQty: { $gte: 0 } }).lean();
    if (!batches.length) return;

    const productIds = batches.map(b => b.productId);
    const products = await Product.find({ id: { $in: productIds } }).lean();
    const prodMap = new Map(products.map(p => [p.id, p]));

    for (const b of batches) {
      const prod = prodMap.get(b.productId) || {};
      const prodName = prod.name || b.productId;
      const minStock = prod.minStock || 10;

      // 1. Low Stock Check
      if (b.currentQty <= minStock && b.currentQty > 0) {
        await pushNotification({
          type: 'Low Stock',
          message: `Low Stock Alert: Product "${prodName}" (Batch ${b.batchNo}) current stock is ${b.currentQty} (Min threshold: ${minStock}).`,
        });
      }

      // 2. Expiry & Near Expiry Check
      if (b.expDate) {
        const exp = dayjs(b.expDate);
        if (exp.isBefore(today)) {
          await pushNotification({
            type: 'Expired',
            message: `Expired Batch Alert: Batch ${b.batchNo} of "${prodName}" expired on ${exp.format('DD-MM-YYYY')}.`,
          });
        } else if (exp.isBefore(sixtyDaysLater) || exp.isSame(sixtyDaysLater)) {
          const daysLeft = exp.diff(today, 'day');
          await pushNotification({
            type: 'Near Expiry',
            message: `Near Expiry Alert: Batch ${b.batchNo} of "${prodName}" expires in ${daysLeft} days on ${exp.format('DD-MM-YYYY')}.`,
          });
        }
      }
    }
  } catch (err) {
    console.error('[Notification Sync Error]:', err.message);
  }
}

module.exports = {
  pushNotification,
  syncSystemNotifications,
};
