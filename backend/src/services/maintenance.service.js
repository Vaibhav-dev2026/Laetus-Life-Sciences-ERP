const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const {
  Product, ProductBatch, Customer, Supplier, Sale, Purchase,
  SalesReturn, PurchaseReturn, Expense, Payment, StockMovement,
  CustomerLedger, SupplierLedger, Company, User, Notification,
} = require('../models');
const { logAudit } = require('./audit.service');

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const EXPORTS_DIR = path.join(process.cwd(), 'exports');

/**
 * Collects system diagnostics on database usage, collection sizes, and temp files.
 */
async function getDiagnostics() {
  const db = mongoose.connection.db;
  if (!db) {
    return { status: 'Disconnected' };
  }

  const collections = await db.listCollections().toArray();
  const stats = [];
  let totalDocCount = 0;

  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    stats.push({ name: col.name, count });
    totalDocCount += count;
  }

  stats.sort((a, b) => b.count - a.count);

  // Check upload files
  let uploadFilesCount = 0;
  let uploadFilesBytes = 0;
  if (fs.existsSync(UPLOADS_DIR)) {
    const files = fs.readdirSync(UPLOADS_DIR);
    uploadFilesCount = files.length;
    for (const f of files) {
      try {
        const s = fs.statSync(path.join(UPLOADS_DIR, f));
        uploadFilesBytes += s.size;
      } catch (e) { /* ignore */ }
    }
  }

  // Check temporary export files
  let exportFilesCount = 0;
  let exportFilesBytes = 0;
  if (fs.existsSync(EXPORTS_DIR)) {
    const files = fs.readdirSync(EXPORTS_DIR);
    exportFilesCount = files.length;
    for (const f of files) {
      try {
        const s = fs.statSync(path.join(EXPORTS_DIR, f));
        exportFilesBytes += s.size;
      } catch (e) { /* ignore */ }
    }
  }

  // Obsolete notifications (> 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const obsoleteNotificationsCount = await Notification.countDocuments({ createdAt: { $lt: ninetyDaysAgo } });

  // QA test data count (records with testRunId or starting with QA-)
  const qaSales = await Sale.countDocuments({ $or: [{ testRunId: { $exists: true } }, { invoiceNo: /^QA-/i }] });
  const qaPurchases = await Purchase.countDocuments({ $or: [{ testRunId: { $exists: true } }, { invoiceNo: /^QA-/i }] });
  const qaCustomers = await Customer.countDocuments({ $or: [{ testRunId: { $exists: true } }, { code: /^QA-/i }] });
  const qaSuppliers = await Supplier.countDocuments({ $or: [{ testRunId: { $exists: true } }, { code: /^QA-/i }] });
  const qaProducts = await Product.countDocuments({ $or: [{ testRunId: { $exists: true } }, { sku: /^QA-/i }] });
  const qaExpenses = await Expense.countDocuments({ $or: [{ testRunId: { $exists: true } }, { voucherNo: /^QA-/i }] });
  const totalQaCount = qaSales + qaPurchases + qaCustomers + qaSuppliers + qaProducts + qaExpenses;

  // 1-Year Retention review candidates (> 365 days old)
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const retentionSales = await Sale.countDocuments({ createdAt: { $lt: oneYearAgo } });
  const retentionPurchases = await Purchase.countDocuments({ createdAt: { $lt: oneYearAgo } });
  const retentionExpenses = await Expense.countDocuments({ createdAt: { $lt: oneYearAgo } });
  const retentionCount = retentionSales + retentionPurchases + retentionExpenses;

  return {
    status: 'Connected',
    databaseName: db.databaseName,
    totalDocCount,
    collectionCount: stats.length,
    collections: stats.slice(0, 10), // Top 10 largest
    allCollections: stats,
    uploads: { count: uploadFilesCount, totalBytes: uploadFilesBytes },
    exports: { count: exportFilesCount, totalBytes: exportFilesBytes },
    obsoleteNotificationsCount,
    qaDataCount: totalQaCount,
    retentionReviewCandidates: retentionCount,
  };
}

/**
 * Scans uploads folder and finds orphan files not referenced in DB models.
 */
async function scanOrphanFiles() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    return { totalFiles: 0, orphanFiles: [], orphanBytes: 0 };
  }
  const files = fs.readdirSync(UPLOADS_DIR);
  if (files.length === 0) {
    return { totalFiles: 0, orphanFiles: [], orphanBytes: 0 };
  }

  const referencedSet = new Set();
  const [products, companies, users] = await Promise.all([
    Product.find({ image: { $ne: '' } }, { image: 1 }).lean(),
    Company.find({ logo: { $ne: '' } }, { logo: 1 }).lean(),
    User.find({ avatar: { $ne: '' } }, { avatar: 1 }).lean(),
  ]);

  products.forEach(p => { if (p.image) referencedSet.add(path.basename(p.image)); });
  companies.forEach(c => { if (c.logo) referencedSet.add(path.basename(c.logo)); });
  users.forEach(u => { if (u.avatar) referencedSet.add(path.basename(u.avatar)); });

  const orphanFiles = [];
  let orphanBytes = 0;
  for (const filename of files) {
    if (!referencedSet.has(filename)) {
      const fullPath = path.join(UPLOADS_DIR, filename);
      try {
        const s = fs.statSync(fullPath);
        orphanFiles.push({ filename, path: fullPath, size: s.size, createdAt: s.birthtime });
        orphanBytes += s.size;
      } catch (e) { /* skip */ }
    }
  }
  return { totalFiles: files.length, orphanCount: orphanFiles.length, orphanFiles, orphanBytes };
}

