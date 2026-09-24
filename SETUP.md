# SETUP

## Prerequisites

- Node.js 18+ and npm
- MongoDB 6+ running locally, or a MongoDB Atlas connection string
- (Optional, for PDF invoices) A Chromium-capable environment for Puppeteer
- (Optional, for backup/restore) MongoDB Database Tools (`mongodump` / `mongorestore`) on PATH

## 1. Backend

```bash
cd backend
cp .env.example .env
# edit .env: set MONGO_URI, a strong JWT_SECRET, and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
npm install
npm run seed      # creates the company profile, your single admin user, and sample master data
npm run dev        # starts the API on http://localhost:5000
```

`npm run seed` reads `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `.env` (or the shell
environment) and creates exactly one login with those credentials — this app is single-admin
by design, with no signup and no other roles. The script refuses to run if
`SEED_ADMIN_PASSWORD` isn't set, so there is no default/fallback password to guess.

Re-running `npm run seed` wipes and recreates the company profile and sample master data
(customers/suppliers/products/batches) every time — only run it again on a fresh database,
never against one that already has real invoices you want to keep.

## 2. Frontend

```bash
cd frontend
cp .env.example .env
# set VITE_API_BASE_URL to point at the backend above
npm install
npm run dev         # starts the app on http://localhost:5173
```

With `VITE_DEMO_MODE=false`, the frontend calls the real backend for every screen. Set it back to `true` at any time to run the frontend fully offline against local mock data (no backend required) — useful for UI-only work.

## 3. Verify

1. Open `http://localhost:5173`, sign in with one of the seeded accounts.
2. Dashboard should load live numbers (all zero/sparse until you create data).
3. Create a Customer, a Supplier, and a Product.
4. Record a Purchase for that product (creates a batch, increases stock).
5. Create a Sales invoice against that batch (deducts stock, posts ledger, updates outstanding).
6. Check Outstanding, Customer Ledger, Reports, GST screens reflect it.

See `TESTING.md` for the automated test suite and `API_CONTRACT.md` for the full endpoint reference.
