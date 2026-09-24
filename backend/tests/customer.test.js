require('./setup');
const request = require('supertest');
const app = require('../src/app');
const { seedBaseData } = require('./helpers');

async function loginAs(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken;
}

describe('Customer CRUD', () => {
  let token;
  beforeEach(async () => { await seedBaseData(); token = await loginAs('admin@test.dev'); });

  test('create customer', async () => {
    const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({ partyName: 'Test Store', mobile: '9876500001' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toMatch(/^CUST-/);
  });

  test('reject invalid mobile', async () => {
    const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({ partyName: 'Bad Mobile', mobile: '12345' });
    expect(res.status).toBe(400);
  });

  test('reject invalid GSTIN', async () => {
    const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({ partyName: 'Bad GSTIN', mobile: '9876500002', gstin: 'INVALIDGSTIN' });
    expect(res.status).toBe(400);
  });

  test('list and read customer', async () => {
    const listRes = await request(app).get('/api/customers').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    const getRes = await request(app).get('/api/customers/CUST-000001').set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe('CUST-000001');
  });

  test('deactivate customer', async () => {
    const res = await request(app).patch('/api/customers/CUST-000001/status').set('Authorization', `Bearer ${token}`).send({ status: 'Inactive' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Inactive');
  });

  test('reject duplicate customer ID (409 conflict)', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 'CUST-000001', partyName: 'Devam Store Copy', mobile: '9825512345' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('A customer with ID "CUST-000001" already exists.');
  });
});
