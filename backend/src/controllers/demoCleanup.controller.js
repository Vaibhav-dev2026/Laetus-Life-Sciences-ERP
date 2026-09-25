/* eslint-disable no-console */
/**
 * TEMPORARY PRODUCTION MAINTENANCE — Demo Data Cleanup
 * =====================================================
 * Endpoint: POST /api/maintenance/demo-cleanup
 *
 * Security:
 *  - Requires valid Admin JWT (handled by route middleware)
 *  - Requires header: x-maintenance-secret matching MAINTENANCE_SECRET env var
 *  - Requires body.confirm = "DELETE_DEMO_DATA" for live execution
 *  - Entire endpoint is disabled (403) if MAINTENANCE_SECRET is not set in env
 *  - After successful live execution the endpoint locks itself (sets DB flag)
 *    so it cannot be run again even with valid credentials
 *
 * Modes:
 *  - mode=dry-run  : returns deterministic target set, NO DB writes
 *  - mode=execute  : runs with the same target set inside a Mongoose session
 *
 * NEVER:
 *  - dropDatabase()
 *  - collection.drop()
 *  - blanket deleteMany({})
 *  - broad/unscoped deletion
 *
 * After execution:
 *  - Automatically verifies protected real records still exist
 *  - Writes an AuditLog entry
 *  - Locks the endpoint permanently (MAINTENANCE_CLEANUP_DONE flag in DB)
 *
 * REMOVE THIS FILE AFTER SUCCESSFUL CLEANUP.
 */

const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const {
  Customer, Supplier, Product, ProductBatch,
  Purchase, Sale, SalesReturn, PurchaseReturn,
  CustomerLedger, SupplierLedger, StockMovement,
  Counter, AuditLog,
} = require('../models');

// ── Constants ────────────────────────────────────────────────────────────────

const PROTECTED = {
  customerNames: [/sunil children hospital/i],
  supplierNames: [/alphine pharma/i],
  productNames:  [/alphilanic/i],
};

const DEMO = {
  customerPatterns: [/demo/i, /devam/i, /abc multispeciality/i, /xyz medical/i, /sanjeevani/i, /qa healthcare/i],
  supplierPatterns: [/cadila/i, /sun pharma/i, /demo/i],
  productPatterns:  [/^l cream$/i, /^medicine a$/i, /^medicine b$/i],
  batchNos:         ['GP-250205', 'PCM-2211', 'AZT-1240', 'AZT-1187'],
};

// ── Security guard middleware ────────────────────────────────────────────────

/**
 * Guards the entire demo-cleanup endpoint:
 *  1. MAINTENANCE_SECRET must be configured in the environment
 *  2. x-maintenance-secret header must match it exactly
 */
function requireMaintenanceSecret(req, res, next) {
  const secret = process.env.MAINTENANCE_SECRET;

  // Endpoint is completely disabled when the secret is not configured
  if (!secret || secret.trim() === '') {
    throw ApiError.forbidden('Maintenance endpoint is disabled: MAINTENANCE_SECRET is not configured.');
  }

  const provided = req.headers['x-maintenance-secret'] || '';
  if (provided !== secret) {
    // Deliberately vague — do not leak whether the secret exists or what it should be
    throw ApiError.forbidden('Maintenance secret invalid or missing.');
  }

  next();
}

// ── Shared target-set computation (identical to cleanDemoData.js logic) ─────

/**
 * Builds the deterministic deletion target set from the live DB.
 * Aborts immediately (throws) if any protected record would be included.
 * Returns counts and IDs — does NOT mutate the database.
 */
