/* eslint-disable no-console */
// Development / initial-setup seed script.
//
// SAFETY GUARDS:
// 1. MUST NOT run in production (NODE_ENV=production).
// 2. REQUIRES explicit safety flag ALLOW_DESTRUCTIVE_SEED=true to run.
// 3. REQUIRES explicit SEED_ADMIN_PASSWORD env variable (no fallback passwords).
//
// Usage:
//   ALLOW_DESTRUCTIVE_SEED=true SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD='a-strong-password' npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const env = require('../src/config/env');
const {
  Company, User, Customer, Supplier, Product, ProductBatch, Counter,
} = require('../src/models');

async function run() {
  // 1. Production Safety Guard
  if (process.env.NODE_ENV === 'production' || env.nodeEnv === 'production') {
    console.error('[seed] REFUSING TO RUN: Destructive seeding is strictly forbidden in production (NODE_ENV=production).');
    process.exit(1);
  }

  // 2. Destructive Seed Flag Guard
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    console.error('[seed] REFUSING TO RUN: Destructive seeding requires explicit safety flag ALLOW_DESTRUCTIVE_SEED=true.');
    console.error('[seed] Example: ALLOW_DESTRUCTIVE_SEED=true SEED_ADMIN_PASSWORD="your-strong-password" npm run seed');
    process.exit(1);
  }

  // 3. Admin Password Environment Guard
  if (!env.seedAdminPassword) {
    console.error('[seed] Refusing to run: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (env vars or .env) before seeding.');
    console.error('[seed] Example: ALLOW_DESTRUCTIVE_SEED=true SEED_ADMIN_EMAIL=you@yourcompany.com SEED_ADMIN_PASSWORD="a-strong-password" npm run seed');
    process.exit(1);
  }

  if (env.seedAdminPassword.length < 8) {
    console.error('[seed] SEED_ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  await mongoose.connect(env.mongoUri);
  console.log('[seed] Connected to', env.sanitizedMongoUri);

  await Promise.all([
    Company.deleteMany({}), Customer.deleteMany({}), Supplier.deleteMany({}),
    Product.deleteMany({}), ProductBatch.deleteMany({}), Counter.deleteMany({}),
  ]);

  await Company.create({
    name: 'L LAETUS LIFE SCIENCES',
    addressLine1: '1st Floor, 249 Sukhinagar, Bamroli Gam Road',
    addressLine2: 'Pandesara, Surat – 394221, Gujarat',
    state: 'Gujarat', stateCode: '24', gstin: '24AFSPT7471H1ZR', pan: 'AFSPT7471H',
    phone: '+91 96620 31042', email: 'laetuslifesciences@gmail.com',
    bank: { bankName: 'HDFC Bank Ltd', accountNumber: '00000000000000', ifsc: 'HDFC0000000' },
    invoice: { prefix: 'LLS', numberFormat: 'LLS/{FY}/{SEQ}', financialYearStart: 'April', startNumber: 1001, dueDateDays: 30, expiryPolicy: 'Warn' },
    terms: [
      'Goods once sold will not be taken back or exchanged.',
      'Bills not paid due date will attract 24% interest.',
      'All disputes subject to Surat jurisdiction only.',
    ],
    signatoryLabel: 'for L LAETUS LIFE SCIENCES',
  });
  console.log('[seed] Company created with synthetic demo bank defaults');

  const adminEmail = (env.seedAdminEmail || 'laetuslifesciences@gmail.com').toLowerCase().trim();
  let adminUser = await User.findOne({ email: adminEmail });
  if (!adminUser) {
    const passwordHash = await User.hashPassword(env.seedAdminPassword);
    adminUser = await User.create({ name: 'L LAETUS LIFE SCIENCES', email: adminEmail, role: 'Admin', passwordHash });
    console.log(`[seed] Admin user created: ${adminUser.email}`);
  } else {
    console.log(`[seed] Preserving existing admin user: ${adminUser.email}`);
  }

  const customers = await Customer.insertMany([
    { id: 'CUST-000001', partyName: 'Demo Medical Store', type: 'Medical Store', address: '123 Demo Street', city: 'Surat', state: 'Gujarat', stateCode: '24', pin: '394130', mobile: '9800000001', gstin: '24AAAAA0000A1Z5', paymentTerms: '30 Days', creditLimit: 150000, openingOutstanding: 1869 },
    { id: 'CUST-000002', partyName: 'Demo Multispeciality Clinic', type: 'Clinic', doctorName: 'Dr. Demo Doctor', address: 'Ring Road', city: 'Surat', state: 'Gujarat', stateCode: '24', pin: '395002', mobile: '9800000002', paymentTerms: '15 Days', creditLimit: 75000, openingOutstanding: 22450 },
    { id: 'CUST-000003', partyName: 'QA Healthcare Store', type: 'Medical Store', address: 'Varachha Road', city: 'Surat', state: 'Gujarat', stateCode: '24', pin: '395006', mobile: '9800000003', gstin: '24BBBBB0000B1Z4', paymentTerms: '45 Days', creditLimit: 200000, openingOutstanding: 58200 },
    { id: 'CUST-000004', partyName: 'Demo Sanjeevani Hospital', type: 'Hospital', address: 'Adajan', city: 'Surat', state: 'Gujarat', stateCode: '24', pin: '395009', mobile: '9800000004', gstin: '24CCCCC0000C1Z3', paymentTerms: '60 Days', creditLimit: 500000, openingOutstanding: 134500 },
  ]);
  console.log(`[seed] ${customers.length} synthetic demo customers created`);

  const suppliers = await Supplier.insertMany([
    { id: 'SUPP-000001', company: 'Demo Cadila Pharma Ltd', contact: 'Demo Manager', city: 'Ahmedabad', state: 'Gujarat', stateCode: '24', mobile: '9800000005', gstin: '24DDDDD0000D1Z2', paymentTerms: '45 Days', openingPayable: 212300, bankName: 'ICICI Bank', accountNumber: '000011110001', ifsc: 'ICIC0000000' },
    { id: 'SUPP-000002', company: 'Demo Sun Pharma Distributors', contact: 'Demo Agent', city: 'Ahmedabad', state: 'Gujarat', stateCode: '24', mobile: '9800000006', gstin: '24EEEEE0000E1Z1', paymentTerms: '30 Days', openingPayable: 98750, bankName: 'HDFC Bank', accountNumber: '000022220002', ifsc: 'HDFC0000000' },
  ]);
  console.log(`[seed] ${suppliers.length} synthetic demo suppliers created`);

  const products = await Product.insertMany([
    { id: 'PRD-000001', sku: 'LFN-CRM-30', name: 'L Cream', genericName: 'Fusidic Acid + Ornidazole', manufacturer: 'L Laetus Life Sciences', category: 'Topical', productType: 'Cream', hsn: '30049099', gstRate: 12, unit: 'Tube', pack: '30gm', mrp: 178.13, purchaseRate: 45, saleRate: 55, minStock: 40, reorderLevel: 60 },
    { id: 'PRD-000002', sku: 'MED-A-10', name: 'Medicine A', genericName: 'Paracetamol 500mg', manufacturer: 'Demo Cadila Pharma Ltd', category: 'Tablet', productType: 'Tablet', hsn: '30049023', gstRate: 12, unit: 'Strip', pack: '10 Tab', mrp: 32, purchaseRate: 11, saleRate: 15, minStock: 100, reorderLevel: 150 },
    { id: 'PRD-000003', sku: 'MED-B-15', name: 'Medicine B', genericName: 'Azithromycin 250mg', manufacturer: 'Demo Sun Pharma Distributors', category: 'Tablet', productType: 'Tablet', hsn: '30049023', gstRate: 12, unit: 'Strip', pack: '6 Tab', mrp: 95, purchaseRate: 42, saleRate: 52, minStock: 60, reorderLevel: 90 },
  ]);
  console.log(`[seed] ${products.length} products created`);

  const batches = await ProductBatch.insertMany([
    { id: 'BAT-000001', productId: 'PRD-000001', batchNo: 'GP-250205', mfgDate: dayjs().subtract(6, 'month').toDate(), expDate: dayjs().add(16, 'month').toDate(), mrp: 178.13, purchaseRate: 45, saleRate: 55, currentQty: 210, supplierId: 'SUPP-000001', status: 'Healthy' },
    { id: 'BAT-000002', productId: 'PRD-000002', batchNo: 'PCM-2211', mfgDate: dayjs().subtract(9, 'month').toDate(), expDate: dayjs().add(15, 'month').toDate(), mrp: 32, purchaseRate: 11, saleRate: 15, currentQty: 620, supplierId: 'SUPP-000001', status: 'Healthy' },
    { id: 'BAT-000003', productId: 'PRD-000003', batchNo: 'AZT-1240', mfgDate: dayjs().subtract(8, 'month').toDate(), expDate: dayjs().add(2, 'month').toDate(), mrp: 95, purchaseRate: 42, saleRate: 52, currentQty: 18, supplierId: 'SUPP-000002', status: 'Near Expiry' },
    { id: 'BAT-000004', productId: 'PRD-000003', batchNo: 'AZT-1187', mfgDate: dayjs().subtract(20, 'month').toDate(), expDate: dayjs().subtract(2, 'month').toDate(), mrp: 95, purchaseRate: 42, saleRate: 52, currentQty: 6, supplierId: 'SUPP-000002', status: 'Expired' },
  ]);
  console.log(`[seed] ${batches.length} batches created`);

  for (const p of products) {
    const total = batches.filter((b) => b.productId === p.id).reduce((a, b) => a + b.currentQty, 0);
    await Product.updateOne({ id: p.id }, { $set: { currentStock: total } });
  }

  await Counter.insertMany([
    { key: 'customer', value: customers.length },
    { key: 'supplier', value: suppliers.length },
    { key: 'product', value: products.length },
    { key: 'batch', value: batches.length },
  ]);
  console.log('[seed] Counters reinitialized to match seeded IDs');

  console.log('\n[seed] Done. Sign in with:');
  console.log(`  ${adminUser.email} (password configured in SEED_ADMIN_PASSWORD)`);

  await mongoose.disconnect();
}

run().catch((err) => { console.error('[seed] Failed:', err); process.exit(1); });
