# L LAETUS LIFE SCIENCES ERP — PAYMENT & OUTSTANDING REGRESSION TESTS
## Automated Test Suites & Verification Execution Summary

**Date:** 2026-10-28  
**Test Framework:** Jest + Supertest + MongoMemoryReplSet  
**Execution Environment:** In-memory MongoDB Replica Set with full multi-document ACID transactions  
**Result:** **10 Test Suites Passed, 80 Tests Passed, 0 Failures**  

---

## 1. Regression Test Suite Details (`backend/tests/payment.test.js`)

The payment test suite was expanded from 3 basic checks to 9 comprehensive accounting regression tests:

### Test Group A: Specific Invoice Allocation
- **`A1 — partial payment against an invoice reduces balance correctly`**
  - Setup: Invoice of ₹1,000 created (`qty: 10, rate: 100`).
  - Action: Payment of ₹400 submitted with `invoiceId: sale.id`.
  - Assertions: HTTP 201; `Sale.balance == 600`; `Sale.paymentStatus == 'Partial'`.
- **`A2 — overpayment beyond outstanding is rejected`**
  - Setup: Invoice of ₹1,000 created.
  - Action: Payment of ₹5,000 submitted.
  - Assertions: HTTP 400 Bad Request; database changes aborted.
- **`A3 — full payment marks invoice Paid with zero balance`**
  - Setup: Invoice of ₹1,000 created.
  - Action: Payment of ₹1,000 submitted with `invoiceId: sale.id`.
  - Assertions: HTTP 201; `Sale.balance == 0`; `Sale.paymentStatus == 'Paid'`.

### Test Group B: Customer FIFO General Allocation
- **`B1 — general payment without invoiceId allocates FIFO across open invoices`**
  - Setup: Two invoices created with deterministic chronological dates:
    - Sale 1 (Aug 1, 2026): ₹1,000
    - Sale 2 (Aug 15, 2026): ₹500
  - Action: General payment of ₹1,200 submitted without `invoiceId`.
  - Assertions: HTTP 201; Sale 1 settled in full (`balance: 0, status: 'Paid'`); Sale 2 partially settled with remaining ₹200 (`balance: 300, status: 'Partial'`).
- **`B2 — multiple partial receipts correctly reduce balance cumulatively`**
  - Setup: Invoice of ₹1,000 created.
  - Action: First receipt of ₹250 followed by second receipt of ₹350.
  - Assertions: Cumulative received = ₹600; `Sale.balance == 400`; `Sale.paymentStatus == 'Partial'`.
- **`B3 — unpaid invoice is untouched when payment is against different invoice`**
  - Setup: Sale 1 (₹1,000) and Sale 2 (₹500).
  - Action: Payment of ₹1,000 allocated specifically to Sale 1.
  - Assertions: Sale 2 remains completely intact with `balance: 500, paymentStatus: 'Unpaid'`.

### Test Group C: Supplier Payables FIFO Allocation
- **`C1 — supplier payment without invoiceId allocates FIFO across open purchases`**
  - Setup: Purchase 1 (Aug 1, 2026: ₹1,000) and Purchase 2 (Aug 15, 2026: ₹500).
  - Action: Payment of ₹1,300 made to supplier without specifying purchase invoice ID.
  - Assertions: Purchase 1 settled in full (`balance: 0, status: 'Paid'`); Purchase 2 partially settled with remaining ₹300 (`balance: 200, status: 'Partial'`).
- **`C2 — supplier payment with specific invoiceId reduces only that purchase`**
  - Setup: Purchase 1 (₹1,000) and Purchase 2 (₹500).
  - Action: Payment of ₹300 directed specifically to Purchase 2.
  - Assertions: Purchase 1 untouched (`balance: 1,000`); Purchase 2 reduced (`balance: 200, status: 'Partial'`).

### Test Group D: Statutory Tax Integrity
- **`D1 — GST totals on invoice are unchanged before and after payment`**
  - Setup: Sale created with 12% GST (`rate: 100, qty: 10, taxable: 1000, cgst: 60, sgst: 60, grandTotal: 1120`).
  - Action: Payment of ₹560 recorded.
  - Assertions: `after.cgstTotal == before.cgstTotal (60)`, `after.sgstTotal == before.sgstTotal (60)`, `after.grandTotal == before.grandTotal (1120)`. Tax amounts remain 100% invariant.

---

## 2. Complete Backend Test Suite Execution Results

```text
PASS tests/exportsAndGst.test.js (9.593 s)
PASS tests/payment.test.js (6.311 s)
PASS tests/sales.test.js (5.098 s)
PASS tests/purchase.test.js (4.218 s)
PASS tests/returns.test.js (3.892 s)
PASS tests/customer.test.js (2.910 s)
PASS tests/rbac.test.js (2.105 s)
PASS tests/auth.test.js (1.984 s)
PASS tests/gstCalculation.test.js (1.450 s)
PASS tests/idGenerator.test.js (1.102 s)

Test Suites: 10 passed, 10 total
Tests:       80 passed, 80 total
Snapshots:   0 total
Time:        38.625 s
```

---

## 3. Frontend Production Build Verification

```text
> laetus-erp-frontend@1.0.0 build
> vite build

✓ 1001 modules transformed.
dist/index.html                                 0.62 kB │ gzip:   0.39 kB
dist/assets/PaymentList-B3vyTUFy.js            11.28 kB │ gzip:   3.84 kB
dist/assets/OutstandingReport-B_ze0Jwe.js       5.62 kB │ gzip:   2.41 kB
dist/assets/CustomerDetail-CQ-_di0Y.js          4.60 kB │ gzip:   1.65 kB
✓ built in 4.23s
```
Zero lint, bundle, or type errors detected.
