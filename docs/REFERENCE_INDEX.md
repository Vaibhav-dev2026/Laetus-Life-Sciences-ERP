# L LAETUS LIFE SCIENCES ERP — SOURCE CODE REFERENCE INDEX

This index establishes end-to-end traceability between the physical codebase files and the comprehensive architectural documentation chapters.

---

## 1. Backend Source Traceability Matrix

| File Path | Primary Function / Responsibility | Key Exports & Symbols | Referenced Chapters |
|---|---|---|---|
| `backend/server.js` | Express server entry point, MongoDB connection gate, cluster bootstrap, process signals | `start()`, `shutdown()` | Ch. 8, Ch. 19, Ch. 20 |
| `backend/src/app.js` | Express app configuration, Helmet CSP, CORS rules, rate limiters, route mounting | `app` | Ch. 4, Ch. 8, Ch. 17 |
| `backend/src/config/db.js` | Mongoose connection manager with mongodb-memory-server fallback for tests | `connectDB()`, `disconnectDB()` | Ch. 4, Ch. 8, Ch. 21 |
| `backend/src/config/env.js` | Central environment variable loader with defaults & type coercion | `env` | Ch. 8, Ch. 18 |
| `backend/src/models/Company.js` | Singleton company profile: address, GSTIN, DL, Bank, FY settings, terms | `Company` | Ch. 7, Ch. 10, Ch. 12 |
| `backend/src/models/User.js` | User identity, bcrypt password hash, roles, lastLogin | `User` | Ch. 9, Ch. 10, Ch. 17 |
| `backend/src/models/Customer.js` | Customer master: partyName, mobile, GSTIN, stateCode, currentBalance | `Customer` | Ch. 7, Ch. 10, Ch. 12 |
| `backend/src/models/Supplier.js` | Supplier master: company, mobile, GSTIN, bank details, currentPayable | `Supplier` | Ch. 7, Ch. 10, Ch. 12 |
| `backend/src/models/Product.js` | Product catalog: name, SKU, HSN, GST rate, MRP, rates, currentStock | `Product` | Ch. 7, Ch. 10, Ch. 12 |
| `backend/src/models/ProductBatch.js` | Batch inventory: batchNo, expDate, currentQty, compound unique index | `ProductBatch` | Ch. 7, Ch. 10, Ch. 12 |
| `backend/src/models/Sale.js` | Sales tax invoice: lines with freeQty, GST totals, idempotencyKey | `Sale` | Ch. 7, Ch. 10, Ch. 12, Ch. 13 |
| `backend/src/models/Purchase.js` | Purchase bill: inward lines with freeQty, batch references, status | `Purchase` | Ch. 7, Ch. 10, Ch. 12 |
| `backend/src/models/SalesReturn.js` | Sales return credit note: reference sale, restored batch qty, refund | `SalesReturn` | Ch. 10, Ch. 12 |
| `backend/src/models/PurchaseReturn.js` | Purchase return debit note: reference purchase, deducted batch qty | `PurchaseReturn` | Ch. 10, Ch. 12 |
| `backend/src/models/Payment.js` | Payment vouchers: customer receipts & supplier payouts with allocations | `Payment` | Ch. 10, Ch. 12 |
| `backend/src/models/Expense.js` | Operational expenditure records: category, payment mode, approval | `Expense` | Ch. 10, Ch. 12 |
| `backend/src/models/StockMovement.js` | Traceable stock audit journal: type, qty delta, balanceAfter | `StockMovement` | Ch. 10, Ch. 12 |
| `backend/src/models/CustomerLedger.js` | Append-only customer statement ledger with monotonic sequence | `CustomerLedger` | Ch. 10, Ch. 12 |
| `backend/src/models/SupplierLedger.js` | Append-only supplier statement ledger with monotonic sequence | `SupplierLedger` | Ch. 10, Ch. 12 |
| `backend/src/models/Counter.js` | Concurrency-safe atomic counter for IDs and FY invoice sequences | `Counter` | Ch. 8, Ch. 10, Ch. 13 |
| `backend/src/models/AuditLog.js` | User & system action audit trail: before/after snapshots | `AuditLog` | Ch. 10, Ch. 17 |
| `backend/src/models/Notification.js` | System and operational alert messages: Low Stock, Expiry | `Notification` | Ch. 7, Ch. 10, Ch. 12 |
| `backend/src/models/Backup.js` | Database dump metadata: timestamp, size, trigger type | `Backup` | Ch. 10, Ch. 23 |
| `backend/src/models/GSTR2BImport.js` | External GST portal GSTR-2B JSON data for ITC reconciliation | `GSTR2BImport` | Ch. 10, Ch. 14 |
| `backend/src/services/gstCalculation.service.js` | Single source of truth for GST calculation (calcLine, calcDocumentTotals) | `calcLine`, `calcDocumentTotals`, `isInterState` | Ch. 8, Ch. 13 |
| `backend/src/services/invoiceNumber.service.js` | Indian FY derivation in IST & atomic sequential invoice number generation | `nextInvoiceNumber`, `currentFinancialYear` | Ch. 8, Ch. 13 |
| `backend/src/services/stock.service.js` | Atomic stock decrement/increment, batch status calculation, expiry policy | `increaseStock`, `decreaseStock`, `syncProductStock` | Ch. 8, Ch. 12 |
| `backend/src/services/ledger.service.js` | Customer & supplier ledger posting logic, balance synchronization | `postCustomerEntry`, `postSupplierEntry` | Ch. 8, Ch. 12 |
| `backend/src/services/gstReport.service.js` | GSTR-1, GSTR-2B, GSTR-3B aggregation engine | `getGstr1Data`, `getGstr2bReconciliationData`, `getGstr3bData` | Ch. 8, Ch. 14 |
| `backend/src/services/pdf.service.js` | Puppeteer browser launcher, Chromium resolver, PDF generation | `generatePdfFromHtml`, `generateReportPdf`, `generateGstr3bPdf` | Ch. 8, Ch. 15 |
| `backend/src/services/export.service.js` | ExcelJS and Docx document builder utilities | `buildExcel`, `buildDocx` | Ch. 8, Ch. 15 |
| `backend/src/services/reportRows.service.js` | Data transformation and normalization for all 12 system reports | 12 report builders | Ch. 8, Ch. 15, Ch. 16 |
| `backend/src/services/bootstrapAuth.service.js` | Idempotent production admin user seeder | `ensureProductionAdmin` | Ch. 8, Ch. 9 |
| `backend/src/controllers/sale.controller.js` | Sales invoice CRUD, stock decrement, idempotency, cancellation | `create`, `list`, `getById`, `update`, `cancel` | Ch. 8, Ch. 11, Ch. 12 |
| `backend/src/controllers/purchase.controller.js` | Purchase entry CRUD, batch upsert, supplier ledger credit | `create`, `list`, `getById`, `update`, `cancel` | Ch. 8, Ch. 11, Ch. 12 |
| `backend/src/controllers/export.controller.js` | Central report export dispatcher (PDF, XLSX, DOCX, CSV) with groupBy | `exportReport` | Ch. 8, Ch. 11, Ch. 15 |
| `backend/src/templates/invoice.html.js` | Sales invoice A4 Puppeteer template with Free column, HSN, bank details | `renderInvoiceHtml` | Ch. 15 |
| `backend/src/templates/gstr3b.html.js` | Statutory Form GSTR-3B portrait A4 return layout | `renderGstr3bHtml` | Ch. 14, Ch. 15 |
| `backend/src/templates/reportTable.html.js` | Landscape grouped report table template with sub-totals and grand-totals | `renderReportTableHtml` | Ch. 15, Ch. 16 |
| `backend/src/templates/ledger.html.js` | Financial ledger statement layout | `renderLedgerHtml` | Ch. 15 |
| `backend/src/templates/paymentReceipt.html.js` | Payment voucher receipt layout | `renderPaymentReceiptHtml` | Ch. 15 |
| `backend/src/middlewares/auth.middleware.js` | Bearer JWT verification, active user check, attaches `req.user` | `authenticate` | Ch. 8, Ch. 9, Ch. 17 |
| `backend/src/middlewares/permission.middleware.js` | Role-based authorization checker | `requireRole` | Ch. 8, Ch. 9, Ch. 17 |
| `backend/src/middlewares/error.middleware.js` | Central error handling for ApiError, ValidationError, Mongo duplicate | `errorHandler`, `notFoundHandler` | Ch. 8, Ch. 17 |
| `backend/src/middlewares/rateLimiters.js` | express-rate-limit instances for login and API protection | `apiLimiter`, `loginLimiter` | Ch. 8, Ch. 17 |
| `backend/src/utils/money.js` | Safe 2-decimal arithmetic rounding to avoid JS floating-point errors | `round2`, `sum` | Ch. 8, Ch. 13 |
| `backend/src/utils/idGenerator.js` | Concurrency-safe atomic zero-padded ID generator (CUST, SUPP, PRD, BAT) | `generateId`, `nextSequence` | Ch. 8, Ch. 10 |

