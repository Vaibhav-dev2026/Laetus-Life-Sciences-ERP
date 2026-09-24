# TESTING

## Test commands

```bash
cd backend
npm test                  # full Jest + Supertest suite (in-memory MongoDB replica set)
npm run test:integration  # just the transactional flows: sales, purchase, payment, returns
npm run lint               # ESLint over backend/src — now actually configured and passing (see below)
cd ../frontend
npm run build              # catches any broken import/syntax error immediately
```

## What's covered (`backend/tests/`)

| File | Scenarios |
|---|---|
| `auth.test.js` | valid login, wrong password, missing credentials, no token → 401, invalid token → 401, inactive user rejected |
| `rbac.test.js` | Updated for the single-admin simplification: any authenticated user can perform any action (there is only one role, `Admin`, now), unauthenticated request → 401 not 403, invalid/garbage token → 401 |
| `customer.test.js` | create, invalid mobile rejected, invalid GSTIN rejected, list/read, deactivate |
| `sales.test.js` | **the flagship flow** — stock deducted from the exact batch, GST math correct (CGST/SGST split verified numerically), invoice numbers unique under concurrent creates, insufficient stock rejected with no partial mutation, expired batch blocked under `Block` policy, partial payment → `Partial` status + correct balance, full payment → `Paid` + zero balance, customer ledger entry created, **negative/zero quantity rejected (400), negative rate rejected (400)** — added this pass, see "Bugs found via testing" below |
| `purchase.test.js` | stock increases + new batch created, supplier ledger payable posted with correct GST, existing batch (same product+batchNo) accumulates instead of duplicating, purchase with no lines rejected, **same batchNo across different products now succeeds (Finding 7 decision)**, **negative/zero quantity rejected, negative rate rejected** — added this pass |
| `payment.test.js` | partial payment reduces balance correctly, overpayment beyond outstanding rejected (400), full payment marks invoice Paid |
| `returns.test.js` | sales return increases stock and rejects qty > originally sold; purchase return decreases stock and rejects qty > originally purchased |
| `exportsAndGst.test.js` | Excel/DOCX/CSV/PDF exports, GSTR-1 B2B/B2C classification, ITC reconciliation, GSTR-3B (Output>ITC, Output<ITC), invoice lifecycle (create→edit→cancel with stock/ledger reconciliation), **GSTR-1 with a sales return present no longer crashes** — regression test added this pass, see below |
| `idGenerator.test.js` | **New this pass.** Direct coverage for Findings 4, 5 and 6, which previously had zero tests: Payment/SalesReturn/PurchaseReturn ID generation correctly detects and skips a colliding pre-existing ID; Backup ID generation is correctly zero-padded (Finding 5's argument-order bug); after seeding, the very next batch ID is generated with **zero wasted collision retries** (Finding 6) |

These correspond directly to the "End-to-end test cases" (Scenarios A–J) in the master implementation plan — A/B/C/D via `sales.test.js` + `payment.test.js`, E via the expired-batch test, F via `returns.test.js`, G via `rbac.test.js`, H via the concurrent-invoice-number test, I via the insufficient-stock test (asserts the batch is untouched after a rejected sale — proof the transaction rolled back), J is the manual frontend walkthrough below.

## Bugs found via testing/lint this pass (fixed — see `CHANGELOG.md` for full detail)

Running a genuinely configured lint pass for the first time (there was previously **no ESLint config file anywhere in the repo**, so `npm run lint` had never actually worked) immediately surfaced two real bugs, and a manual code-path review while writing missing test coverage surfaced two more:

1. **Crash bug**: `gst.controller.js`'s GSTR-1 credit-note row builder referenced an undefined variable (`s` instead of `r`), which would throw `ReferenceError` and crash the whole GSTR-1 endpoint with a 500 whenever any sales return existed in the queried date range. Fixed; regression test added.
2. **Data-integrity bug**: sale and purchase line validation only checked `!l.qty` (rejects `0`/falsy, but **not negative numbers** — `-5` is truthy). A negative quantity would flow straight into `increaseStock`/`decreaseStock`, silently moving stock in the *wrong direction*. Fixed on both sides; regression tests added.
3. Missing `CastError` handling in the global error handler — an invalid ID format in a URL (e.g. `PUT /api/users/not-a-real-id`) previously fell through to a generic 500 instead of a clean 400.
4. `npm run lint` itself was silently broken (no config file existed) — added `backend/.eslintrc.json`. Lint is now genuinely zero errors, zero warnings.

## ⚠️ Execution status in this delivery

`npm install` and lint **were run for real** in the environment this pass was done in, and both succeeded — 662 backend packages installed cleanly, `npm run build` on the frontend succeeds with zero warnings, `npm run lint` on the backend is genuinely zero errors/warnings (after the two real bugs above were fixed).

**The Jest suite itself still could not be executed** in that environment: `mongodb-memory-server` needs to download a real `mongod` binary on first use, from `fastdl.mongodb.org`, and that environment's network access is restricted to package registries (npm, PyPI, GitHub, etc.) — not MongoDB's own download servers. Multiple workarounds were attempted (system-installed MongoDB via `apt`, an alternative binary mirror, an npm-hosted prebuilt binary) — none were viable in that specific sandbox. This is a network/environment limitation, not a code issue, and not a reason to skip running the suite yourself.

**Please run this yourself, on a machine with normal internet access, before trusting this in production:**
```bash
cd backend
npm install
npm test
```
The suite is larger and more thorough than it was originally (idGenerator.test.js is new; sales/purchase/exportsAndGst gained new regression tests) and every test file has been hand-reviewed against the actual current application behavior — including fixing two tests that would otherwise have failed for the *right* reason (they asserted old behavior that was deliberately changed: the single-admin RBAC simplification, and the Finding 7 batch-uniqueness decision). If anything still fails when you run it for real, that's exactly the kind of signal this suite exists to catch — paste the failure back for a direct fix rather than a guess.

## Manual smoke test (Scenario J)

1. `npm run seed` in `backend/` with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` set (see `SETUP.md`), then `npm run dev` in both `backend/` and `frontend/`.
2. Log in with the admin email/password you set.
3. Dashboard loads (all aggregation cards, zero/sparse until data exists).
4. Create a Customer and a Supplier.
5. Create a Product, then a Purchase for it → check the Batches page shows the new batch and increased stock.
6. Create a Sales invoice against that batch → check stock decreased, invoice preview/print renders, Outstanding shows the balance, Customer Ledger shows the debit.
7. Record a Payment against that invoice → balance drops, status updates to Partial/Paid.
8. Check Reports and GST screens (GSTR-1, ITC Reconciliation, GSTR-3B) reflect the same numbers.
9. Create a Sales Return for part of that invoice → confirm GSTR-1 still loads correctly (this was the crash bug above) and shows a Credit Note row.
10. Try a request with no auth token against a protected endpoint → expect 401, never a raw 500.

See `CLAUDE_CODE_TESTING_QA_PLAN.md`'s Phase 5 for the full 19-step version of this walkthrough, meant to be run against your actual deployed Vercel+Render+Atlas stack, not just locally.
