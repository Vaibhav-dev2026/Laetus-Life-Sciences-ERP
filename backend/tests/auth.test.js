require('./setup');
const request = require('supertest');
const app = require('../src/app');
const { seedBaseData } = require('./helpers');

describe('Auth', () => {
  test('valid login returns token and user', async () => {
    await seedBaseData();
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.dev', password: 'Test@1234' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.role).toBe('Admin');
  });

  test('invalid password is rejected', async () => {
    await seedBaseData();
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.dev', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('missing credentials fail validation', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: '' });
    expect(res.status).toBe(400);
  });

  test('protected route without token returns 401', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
  });

  test('invalid token returns 401', async () => {
    const res = await request(app).get('/api/customers').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('inactive user cannot login', async () => {
    const { User } = require('../src/models');
    await seedBaseData();
    await User.updateOne({ email: 'billing@test.dev' }, { $set: { isActive: false } });
    const res = await request(app).post('/api/auth/login').send({ email: 'billing@test.dev', password: 'Test@1234' });
    expect(res.status).toBe(401);
  });
});