---

## 2. Frontend Source Traceability Matrix

| File Path | Primary Function / Responsibility | Key Exports & Symbols | Referenced Chapters |
|---|---|---|---|
| `frontend/src/main.jsx` | React DOM root entry point, mounts App inside StrictMode | DOM Render | Ch. 7 |
| `frontend/src/App.jsx` | Application router, Context Providers (Auth, Company, Toast, PageTitle) | `App` | Ch. 7, Ch. 9 |
| `frontend/src/api/client.js` | Axios instance with JWT interceptor, 401 redirect, idempotency key injection | `apiClient` | Ch. 7, Ch. 8, Ch. 17 |
| `frontend/src/context/AuthContext.jsx` | Authentication state, login/logout actions, user storage | `AuthContext`, `useAuth` | Ch. 7, Ch. 9 |
| `frontend/src/context/CompanyContext.jsx` | Cached company profile provider, auto-refreshes on auth:login event | `CompanyContext`, `useCompany` | Ch. 7, Ch. 12 |
| `frontend/src/pages/auth/Login.jsx` | Login form with rate limit handling, credential validation | `Login` | Ch. 7, Ch. 9, Ch. 25 |
| `frontend/src/pages/dashboard/Dashboard.jsx` | Operational dashboard with KPI cards, sales trends, inventory alerts | `Dashboard` | Ch. 7, Ch. 12, Ch. 25 |
| `frontend/src/pages/sales/SalesInvoiceForm.jsx` | Flagship billing form: batch selection, live GST, freeQty, save & print | `SalesInvoiceForm` | Ch. 7, Ch. 12, Ch. 25 |
| `frontend/src/pages/sales/SalesInvoiceView.jsx` | Bill view page with cancel dialog, export actions, invoice preview | `SalesInvoiceView` | Ch. 7, Ch. 12, Ch. 25 |
| `frontend/src/components/invoice/InvoicePreview.jsx` | Complete pharmaceutical invoice layout matching real bill reference | `InvoicePreview` | Ch. 7, Ch. 12, Ch. 15 |
| `frontend/src/pages/purchases/PurchaseForm.jsx` | Inward purchase entry form with batch creation & rate tracking | `PurchaseForm` | Ch. 7, Ch. 12, Ch. 25 |
| `frontend/src/pages/gst/GSTR1.jsx` | Interactive GSTR-1 return view (B2B, B2C, HSN, CDNR tabs) | `GSTR1` | Ch. 7, Ch. 14, Ch. 25 |
| `frontend/src/pages/gst/GSTR3B.jsx` | Interactive Form GSTR-3B summary view (Sections 3.1, 4, 6.1) | `GSTR3B` | Ch. 7, Ch. 14, Ch. 25 |
| `frontend/src/pages/gst/ITCReconciliation.jsx` | Purchase vs GSTR-2B matching interface | `ITCReconciliation` | Ch. 7, Ch. 14, Ch. 25 |
| `frontend/src/pages/company/CompanySettings.jsx` | Company profile editor (DL, Bank, GSTIN, invoice prefix) | `CompanySettings` | Ch. 7, Ch. 12, Ch. 25 |
| `frontend/src/pages/reports/ReportsCenter.jsx` | Central reporting hub with filters and export buttons | `ReportsCenter` | Ch. 7, Ch. 16, Ch. 25 |
| `frontend/src/components/common/ExportActions.jsx` | Reusable export toolbar supporting PDF preview, PDF, XLSX, DOCX, CSV | `ExportActions` | Ch. 7, Ch. 15 |
| `frontend/src/utils/gst.js` | Client-side mirrored GST calculation for instant UI feedback | `calcLine`, `calcDocumentTotals` | Ch. 7, Ch. 13 |
| `frontend/src/utils/format.js` | Indian currency locale formatting (`en-IN`), date formats, amount in words | `formatCurrency`, `formatDate`, `amountInWords` | Ch. 7, Ch. 13 |

---

## 3. DevOps, Configuration & Deployment Traceability Matrix

| File Path | Purpose & Configuration Content | Referenced Chapters |
|---|---|---|
| `render.yaml` | Render Blueprint infrastructure as code for backend web service | Ch. 4, Ch. 20 |
| `frontend/vercel.json` | Vercel SPA routing rewrites, Content Security Policy, security headers | Ch. 4, Ch. 20 |
| `backend/.env.example` | Template of required backend environment variables | Ch. 18, Ch. 19 |
| `frontend/.env.example` | Template of required frontend environment variables (`VITE_API_BASE_URL`) | Ch. 18, Ch. 19 |
| `API_CONTRACT.md` | Authoritative REST API endpoint contract specification | Ch. 11 |
| `TESTING.md` | Master test suite specification, smoke test workflows, regression log | Ch. 21 |
| `SETUP.md` | Developer onboarding and environment configuration instructions | Ch. 19 |
| `GETTING_STARTED.md` | Business operator onboarding manual | Ch. 25 |
