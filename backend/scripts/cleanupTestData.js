/* eslint-disable no-console */
/**
 * Removes every document created during testing/QA (anything created at or
 * after a given cutoff timestamp), across every transactional collection,
 * while preserving your real Company profile and your single admin User
 * account. Then reinitializes every Counter to match whatever real data
 * survives, so your very first genuine invoice/customer/etc. after cleanup
 * starts at a sensible number instead of continuing from wherever testing
 * left off.
 *
 * SAFE BY DEFAULT: running this with no flags only PRINTS what it would
 * delete, per collection, and changes nothing. You must pass --confirm to
 * actually delete anything.
 *
 * Usage:
 *   node scripts/cleanupTestData.js --after="2026-09-16T10:00:00Z"          (dry run — prints counts only)
 *   node scripts/cleanupTestData.js --after="2026-09-16T10:00:00Z" --confirm (actually deletes)
 *
 * --after is required and must be an ISO timestamp — the exact moment right
 * before you started your manual E2E testing walkthrough. Every document
 * with createdAt >= that timestamp, in the collections listed below, is
 * treated as test data and removed. Get this timestamp wrong and you either
 * delete real data (too early) or leave test data behind (too late) — when
 * in doubt, run without --confirm first and eyeball the per-collection
 * counts before trusting them.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../src/config/env');
const {
  Customer, Supplier, Product, ProductBatch, Purchase, Sale, Payment,
  SalesReturn, PurchaseReturn, CustomerLedger, SupplierLedger, StockMovement,
  AuditLog, Notification, Backup, Counter,
} = require('../src/models');

// Order matters only for readability of the printed report — deletion order
// doesn't matter here since we're wiping by timestamp, not by dependency.
const COLLECTIONS = [
  { name: 'Sale', model: Sale },
  { name: 'SalesReturn', model: SalesReturn },
  { name: 'Purchase', model: Purchase },
  { name: 'PurchaseReturn', model: PurchaseReturn },
  { name: 'Payment', model: Payment },
  { name: 'CustomerLedger', model: CustomerLedger },
  { name: 'SupplierLedger', model: SupplierLedger },
  { name: 'StockMovement', model: StockMovement },
  { name: 'ProductBatch', model: ProductBatch },
  { name: 'Product', model: Product },
  { name: 'Customer', model: Customer },
  { name: 'Supplier', model: Supplier },
  { name: 'AuditLog', model: AuditLog },
  { name: 'Notification', model: Notification },
  { name: 'Backup', model: Backup },
];
// Deliberately NOT included: Company (your real, once-off company profile),
// User (your real admin login — never touched by this script), Counter
// (reset separately below, not deleted by timestamp).

function parseArgs() {
  const args = process.argv.slice(2);
  const afterArg = args.find((a) => a.startsWith('--after='));
  const confirm = args.includes('--confirm');
  if (!afterArg) {
    console.error('[cleanup] Missing required --after="<ISO timestamp>" argument. Aborting — nothing was touched.');
    process.exit(1);
  }
  const after = new Date(afterArg.split('=')[1]);
  if (Number.isNaN(after.getTime())) {
    console.error('[cleanup] --after value is not a valid date. Aborting — nothing was touched.');
    process.exit(1);
  }
  return { after, confirm };
}

async function run() {
  const { after, confirm } = parseArgs();
  await mongoose.connect(env.mongoUri);
  console.log(`[cleanup] Connected. Cutoff timestamp: ${after.toISOString()}`);
  console.log(`[cleanup] Mode: ${confirm ? 'LIVE — will actually delete' : 'DRY RUN — will only report counts'}\n`);

  const filter = { createdAt: { $gte: after } };
  let totalWouldDelete = 0;

  for (const { name, model } of COLLECTIONS) {
    const count = await model.countDocuments(filter);
    totalWouldDelete += count;
    console.log(`  ${name.padEnd(16)} ${count} document(s) with createdAt >= cutoff`);
    if (confirm && count > 0) {
      await model.deleteMany(filter);
    }
  }

  console.log(`\n[cleanup] Total: ${totalWouldDelete} document(s) ${confirm ? 'deleted' : 'WOULD be deleted (dry run — nothing changed)'}.`);

  if (!confirm) {
    console.log('[cleanup] Re-run with --confirm once these counts look right to actually delete.');
    await mongoose.disconnect();
    return;
  }

  // Reset every Counter to match whatever real data survives the cleanup —
  // covers both "nothing real existed before testing" (resets to 0) and
  // "you'd already entered real customers/products before testing began"
  // (counters match the real remaining count, same approach as seed.js).
  const counterKeys = [
    { key: 'customer', model: Customer },
    { key: 'supplier', model: Supplier },
    { key: 'product', model: Product },
    { key: 'batch', model: ProductBatch },
  ];
  for (const { key, model } of counterKeys) {
    const remaining = await model.countDocuments({});
    await Counter.findOneAndUpdate({ key }, { $set: { value: remaining } }, { upsert: true });
    console.log(`[cleanup] Counter '${key}' reset to ${remaining} (matches remaining real documents)`);
  }

  console.log('\n[cleanup] Done. Your Company profile and admin User login were not touched.');
  console.log('[cleanup] Log in once more and confirm the Dashboard/lists show only what you expect before going live.');

  await mongoose.disconnect();
}

run().catch((err) => { console.error('[cleanup] Failed:', err); process.exit(1); });
