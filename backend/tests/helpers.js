const { User, Customer, Supplier, Product, ProductBatch, Company, Counter } = require('../src/models');
const dayjs = require('dayjs');

async function seedBaseData() {
  await Company.create({ name: 'L LAETUS LIFE SCIENCES', stateCode: '24', gstin: '24AFSPT7471H1ZR', invoice: { numberFormat: 'LLS/{FY}/{SEQ}', expiryPolicy: 'Warn' } });

  const passwordHash = await User.hashPassword('Test@1234');
  // This app is single-admin now — every login has role 'Admin'. These are
  // kept as separate accounts (rather than collapsed to one) purely so
  // existing tests that log in as different emails to exercise different
  // flows don't all need rewriting; they no longer represent different
  // permission levels.
  const admin = await User.create({ name: 'Test Admin', email: 'admin@test.dev', role: 'Admin', passwordHash });
  const billing = await User.create({ name: 'Test Billing', email: 'billing@test.dev', role: 'Admin', passwordHash });
  const purchaseUser = await User.create({ name: 'Test Purchase', email: 'purchase@test.dev', role: 'Admin', passwordHash });
  const accountsUser = await User.create({ name: 'Test Accounts', email: 'accounts@test.dev', role: 'Admin', passwordHash });


  const customer = await Customer.create({ id: 'CUST-000001', partyName: 'Test Customer', mobile: '9876543210', stateCode: '24', openingOutstanding: 0 });
  const supplier = await Supplier.create({ id: 'SUPP-000001', company: 'Test Supplier', mobile: '9876543211', stateCode: '24', openingPayable: 0 });
  const product = await Product.create({ id: 'PRD-000001', sku: 'TEST-SKU-1', name: 'Test Medicine', hsn: '30049099', gstRate: 12, mrp: 100, saleRate: 80, purchaseRate: 50 });
  const batch = await ProductBatch.create({ id: 'BAT-000001', productId: product.id, batchNo: 'B1', expDate: dayjs().add(1, 'year').toDate(), mrp: 100, purchaseRate: 50, saleRate: 80, currentQty: 100, status: 'Healthy' });
  const expiredBatch = await ProductBatch.create({ id: 'BAT-000002', productId: product.id, batchNo: 'B2-EXPIRED', expDate: dayjs().subtract(1, 'month').toDate(), mrp: 100, purchaseRate: 50, saleRate: 80, currentQty: 20, status: 'Expired' });

  // Pre-seed counters so generateId starts from 000002 (since 000001 is already used above)
  await Counter.create({ key: 'customer', value: 1 });
  await Counter.create({ key: 'supplier', value: 1 });
  await Counter.create({ key: 'product', value: 1 });
  await Counter.create({ key: 'batch', value: 2 });

  return { admin, billing, customer, supplier, product, batch, expiredBatch };
}

module.exports = { seedBaseData };

