/* eslint-disable no-console */
/**
 * Safe, targeted cleanup script for Laetus ERP.
 * Removes known demo/sample records while preserving real business records:
 * - REAL SUPPLIER: ALPHINE PHARMA
 * - REAL CUSTOMER: SUNIL CHILDREN HOSPITAL
 * - REAL PRODUCT:  ALPHILANIC-625
 * and all their genuine transactional history (batches, purchases, sales, ledgers, payments).
 *
 * Usage:
 *   node scripts/cleanDemoData.js            -- LIVE run (executes deletions)
 *   node scripts/cleanDemoData.js --dry-run  -- preview only, NO writes made
 */
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../src/config/env');
const {
  Customer, Supplier, Product, ProductBatch, Purchase, Sale, Payment,
  SalesReturn, PurchaseReturn, CustomerLedger, SupplierLedger, StockMovement,
  Counter,
} = require('../src/models');

const DRY_RUN = process.argv.includes('--dry-run');

const PROTECTED = {
  customerNames: [/sunil children hospital/i],
  supplierNames: [/alphine pharma/i],
  productNames: [/alphilanic/i],
};

const DEMO = {
  customerPatterns: [/demo/i, /devam/i, /abc multispeciality/i, /xyz medical/i, /sanjeevani/i, /qa healthcare/i],
  supplierPatterns: [/cadila/i, /sun pharma/i, /demo/i],
  productPatterns: [/^l cream$/i, /^medicine a$/i, /^medicine b$/i],
  batchNos: ['GP-250205', 'PCM-2211', 'AZT-1240', 'AZT-1187'],
};

