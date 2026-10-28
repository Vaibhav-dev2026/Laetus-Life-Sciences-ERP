require('./setup');
const request = require('supertest');
const app = require('../src/app');
const { seedBaseData } = require('./helpers');

async function loginAs(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken;
}

async function createSale(app, qty = 10, rate = 100, gstRate = 0, date = '2026-08-22') {
  const billingToken = await loginAs('billing@test.dev');
  const res = await request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${billingToken}`)
    .send({
      customerId: 'CUST-000001',
      date,
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty, rate, gstRate }],
    });
  return res.body.data;
}

async function createPurchase(app, qty = 10, rate = 100, gstRate = 0, purchaseDate = '2026-08-22') {
  const purchaseToken = await loginAs('purchase@test.dev');
  const res = await request(app)
    .post('/api/purchases')
    .set('Authorization', `Bearer ${purchaseToken}`)
    .send({
      supplierId: 'SUPP-000001',
      purchaseDate,
      lines: [{
        productId: 'PRD-000001',
        batchNo: 'B-TEST',
        expDate: '2027-12-31',
        qty,
        rate,
        gstRate,
        mrp: 120,
      }],
    });
  return res.body.data;
}

describe('Payment logic', () => {
  let token;
  beforeEach(async () => { await seedBaseData(); token = await loginAs('accounts@test.dev'); });

  // ------------------------------------------------------------------
  // A. Specific-invoice allocation (original tests)
  // ------------------------------------------------------------------

  test('A1 — partial payment against an invoice reduces balance correctly', async () => {
    const sale = await createSale(app); // grandTotal 1000
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ partyId: 'CUST-000001', partyType: 'Customer', invoiceId: sale.id, amount: 400, mode: 'Cash', date: '2026-08-22' });
    expect(res.status).toBe(201);
    const { Sale } = require('../src/models');
    const updated = await Sale.findOne({ id: sale.id });
    expect(updated.balance).toBeCloseTo(600);
    expect(updated.paymentStatus).toBe('Partial');
  });

  test('A2 — overpayment beyond outstanding is rejected', async () => {
    const sale = await createSale(app); // grandTotal 1000
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ partyId: 'CUST-000001', partyType: 'Customer', invoiceId: sale.id, amount: 5000, mode: 'Cash', date: '2026-08-22' });
    expect(res.status).toBe(400);
  });

  test('A3 — full payment marks invoice Paid with zero balance', async () => {
    const sale = await createSale(app);
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ partyId: 'CUST-000001', partyType: 'Customer', invoiceId: sale.id, amount: 1000, mode: 'Cash', date: '2026-08-22' });
    expect(res.status).toBe(201);
    const { Sale } = require('../src/models');
    const updated = await Sale.findOne({ id: sale.id });
    expect(updated.paymentStatus).toBe('Paid');
    expect(updated.balance).toBeCloseTo(0);
  });

  // ------------------------------------------------------------------
  // B. FIFO general payment (no invoiceId) — customer
  // ------------------------------------------------------------------

  test('B1 — general payment without invoiceId allocates FIFO across open invoices', async () => {
    // Create two sales with distinct dates so FIFO order is deterministic
    // sale1 older (Aug 1) → settled first. sale2 newer (Aug 15).
    const sale1 = await createSale(app, 10, 100, 0, '2026-08-01'); // 1000
    const sale2 = await createSale(app, 5, 100, 0, '2026-08-15');  // 500
    // Pay 1200 — should fully settle sale1 (₹1000) and partially settle sale2 (₹200)
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ partyId: 'CUST-000001', partyType: 'Customer', amount: 1200, mode: 'Cash', date: '2026-08-22' });
    expect(res.status).toBe(201);
    const { Sale } = require('../src/models');
    const updated1 = await Sale.findOne({ id: sale1.id });
    const updated2 = await Sale.findOne({ id: sale2.id });
    expect(updated1.balance).toBeCloseTo(0);
    expect(updated1.paymentStatus).toBe('Paid');
    expect(updated2.balance).toBeCloseTo(300);
    expect(updated2.paymentStatus).toBe('Partial');
  });

  test('B2 — multiple partial receipts correctly reduce balance cumulatively', async () => {
    const sale = await createSale(app, 10, 100, 0); // 1000
    const pay1 = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ partyId: 'CUST-000001', partyType: 'Customer', invoiceId: sale.id, amount: 250, mode: 'Cash', date: '2026-08-22' });
    expect(pay1.status).toBe(201);
    const pay2 = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ partyId: 'CUST-000001', partyType: 'Customer', invoiceId: sale.id, amount: 350, mode: 'Cash', date: '2026-08-22' });
    expect(pay2.status).toBe(201);
    const { Sale } = require('../src/models');
    const updated = await Sale.findOne({ id: sale.id });
    expect(updated.balance).toBeCloseTo(400);
    expect(updated.paymentStatus).toBe('Partial');
  });

  test('B3 — unpaid invoice is untouched when payment is against different invoice', async () => {
    const sale1 = await createSale(app, 10, 100, 0); // 1000
    const sale2 = await createSale(app, 5, 100, 0);  // 500
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ partyId: 'CUST-000001', partyType: 'Customer', invoiceId: sale1.id, amount: 1000, mode: 'Cash', date: '2026-08-22' });
    expect(res.status).toBe(201);
    const { Sale } = require('../src/models');
    const unchanged = await Sale.findOne({ id: sale2.id });
    expect(unchanged.balance).toBeCloseTo(500);
    expect(unchanged.paymentStatus).toBe('Unpaid');
  });

  // ------------------------------------------------------------------
  // C. Supplier payment FIFO allocation
  // ------------------------------------------------------------------

  test('C1 — supplier payment without invoiceId allocates FIFO across open purchases', async () => {
    // Use distinct dates so FIFO sort is deterministic
    const pur1 = await createPurchase(app, 10, 100, 0, '2026-08-01'); // grandTotal 1000
    const pur2 = await createPurchase(app, 5, 100, 0, '2026-08-15');  // grandTotal 500
    // Pay 1300: should fully settle pur1 (₹1000) and partially settle pur2 (₹300)
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ partyId: 'SUPP-000001', partyType: 'Supplier', amount: 1300, mode: 'Bank Transfer', date: '2026-08-22' });
    expect(res.status).toBe(201);
    const { Purchase } = require('../src/models');
    const updated1 = await Purchase.findOne({ id: pur1.id });
    const updated2 = await Purchase.findOne({ id: pur2.id });
    expect(updated1.balance).toBeCloseTo(0);
    expect(updated1.paymentStatus).toBe('Paid');
    expect(updated2.balance).toBeCloseTo(200);
    expect(updated2.paymentStatus).toBe('Partial');
  });

  test('C2 — supplier payment with specific invoiceId reduces only that purchase', async () => {
    const pur1 = await createPurchase(app, 10, 100, 0); // 1000
    const pur2 = await createPurchase(app, 5, 100, 0);  // 500
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ partyId: 'SUPP-000001', partyType: 'Supplier', invoiceId: pur2.id, amount: 300, mode: 'Cash', date: '2026-08-22' });
    expect(res.status).toBe(201);
    const { Purchase } = require('../src/models');
    const updated1 = await Purchase.findOne({ id: pur1.id });
    const updated2 = await Purchase.findOne({ id: pur2.id });
    expect(updated1.balance).toBeCloseTo(1000); // unchanged
    expect(updated2.balance).toBeCloseTo(200);
    expect(updated2.paymentStatus).toBe('Partial');
  });

  // ------------------------------------------------------------------
  // D. GST values are never altered by payment operations
  // ------------------------------------------------------------------

  test('D1 — GST totals on invoice are unchanged before and after payment', async () => {
    const sale = await createSale(app, 10, 100, 12); // 12% GST
    const { Sale } = require('../src/models');
    const before = await Sale.findOne({ id: sale.id });
    const cgstBefore = before.cgstTotal;
    const sgstBefore = before.sgstTotal;
    const grandBefore = before.grandTotal;
    await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ partyId: 'CUST-000001', partyType: 'Customer', invoiceId: sale.id, amount: 560, mode: 'Cash', date: '2026-08-22' });
    const after = await Sale.findOne({ id: sale.id });
    expect(after.cgstTotal).toBeCloseTo(cgstBefore);
    expect(after.sgstTotal).toBeCloseTo(sgstBefore);
    expect(after.grandTotal).toBeCloseTo(grandBefore);
  });
});