/**
 * Scans candidate items for cleanup preview (SCAN -> PREVIEW -> CONFIRM -> EXECUTE).
 */
async function scanCandidates({ retentionMonths = 12 } = {}) {
  const orphans = await scanOrphanFiles();

  // Expired notifications (> 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const obsoleteNotifications = await Notification.countDocuments({ createdAt: { $lt: ninetyDaysAgo } });

  // Temporary export files
  let tempExportsCount = 0;
  let tempExportsBytes = 0;
  if (fs.existsSync(EXPORTS_DIR)) {
    const files = fs.readdirSync(EXPORTS_DIR);
    tempExportsCount = files.length;
    for (const f of files) {
      try {
        tempExportsBytes += fs.statSync(path.join(EXPORTS_DIR, f)).size;
      } catch (e) { /* ignore */ }
    }
  }

  // QA test runs
  const qaQuery = { $or: [{ testRunId: { $exists: true } }, { invoiceNo: /^QA-/i }, { code: /^QA-/i }, { sku: /^QA-/i }] };
  const [qaSales, qaPurchases, qaCustomers, qaSuppliers, qaProducts, qaExpenses] = await Promise.all([
    Sale.find(qaQuery).select('_id invoiceNo testRunId').lean(),
    Purchase.find(qaQuery).select('_id invoiceNo testRunId').lean(),
    Customer.find(qaQuery).select('_id code testRunId').lean(),
    Supplier.find(qaQuery).select('_id code testRunId').lean(),
    Product.find(qaQuery).select('_id sku testRunId').lean(),
    Expense.find(qaQuery).select('_id voucherNo testRunId').lean(),
  ]);

  const qaTotal = qaSales.length + qaPurchases.length + qaCustomers.length + qaSuppliers.length + qaProducts.length + qaExpenses.length;

  // Retention candidates (> retentionMonths old)
  const cutoffDate = new Date(Date.now() - retentionMonths * 30 * 24 * 60 * 60 * 1000);
  const [retentionSalesCount, retentionPurchasesCount, retentionExpensesCount] = await Promise.all([
    Sale.countDocuments({ createdAt: { $lt: cutoffDate } }),
    Purchase.countDocuments({ createdAt: { $lt: cutoffDate } }),
    Expense.countDocuments({ createdAt: { $lt: cutoffDate } }),
  ]);

  return {
    temporary: {
      orphanFilesCount: orphans.orphanCount,
      orphanBytes: orphans.orphanBytes,
      tempExportsCount,
      tempExportsBytes,
      obsoleteNotificationsCount: obsoleteNotifications,
    },
    qaData: {
      totalQaRecords: qaTotal,
      salesCount: qaSales.length,
      purchasesCount: qaPurchases.length,
      customersCount: qaCustomers.length,
      suppliersCount: qaSuppliers.length,
      productsCount: qaProducts.length,
      expensesCount: qaExpenses.length,
    },
    retention: {
      retentionMonths,
      cutoffDate,
      candidatesTotal: retentionSalesCount + retentionPurchasesCount + retentionExpensesCount,
      salesCount: retentionSalesCount,
      purchasesCount: retentionPurchasesCount,
      expensesCount: retentionExpensesCount,
    },
  };
}

/**
 * Safely executes targeted, dependency-aware cleanup of temporary & QA data.
 */
