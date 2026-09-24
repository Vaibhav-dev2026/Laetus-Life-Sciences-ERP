# L LAETUS LIFE SCIENCES ERP — Full Stack

A pharmaceutical Sales, Purchase, Inventory, GST Billing, Outstanding, Ledger, Reporting and Business Management ERP for **L Laetus Life Sciences** (Surat, Gujarat) — single-company edition.

```
laetus-erp/
├── frontend/   React 18 + Vite + React Router v6 + Axios + Recharts + plain CSS
├── backend/    Node.js + Express + MongoDB/Mongoose + JWT + bcrypt
├── README.md
├── API_CONTRACT.md
├── DATABASE_SCHEMA.md
├── SETUP.md
├── TESTING.md
└── DEPLOYMENT.md
```

## Architecture

```
React pages  →  src/api/*.js  →  axiosClient  →  Express routes
                                                       ↓
                                            auth/permission middleware
                                                       ↓
                                                  controllers
                                                       ↓
                                    services (gstCalculation, stock, ledger,
                                    invoiceNumber, audit, backup, pdf, export)
                                                       ↓
                                              Mongoose models → MongoDB
```

Every frontend `api/*.js` module calls the real backend below through axiosClient — there is
no offline/demo mode. (Earlier versions had a `VITE_DEMO_MODE` flag that ran fully offline
against `localStorage`-seeded mock data; it defaulted to on and, because it lived in a
gitignored `.env` file, silently stayed on in production. It has been removed entirely so a
missing env var can never again cause the live app to show fake data.)

## Quick start

```bash
# Backend
cd backend
cp .env.example .env   # set MONGO_URI, JWT_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
npm install
npm run seed
npm run dev             # http://localhost:5000

# Frontend (new terminal)
cd frontend
cp .env.example .env    # set VITE_API_BASE_URL=http://localhost:5000/api
npm install
npm run dev              # http://localhost:5173
```

Full details and a manual smoke-test checklist are in **SETUP.md**.

## What was built

**Backend** — complete Express + Mongoose API: JWT auth with bcrypt (single-admin — no
signup, no multi-role complexity), full CRUD for Customers/Suppliers/Products/Batches, a
transactional Purchase engine (creates/accumulates batches, increases stock, posts supplier
ledger, optional payment — all inside a MongoDB session that rolls back completely on any
failure), a transactional Sales/Billing engine (the most important flow — validates the exact
batch, checks stock and expiry policy, recalculates every GST figure server-side, generates an
atomic FY-aware invoice number, deducts stock, posts customer ledger, optional payment, audit
log, one all-or-nothing transaction), Payments with server-enforced "never exceed
outstanding," Sales/Purchase Returns with quantity limits and stock/ledger reversal,
append-only Customer/Supplier ledgers, Outstanding with ageing buckets,
MongoDB-aggregation-backed Dashboard and Reports endpoints, GSTR-1/ITC-Reconciliation/GSTR-3B-style
reporting, PDF invoice generation via Puppeteer, Excel/DOCX export, file upload via Multer,
audit logging, notifications, and a guarded mongodump/mongorestore backup system with a
nightly cron job.

**Frontend** — the previously delivered complete React ERP UI (all modules from the
implementation plan), with its API layer calling this backend directly.

**Documentation** — this README plus API_CONTRACT.md (every endpoint), DATABASE_SCHEMA.md (every model, index, and transactional workflow), SETUP.md, TESTING.md, DEPLOYMENT.md.

**Tests** — a real Jest + Supertest suite (`backend/tests/`) covering auth, RBAC, customer validation, and — most importantly — the sales transaction (stock deduction from the exact batch, GST math, atomic unique invoice numbers under concurrency, insufficient-stock rejection with proof of no partial mutation, expired-batch blocking, partial/full payment status), the purchase transaction, payment overpayment rejection, and both return flows. See TESTING.md for exactly what's covered and — importantly — this delivery's one real limitation, below.

## Environment variables

See the table in **DEPLOYMENT.md**. Copy each `.env.example` to `.env` before running.

## Test results — read this before trusting "it works"

**I could not actually run `npm install` or the test suite in the sandbox this was built in** — the npm registry returns `403 Forbidden` here (no internet egress), confirmed for both `frontend/` and `backend/`. So I am not going to claim "everything passes" without having watched it pass, which the task itself explicitly forbids.

What I *could* and did verify mechanically, without needing installed dependencies:
- All 101 backend `.js` files pass `node --check` (zero syntax errors).
- Every `require`/`import` path in both frontend and backend resolves to a real file (automated check across ~550 import statements, zero missing).
- Braces/parens/brackets balance-checked file by file.
- The test suite (`backend/tests/*.test.js`) is written and complete — it exercises the exact scenarios A–J from the implementation plan — but has not been executed by me.

**Your first command should be `cd backend && npm install && npm test`.** If anything fails, that's real, specific signal — send it back and it gets fixed directly, not guessed at.

## Known limitations

- Puppeteer PDF generation needs a Chromium-capable host (see DEPLOYMENT.md) — untested here for the same no-network reason.
- `mongodump`/`mongorestore` must be present on the backend host for the Backup screen to fully work; the API returns a clear error if they're missing rather than failing silently.
- MongoDB **transactions require a replica set** (Atlas gives you this by default; a bare standalone local `mongod` does not) — see DEPLOYMENT.md.
- Outstanding/Ledger frontend pages currently aggregate from the generic `/customers`, `/sales`, `/payments` list endpoints client-side rather than the dedicated `/outstanding` and `/ledger/*` aggregation endpoints the backend exposes — both work, the dedicated endpoints are simply not yet wired in as the single source for those two screens.