async function buildTargetSet() {
  // 1. Customers
  const allCustomers = await Customer.find({}).lean();
  const demoCustomers = [];
  const unmatchedCustomers = [];

  for (const c of allCustomers) {
    const isProtected = PROTECTED.customerNames.some((p) => p.test(c.partyName));
    const isDemo      = !isProtected && DEMO.customerPatterns.some((p) => p.test(c.partyName) || p.test(c.id || ''));
    if (isProtected) { /* keep */ }
    else if (isDemo)  { demoCustomers.push({ _id: c._id, id: c.id, name: c.partyName }); }
    else              { unmatchedCustomers.push({ id: c.id, name: c.partyName }); }
  }

  // 2. Suppliers
  const allSuppliers = await Supplier.find({}).lean();
  const demoSuppliers = [];
  const unmatchedSuppliers = [];

  for (const s of allSuppliers) {
    const displayName = s.company || s.partyName || '';
    const isProtected = PROTECTED.supplierNames.some((p) => p.test(displayName));
    const isDemo      = !isProtected && DEMO.supplierPatterns.some((p) => p.test(displayName) || p.test(s.id || ''));
    if (isProtected) { /* keep */ }
    else if (isDemo)  { demoSuppliers.push({ _id: s._id, id: s.id, name: displayName }); }
    else              { unmatchedSuppliers.push({ id: s.id, name: displayName }); }
  }

  // 3. Products
  const allProducts = await Product.find({}).lean();
  const demoProducts = [];
  const unmatchedProducts = [];

  for (const p of allProducts) {
    const isProtected = PROTECTED.productNames.some((pat) => pat.test(p.name));
    const isDemo      = !isProtected && DEMO.productPatterns.some((pat) => pat.test(p.name) || pat.test(p.id || '') || pat.test(p.sku || ''));
    if (isProtected) { /* keep */ }
    else if (isDemo)  { demoProducts.push({ _id: p._id, id: p.id, name: p.name }); }
    else              { unmatchedProducts.push({ id: p.id, name: p.name }); }
  }

  // 4. Batches — tied to demo products OR explicitly known demo batch numbers
  const demoProdIds = demoProducts.map((p) => p.id);
  const allBatches  = await ProductBatch.find({}).lean();
  const demoBatches = [];

  for (const b of allBatches) {
    if (demoProdIds.includes(b.productId) || DEMO.batchNos.includes(b.batchNo)) {
      demoBatches.push({ _id: b._id, id: b.id, batchNo: b.batchNo, productId: b.productId });
    }
  }

  // 5. Transactions tied to demo entities (query only — no deletion)
  const demoCustIds  = demoCustomers.map((c) => c.id);
  const demoSuppIds  = demoSuppliers.map((s) => s.id);
  const demoBatchIds = demoBatches.map((b) => b.id);

  const [
    demoSales,
    demoPurchases,
    demoSalesReturns,
    demoPurchaseReturns,
    demoStockMovementsCount,
    demoCustLedgersCount,
    demoSuppLedgersCount,
  ] = await Promise.all([
    Sale.find({ $or: [{ customerId: { $in: demoCustIds } }, { 'lines.productId': { $in: demoProdIds } }] })
        .select('_id id invoiceNo customerId').lean(),
    Purchase.find({ $or: [{ supplierId: { $in: demoSuppIds } }, { 'lines.productId': { $in: demoProdIds } }] })
            .select('_id id purchaseInvoiceNo supplierId').lean(),
    SalesReturn.find({ $or: [{ customerId: { $in: demoCustIds } }, { productId: { $in: demoProdIds } }] })
               .select('_id id customerId').lean(),
    PurchaseReturn.find({ $or: [{ supplierId: { $in: demoSuppIds } }, { productId: { $in: demoProdIds } }] })
                  .select('_id id supplierId').lean(),
    StockMovement.countDocuments({ batchId: { $in: demoBatchIds } }),
    CustomerLedger.countDocuments({ partyId: { $in: demoCustIds } }),
    SupplierLedger.countDocuments({ partyId: { $in: demoSuppIds } }),
  ]);

  // 6. Safety check — protected records must NOT be in any demo list
  const realCustomer = await Customer.findOne({ partyName: PROTECTED.customerNames[0] }).lean();
  const realSupplier = await Supplier.findOne({ $or: [{ company: PROTECTED.supplierNames[0] }, { partyName: PROTECTED.supplierNames[0] }] }).lean();
  const realProduct  = await Product.findOne({ name: PROTECTED.productNames[0] }).lean();

  const protectedVerification = {
    'SUNIL CHILDREN HOSPITAL': realCustomer ? 'FOUND ✓' : 'NOT FOUND — ABORT',
    'ALPHINE PHARMA':          realSupplier ? 'FOUND ✓' : 'NOT FOUND — ABORT',
    'ALPHILANIC-625':          realProduct  ? 'FOUND ✓' : 'NOT FOUND — ABORT',
  };

  // Hard abort if protected records are missing or contaminated
  if (!realCustomer || !realSupplier || !realProduct) {
    throw new Error('SAFETY ABORT: One or more protected real records not found in the database. Cleanup aborted.');
  }

  const contaminated =
    demoCustIds.includes(realCustomer.id) ||
    demoSuppIds.includes(realSupplier.id) ||
    demoProdIds.includes(realProduct.id);

  if (contaminated) {
    throw new Error('SAFETY ABORT: Protected real records were found in the demo deletion target set. Cleanup aborted.');
  }

  return {
    demoCustomers,
    demoSuppliers,
    demoProducts,
    demoBatches,
    demoCustIds,
    demoSuppIds,
    demoProdIds,
    demoBatchIds,
    transactions: {
      demoSales,
      demoPurchases,
      demoSalesReturns,
      demoPurchaseReturns,
      demoStockMovementsCount,
      demoCustLedgersCount,
      demoSuppLedgersCount,
    },
    protectedVerification,
    unmatchedCustomers,
    unmatchedSuppliers,
    unmatchedProducts,
  };
}

