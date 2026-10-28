# L LAETUS LIFE SCIENCES ERP — PAYMENT & OUTSTANDING RECONCILIATION FIX
## Root Cause Analysis & Technical Remediation Report

**Date:** 2026-10-28  
**Module:** Payments, Sales Receivables, Purchase Payables & Ledger Accounting  
**Status:** Verified & Fully Resolved  

---

## 1. Executive Summary

In L LAETUS LIFE SCIENCES ERP, users reported an accounting defect where recording a customer payment (e.g., ₹4,000 received against an initial ₹10,000 outstanding balance) saved the payment record and updated the customer ledger, yet the **Outstanding Report**, **Customer Details**, and **Receivable dashboards** continued to show the original unreduced invoice balance of ₹10,000.

An exhaustive forensic analysis across frontend components, Express controllers, Mongoose models, and reporting aggregation queries isolated the root causes and implemented an evidence-based, zero-regression fix adhering strictly to statutory Indian pharma ERP accounting standards and double-entry invariants.

---

## 2. Root Cause Analysis

### Root Cause 1: Conditional Invoice Allocation in `payment.controller.js`
In `backend/src/controllers/payment.controller.js`:
- The previous implementation contained an `if (invoiceId)` block that exclusively updated `Sale.amountReceived`, `Sale.balance`, and `Sale.paymentStatus` **only when an explicit `invoiceId` was submitted in the request payload**.
- In typical workflows, users selected "General payment / Advance receipt" (or left the invoice dropdown blank, sending `invoiceId: ""`), or recorded a lump-sum payment intended to cover multiple bills.
- Consequently, when `invoiceId` was empty or omitted:
  1. The `Payment` document was persisted.
  2. The `CustomerLedger` was credited via `postCustomerEntry()`.
  3. **Zero `Sale` documents were updated**.
  4. The underlying `Sale.balance` remained identical to `Sale.grandTotal`, and `Sale.amountReceived` remained `0`.

### Root Cause 2: Outstanding Reporting Derivation from Invoice Documents
The ERP calculates receivables from actual invoice records:
- `backend/src/controllers/outstanding.controller.js` queries `Sale.find({ status: 'Active', balance: { $gt: 0.5 } })`.
- `backend/src/services/reportRows.service.js` builds export rows filtering on `balance: { $gt: 0.5 }`.
- `frontend/src/pages/outstanding/OutstandingReport.jsx` computed invoice balances from `s.grandTotal - (s.amountReceived || 0)`.
Because the `Sale` documents never had their `amountReceived` and `balance` updated upon receiving general payments, every open invoice continued to appear with its initial balance in all Outstanding screens, PDF/Excel/DOCX exports, and dashboard metrics.

### Root Cause 3: Missing Supplier Invoice Allocation in Backend & Frontend UI
- In `frontend/src/pages/payments/PaymentList.jsx`, the invoice dropdown was only rendered when `partyType === 'Customer'`, with no selector whatsoever for `Supplier` purchases.
- In `backend/src/controllers/payment.controller.js`, supplier payments with no `invoiceId` never updated open `Purchase` records.
- In `backend/src/models/Purchase.js`, the schema lacked an explicit `balance` field, causing payables aggregation in `dashboard.controller.js` (`Purchase.aggregate([{ $match: { status: 'Active', balance: { $gt: 0 } } }])`) to silently mismatch actual purchase debt.

### Root Cause 4: Client-Side Re-calculation Drift in Customer Details
- `frontend/src/pages/customers/CustomerDetail.jsx` previously re-summed invoice lines client-side instead of reading the authoritative `Sale.balance` from the server, causing discrepancies with partial receipts and payments.

---

## 3. Architecture & Implementation of the Fix

### A. FIFO Allocation Engine (`backend/src/controllers/payment.controller.js`)
We implemented standard automated FIFO (First-In, First-Out) debt settlement helpers:
1. **`allocateCustomerFifo(partyId, amount, priorityInvoiceId, opts)`**:
   - Queries all active unpaid sales for the party (`status: 'Active', balance: { $gt: 0.009 }`), sorted deterministically by oldest date and creation ID: `{ date: 1, _id: 1 }`.
   - If a specific `priorityInvoiceId` was selected by the user, that invoice is prioritized first.
   - Any remaining balance cascades through the oldest open invoices in FIFO order.
   - For each allocated sale:
     - `sale.amountReceived = round2(sale.amountReceived + applied)`
     - `sale.balance = round2(sale.grandTotal - sale.amountReceived)`
     - `sale.paymentStatus = sale.balance <= 0.009 ? 'Paid' : 'Partial'`
2. **`allocateSupplierFifo(partyId, amount, priorityInvoiceId, opts)`**:
   - Handles supplier purchases in deterministic chronological FIFO order (`{ purchaseDate: 1, _id: 1 }`).
   - Safely accommodates legacy purchase documents where `balance` was unpopulated by dynamically deriving `grandTotal - amountPaid`.
   - Updates `purchase.amountPaid`, `purchase.balance`, and `purchase.paymentStatus`.

### B. Purchase Model Schema Enhancement (`backend/src/models/Purchase.js`)
- Added `balance: { type: Number, default: 0 }` to `Purchase` schema.
- Synchronized `purchase.controller.js` in both `create` and `update` actions to initialize and recalculate `balance = round2(grandTotal - amountPaid)`.
- Restored parity with `dashboard.controller.js` payable aggregations.

### C. Frontend Payment & Outstanding UX Overhaul
1. **`PaymentList.jsx`**:
   - Integrated `purchaseApi` hook alongside `saleApi`.
   - Added dynamic invoice dropdowns for both Customers and Suppliers.
   - Updated dropdown labels: `"Auto-allocate FIFO across oldest unpaid invoices / purchases"`.
   - Re-synced both sales and purchases on modal open and submit completion.
2. **`OutstandingReport.jsx` & `CustomerDetail.jsx`**:
   - Switched to server-authoritative `Sale.balance` (with safe backward-compatible fallback for legacy unmigrated records).

---

## 4. Accounting Invariants Maintained

| Invariant | Guarantee |
|---|---|
| **Invoice Balance Integrity** | $\text{Balance} = \text{GrandTotal} - \text{AmountReceived}$ holds across all states. |
| **Ledger Monotonicity** | `CustomerLedger` and `SupplierLedger` remain append-only; historical rows are never mutated. |
| **GST Immutability** | Taxable values, CGST, SGST, IGST, HSN, batch numbers, and line totals on invoices are 100% frozen and untouched by payment operations. |
| **Overpayment Guard** | Server validates payment $\le$ total party outstanding balance before accepting transaction. |
| **Transactional Atomicity** | Allocations, payment creation, ledger posting, and audit logs execute inside atomic MongoDB sessions (`withTransaction`). |
