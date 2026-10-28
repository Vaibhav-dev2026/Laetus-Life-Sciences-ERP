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
 * Resolves (marks read) unread notifications of specific types matching a pattern.
 */
async function resolveNotifications({ types, pattern, session }) {
  if (!types || !pattern) return;
  const opts = session ? { session } : {};
  await Notification.updateMany(
    {
      type: { $in: Array.isArray(types) ? types : [types] },
      message: { $regex: pattern, $options: 'i' },
      read: false,
    },
    { $set: { read: true } },
    opts
  );
}

/**
 * Checks stock status for a single product and creates or resolves notifications accordingly.
 */
async function checkProductStockAlerts(productId, explicitStock, session) {
  try {
    const opts = session ? { session } : {};
    const prod = await Product.findOne({ id: productId }, null, opts);
    if (!prod || prod.status === 'Inactive') return;

    const threshold = prod.reorderLevel > 0 ? prod.reorderLevel : (prod.minStock > 0 ? prod.minStock : 10);
    const stock = explicitStock !== undefined ? Number(explicitStock) : (Number(prod.currentStock) || 0);

    if (stock <= 0) {
      // Out of Stock
      await resolveNotifications({ types: ['Low Stock'], pattern: prod.name, session });
      await pushNotification({
        type: 'Out of Stock',
        message: `Out of Stock Alert: Product "${prod.name}" (${prod.sku}) has zero stock remaining.`,
        session,
      });
    } else if (stock <= threshold) {
      // Low Stock
      await resolveNotifications({ types: ['Out of Stock'], pattern: prod.name, session });
      await pushNotification({
        type: 'Low Stock',
        message: `Low Stock Alert: Product "${prod.name}" (${prod.sku}) current stock is ${stock} (Threshold: ${threshold}).`,
        session,
      });
    } else {
      // Stock is healthy — auto-resolve any previous low or out of stock warnings
      await resolveNotifications({ types: ['Low Stock', 'Out of Stock'], pattern: prod.name, session });
    }
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Scans all products and active product batches for Out of Stock, Low Stock,
 * Near Expiry, and Expired status, creating deduplicated system notifications.
 */
async function syncSystemNotifications() {
  try {
    const today = dayjs().startOf('day');
    const sixtyDaysLater = today.add(60, 'day').endOf('day');

    // 1. Product-level Low Stock & Out of Stock scan
    const activeProducts = await Product.find({ status: 'Active' }).lean();
    for (const prod of activeProducts) {
      const threshold = prod.reorderLevel > 0 ? prod.reorderLevel : (prod.minStock > 0 ? prod.minStock : 10);
      const stock = Number(prod.currentStock) || 0;

      if (stock <= 0) {
        await resolveNotifications({ types: ['Low Stock'], pattern: prod.name });
        await pushNotification({
          type: 'Out of Stock',
          message: `Out of Stock Alert: Product "${prod.name}" (${prod.sku}) has zero stock remaining.`,
        });
      } else if (stock <= threshold) {
        await resolveNotifications({ types: ['Out of Stock'], pattern: prod.name });
        await pushNotification({
          type: 'Low Stock',
          message: `Low Stock Alert: Product "${prod.name}" (${prod.sku}) current stock is ${stock} (Threshold: ${threshold}).`,
        });
      } else {
        await resolveNotifications({ types: ['Low Stock', 'Out of Stock'], pattern: prod.name });
      }
    }

    // 2. Batch-level Expiry & Near Expiry scan
    const activeBatches = await ProductBatch.find({ currentQty: { $gt: 0 } }).lean();
    if (!activeBatches.length) return;

    const prodMap = new Map(activeProducts.map((p) => [p.id, p]));

    for (const b of activeBatches) {
      if (!b.expDate) continue;
      const prod = prodMap.get(b.productId) || {};
      const prodName = prod.name || b.productId;
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
  } catch (err) {
    console.error('[Notification Sync Error]:', err.message);
  }
}

module.exports = {
  pushNotification,
  resolveNotifications,
  checkProductStockAlerts,
  syncSystemNotifications,
};
