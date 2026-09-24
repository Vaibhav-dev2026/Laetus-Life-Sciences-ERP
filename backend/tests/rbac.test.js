require('./setup');
const request = require('supertest');
const app = require('../src/app');
const { seedBaseData } = require('./helpers');

async function loginAs(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken;
}

describe('Authorization (RBAC)', () => {
  // This app is single-admin now (see Part 2 of the implementation plan) —
  // every account has role 'Admin' and per-module role gating was removed.
  // The only remaining authorization boundary is "authenticated or not".
  test('any authenticated user (single-admin app) can cancel a purchase', async () => {
    await seedBaseData();
    const token = await loginAs('billing@test.dev');
    const res = await request(app).patch('/api/purchases/PUR-000001/cancel').set('Authorization', `Bearer ${token}`).send({ reason: 'test' });
    expect(res.status).not.toBe(403);
  });

  test('Admin is allowed to create a customer', async () => {
    await seedBaseData();
    const token = await loginAs('admin@test.dev');
    const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({ partyName: 'New Customer', mobile: '9876500000' });
    expect(res.status).toBe(201);
  });

  test('Unauthenticated request to a protected API returns 401 not 403', async () => {
    const res = await request(app).delete('/api/purchases/PUR-000001');
    expect(res.status).toBe(401);
  });

  test('Invalid/expired token returns 401, never silently falls through', async () => {
    const res = await request(app).get('/api/customers').set('Authorization', 'Bearer garbage-token');
    expect(res.status).toBe(401);
  });
});
