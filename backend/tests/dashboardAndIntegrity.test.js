require('./setup');
const request = require('supertest');
const dayjs = require('dayjs');
const app = require('../src/app');
const { seedBaseData } = require('./helpers');
const { Customer, Supplier, Product, ProductBatch, Sale, Purchase, Payment, Notification } = require('../src/models');
const { syncSystemNotifications } = require('../src/services/notification.service');

async function loginAs(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken;
}

describe('Dashboard, Outstanding & Inventory Integrity', () => {
  let adminToken;
  let billingToken;
  let purchaseToken;
  let accountsToken;

  beforeEach(async () => {
    await seedBaseData();
    adminToken = await loginAs('admin@test.dev');
    billingToken = await loginAs('billing@test.dev');
    purchaseToken = await loginAs('purchase@test.dev');
    accountsToken = await loginAs('accounts@test.dev');
  });

  // =========================================================================
  // 1. Customer Opening Balance in Outstanding & Payment Settlement
  // =========================================================================
  test('Customer with opening balance appears in Outstanding and settles to zero upon payment', async () => {
    // Create customer with ₹10,000 opening outstanding
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        partyName: 'Kumar Pharma Demo',
        type: 'Medical Store',
        mobile: '9876500001',
        stateCode: '24',
        openingOutstanding: 10000,
      });
    expect(custRes.status).toBe(201);
    const custId = custRes.body.data.id;

    // 1. Initial Outstanding check
    const outRes1 = await request(app)
      .get(`/api/outstanding?customerId=${custId}`)
      .set('Authorization', `Bearer ${accountsToken}`);
    expect(outRes1.status).toBe(200);
    const rows1 = outRes1.body.data.rows;
    expect(rows1.length).toBe(1);
    expect(rows1[0].billNo).toBe('OPENING');
    expect(rows1[0].billAmount).toBe(10000);
    expect(rows1[0].balance).toBe(10000);
    expect(rows1[0].received).toBe(0);

    // 2. Pay ₹4,000
    const pay1 = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${accountsToken}`)
      .send({
        partyId: custId,
        partyType: 'Customer',
        amount: 4000,
        mode: 'Cash',
        date: dayjs().format('YYYY-MM-DD'),
      });
    expect(pay1.status).toBe(201);

    // 3. Outstanding check after ₹4,000 payment -> remaining balance should be ₹6,000
    const outRes2 = await request(app)
      .get(`/api/outstanding?customerId=${custId}`)
      .set('Authorization', `Bearer ${accountsToken}`);
    expect(outRes2.status).toBe(200);
    const rows2 = outRes2.body.data.rows;
    expect(rows2.length).toBe(1);
    expect(rows2[0].billAmount).toBe(10000);
    expect(rows2[0].received).toBe(4000);
    expect(rows2[0].balance).toBe(6000);

    // Also check Customer list returns current balance of 6000
    const custListRes = await request(app)
      .get(`/api/customers/${custId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(custListRes.status).toBe(200);
    expect(custListRes.body.data.currentBalance).toBe(6000);

    // 4. Pay remaining ₹6,000
    const pay2 = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${accountsToken}`)
      .send({
        partyId: custId,
        partyType: 'Customer',
        amount: 6000,
        mode: 'Bank Transfer',
        date: dayjs().format('YYYY-MM-DD'),
      });
    expect(pay2.status).toBe(201);

    // 5. Customer should now have ₹0 balance and be completely removed from Outstanding!
    const outRes3 = await request(app)
      .get(`/api/outstanding?customerId=${custId}`)
      .set('Authorization', `Bearer ${accountsToken}`);
    expect(outRes3.status).toBe(200);
    expect(outRes3.body.data.rows.length).toBe(0);

    const custFinal = await request(app)
      .get(`/api/customers/${custId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(custFinal.body.data.currentBalance).toBe(0);
  });

  // =========================================================================
  // 2. Dashboard Monthly Sales & Purchase Today Verification
  // =========================================================================
  test('Dashboard calculates true Monthly Sales (current month) and Purchase Today', async () => {
    const today = dayjs().format('YYYY-MM-DD');
    const earlierMonth = dayjs().subtract(2, 'month').format('YYYY-MM-DD');

    // 1. Create a sale today of ₹1,000
    await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${billingToken}`)
      .send({
        customerId: 'CUST-000001',
        date: today,
        lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 10, rate: 100, gstRate: 0 }],
      });

    // 2. Create a purchase today of ₹500
    await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${purchaseToken}`)
      .send({
        supplierId: 'SUPP-000001',
        purchaseDate: today,
        lines: [{ productId: 'PRD-000001', batchNo: 'B-TODAY', expDate: '2028-01-01', qty: 5, rate: 100, gstRate: 0, mrp: 120 }],
      });

    // 3. Create a purchase from 2 months ago of ₹2,000
    await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${purchaseToken}`)
      .send({
        supplierId: 'SUPP-000001',
        purchaseDate: earlierMonth,
        lines: [{ productId: 'PRD-000001', batchNo: 'B-OLD', expDate: '2028-01-01', qty: 20, rate: 100, gstRate: 0, mrp: 120 }],
      });

    // Fetch dashboard summary
    const dashRes = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dashRes.status).toBe(200);
    const d = dashRes.body.data;

    // Sales Today should be 1000
    expect(d.salesToday).toBe(1000);
    // Monthly Sales should be 1000 (only current month, not all-time)
    expect(d.monthlySales).toBe(1000);
    // Purchase Today should be strictly today's 500, NOT 2500!
    expect(d.purchaseToday).toBe(500);
    // Total Purchases should be 2500
    expect(d.totalPurchases).toBe(2500);
  });

  // =========================================================================
  // 3. Reliable Low Stock and Out of Stock Notifications
  // =========================================================================
  test('Product-level low-stock and out-of-stock alerts trigger and deduplicate accurately', async () => {
    // Create product with reorderLevel 15
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'TEST-STOCK-1',
        name: 'Stock Test Syrup',
        hsn: '30049099',
        gstRate: 12,
        mrp: 150,
        saleRate: 120,
        purchaseRate: 80,
        reorderLevel: 15,
        minStock: 10,
      });
    expect(prodRes.status).toBe(201);
    const prod = prodRes.body.data;

    // Add initial batch of 20 units via purchase
    await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${purchaseToken}`)
      .send({
        supplierId: 'SUPP-000001',
        purchaseDate: dayjs().format('YYYY-MM-DD'),
        lines: [{ productId: prod.id, batchNo: 'STK-B1', expDate: '2028-01-01', qty: 20, rate: 80, gstRate: 0, mrp: 150 }],
      });

    const batch = await ProductBatch.findOne({ productId: prod.id, batchNo: 'STK-B1' });
    expect(batch.currentQty).toBe(20);

    // Sync notifications — 20 units > threshold 15, should have NO low stock notification
    await syncSystemNotifications();
    const notifs1 = await Notification.find({ message: new RegExp(prod.name, 'i'), read: false });
    expect(notifs1.length).toBe(0);

    // Sell 10 units -> stock becomes 10 (<= reorderLevel 15) -> triggers Low Stock alert
    await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${billingToken}`)
      .send({
        customerId: 'CUST-000001',
        date: dayjs().format('YYYY-MM-DD'),
        lines: [{ productId: prod.id, batchId: batch.id, qty: 10, rate: 120, gstRate: 0 }],
      });

    const notifs2 = await Notification.find({ message: new RegExp(prod.name, 'i'), read: false });
    expect(notifs2.length).toBe(1);
    expect(notifs2[0].type).toBe('Low Stock');

    // Multiple sync calls should NOT create duplicate unread notifications
    await syncSystemNotifications();
    await syncSystemNotifications();
    const notifsDupeCheck = await Notification.find({ message: new RegExp(prod.name, 'i'), read: false });
    expect(notifsDupeCheck.length).toBe(1);

    // Sell remaining 10 units -> stock becomes 0 -> triggers Out of Stock alert
    const secondSale = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${billingToken}`)
      .send({
        customerId: 'CUST-000001',
        date: dayjs().format('YYYY-MM-DD'),
        idempotencyKey: 'UNIQUE-SALE-OUT-OF-STOCK',
        lines: [{ productId: prod.id, batchId: batch.id, qty: 10, rate: 120, gstRate: 0 }],
      });
    expect(secondSale.status).toBe(201);

    const notifs3 = await Notification.find({ message: new RegExp(prod.name, 'i'), read: false });
    expect(notifs3.length).toBe(1);
    expect(notifs3[0].type).toBe('Out of Stock');
  });

  // =========================================================================
  // 4. Bill Editing Validation & Integrity
  // =========================================================================
  test('Bill editing rejects customer swap when payment already received', async () => {
    // 1. Create sale for CUST-000001 of ₹1,000
    const saleRes = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${billingToken}`)
      .send({
        customerId: 'CUST-000001',
        date: dayjs().format('YYYY-MM-DD'),
        lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 10, rate: 100, gstRate: 0 }],
      });
    expect(saleRes.status).toBe(201);
    const saleId = saleRes.body.data.id;

    // 2. Customer pays ₹500 against this invoice
    await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${accountsToken}`)
      .send({
        partyId: 'CUST-000001',
        partyType: 'Customer',
        invoiceId: saleId,
        amount: 500,
        mode: 'Cash',
      });

    // 3. Create a second customer
    const cust2 = await Customer.create({ id: 'CUST-000002', partyName: 'Second Cust', mobile: '9876543299', stateCode: '24' });

    // 4. Attempt to edit invoice and switch customer to CUST-000002 -> MUST BE REJECTED!
    const editRes = await request(app)
      .put(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${billingToken}`)
      .send({
        customerId: cust2.id,
        lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 10, rate: 100, gstRate: 0 }],
      });
    expect(editRes.status).toBe(400);
    expect(editRes.body.message).toContain('Cannot change customer');
  });
});