// ── Endpoint: POST /api/maintenance/demo-cleanup ─────────────────────────────

const demoCleanup = [
  requireMaintenanceSecret,
  asyncHandler(async (req, res) => {
    // Auth check — must be Admin (route-level middleware ensures authenticate,
    // but we double-check role here for defence-in-depth)
    if (!req.user || req.user.role !== 'Admin') {
      throw ApiError.forbidden('Admin role required for maintenance operations.');
    }

    const mode    = (req.body.mode    || '').trim().toLowerCase();
    const confirm = (req.body.confirm || '').trim();

    if (mode !== 'dry-run' && mode !== 'execute') {
      throw ApiError.badRequest('body.mode must be "dry-run" or "execute".');
    }

    // ── Check one-time lock (set after successful execution) ──────────────
    const lockDoc = await AuditLog.findOne({
      action: 'MaintenanceCleanup',
      module: 'DemoDataCleanup',
      reference: 'COMPLETED',
    }).lean();

    if (lockDoc) {
      return res.status(200).json({
        success: false,
        locked: true,
        message: 'Demo data cleanup has already been completed and this endpoint is permanently locked. Remove MAINTENANCE_SECRET from Render env vars.',
        completedAt: lockDoc.date,
      });
    }

    // ── Build the target set (shared logic — identical to cleanDemoData.js) ─
    let targetSet;
    try {
      targetSet = await buildTargetSet();
    } catch (err) {
      console.error('[maintenance] buildTargetSet SAFETY ABORT:', err.message);
      throw ApiError.internal(err.message);
    }

    const {
      demoCustomers, demoSuppliers, demoProducts, demoBatches,
      demoCustIds, demoSuppIds, demoProdIds, demoBatchIds,
      transactions, protectedVerification,
      unmatchedCustomers, unmatchedSuppliers, unmatchedProducts,
    } = targetSet;

    // ── DRY-RUN mode — return preview, NO writes ──────────────────────────
    if (mode === 'dry-run') {
      return res.status(200).json({
        success: true,
        mode: 'dry-run',
        message: 'DRY-RUN COMPLETE — NO DATA WAS MODIFIED.',
        protectedRecordsVerification: protectedVerification,
        targetedDemoRecords: {
          customers: {
            count: demoCustomers.length,
            records: demoCustomers.map((c) => ({ id: c.id, name: c.name })),
          },
          suppliers: {
            count: demoSuppliers.length,
            records: demoSuppliers.map((s) => ({ id: s.id, name: s.name })),
          },
          products: {
            count: demoProducts.length,
            records: demoProducts.map((p) => ({ id: p.id, name: p.name })),
          },
          batches: {
            count: demoBatches.length,
            records: demoBatches.map((b) => ({ id: b.id, batchNo: b.batchNo, productId: b.productId })),
          },
        },
        targetedTransactions: {
          salesInvoices: {
            count: transactions.demoSales.length,
            records: transactions.demoSales.map((s) => ({ id: s.id, invoiceNo: s.invoiceNo, customerId: s.customerId })),
          },
          purchaseInvoices: {
            count: transactions.demoPurchases.length,
            records: transactions.demoPurchases.map((p) => ({ id: p.id, invoiceNo: p.purchaseInvoiceNo, supplierId: p.supplierId })),
          },
          salesReturns:     { count: transactions.demoSalesReturns.length },
          purchaseReturns:  { count: transactions.demoPurchaseReturns.length },
          stockMovements:   { count: transactions.demoStockMovementsCount },
          customerLedgers:  { count: transactions.demoCustLedgersCount },
          supplierLedgers:  { count: transactions.demoSuppLedgersCount },
        },
        notTargeted: {
          customers: unmatchedCustomers,
          suppliers: unmatchedSuppliers,
          products:  unmatchedProducts,
        },
        nextStep: 'Review the above. If correct, send mode=execute&confirm=DELETE_DEMO_DATA with Admin JWT and x-maintenance-secret header.',
      });
    }

    // ── EXECUTE mode — require explicit confirmation token ─────────────────
    if (confirm !== 'DELETE_DEMO_DATA') {
      throw ApiError.badRequest('body.confirm must be exactly "DELETE_DEMO_DATA" to proceed with execution.');
    }

    // ── Run deletions inside a Mongoose session for atomicity ─────────────
    const session = await mongoose.startSession();
    let executionSummary;

    try {
      await session.withTransaction(async () => {
        // Delete targeted master records using EXPLICIT _id lists from the target set
        const [
          custDel, suppDel, prodDel, batchDel,
          stockDel, custLedgDel, suppLedgDel,
          saleDel, purDel, srDel, prDel,
        ] = await Promise.all([
          Customer.deleteMany(      { _id: { $in: demoCustomers.map((c) => c._id) } },      { session }),
          Supplier.deleteMany(      { _id: { $in: demoSuppliers.map((s) => s._id) } },      { session }),
          Product.deleteMany(       { _id: { $in: demoProducts.map((p) => p._id) } },        { session }),
          ProductBatch.deleteMany(  { _id: { $in: demoBatches.map((b) => b._id) } },         { session }),
          StockMovement.deleteMany( { batchId: { $in: demoBatchIds } },                       { session }),
          CustomerLedger.deleteMany({ partyId: { $in: demoCustIds } },                        { session }),
          SupplierLedger.deleteMany({ partyId: { $in: demoSuppIds } },                        { session }),
          Sale.deleteMany(          { _id: { $in: transactions.demoSales.map((s) => s._id) } },          { session }),
          Purchase.deleteMany(      { _id: { $in: transactions.demoPurchases.map((p) => p._id) } },      { session }),
          SalesReturn.deleteMany(   { _id: { $in: transactions.demoSalesReturns.map((r) => r._id) } },   { session }),
          PurchaseReturn.deleteMany({ _id: { $in: transactions.demoPurchaseReturns.map((r) => r._id) } },{ session }),
        ]);

        executionSummary = {
          customersDeleted:       custDel.deletedCount,
          suppliersDeleted:       suppDel.deletedCount,
          productsDeleted:        prodDel.deletedCount,
          batchesDeleted:         batchDel.deletedCount,
          stockMovementsDeleted:  stockDel.deletedCount,
          customerLedgersDeleted: custLedgDel.deletedCount,
          supplierLedgersDeleted: suppLedgDel.deletedCount,
          salesDeleted:           saleDel.deletedCount,
          purchasesDeleted:       purDel.deletedCount,
          salesReturnsDeleted:    srDel.deletedCount,
          purchaseReturnsDeleted: prDel.deletedCount,
        };

        // ── Recalculate stock for remaining real products ──────────────────
        const remainingProducts = await Product.find({}, null, { session });
        for (const p of remainingProducts) {
          const activeBatches = await ProductBatch.find({ productId: p.id }, null, { session });
          const realStock = activeBatches.reduce((sum, b) => sum + (b.currentQty || 0), 0);
          await Product.updateOne({ _id: p._id }, { $set: { currentStock: realStock } }, { session });
        }

        // ── Reset counters ─────────────────────────────────────────────────
        const [rCust, rSupp, rProd, rBatch] = await Promise.all([
          Customer.countDocuments({}, { session }),
          Supplier.countDocuments({}, { session }),
          Product.countDocuments({},  { session }),
          ProductBatch.countDocuments({}, { session }),
        ]);
        await Promise.all([
          Counter.findOneAndUpdate({ key: 'customer' }, { $set: { value: rCust } },  { upsert: true, session }),
          Counter.findOneAndUpdate({ key: 'supplier' }, { $set: { value: rSupp } },  { upsert: true, session }),
          Counter.findOneAndUpdate({ key: 'product' },  { $set: { value: rProd } },  { upsert: true, session }),
          Counter.findOneAndUpdate({ key: 'batch' },    { $set: { value: rBatch } }, { upsert: true, session }),
        ]);
      });
    } catch (txErr) {
      console.error('[maintenance] Transaction aborted:', txErr.message);
      throw ApiError.internal(`Cleanup transaction aborted: ${txErr.message}`);
    } finally {
      session.endSession();
    }

    // ── Post-execution verification (outside transaction — read committed) ─
    const [postCustomer, postSupplier, postProduct] = await Promise.all([
      Customer.findOne({ partyName: PROTECTED.customerNames[0] }).lean(),
      Supplier.findOne({ $or: [{ company: PROTECTED.supplierNames[0] }, { partyName: PROTECTED.supplierNames[0] }] }).lean(),
      Product.findOne({ name: PROTECTED.productNames[0] }).lean(),
    ]);

    const postVerification = {
      'SUNIL CHILDREN HOSPITAL': postCustomer ? 'EXISTS ✓' : 'MISSING — BUG!',
      'ALPHINE PHARMA':          postSupplier ? 'EXISTS ✓' : 'MISSING — BUG!',
      'ALPHILANIC-625':          postProduct  ? 'EXISTS ✓' : 'MISSING — BUG!',
    };

    const verificationPassed = postCustomer && postSupplier && postProduct;

    // ── Write one-time completion lock to AuditLog ────────────────────────
    await AuditLog.create({
      user:      req.user.name || req.user.email || 'Admin',
      action:    'MaintenanceCleanup',
      module:    'DemoDataCleanup',
      reference: 'COMPLETED',
      before:    {
        demoCustomerIds: demoCustIds,
        demoSupplierIds: demoSuppIds,
        demoProductIds:  demoProdIds,
        demoBatchIds,
      },
      after: {
        executionSummary,
        postVerification,
        verificationPassed,
        executedBy: req.user.email || req.user.name,
        executedAt: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      success: true,
      mode:    'execute',
      message: verificationPassed
        ? 'Demo data cleanup completed and verified. All protected real records intact. REMOVE MAINTENANCE_SECRET from Render env vars now.'
        : 'CLEANUP COMPLETED BUT VERIFICATION FAILED — check postVerification for details.',
      executionSummary,
      postVerification,
      verificationPassed,
      instruction: 'Remove MAINTENANCE_SECRET from Render environment variables immediately. Then remove the /api/maintenance/demo-cleanup endpoint from the codebase.',
    });
  }),
];

module.exports = { demoCleanup };
