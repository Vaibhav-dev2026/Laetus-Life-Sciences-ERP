# DATABASE SCHEMA — Laetus Life Sciences ERP

MongoDB via Mongoose. Single-company ERP: exactly one `Company` document.

## Collections

| Model | Key fields | Indexes |
|---|---|---|
| **Company** | name, gstin, stateCode, invoice{prefix,numberFormat,expiryPolicy}, bank, terms | singleton (no unique index needed — app reads the first doc) |
| **User** | name, email, passwordHash (bcrypt), role, isActive | `email` unique |
| **Customer** | id (CUST-000001), partyName, type, gstin, mobile, openingOutstanding, status | `id` unique, text index on partyName/doctorName/organization/mobile |
| **Supplier** | id (SUPP-000001), company, gstin, mobile, openingPayable, status | `id` unique, text index |
| **Product** | id (PRD-000001), sku, hsn, gstRate, mrp, saleRate, currentStock (denormalized) | `id` unique, `sku` unique, text index |
| **ProductBatch** | id (BAT-000001), productId, batchNo, expDate, currentQty, status | `id` unique, **`(productId, batchNo)` unique compound**, `expDate` |
| **Purchase** | id (PUR-000001), purchaseInvoiceNo, supplierId, lines[], grandTotal, paymentStatus, financialYear | `id` unique, `(supplierId, purchaseDate)` |
| **Sale** | id (INV-000001), invoiceNo, customerId, lines[] (each with exact `batchId`), grandTotal, balance, paymentStatus, financialYear | `id` unique, **`invoiceNo` unique**, `(customerId, date)`, `financialYear` |
| **SalesReturn** | id (SR-000001), saleId, productId, batchId, qty, refundAmount | `id` unique |
| **PurchaseReturn** | id (PR-000001), purchaseId, productId, batchId, qty, payableAdjustment | `id` unique |
| **Payment** | id (PAY-000001), partyId, partyType, invoiceId?, amount, mode, date | `id` unique, `(partyId, date)` |
| **Expense** | id (EXP-000001), date, category, amount, status | `id` unique |
| **StockMovement** | productId, batchId, type, qty (+/-), refId, refType, balanceAfter | `productId`, `batchId` |
| **CustomerLedger** | partyId, date, type, refId, debit, credit, **balance** (running) | `(partyId, date, createdAt)` — append-only |
| **SupplierLedger** | same shape as CustomerLedger | `(partyId, date, createdAt)` — append-only |
| **AuditLog** | user, action, module, reference, before, after, date | `date`, `(module, date)` |
| **Notification** | id, type, message, read, date | `id` unique |
| **Backup** | id, fileName, filePath, size, type, restoredAt | `id` unique |
| **Counter** | key, value | `key` unique — generic atomic sequence source for both entity IDs (`CUST-`, `SUPP-`, …) and FY-aware invoice numbers (`invoice:SALE:25-26`) |

## Relationships (all by application-level `id` string, not Mongo `_id`)

```
Customer.id ─┬─< Sale.customerId
             └─< CustomerLedger.partyId, Payment.partyId

Supplier.id ─┬─< Purchase.supplierId
             ├─< ProductBatch.supplierId
             └─< SupplierLedger.partyId, Payment.partyId

Product.id ──┬─< ProductBatch.productId
             └─< Sale.lines[].productId, Purchase.lines[].productId

ProductBatch.id ─< Sale.lines[].batchId   (sale ALWAYS references the exact batch sold from)
                 └─< StockMovement.batchId
```

Why string `id` instead of ObjectId refs: the frontend was built against human-readable IDs (`CUST-000001`, `INV-000001`) end-to-end (forms, search, URLs). Using the same string as the join key avoids a translation layer between Mongo `_id` and the frontend's display ID, at the cost of an extra unique index per collection — an acceptable trade for a single-company ERP of this size.

## Transactional workflows (Mongo sessions)

- **Sale**: validate batches/stock/expiry → generate invoice number (atomic $inc) → save Sale → decrement each batch + StockMovement → CustomerLedger debit → optional Payment + ledger credit → AuditLog. All in one `session.withTransaction`.
- **Purchase**: validate supplier → save Purchase → upsert ProductBatch (create or accumulate qty) + StockMovement → SupplierLedger credit → optional Payment → AuditLog.
- **SalesReturn / PurchaseReturn**: validate qty ≤ original line qty → adjust batch qty + StockMovement → ledger entry → adjust the original document's balance → AuditLog.
- **Payment**: validate amount ≤ current outstanding (invoice-specific or party-level) → create Payment → ledger entry → update invoice balance/status → AuditLog.

Every one of the above either fully commits or fully rolls back — see `sale.controller.js`, `purchase.controller.js`, `return.controller.js`, `payment.controller.js`.

## Money & GST

`gstCalculation.service.js` is the single place GST math happens (line gross → discount → taxable → CGST/SGST or IGST → total), reused by Purchase, Sale, GST reports and the PDF template. All amounts are rounded to 2 decimals via `utils/money.js` before being summed, avoiding floating-point drift on invoice totals.
