require('./setup');
const request = require('supertest');
const app = require('../src/app');
const { seedBaseData } = require('./helpers');

async function loginAs(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken;
}

async function createSale(app, qty = 10, rate = 100, gstRate = 0) {
  const billingToken = await loginAs('billing@test.dev');
  const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${billingToken}`).send({
    customerId: 'CUST-000001', date: '2026-08-22',
    lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', qty, rate, gstRate }],
  });
  return res.body.data;
}


describe('Payment logic', () => {
  let token;
  beforeEach(async () => { await seedBaseData(); token = await loginAs('accounts@test.dev'); });

  test('partial payment against an invoice reduces balance correctly', async () => {
    const sale = await createSale(app); // grandTotal 1000
    const res = await request(app).post('/api/payments').set('Authorization', `Bearer ${token}`).send({
      partyId: 'CUST-000001', partyType: 'Customer', invoiceId: sale.id, amount: 400, mode: 'Cash', date: '2026-08-22',
    });
    expect(res.status).toBe(201);
    const { Sale } = require('../src/models');
    const updated = await Sale.findOne({ id: sale.id });
    expect(updated.balance).toBeCloseTo(600);
    expect(updated.paymentStatus).toBe('Partial');
  });

  test('overpayment beyond outstanding is rejected', async () => {
    const sale = await createSale(app); // grandTotal 1000
    const res = await request(app).post('/api/payments').set('Authorization', `Bearer ${token}`).send({
      partyId: 'CUST-000001', partyType: 'Customer', invoiceId: sale.id, amount: 5000, mode: 'Cash', date: '2026-08-22',
    });
    expect(res.status).toBe(400);
  });

  test('full payment marks invoice Paid', async () => {
    const sale = await createSale(app);
    const res = await request(app).post('/api/payments').set('Authorization', `Bearer ${token}`).send({
      partyId: 'CUST-000001', partyType: 'Customer', invoiceId: sale.id, amount: 1000, mode: 'Cash', date: '2026-08-22',
    });
    expect(res.status).toBe(201);

    const { Sale } = require('../src/models');
    const updated = await Sale.findOne({ id: sale.id });
    expect(updated.paymentStatus).toBe('Paid');
    expect(updated.balance).toBeCloseTo(0);
  });
});
