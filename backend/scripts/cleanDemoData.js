/* eslint-disable no-console */
/**
 * Safe, targeted cleanup script for Laetus ERP.
 * Removes known demo/sample records while preserving real business records:
 * - REAL SUPPLIER: ALPHINE PHARMA
 * - REAL CUSTOMER: SUNIL CHILDREN HOSPITAL
 * - REAL PRODUCT:  ALPHILANIC-625
 * and all their genuine transactional history (batches, purchases, sales, ledgers, payments).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../src/config/env');
const {
  Customer, Supplier, Product, ProductBatch, Purchase, Sale, Payment,
  SalesReturn, PurchaseReturn, CustomerLedger, SupplierLedger, StockMovement,
  Counter,
} = require('../src/models');

const PROTECTED = {
  customerNames: [/sunil children hospital/i],
  supplierNames: [/alphine pharma/i],
  productNames: [/alphilanic/i],
};

const DEMO = {
  customerPatterns: [/demo/i, /devam/i, /abc multispeciality/i, /xyz medical/i, /sanjeevani/i, /qa healthcare/i],
  supplierPatterns: [/cadila/i, /sun pharma/i, /demo/i],
  productPatterns: [/l cream/i, /medicine a/i, /medicine b/i],
  batchNos: ['GP-250205', 'PCM-2211', 'AZT-1240', 'AZT-1187'],
};

async function runCleanDemoData() {
  console.log('=== STARTING SAFE TARGETED DEMO DATA CLEANUP ===');
  await mongoose.connect(env.mongoUri);
  console.log('[clean] Connected to MongoDB:', env.sanitizedMongoUri);

  // 1. Identify Demo Customers vs Protected Customers
  const allCustomers = await Customer.find({});
  const demoCustomerIds = [];
  for (const c of allCustomers) {
    const isProtected = PROTECTED.customerNames.some((p) => p.test(c.partyName));
    if (isProtected) {
      console.log(`[PRESERVED REAL CUSTOMER] ${c.id} | ${c.partyName}`);
    } else {
      const isDemo = DEMO.customerPatterns.some((p) => p.test(c.partyName) || p.test(c.id));
      if (isDemo) {
        demoCustomerIds.push(c.id);
        console.log(`[MARKED FOR REMOVAL - DEMO CUSTOMER] ${c.id} | ${c.partyName}`);
      }
    }
  }

  // 2. Identify Demo Suppliers vs Protected Suppliers
  const allSuppliers = await Supplier.find({});
  const demoSupplierIds = [];
  for (const s of allSuppliers) {
    const isProtected = PROTECTED.supplierNames.some((p) => p.test(s.company) || p.test(s.partyName || ''));
    if (isProtected) {
      console.log(`[PRESERVED REAL SUPPLIER] ${s.id} | ${s.company}`);
    } else {
      const isDemo = DEMO.supplierPatterns.some((p) => p.test(s.company) || p.test(s.id));
      if (isDemo) {
        demoSupplierIds.push(s.id);
        console.log(`[MARKED FOR REMOVAL - DEMO SUPPLIER] ${s.id} | ${s.company}`);
      }
    }
  }

  // 3. Identify Demo Products vs Protected Products
  const allProducts = await Product.find({});
  const demoProductIds = [];
  for (const p of allProducts) {
    const isProtected = PROTECTED.productNames.some((pat) => pat.test(p.name));
    if (isProtected) {
      console.log(`[PRESERVED REAL PRODUCT] ${p.id} | ${p.name}`);
    } else {
      const isDemo = DEMO.productPatterns.some((pat) => pat.test(p.name) || pat.test(p.id) || pat.test(p.sku || ''));
      if (isDemo) {
        demoProductIds.push(p.id);
        console.log(`[MARKED FOR REMOVAL - DEMO PRODUCT] ${p.id} | ${p.name}`);
      }
    }
  }

  // 4. Identify Demo Batches
  const allBatches = await ProductBatch.find({});
  const demoBatchIds = [];
  for (const b of allBatches) {
    if (demoProductIds.includes(b.productId) || DEMO.batchNos.includes(b.batchNo)) {
      demoBatchIds.push(b.id);
      console.log(`[MARKED FOR REMOVAL - DEMO BATCH] ${b.id} | Batch ${b.batchNo} (Product: ${b.productId})`);
    } else {
      console.log(`[PRESERVED REAL BATCH] ${b.id} | Batch ${b.batchNo} (Product: ${b.productId})`);
    }
  }

  // Execute Deletions for Demo Master Data
  if (demoCustomerIds.length > 0) {
    await Customer.deleteMany({ id: { $in: demoCustomerIds } });
    await CustomerLedger.deleteMany({ partyId: { $in: demoCustomerIds } });
    console.log(`✓ Deleted ${demoCustomerIds.length} demo customer(s) and their ledgers.`);
  }

  if (demoSupplierIds.length > 0) {
    await Supplier.deleteMany({ id: { $in: demoSupplierIds } });
    await SupplierLedger.deleteMany({ partyId: { $in: demoSupplierIds } });
    console.log(`✓ Deleted ${demoSupplierIds.length} demo supplier(s) and their ledgers.`);
  }

  if (demoProductIds.length > 0) {
    await Product.deleteMany({ id: { $in: demoProductIds } });
    console.log(`✓ Deleted ${demoProductIds.length} demo product(s).`);
  }

  if (demoBatchIds.length > 0) {
    await ProductBatch.deleteMany({ id: { $in: demoBatchIds } });
    await StockMovement.deleteMany({ batchId: { $in: demoBatchIds } });
    console.log(`✓ Deleted ${demoBatchIds.length} demo batch(es) and stock movements.`);
  }

  // Delete Demo Sales / Purchases associated with demo entities
  const deletedSales = await Sale.deleteMany({ $or: [{ customerId: { $in: demoCustomerIds } }, { 'lines.productId': { $in: demoProductIds } }] });
  console.log(`✓ Deleted ${deletedSales.deletedCount || 0} demo sales invoice(s).`);

  const deletedPurchases = await Purchase.deleteMany({ $or: [{ supplierId: { $in: demoSupplierIds } }, { 'lines.productId': { $in: demoProductIds } }] });
  console.log(`✓ Deleted ${deletedPurchases.deletedCount || 0} demo purchase invoice(s).`);

  const deletedSalesReturns = await SalesReturn.deleteMany({ $or: [{ customerId: { $in: demoCustomerIds } }, { productId: { $in: demoProductIds } }] });
  console.log(`✓ Deleted ${deletedSalesReturns.deletedCount || 0} demo sales return(s).`);

  const deletedPurchaseReturns = await PurchaseReturn.deleteMany({ $or: [{ supplierId: { $in: demoSupplierIds } }, { productId: { $in: demoProductIds } }] });
  console.log(`✓ Deleted ${deletedPurchaseReturns.deletedCount || 0} demo purchase return(s).`);

  // Recalculate remaining real product stock levels
  const remainingProducts = await Product.find({});
  for (const p of remainingProducts) {
    const activeBatches = await ProductBatch.find({ productId: p.id });
    const realStock = activeBatches.reduce((sum, b) => sum + (b.currentQty || 0), 0);
    await Product.updateOne({ id: p.id }, { $set: { currentStock: realStock } });
    console.log(`✓ Updated stock for preserved product ${p.name} (${p.id}): ${realStock}`);
  }

  // Reset counters to match remaining real counts
  const realCustCount = await Customer.countDocuments();
  const realSuppCount = await Supplier.countDocuments();
  const realProdCount = await Product.countDocuments();
  const realBatchCount = await ProductBatch.countDocuments();

  await Counter.findOneAndUpdate({ key: 'customer' }, { $set: { value: realCustCount } }, { upsert: true });
  await Counter.findOneAndUpdate({ key: 'supplier' }, { $set: { value: realSuppCount } }, { upsert: true });
  await Counter.findOneAndUpdate({ key: 'product' }, { $set: { value: realProdCount } }, { upsert: true });
  await Counter.findOneAndUpdate({ key: 'batch' }, { $set: { value: realBatchCount } }, { upsert: true });

  console.log(`\n=== CLEANUP COMPLETE ===`);
  console.log(`Remaining Customers: ${realCustCount}`);
  console.log(`Remaining Suppliers: ${realSuppCount}`);
  console.log(`Remaining Products:  ${realProdCount}`);
  console.log(`Remaining Batches:   ${realBatchCount}`);

  await mongoose.disconnect();
}

runCleanDemoData().catch((err) => {
  console.error('[clean] Error during cleanup:', err);
  process.exit(1);
});
