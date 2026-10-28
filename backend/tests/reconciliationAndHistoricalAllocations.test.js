require('./setup');
const request = require('supertest');
const app = require('../src/app');
const { seedBaseData } = require('./helpers');
const { Sale, Payment, Customer } = require('../src/models');
const { reconcileAllFinancialAllocations, reconcileCustomer } = require('../src/services/reconciliation.service');

async function loginAs(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken;
}

describe('Financial Reconciliation & Historical Receipt Allocation', () => {
  let token;

  beforeEach(async () => {
    await seedBaseData();
    token = await loginAs('admin@test.dev');
  });

  test('Scenario A & B: Unallocated historical payments settle matching invoices to zero', async () => {
    // 1. Create Customer A (Kumar Pharma equivalent)
    const custResA = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ partyName: 'Kumar Pharma Test', mobile: '9876543210', state: 'Gujarat' });
    const custIdA = custResA.body.data.id;

    // Create Invoice for Customer A: ₹3,360
    const saleA = await Sale.create({
      id: 'INV-TEST-000015',
      invoiceNo: 'LLS/26-27/000015',
      date: new Date('2026-09-25'),
      customerId: custIdA,
      grossTotal: 3000,
      discountTotal: 0,
      taxableTotal: 3000,
      cgstTotal: 180,
      sgstTotal: 180,
      igstTotal: 0,
      grandTotal: 3360,
      amountReceived: 0,
      balance: 3360,
      paymentStatus: 'Unpaid',
      financialYear: '26-27',
      status: 'Active',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', batchNo: 'B-01', rate: 150, qty: 20, gstRate: 12, taxableValue: 3000, total: 3360 }],
    });
    expect(saleA.grandTotal).toBe(3360);
    expect(saleA.balance).toBe(3360);

    // Simulate historical payment recorded with blank invoiceId (e.g. legacy PAY-000023)
    const historicalPaymentA = await Payment.create({
      id: 'PAY-HIST-000023',
      partyId: custIdA,
      partyType: 'Customer',
      invoiceId: '',
      amount: 3360,
      mode: 'Cash',
      date: new Date('2026-10-27'),
      reference: 'HIST-CASH-01',
      createdBy: 'Admin',
    });

    // Before reconciliation: sale has balance 3360 and appears in outstanding
    const preRecoSale = await Sale.findOne({ id: saleA.id });
    expect(preRecoSale.balance).toBe(3360);
    expect(preRecoSale.amountReceived).toBe(0);

    // Execute idempotent reconciliation
    const result = await reconcileAllFinancialAllocations();
    expect(result.reconciledCustomers).toBeGreaterThanOrEqual(1);

    // After reconciliation: saleA must be fully settled (balance 0, status Paid)
    const postRecoSale = await Sale.findOne({ id: saleA.id });
    expect(postRecoSale.amountReceived).toBe(3360);
    expect(postRecoSale.balance).toBe(0);
    expect(postRecoSale.paymentStatus).toBe('Paid');

    // Payment document must reflect allocations
    const postRecoPay = await Payment.findOne({ id: historicalPaymentA.id });
    expect(postRecoPay.isAllocated).toBe(true);
    expect(postRecoPay.allocations.length).toBe(1);
    expect(postRecoPay.allocations[0].invoiceId).toBe(saleA.id);
    expect(postRecoPay.allocations[0].appliedAmount).toBe(3360);

    // Outstanding API must NO LONGER return this fully paid invoice
    const outRes = await request(app)
      .get(`/api/outstanding?customerId=${custIdA}`)
      .set('Authorization', `Bearer ${token}`);
    expect(outRes.status).toBe(200);
    const matchingRows = outRes.body.data.rows.filter((r) => r.id === saleA.id);
    expect(matchingRows.length).toBe(0);
  });

  test('Scenario C: Dr Santosh Kumar partial receipt across multiple invoices with exact remaining balance', async () => {
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ partyName: 'Dr Santosh Kumar Test', mobile: '9876543211', state: 'Gujarat' });
    const custId = custRes.body.data.id;

    // Create 4 active sales directly to simulate the scenario invoices:
    // Invoice 1: 3,227.66
    // Invoice 2: 1,461.60
    // Invoice 3: 819.00
    // Invoice 4: 1,260.00
    const s1 = await Sale.create({
      id: 'INV-TEST-000006',
      invoiceNo: 'LLS/26-27/000006',
      date: new Date('2026-09-01'),
      customerId: custId,
      grossTotal: 2881.84,
      discountTotal: 0,
      taxableTotal: 2881.84,
      cgstTotal: 172.91,
      sgstTotal: 172.91,
      igstTotal: 0,
      grandTotal: 3227.66,
      amountReceived: 0,
      balance: 3227.66,
      paymentStatus: 'Unpaid',
      financialYear: '26-27',
      status: 'Active',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', batchNo: 'B-01', rate: 100, qty: 1, gstRate: 12, taxableValue: 2881.84, total: 3227.66 }],
    });

    const s2 = await Sale.create({
      id: 'INV-TEST-000017',
      invoiceNo: 'LLS/26-27/000017',
      date: new Date('2026-09-05'),
      customerId: custId,
      grossTotal: 1305.00,
      discountTotal: 0,
      taxableTotal: 1305.00,
      cgstTotal: 78.30,
      sgstTotal: 78.30,
      igstTotal: 0,
      grandTotal: 1461.60,
      amountReceived: 0,
      balance: 1461.60,
      paymentStatus: 'Unpaid',
      financialYear: '26-27',
      status: 'Active',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', batchNo: 'B-01', rate: 100, qty: 1, gstRate: 12, taxableValue: 1305.00, total: 1461.60 }],
    });

    const s3 = await Sale.create({
      id: 'INV-TEST-000027',
      invoiceNo: 'LLS/26-27/000027',
      date: new Date('2026-09-10'),
      customerId: custId,
      grossTotal: 731.25,
      discountTotal: 0,
      taxableTotal: 731.25,
      cgstTotal: 43.875,
      sgstTotal: 43.875,
      igstTotal: 0,
      grandTotal: 819.00,
      amountReceived: 0,
      balance: 819.00,
      paymentStatus: 'Unpaid',
      financialYear: '26-27',
      status: 'Active',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', batchNo: 'B-01', rate: 100, qty: 1, gstRate: 12, taxableValue: 731.25, total: 819.00 }],
    });

    const s4 = await Sale.create({
      id: 'INV-TEST-000040',
      invoiceNo: 'LLS/26-27/000040',
      date: new Date('2026-09-15'),
      customerId: custId,
      grossTotal: 1125.00,
      discountTotal: 0,
      taxableTotal: 1125.00,
      cgstTotal: 67.50,
      sgstTotal: 67.50,
      igstTotal: 0,
      grandTotal: 1260.00,
      amountReceived: 0,
      balance: 1260.00,
      paymentStatus: 'Unpaid',
      financialYear: '26-27',
      status: 'Active',
      lines: [{ productId: 'PRD-000001', batchId: 'BAT-000001', batchNo: 'B-01', rate: 100, qty: 1, gstRate: 12, taxableValue: 1125.00, total: 1260.00 }],
    });

    // Simulate receipt PAY-000017 of ₹4,688.00 (blank invoiceId)
    await Payment.create({
      id: 'PAY-HIST-000017',
      partyId: custId,
      partyType: 'Customer',
      invoiceId: '',
      amount: 4688.00,
      mode: 'Cash',
      date: new Date('2026-10-09'),
      reference: 'HIST-SANTOSH',
      createdBy: 'Admin',
    });

    // Reconcile
    await reconcileCustomer(custId);

    // Verify exact FIFO allocations:
    // Invoice 1 (3,227.66): fully paid
    const updated1 = await Sale.findOne({ id: s1.id });
    expect(updated1.amountReceived).toBe(3227.66);
    expect(updated1.balance).toBe(0);
    expect(updated1.paymentStatus).toBe('Paid');

    // Invoice 2 (1,461.60): partially paid by 1,460.34, remaining balance exactly 1.26
    const updated2 = await Sale.findOne({ id: s2.id });
    expect(updated2.amountReceived).toBe(1460.34);
    expect(updated2.balance).toBe(1.26);
    expect(updated2.paymentStatus).toBe('Partial');

    // Invoice 3 (819.00): untouched
    const updated3 = await Sale.findOne({ id: s3.id });
    expect(updated3.amountReceived).toBe(0);
    expect(updated3.balance).toBe(819.00);
    expect(updated3.paymentStatus).toBe('Unpaid');

    // Invoice 4 (1,260.00): untouched
    const updated4 = await Sale.findOne({ id: s4.id });
    expect(updated4.amountReceived).toBe(0);
    expect(updated4.balance).toBe(1260.00);
    expect(updated4.paymentStatus).toBe('Unpaid');

    // Verify Outstanding endpoint displays Invoice 2 with 1.26, Invoice 3 with 819, Invoice 4 with 1260
    const outRes = await request(app)
      .get(`/api/outstanding?customerId=${custId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(outRes.status).toBe(200);
    const rows = outRes.body.data.rows;

    // Invoice 1 must NOT be in open rows
    expect(rows.some((r) => r.id === s1.id)).toBe(false);

    // Invoice 2 must be present with balance 1.26
    const row2 = rows.find((r) => r.id === s2.id);
    expect(row2).toBeDefined();
    expect(row2.balance).toBe(1.26);
    expect(row2.received).toBe(1460.34);

    // Invoice 3 and 4 must be present with full balances
    const row3 = rows.find((r) => r.id === s3.id);
    expect(row3).toBeDefined();
    expect(row3.balance).toBe(819);

    const row4 = rows.find((r) => r.id === s4.id);
    expect(row4).toBeDefined();
    expect(row4.balance).toBe(1260);

    // Total outstanding for Dr Santosh Kumar = 1.26 + 819 + 1260 = 2080.26
    const totalCustOutstanding = rows.reduce((acc, r) => acc + r.balance, 0);
    expect(Math.round(totalCustOutstanding * 100) / 100).toBe(2080.26);
  });

  test('Idempotency: Repeated reconciliations produce identical state with zero drift', async () => {
    // Run reconciliation 3 times consecutively
    await reconcileAllFinancialAllocations();
    const run1 = await Sale.find({}).lean();

    await reconcileAllFinancialAllocations();
    const run2 = await Sale.find({}).lean();

    await reconcileAllFinancialAllocations();
    const run3 = await Sale.find({}).lean();

    expect(run1.length).toBe(run2.length);
    expect(run2.length).toBe(run3.length);

    for (let i = 0; i < run1.length; i++) {
      expect(run1[i].balance).toBe(run2[i].balance);
      expect(run2[i].balance).toBe(run3[i].balance);
      expect(run1[i].amountReceived).toBe(run2[i].amountReceived);
      expect(run2[i].amountReceived).toBe(run3[i].amountReceived);
    }
  });

  test('Reconcile Admin Endpoint: POST /api/payments/reconcile executes successfully', async () => {
    const res = await request(app)
      .post('/api/payments/reconcile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('reconciledCustomers');
    expect(res.body.data).toHaveProperty('reconciledSuppliers');
  });
});
