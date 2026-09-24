# L LAETUS LIFE SCIENCES ERP — Frontend

A complete, production-style frontend for a pharmaceutical Sales, Purchase, Inventory, GST Billing, Outstanding, Reporting and Business Management ERP, built for **L Laetus Life Sciences** (Surat, Gujarat).

This is the **frontend only**. It is architected to consume a Node.js + Express + MongoDB backend that is not part of this deliverable.

---

## Technology

- React 18 (plain JavaScript — no TypeScript)
- React Router v6
- Axios (wrapped in a central `axiosClient`)
- Plain CSS with a CSS-variable design system (no Tailwind/Bootstrap/MUI/AntD/styled-components)
- Recharts for dashboard charts
- Day.js for date handling
- Vite as the build tool

## Demo / Mock mode

Because the backend is a separate implementation phase, every screen currently runs in **demo mode**:

- All `src/api/*.js` modules expose the exact same async function signatures a real Axios-backed module would (`list`, `getById`, `create`, `update`, `remove`, etc.).
- In demo mode they read/write a `localStorage`-backed store (`src/api/localDb.js`), seeded from `src/mock/mockData.js`, with a small artificial delay so loading states are visible.
- Set `VITE_DEMO_MODE=false` and point `VITE_API_BASE_URL` at a running backend, then extend the api modules to call `axiosClient` instead of `localDb` — no changes are needed in any page or component, since they only ever import from `src/api/*`.

Demo login: use any email from `src/mock/mockData.js` (e.g. `meera@laetuslifesciences.com`) with any password of 4+ characters.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
# or
npm start
```

Runs on `http://localhost:5173` by default.

## Production build

```bash
npm run build
npm run preview   # to serve the production build locally
```

## Environment variables

Copy `.env.example` to `.env` and adjust:

```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_DEMO_MODE=true
```

- `VITE_API_BASE_URL` — base URL of the Node/Express backend once available.
- `VITE_DEMO_MODE` — `true` keeps the app fully functional against local mock data; set to `false` once the backend is wired up.

No secrets (Mongo URI, JWT secret, etc.) are ever placed in frontend source — only this public base URL.

## Folder structure

```
src/
├── api/            Axios client + one module per domain (customerApi, saleApi, gstApi, ...)
├── assets/         Logo and static assets
├── components/
│   ├── layout/      Sidebar, Topbar, ProtectedRoute, Breadcrumbs, PageHeader, AppLayout, ErrorBoundary
│   ├── common/      DataTable, Modal, Drawer, Toast, SearchBox, Pagination, StatCard, StatusBadge, ...
│   └── invoice/     InvoicePreview, InvoiceTotals, InvoiceActions (shared by Sales & print view)
├── config/         Centralized company/branding configuration
├── context/        AuthContext, ToastContext, PageTitleContext
├── hooks/          useAsync, useDebounce
├── mock/           Seed data for demo mode
├── pages/          One folder per module (customers, suppliers, products, batches, purchases,
│                   sales, payments, outstanding, ledger, returns, expenses, reports, gst, users,
│                   audit, notifications, backup, company, auth, dashboard)
├── styles/         variables.css (design tokens), global.css, print.css (A4 invoice print rules)
├── utils/          format.js, gst.js (frontend GST preview calculations), validators.js, id.js
├── App.jsx         Full route table (lazy-loaded page groups)
└── main.jsx        App bootstrap (Router, Toast/Auth/PageTitle providers)
```

## Notable implementation notes

- **GST calculations are frontend previews only.** `src/utils/gst.js` computes CGST/SGST/IGST splits for line-item display and invoice totals, but the backend remains authoritative when the real API is connected.
- **Billing screen** (`/sales/new`) implements the full workflow from the spec: customer search with outstanding shown inline → product search → batch picker (with expired-batch Block/Warn policy) → editable line table → live GST totals → amount received → payment status → save & preview → print-ready invoice.
- **Invoice print** uses a dedicated `print.css` with `@page { size: A4; }` rules; only `.print-area` content (the `InvoicePreview` component) is shown when printing, and the sidebar/topbar/buttons are hidden.
- **Role-based UI** — the sidebar and certain routes (Company Settings, Users & Roles, Audit Logs, Backup) are filtered/protected by role via `AuthContext.hasRole()` and `ProtectedRoute`. This is UX-only; the real backend must enforce permissions server-side.
- **DataTable** is a single reusable component (sorting, pagination, loading skeleton, empty/error states, mobile card layout) used by every list screen in the app.
- **Export actions** (`ExportActions`) render Excel/PDF/DOCX/Print buttons everywhere reports and ledgers need them; actual file generation is left as a service call the backend will fulfil — for now they surface a toast so the flow is fully wired.

## Backend integration checklist (for the next phase)

1. Point `VITE_API_BASE_URL` at the Express server and set `VITE_DEMO_MODE=false`.
2. In each `src/api/*.js` module, replace the `createCrudApi(...)` / `localDb` calls with the equivalent `axiosClient.get/post/put/delete` calls against the REST endpoints listed in the implementation plan (`/api/customers`, `/api/sales`, `/api/gst`, etc.).
3. Replace the demo `authApi.login` with a real `POST /api/auth/login` call — `AuthContext` already expects `{ accessToken, user: { name, email, role } }` in return.
4. Wire `ExportActions` and `InvoiceActions` (`Download PDF`) to real backend export/PDF endpoints.

## Deployment

The build output (`npm run build`) is a static `dist/` folder that can be served by any static host (Nginx, Vercel, Netlify, S3+CloudFront, or served directly by the Express backend). Set `VITE_API_BASE_URL` at build time to point at the deployed backend.

---

**Note on this build:** this project was assembled in a sandboxed environment without npm registry access, so `npm install` / `npm run build` could not be executed here to produce a verified build artifact. Every file was hand-reviewed for import correctness and balanced JSX; running `npm install && npm run dev` in a normal environment with internet access is the next step to confirm the build.