async function runCleanup({
  cleanOrphans = false,
  cleanNotifications = false,
  cleanTempExports = false,
  cleanQaData = false,
  cleanQaTestRunId = null,
  userName = 'Admin',
}) {
  const results = {
    scanned: 0,
    removed: 0,
    skipped: 0,
    bytesFreed: 0,
    details: {},
  };

  // 1. Clean Orphan Upload Files
  if (cleanOrphans) {
    const scan = await scanOrphanFiles();
    results.scanned += scan.orphanCount;
    for (const orphan of scan.orphanFiles) {
      try {
        if (fs.existsSync(orphan.path)) {
          fs.unlinkSync(orphan.path);
          results.removed++;
          results.bytesFreed += orphan.size;
        }
      } catch (e) {
        results.skipped++;
      }
    }
    results.details.orphansRemoved = results.removed;
  }

  // 2. Clean Obsolete Notifications
  if (cleanNotifications) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const res = await Notification.deleteMany({ createdAt: { $lt: ninetyDaysAgo } });
    results.removed += res.deletedCount || 0;
    results.details.notificationsPurged = res.deletedCount || 0;
  }

  // 3. Clean Temp Export Files
  if (cleanTempExports && fs.existsSync(EXPORTS_DIR)) {
    const files = fs.readdirSync(EXPORTS_DIR);
    for (const f of files) {
      const fullPath = path.join(EXPORTS_DIR, f);
      try {
        const s = fs.statSync(fullPath);
        fs.unlinkSync(fullPath);
        results.removed++;
        results.bytesFreed += s.size;
      } catch (e) {
        results.skipped++;
      }
    }
  }

  // 4. Targeted Dependency-Aware QA Data Cleanup
  if (cleanQaData || cleanQaTestRunId) {
    let qaFilter = {};
    if (cleanQaTestRunId) {
      qaFilter = { testRunId: cleanQaTestRunId };
    } else {
      qaFilter = { $or: [{ testRunId: { $exists: true } }, { invoiceNo: /^QA-/i }, { code: /^QA-/i }, { sku: /^QA-/i }, { voucherNo: /^QA-/i }] };
    }

    // Find QA Sales and delete dependencies (StockMovement, CustomerLedger, Payments)
    const qaSales = await Sale.find(qaFilter).select('_id id invoiceNo').lean();
    if (qaSales.length > 0) {
      const saleIds = qaSales.map(s => s._id);
      const saleDocIds = qaSales.map(s => s.id).filter(Boolean);
      const saleInvoices = qaSales.map(s => s.invoiceNo).filter(Boolean);

      await Promise.all([
        StockMovement.deleteMany({ $or: [{ referenceId: { $in: [...saleIds, ...saleDocIds] } }, { refId: { $in: saleDocIds } }] }),
        CustomerLedger.deleteMany({ $or: [{ refNo: { $in: saleInvoices } }, { refId: { $in: saleDocIds } }] }),
        Payment.deleteMany({ $or: [{ refNo: { $in: saleInvoices } }, { invoiceId: { $in: saleDocIds } }] }),
        Sale.deleteMany({ _id: { $in: saleIds } }),
      ]);
      results.removed += qaSales.length;
    }

    // Find QA Purchases and delete dependencies (StockMovement, SupplierLedger, Payments)
    const qaPurchases = await Purchase.find(qaFilter).select('_id id purchaseInvoiceNo supplierInvoiceNo').lean();
    if (qaPurchases.length > 0) {
      const purIds = qaPurchases.map(p => p._id);
      const purDocIds = qaPurchases.map(p => p.id).filter(Boolean);
      const purInvoices = qaPurchases.flatMap(p => [p.purchaseInvoiceNo, p.supplierInvoiceNo]).filter(Boolean);

      await Promise.all([
        StockMovement.deleteMany({ $or: [{ referenceId: { $in: [...purIds, ...purDocIds] } }, { refId: { $in: purDocIds } }] }),
        SupplierLedger.deleteMany({ $or: [{ refNo: { $in: purInvoices } }, { refId: { $in: purDocIds } }] }),
        Payment.deleteMany({ $or: [{ refNo: { $in: purInvoices } }, { invoiceId: { $in: purDocIds } }] }),
        Purchase.deleteMany({ _id: { $in: purIds } }),
      ]);
      results.removed += qaPurchases.length;
    }

    // Find QA Customers and Suppliers to clean their ledgers before deleting them
    const qaCusts = await Customer.find(qaFilter).select('id').lean();
    const qaSupps = await Supplier.find(qaFilter).select('id').lean();
    const qaCustIds = qaCusts.map(c => c.id).filter(Boolean);
    const qaSuppIds = qaSupps.map(s => s.id).filter(Boolean);

    if (qaCustIds.length > 0) {
      await CustomerLedger.deleteMany({ partyId: { $in: qaCustIds } });
    }
    if (qaSuppIds.length > 0) {
      await SupplierLedger.deleteMany({ partyId: { $in: qaSuppIds } });
    }

    // Clean orphan ledger entries where customer/supplier no longer exists
    const validCustIds = (await Customer.find().select('id').lean()).map(c => c.id);
    const validSuppIds = (await Supplier.find().select('id').lean()).map(s => s.id);
    await Promise.all([
      CustomerLedger.deleteMany({ partyId: { $nin: validCustIds } }),
      SupplierLedger.deleteMany({ partyId: { $nin: validSuppIds } }),
    ]);

    // Find QA Returns, Expenses, Products, Customers, Suppliers
    const [resSR, resPR, resExp, resProd, resCust, resSupp] = await Promise.all([
      SalesReturn.deleteMany(qaFilter),
      PurchaseReturn.deleteMany(qaFilter),
      Expense.deleteMany(qaFilter),
      Product.deleteMany(qaFilter),
      Customer.deleteMany(qaFilter),
      Supplier.deleteMany(qaFilter),
    ]);

    results.removed += (resSR.deletedCount || 0) + (resPR.deletedCount || 0) + (resExp.deletedCount || 0) +
                       (resProd.deletedCount || 0) + (resCust.deletedCount || 0) + (resSupp.deletedCount || 0);
  }

  await logAudit({
    user: userName,
    action: 'DatabaseMaintenanceCleanup',
    module: 'System',
    reference: 'Maintenance',
    after: results,
  });

  return results;
}

module.exports = {
  getDiagnostics,
  scanOrphanFiles,
  scanCandidates,
  runCleanup,
};
