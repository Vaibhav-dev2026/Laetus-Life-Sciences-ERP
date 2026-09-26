require('./setup');
const request = require('supertest');
const app = require('../src/app');
const { seedBaseData } = require('./helpers');
const { ProductBatch, Sale, CustomerLedger } = require('../src/models');

async function loginAs(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken;
}

describe('Sales transaction — the flagship flow', () => {
  let token, ctx;
  beforeEach(async () => { ctx = await seedBaseData(); token = await loginAs('billing@test.dev'); });

  test('sale deducts stock from the exact batch and computes correct GST (intra-state)', async () => {
    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
      customerId: 'CUST-000001', date: '2026-08-22',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 10, rate: 80, gstRate: 12, hsn: '30049099' }],
      amountReceived: 0,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.taxableTotal).toBeCloseTo(800);
    expect(res.body.data.cgstTotal).toBeCloseTo(48); // 12% / 2
    expect(res.body.data.sgstTotal).toBeCloseTo(48);
    expect(res.body.data.grandTotal).toBeCloseTo(896);
    expect(res.body.data.invoiceNo).toMatch(/^LLS\//);

    const batch = await ProductBatch.findOne({ id: 'BAT-000001' });
    expect(batch.currentQty).toBe(90); // 100 - 10
  });

  test('invoice numbers are unique across rapid concurrent creates', async () => {
    const makeSale = () => request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
      customerId: 'CUST-000001', date: '2026-08-22',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 1, rate: 80, gstRate: 12, hsn: '30049099' }],
    });
    const [r1, r2, r3] = await Promise.all([makeSale(), makeSale(), makeSale()]);
    const numbers = [r1, r2, r3].map((r) => r.body.data.invoiceNo);
    expect(new Set(numbers).size).toBe(3);
  });

  test('insufficient stock is rejected', async () => {
    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
      customerId: 'CUST-000001', date: '2026-08-22',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 9999, rate: 80, gstRate: 12 }],
    });
    expect(res.status).toBe(400);
    const batch = await ProductBatch.findOne({ id: 'BAT-000001' });
    expect(batch.currentQty).toBe(100); // unchanged — no partial mutation
  });

  test('expired batch is blocked when policy is Block', async () => {
    const { Company } = require('../src/models');
    await Company.updateOne({}, { $set: { 'invoice.expiryPolicy': 'Block' } });
    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
      customerId: 'CUST-000001', date: '2026-08-22',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000002', qty: 1, rate: 80, gstRate: 12 }],
    });
    expect(res.status).toBe(400);
  });

  test('partial payment sets Partial status and correct balance', async () => {
    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
      customerId: 'CUST-000001', date: '2026-08-22',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 10, rate: 100, gstRate: 0 }],
      amountReceived: 400,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.grandTotal).toBeCloseTo(1000);
    expect(res.body.data.balance).toBeCloseTo(600);
    expect(res.body.data.paymentStatus).toBe('Partial');
  });

  test('full payment sets Paid status with zero balance', async () => {
    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
      customerId: 'CUST-000001', date: '2026-08-22',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 10, rate: 100, gstRate: 0 }],
      amountReceived: 1000,
    });
    expect(res.body.data.paymentStatus).toBe('Paid');
    expect(res.body.data.balance).toBeCloseTo(0);
  });

  test('rejects a negative or zero quantity sale line (data-integrity guard)', async () => {
    const negative = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
      customerId: 'CUST-000001', date: '2026-08-22',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: -3, rate: 80, gstRate: 12 }],
    });
    expect(negative.status).toBe(400);

    const zero = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
      customerId: 'CUST-000001', date: '2026-08-22',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 0, rate: 80, gstRate: 12 }],
    });
    expect(zero.status).toBe(400);

    // Confirm the batch was never touched (this is the exact scenario that
    // used to silently INCREASE stock via decreaseStock(qty: -3)).
    const batch = await ProductBatch.findOne({ id: 'BAT-000001' });
    expect(batch.currentQty).toBe(100); // unchanged from seed
  });

  test('rejects a negative rate sale line', async () => {
    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
      customerId: 'CUST-000001', date: '2026-08-22',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 5, rate: -80, gstRate: 12 }],
    });
    expect(res.status).toBe(400);
  });

  test('customer ledger entry is created for the sale', async () => {
    await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
      customerId: 'CUST-000001', date: '2026-08-22',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 5, rate: 80, gstRate: 12 }],
    });
    const entries = await CustomerLedger.find({ partyId: 'CUST-000001', type: 'Sale' });
    expect(entries.length).toBe(1);
    expect(entries[0].debit).toBeGreaterThan(0);
  });

  test('pharmaceutical line fields (Pack, HSN, MRP, PTR, Free Qty) are saved and reloaded accurately', async () => {
    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
      customerId: 'CUST-000001',
      date: '2026-08-24',
      lines: [
        {
          productId: 'PRD-000001',
          productName: 'Test Medicine',
          pack: '10x10 Tablets',
          mfg: 'Cadila Ph.',
          batchId: 'BAT-000001',
          batchNo: 'B1',
          expDate: '2027-08-24',
          hsn: '30049099',
          mrp: 120,
          ptr: 80,
          rate: 70, // distinct from MRP (120) and PTR (80)
          qty: 10,
          freeQty: 2, // 2 free units
          discountPct: 5,
          gstRate: 12,
        },
      ],
      amountReceived: 0,
    });

    expect(res.status).toBe(201);
    const saleId = res.body.data.id;

    // Reload via GET /api/sales/:id
    const getRes = await request(app).get(`/api/sales/${saleId}`).set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    const loadedLine = getRes.body.data.lines[0];

    // Verify all pharma fields
    expect(loadedLine.productName).toBe('Test Medicine');
    expect(loadedLine.pack).toBe('10x10 Tablets');
    expect(loadedLine.mfg).toBe('Cadila Ph.');
    expect(loadedLine.batchNo).toBe('B1');
    expect(loadedLine.hsn).toBe('30049099');
    expect(loadedLine.mrp).toBe(120);
    expect(loadedLine.ptr).toBe(80);
    expect(loadedLine.rate).toBe(70); // rate used for billing is 70, not MRP (120)
    expect(loadedLine.qty).toBe(10);
    expect(loadedLine.freeQty).toBe(2);
    expect(loadedLine.discountPct).toBe(5);
    expect(loadedLine.gstRate).toBe(12);

    // Math verification: Gross = 10 * 70 = 700, 5% disc = 35, Taxable = 665, 12% GST = 79.8 (CGST 39.9, SGST 39.9), Total = 744.8
    expect(loadedLine.taxableValue).toBeCloseTo(665);
    expect(loadedLine.cgst).toBeCloseTo(39.9);
    expect(loadedLine.sgst).toBeCloseTo(39.9);
    expect(loadedLine.total).toBeCloseTo(744.8);

    // Stock verification: Batch stock decreased by qty (10) + freeQty (2) = 12
    const batch = await ProductBatch.findOne({ id: 'BAT-000001' });
    expect(batch.currentQty).toBe(88); // 100 - 12
  });

  test('sale request-key idempotency correctly handles retries, new sales, and payload conflicts', async () => {
    const key = 'IDEM-SALE-TEST-999';
    const payload1 = {
      customerId: 'CUST-000001', date: '2026-08-24',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', batchNo: 'B1', qty: 5, rate: 100, gstRate: 12 }],
      amountReceived: 0,
    };

    // 1. Initial request with idempotency key
    const res1 = await request(app).post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .set('x-idempotency-key', key)
      .send(payload1);
    expect(res1.status).toBe(201);
    const createdId = res1.body.data.id;

    // 2. Retry request with SAME idempotency key -> returns existing sale without creating duplicate
    const res2 = await request(app).post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .set('x-idempotency-key', key)
      .send(payload1);
    expect(res2.status).toBe(200);
    expect(res2.body.data.id).toBe(createdId);

    // 3. Different idempotency key with SAME customer and SAME total -> allowed as a NEW sale
    const payload2 = {
      customerId: 'CUST-000001', date: '2026-08-24',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', batchNo: 'B1', qty: 5, rate: 100, gstRate: 12 }],
      amountReceived: 0,
    };
    const res3 = await request(app).post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .set('x-idempotency-key', 'IDEM-SALE-TEST-888')
      .send(payload2);
    expect(res3.status).toBe(201);
    expect(res3.body.data.id).not.toBe(createdId);

    // 4. Same idempotency key with CONFLICTING payload -> returns 409 Conflict
    const conflictingPayload = {
      customerId: 'CUST-000001', date: '2026-08-24',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', batchNo: 'B1', qty: 50, rate: 100, gstRate: 12 }],
      amountReceived: 0,
    };
    const res4 = await request(app).post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .set('x-idempotency-key', key)
      .send(conflictingPayload);
    expect(res4.status).toBe(409);
  });
});

