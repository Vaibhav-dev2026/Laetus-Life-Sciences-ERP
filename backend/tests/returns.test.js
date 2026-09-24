require('./setup');
const request = require('supertest');
const app = require('../src/app');
const { seedBaseData } = require('./helpers');
const { ProductBatch } = require('../src/models');

async function loginAs(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken;
}

describe('Sales & Purchase Returns', () => {
  let token;
  beforeEach(async () => { await seedBaseData(); token = await loginAs('billing@test.dev'); });

  test('sales return increases stock and enforces quantity limit', async () => {
    const saleRes = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({
      customerId: 'CUST-000001', date: '2026-08-22',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty: 10, rate: 80, gstRate: 12 }],
    });
    const sale = saleRes.body.data;

    const overReturn = await request(app).post('/api/returns/sales').set('Authorization', `Bearer ${token}`).send({ saleId: sale.id, lineIndex: 0, qty: 999, reason: 'test' });
    expect(overReturn.status).toBe(400);

    const okReturn = await request(app).post('/api/returns/sales').set('Authorization', `Bearer ${token}`).send({ saleId: sale.id, lineIndex: 0, qty: 4, reason: 'Customer request' });
    expect(okReturn.status).toBe(201);

    const batch = await ProductBatch.findOne({ id: 'BAT-000001' });
    expect(batch.currentQty).toBe(94); // 100 - 10 + 4
  });

  test('purchase return decreases stock and enforces quantity limit', async () => {
    const purToken = await loginAs('purchase@test.dev');
    const purchaseRes = await request(app).post('/api/purchases').set('Authorization', `Bearer ${purToken}`).send({
      purchaseInvoiceNo: 'PI-2001', purchaseDate: '2026-08-01', supplierId: 'SUPP-000001',
      lines: [{ productId: 'PRD-000001', batchNo: 'RETB-1', expDate: '2028-01-01', qty: 30, rate: 50, gstRate: 12 }],
    });
    const purchase = purchaseRes.body.data;

    const overReturn = await request(app).post('/api/returns/purchases').set('Authorization', `Bearer ${purToken}`).send({ purchaseId: purchase.id, lineIndex: 0, qty: 999, reason: 'test' });
    expect(overReturn.status).toBe(400);

    const okReturn = await request(app).post('/api/returns/purchases').set('Authorization', `Bearer ${purToken}`).send({ purchaseId: purchase.id, lineIndex: 0, qty: 10, reason: 'Damaged' });
    expect(okReturn.status).toBe(201);

    const batch = await ProductBatch.findOne({ productId: 'PRD-000001', batchNo: 'RETB-1' });
    expect(batch.currentQty).toBe(20); // 30 - 10
  });
});