async function runCleanDemoData() {
  console.log('=======================================================');
  console.log(DRY_RUN ? '=== DRY-RUN MODE: NO WRITES WILL BE MADE ===' : '=== LIVE EXECUTION: WRITING TO PRODUCTION DB ===');
  console.log('=======================================================');

  await mongoose.connect(env.mongoUri);
  console.log('[clean] Connected to MongoDB:', env.sanitizedMongoUri);

  // ── 1. Identify Demo Customers ─────────────────────────────────────────────
  const allCustomers = await Customer.find({});
  const demoCustomerIds = [];
  console.log('\n── CUSTOMERS ──');
  for (const c of allCustomers) {
    const isProtected = PROTECTED.customerNames.some((p) => p.test(c.partyName));
    if (isProtected) {
      console.log(`  [PRESERVED REAL CUSTOMER]         ${c.id} | ${c.partyName}`);
    } else {
      const isDemo = DEMO.customerPatterns.some((p) => p.test(c.partyName) || p.test(c.id));
      if (isDemo) {
        demoCustomerIds.push(c.id);
        console.log(`  [MARKED FOR REMOVAL - DEMO CUSTOMER] ${c.id} | ${c.partyName}`);
      } else {
        console.log(`  [UNMATCHED - NOT TOUCHING]        ${c.id} | ${c.partyName}`);
      }
    }
  }

  // ── 2. Identify Demo Suppliers ─────────────────────────────────────────────
  const allSuppliers = await Supplier.find({});
  const demoSupplierIds = [];
  console.log('\n── SUPPLIERS ──');
  for (const s of allSuppliers) {
    const isProtected = PROTECTED.supplierNames.some((p) => p.test(s.company) || p.test(s.partyName || ''));
    if (isProtected) {
      console.log(`  [PRESERVED REAL SUPPLIER]         ${s.id} | ${s.company}`);
    } else {
      const isDemo = DEMO.supplierPatterns.some((p) => p.test(s.company) || p.test(s.id));
      if (isDemo) {
        demoSupplierIds.push(s.id);
        console.log(`  [MARKED FOR REMOVAL - DEMO SUPPLIER] ${s.id} | ${s.company}`);
      } else {
        console.log(`  [UNMATCHED - NOT TOUCHING]        ${s.id} | ${s.company}`);
      }
    }
  }

  // ── 3. Identify Demo Products ──────────────────────────────────────────────
  const allProducts = await Product.find({});
  const demoProductIds = [];
  console.log('\n── PRODUCTS ──');
  for (const p of allProducts) {
    const isProtected = PROTECTED.productNames.some((pat) => pat.test(p.name));
    if (isProtected) {
      console.log(`  [PRESERVED REAL PRODUCT]          ${p.id} | ${p.name}`);
    } else {
      const isDemo = DEMO.productPatterns.some((pat) => pat.test(p.name) || pat.test(p.id) || pat.test(p.sku || ''));
      if (isDemo) {
        demoProductIds.push(p.id);
        console.log(`  [MARKED FOR REMOVAL - DEMO PRODUCT]  ${p.id} | ${p.name}`);
      } else {
        console.log(`  [UNMATCHED - NOT TOUCHING]        ${p.id} | ${p.name}`);
      }
    }
  }

  // ── 4. Identify Demo Batches ───────────────────────────────────────────────
  const allBatches = await ProductBatch.find({});
  const demoBatchIds = [];
  console.log('\n── BATCHES ──');
  for (const b of allBatches) {
    if (demoProductIds.includes(b.productId) || DEMO.batchNos.includes(b.batchNo)) {
      demoBatchIds.push(b.id);
      console.log(`  [MARKED FOR REMOVAL - DEMO BATCH]    ${b.id} | Batch ${b.batchNo} (Product: ${b.productId})`);
    } else {
      console.log(`  [PRESERVED REAL BATCH]            ${b.id} | Batch ${b.batchNo} (Product: ${b.productId})`);
    }
  }

  // ── 5. Predict transactional impact with protected exclusions ─────────────
  const realCustomer = await Customer.findOne({ partyName: /sunil children hospital/i });
  const realSupplier = await Supplier.findOne({ company: /alphine pharma/i });
  const realProduct  = await Product.findOne({ name: /alphilanic/i });

  const protectedCustIds = [realCustomer?.id, realCustomer?._id?.toString()].filter(Boolean);
  const protectedSuppIds = [realSupplier?.id, realSupplier?._id?.toString()].filter(Boolean);
  const protectedProdIds = [realProduct?.id, realProduct?._id?.toString()].filter(Boolean);

  const allSales = await Sale.find({});
  const salesToRemove = allSales.filter((s) => {
    if (protectedCustIds.includes(s.customerId)) return false;
    const hasProtectedProd = (s.lines || []).some((l) => protectedProdIds.includes(l.productId));
    if (hasProtectedProd) return false;
    const isDemoCust = demoCustomerIds.includes(s.customerId);
    const allDemoProds = (s.lines || []).length > 0 && (s.lines || []).every((l) => demoProductIds.includes(l.productId));
    return isDemoCust || allDemoProds;
  });

  const allPurchases = await Purchase.find({});
  const purchasesToRemove = allPurchases.filter((p) => {
    if (protectedSuppIds.includes(p.supplierId)) return false;
    const hasProtectedProd = (p.lines || []).some((l) => protectedProdIds.includes(l.productId));
    if (hasProtectedProd) return false;
    const isDemoSupp = demoSupplierIds.includes(p.supplierId);
    const allDemoProds = (p.lines || []).length > 0 && (p.lines || []).every((l) => demoProductIds.includes(l.productId));
    return isDemoSupp || allDemoProds;
  });

  const allSalesReturns = await SalesReturn.find({});
  const salesReturnsToRemove = allSalesReturns.filter((r) => {
    if (protectedCustIds.includes(r.customerId)) return false;
    if (protectedProdIds.includes(r.productId)) return false;
    return demoCustomerIds.includes(r.customerId) || demoProductIds.includes(r.productId);
  });

  const allPurchaseReturns = await PurchaseReturn.find({});
  const purchaseReturnsToRemove = allPurchaseReturns.filter((r) => {
    if (protectedSuppIds.includes(r.supplierId)) return false;
    if (protectedProdIds.includes(r.productId)) return false;
    return demoSupplierIds.includes(r.supplierId) || demoProductIds.includes(r.productId);
  });

  const stockMovementsToRemove = await StockMovement.countDocuments({ batchId: { $in: demoBatchIds } });
  const custLedgersToRemove = await CustomerLedger.countDocuments({ partyId: { $in: demoCustomerIds, $nin: protectedCustIds } });
  const suppLedgersToRemove = await SupplierLedger.countDocuments({ partyId: { $in: demoSupplierIds, $nin: protectedSuppIds } });

  console.log('\n── TRANSACTIONS THAT WOULD BE REMOVED ──');
  console.log(`  Demo Sales Invoices:       ${salesToRemove.length}`);
  for (const s of salesToRemove) console.log(`    - ${s.invoiceNo || s.id} | Customer: ${s.customerId}`);

  console.log(`  Demo Purchase Invoices:    ${purchasesToRemove.length}`);
  for (const p of purchasesToRemove) console.log(`    - ${p.invoiceNo || p.id} | Supplier: ${p.supplierId}`);

  console.log(`  Demo Sales Returns:        ${salesReturnsToRemove.length}`);
  console.log(`  Demo Purchase Returns:     ${purchaseReturnsToRemove.length}`);
  console.log(`  Demo Stock Movements:      ${stockMovementsToRemove}`);
  console.log(`  Demo Customer Ledgers:     ${custLedgersToRemove}`);
  console.log(`  Demo Supplier Ledgers:     ${suppLedgersToRemove}`);

  // ── 6. Protected records safety check ─────────────────────────────────────
  console.log('\n── SAFETY CONFIRMATION ──');
  const realCustomer = await Customer.findOne({ partyName: /sunil children hospital/i });
  const realSupplier = await Supplier.findOne({ company: /alphine pharma/i });
  const realProduct  = await Product.findOne({ name: /alphilanic/i });
  console.log(`  SUNIL CHILDREN HOSPITAL found: ${realCustomer ? '✅ YES' : '❌ NOT FOUND'}`);
  console.log(`  ALPHINE PHARMA found:          ${realSupplier ? '✅ YES' : '❌ NOT FOUND'}`);
  console.log(`  ALPHILANIC-625 found:          ${realProduct  ? '✅ YES' : '❌ NOT FOUND'}`);

  // Abort if protected records are not confirmed
  if (!realCustomer || !realSupplier || !realProduct) {
    console.error('\n[ABORT] One or more protected real records NOT FOUND. Aborting cleanup to prevent accidental data loss.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Confirm protected records are NOT in demo lists
  const safetyFailed = (
    demoCustomerIds.includes(realCustomer.id) ||
    demoSupplierIds.includes(realSupplier.id) ||
    demoProductIds.includes(realProduct.id)
  );
  if (safetyFailed) {
    console.error('\n[ABORT] Protected real records are in the demo deletion list! Aborting cleanup.');
    await mongoose.disconnect();
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('\n=======================================================');
    console.log('=== DRY-RUN COMPLETE. NO DATA WAS MODIFIED. ===');
    console.log('=== Run without --dry-run to execute the cleanup. ===');
    console.log('=======================================================');
    await mongoose.disconnect();
    return;
  }

  // ── 7. Execute Deletions ───────────────────────────────────────────────────
  console.log('\n── EXECUTING DELETIONS ──');

  if (demoCustomerIds.length > 0) {
    await Customer.deleteMany({ id: { $in: demoCustomerIds } });
    await CustomerLedger.deleteMany({ partyId: { $in: demoCustomerIds } });
    console.log(`  ✓ Deleted ${demoCustomerIds.length} demo customer(s) and their ledgers.`);
  }

  if (demoSupplierIds.length > 0) {
    await Supplier.deleteMany({ id: { $in: demoSupplierIds } });
    await SupplierLedger.deleteMany({ partyId: { $in: demoSupplierIds } });
    console.log(`  ✓ Deleted ${demoSupplierIds.length} demo supplier(s) and their ledgers.`);
  }

  if (demoProductIds.length > 0) {
    await Product.deleteMany({ id: { $in: demoProductIds } });
    console.log(`  ✓ Deleted ${demoProductIds.length} demo product(s).`);
  }

  if (demoBatchIds.length > 0) {
    await ProductBatch.deleteMany({ id: { $in: demoBatchIds } });
    await StockMovement.deleteMany({ batchId: { $in: demoBatchIds } });
    console.log(`  ✓ Deleted ${demoBatchIds.length} demo batch(es) and their stock movements.`);
  }

  if (salesToRemove.length > 0) {
    await Sale.deleteMany({ _id: { $in: salesToRemove.map(s => s._id) } });
    console.log(`  ✓ Deleted ${salesToRemove.length} demo sales invoice(s).`);
  }

  if (purchasesToRemove.length > 0) {
    await Purchase.deleteMany({ _id: { $in: purchasesToRemove.map(p => p._id) } });
    console.log(`  ✓ Deleted ${purchasesToRemove.length} demo purchase invoice(s).`);
  }

  if (salesReturnsToRemove.length > 0) {
    await SalesReturn.deleteMany({ _id: { $in: salesReturnsToRemove.map(r => r._id) } });
    console.log(`  ✓ Deleted ${salesReturnsToRemove.length} demo sales return(s).`);
  }

  if (purchaseReturnsToRemove.length > 0) {
    await PurchaseReturn.deleteMany({ _id: { $in: purchaseReturnsToRemove.map(r => r._id) } });
    console.log(`  ✓ Deleted ${purchaseReturnsToRemove.length} demo purchase return(s).`);
  }

  // ── 8. Recalculate real product stock levels ───────────────────────────────
  const remainingProducts = await Product.find({});
  for (const p of remainingProducts) {
    const activeBatches = await ProductBatch.find({ productId: p.id });
    const realStock = activeBatches.reduce((sum, b) => sum + (b.currentQty || 0), 0);
    await Product.updateOne({ id: p.id }, { $set: { currentStock: realStock } });
    console.log(`  ✓ Updated stock for ${p.name} (${p.id}): ${realStock} units`);
  }

  // ── 9. Reset counters ─────────────────────────────────────────────────────
  const realCustCount  = await Customer.countDocuments();
  const realSuppCount  = await Supplier.countDocuments();
  const realProdCount  = await Product.countDocuments();
  const realBatchCount = await ProductBatch.countDocuments();

  await Counter.findOneAndUpdate({ key: 'customer' }, { $set: { value: realCustCount } }, { upsert: true });
  await Counter.findOneAndUpdate({ key: 'supplier' }, { $set: { value: realSuppCount } }, { upsert: true });
  await Counter.findOneAndUpdate({ key: 'product' },  { $set: { value: realProdCount  } }, { upsert: true });
  await Counter.findOneAndUpdate({ key: 'batch' },    { $set: { value: realBatchCount } }, { upsert: true });

  // ── 10. Post-cleanup safety verification ──────────────────────────────────
  console.log('\n── POST-CLEANUP VERIFICATION ──');
  const postCustomer = await Customer.findOne({ partyName: /sunil children hospital/i });
  const postSupplier = await Supplier.findOne({ company: /alphine pharma/i });
  const postProduct  = await Product.findOne({ name: /alphilanic/i });
  console.log(`  SUNIL CHILDREN HOSPITAL still exists: ${postCustomer ? '✅ YES' : '❌ MISSING - BUG!'}`);
  console.log(`  ALPHINE PHARMA still exists:          ${postSupplier ? '✅ YES' : '❌ MISSING - BUG!'}`);
  console.log(`  ALPHILANIC-625 still exists:          ${postProduct  ? '✅ YES' : '❌ MISSING - BUG!'}`);

  console.log('\n=======================================================');
  console.log('=== CLEANUP COMPLETE ===');
  console.log(`  Remaining Customers: ${realCustCount}`);
  console.log(`  Remaining Suppliers: ${realSuppCount}`);
  console.log(`  Remaining Products:  ${realProdCount}`);
  console.log(`  Remaining Batches:   ${realBatchCount}`);
  console.log('=======================================================');

  await mongoose.disconnect();
}

runCleanDemoData().catch((err) => {
  console.error('[clean] Fatal error during cleanup:', err);
  process.exit(1);
});
