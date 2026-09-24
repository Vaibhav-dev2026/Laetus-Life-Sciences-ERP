require('./setup');
const mongoose = require('mongoose');
const { generateId } = require('../src/utils/idGenerator');
const { Counter, Payment, SalesReturn, PurchaseReturn, Backup, ProductBatch } = require('../src/models');

// These tests exercise idGenerator.generateId directly, at the unit level,
// against the four real Mongoose models it's used for in production — this
// is the exact gap the QA plan called out: Findings 4, 5 and 6 were fixed
// but had zero test coverage, so a future refactor could silently reopen
// any of them without a single red test.

describe('generateId collision protection (Finding 4 & 5)', () => {
  beforeEach(async () => {
    await Counter.deleteMany({});
    await Payment.deleteMany({});
    await SalesReturn.deleteMany({});
    await PurchaseReturn.deleteMany({});
    await Backup.deleteMany({});
    await ProductBatch.deleteMany({});
  });

  test('Payment: skips an existing PAY-000001 and returns PAY-000002 when session+model are passed', async () => {
    await Payment.create({
      id: 'PAY-000001', partyId: 'CUST-000001', partyType: 'Customer', amount: 100, mode: 'Cash', date: new Date(),
    });
    const session = await mongoose.startSession();
    let id;
    await session.withTransaction(async () => {
      id = await generateId('PAY', 'payment', 6, session, Payment);
    });
    await session.endSession();
    expect(id).toBe('PAY-000002'); // proves the collision check actually ran, not just an incrementing counter
  });

  test('SalesReturn: skips an existing SR-000001 and returns SR-000002', async () => {
    await SalesReturn.create({
      id: 'SR-000001', saleId: 'SALE-X', invoiceNo: 'LLS/26-27/0001', customerId: 'CUST-000001',
      productId: 'PRD-000001', batchId: 'BAT-000001', qty: 1, refundAmount: 10,
    });
    const session = await mongoose.startSession();
    let id;
    await session.withTransaction(async () => {
      id = await generateId('SR', 'salesReturn', 6, session, SalesReturn);
    });
    await session.endSession();
    expect(id).toBe('SR-000002');
  });

  test('PurchaseReturn: skips an existing PR-000001 and returns PR-000002', async () => {
    await PurchaseReturn.create({
      id: 'PR-000001', purchaseId: 'PUR-X', purchaseInvoiceNo: 'PI-0001', supplierId: 'SUPP-000001',
      productId: 'PRD-000001', batchId: 'BAT-000001', qty: 1, payableAdjustment: 10,
    });
    const session = await mongoose.startSession();
    let id;
    await session.withTransaction(async () => {
      id = await generateId('PR', 'purchaseReturn', 6, session, PurchaseReturn);
    });
    await session.endSession();
    expect(id).toBe('PR-000002');
  });

  test('Backup: produces a correctly zero-padded, non-colliding ID (Finding 5 argument-order bug)', async () => {
    await Backup.create({ id: 'BKP-000001', fileName: 'backup-1.gz', filePath: '/backups/backup-1.gz', status: 'Completed', triggeredBy: 'Manual' });
    // This mirrors the exact call shape backup.service.js now uses:
    // generateId('BKP', 'backup', 6, null, Backup) — the 3rd argument is
    // padLength, not the model. Before the fix, Backup was passed into the
    // padLength slot, coercing to NaN and producing an unpadded, uncollision-checked ID.
    const id = await generateId('BKP', 'backup', 6, null, Backup);
    expect(id).toBe('BKP-000002');
    expect(id).toMatch(/^BKP-\d{6}$/); // correctly zero-padded, not "BKP-NaN" or similar
  });
});

describe('Counter reinitialization after seeding (Finding 6)', () => {
  test('generateId returns BAT-000005 on the very first call after 4 batches are seeded, not BAT-000001 with wasted retries', async () => {
    // Mirrors exactly what seed.js now does: insert 4 batches with hand-set
    // IDs, then reinitialize the Counter to match — this is the fix for
    // Finding 6. Before the fix, Counter started at 0 after every seed, so
    // the first real generateId('BAT', 'batch', ...) call would collide with
    // BAT-000001 through BAT-000004 in turn before finally landing on
    // BAT-000005 — self-healing, but 4 wasted DB round-trips every time.
    await ProductBatch.insertMany([
      { id: 'BAT-000001', productId: 'PRD-000001', batchNo: 'B1', expDate: new Date('2028-01-01'), mrp: 100, purchaseRate: 40, saleRate: 55, currentQty: 10 },
      { id: 'BAT-000002', productId: 'PRD-000001', batchNo: 'B2', expDate: new Date('2028-01-01'), mrp: 100, purchaseRate: 40, saleRate: 55, currentQty: 10 },
      { id: 'BAT-000003', productId: 'PRD-000002', batchNo: 'B3', expDate: new Date('2028-01-01'), mrp: 100, purchaseRate: 40, saleRate: 55, currentQty: 10 },
      { id: 'BAT-000004', productId: 'PRD-000002', batchNo: 'B4', expDate: new Date('2028-01-01'), mrp: 100, purchaseRate: 40, saleRate: 55, currentQty: 10 },
    ]);
    await Counter.insertMany([{ key: 'batch', value: 4 }]);

    const session = await mongoose.startSession();
    let id;
    let attempts = 0;
    const originalFindOne = ProductBatch.findOne.bind(ProductBatch);
    // Spy: count how many existence-check lookups generateId performs, to
    // prove there were zero wasted collision retries, not just that the
    // final answer happened to be correct.
    ProductBatch.findOne = (...args) => { attempts += 1; return originalFindOne(...args); };
    try {
      await session.withTransaction(async () => {
        id = await generateId('BAT', 'batch', 6, session, ProductBatch);
      });
    } finally {
      ProductBatch.findOne = originalFindOne;
    }
    await session.endSession();

    expect(id).toBe('BAT-000005');
    expect(attempts).toBe(1); // exactly one existence check, zero retries
  });
});
