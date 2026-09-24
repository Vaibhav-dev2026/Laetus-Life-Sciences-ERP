require('./setup');
const { calcLine, calcDocumentTotals, isInterState } = require('../src/services/gstCalculation.service');
const request = require('supertest');
const app = require('../src/app');
const { seedBaseData } = require('./helpers');

async function loginAs(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken;
}

describe('Authoritative GST Calculation & Rate Engine', () => {
  test('Rate 10, Qty 10, GST 5% (Intra-state) produces Gross 100, GST 5, CGST 2.50, SGST 2.50, Total 105', () => {
    const line = calcLine({ qty: 10, rate: 10, discountPct: 0, gstRate: 5, isInterState: false });
    expect(line.gross).toBe(100);
    expect(line.discountAmt).toBe(0);
    expect(line.taxableValue).toBe(100);
    expect(line.gstAmount).toBe(5);
    expect(line.cgst).toBe(2.5);
    expect(line.sgst).toBe(2.5);
    expect(line.igst).toBe(0);
    expect(line.total).toBe(105);
  });

  test('Changing rate from 10 to 20 immediately recalculates without leftover tax', () => {
    // Initial rate 10
    const initial = calcLine({ qty: 10, rate: 10, discountPct: 0, gstRate: 5, isInterState: false });
    expect(initial.total).toBe(105);

    // Rate changed to 20
    const updated = calcLine({ qty: 10, rate: 20, discountPct: 0, gstRate: 5, isInterState: false });
    expect(updated.gross).toBe(200);
    expect(updated.discountAmt).toBe(0);
    expect(updated.taxableValue).toBe(200);
    expect(updated.gstAmount).toBe(10);
    expect(updated.cgst).toBe(5);
    expect(updated.sgst).toBe(5);
    expect(updated.igst).toBe(0);
    expect(updated.total).toBe(210);
  });

  test('Reference invoice sanity check: Taxable ₹880, GST 5%, CGST ₹22, SGST ₹22, Grand Total ₹924', () => {
    // 10 units at rate 88 = 880 taxable, 5% GST = 44 (CGST 22 + SGST 22) => Total 924
    const line = calcLine({ qty: 10, rate: 88, discountPct: 0, gstRate: 5, isInterState: false });
    expect(line.gross).toBe(880);
    expect(line.taxableValue).toBe(880);
    expect(line.gstAmount).toBe(44);
    expect(line.cgst).toBe(22);
    expect(line.sgst).toBe(22);
    expect(line.igst).toBe(0);
    expect(line.total).toBe(924);

    const docTotals = calcDocumentTotals([line]);
    expect(docTotals.taxableTotal).toBe(880);
    expect(docTotals.cgstTotal).toBe(22);
    expect(docTotals.sgstTotal).toBe(22);
    expect(docTotals.igstTotal).toBe(0);
    expect(docTotals.grandTotal).toBe(924);
  });

  test('Inter-state supply allocates full GST to IGST and 0 to CGST/SGST', () => {
    const line = calcLine({ qty: 10, rate: 10, discountPct: 0, gstRate: 5, isInterState: true });
    expect(line.gross).toBe(100);
    expect(line.taxableValue).toBe(100);
    expect(line.gstAmount).toBe(5);
    expect(line.cgst).toBe(0);
    expect(line.sgst).toBe(0);
    expect(line.igst).toBe(5);
    expect(line.total).toBe(105);
  });

  test('Discount is deducted from gross BEFORE computing GST', () => {
    // Gross: 10 * 100 = 1000, 10% discount = 100, Taxable: 900, 18% GST = 162 (CGST 81, SGST 81), Total = 1062
    const line = calcLine({ qty: 10, rate: 100, discountPct: 10, gstRate: 18, isInterState: false });
    expect(line.gross).toBe(1000);
    expect(line.discountAmt).toBe(100);
    expect(line.taxableValue).toBe(900);
    expect(line.gstAmount).toBe(162);
    expect(line.cgst).toBe(81);
    expect(line.sgst).toBe(81);
    expect(line.total).toBe(1062);
  });

  test('Backend recomputes final sales invoice values on create via API', async () => {
    await seedBaseData();
    const token = await loginAs('billing@test.dev');

    // Create invoice with Rate 10, Qty 10, GST 5%
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: 'CUST-000001',
        date: '2026-08-24',
        lines: [
          {
            productId: 'PRD-000001',
            batchId: 'BAT-000001',
            qty: 10,
            rate: 10,
            discountPct: 0,
            gstRate: 5,
            hsn: '30049099',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.taxableTotal).toBe(100);
    expect(res.body.data.cgstTotal).toBe(2.5);
    expect(res.body.data.sgstTotal).toBe(2.5);
    expect(res.body.data.igstTotal).toBe(0);
    expect(res.body.data.grandTotal).toBe(105);
  });
});
