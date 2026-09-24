# DEPLOYMENT

## Recommended targets (100% free tier)

- **Frontend**: Vercel (static Vite build)
- **Backend**: Render (free web service — needs a long-running Node process, not serverless, because of MongoDB transactions + Puppeteer + cron)
- **Database**: MongoDB Atlas M0 (free, 512MB)

## Backend

1. Provision a MongoDB Atlas cluster (free M0 tier is fine). **Transactions require a replica set** — Atlas clusters are replica sets by default, so this just works; a standalone self-hosted `mongod` would reject `session.withTransaction`.
2. Deploy using the included `render.yaml` (Render dashboard → New → Blueprint → point at this repo → root directory `backend`). This automatically installs Chromium during the build so Puppeteer-based PDF generation works — see "Puppeteer / PDF invoices" below.
3. Set these environment variables on Render (the blueprint marks them `sync: false`, meaning you enter the real values yourself in the dashboard — never commit them):
   - `MONGO_URI` — your Atlas connection string
   - `JWT_SECRET` — a long random secret, e.g. `openssl rand -hex 48`. **Do not reuse any value that was ever committed to this repo** — see the security note at the bottom of this file.
   - `CLIENT_ORIGIN` — your exact deployed Vercel URL (including `https://`, no trailing slash)
4. `npm run seed` once, against the production database, with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` set to your real login. This creates the Company profile, sample master data, and your one Admin account. **Never re-run this against a database that already has real invoices** — it wipes and recreates the sample data every time.
5. Confirm `GET /api/health` returns `{ "database": "connected" }`.

### Puppeteer / PDF invoices

`render.yaml`'s build command runs `apt-get install -y chromium` and sets `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`, and `pdf.service.js` now reads that env var first before falling back to Puppeteer's bundled Chromium or a hardcoded path list. If Chromium still can't launch for some reason, PDF endpoints fall back to returning the invoice as HTML (clearly labeled, not a broken file) rather than crashing — but with the blueprint above this fallback should never trigger. Browser-based printing (built into the frontend's Invoice Preview) works regardless either way.

### Backups

`mongodump`/`mongorestore` (MongoDB Database Tools) must be installed separately on the Render instance for `/api/backup/*` and the nightly cron job to work — Render's free tier does not include these by default. On MongoDB Atlas, prefer Atlas's own scheduled backups as your primary safety net and treat this app's backup feature as a secondary/manual export you can trigger and download yourself.

### File uploads

Company logo uploads are written to local disk (`UPLOAD_DIR`) by default — fine for a single-instance deployment. For multi-instance/horizontally-scaled hosting, swap `multer.diskStorage` for an S3-compatible storage adapter (not included here).

### Cold starts (Render free tier)

Render's free web services sleep after ~15 minutes idle; the first request after sleep takes 30–50 seconds. Consider a lightweight "waking up the server…" loading state on first request, and/or a free scheduled GitHub Action pinging `/api/health` every 10 minutes during your business hours to keep it warm.

## Frontend

1. Set `VITE_API_BASE_URL` to the deployed backend's `/api` URL as a build-time env var on Vercel.
2. `npm run build` → deploy the `dist/` folder. (There is no demo/offline mode anymore — the app always calls this URL.)
3. Confirm CORS: the backend's `CLIENT_ORIGIN` must exactly match the deployed frontend origin or every request will be blocked by `helmet`/`cors`.

## Environment variable summary

| Variable | Where | Required |
|---|---|---|
| `MONGO_URI` | backend | Yes |
| `JWT_SECRET` | backend | Yes |
| `JWT_EXPIRES_IN` | backend | No (default 8h) |
| `CLIENT_ORIGIN` | backend | Yes in production |
| `UPLOAD_DIR`, `BACKUP_DIR` | backend | No (defaults provided) |
| `PUPPETEER_EXECUTABLE_PATH` | backend | No locally; set by `render.yaml` on Render |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | backend, seed script only | Yes, when running `npm run seed` |
| `VITE_API_BASE_URL` | frontend | Yes |

No secret ever lives in frontend source — only the public API base URL.

## ⚠️ Security note — rotate your credentials

Earlier versions of this repo had real MongoDB Atlas credentials and a JWT secret committed
in `backend/.env.example` (not gitignored, unlike `.env`), and the backend auto-created a set
of hardcoded demo login accounts (including a `SuperAdmin`) on every server start, with the
login page displaying those accounts and their default password directly to any visitor.
Both have been removed from the code. If this repository was ever pushed to a Git host
(GitHub, GitLab, etc.) before this fix, **rotate your MongoDB Atlas database user password
and generate a new `JWT_SECRET` now**, regardless of anything else in this document — the old
values should be treated as permanently compromised.
