# L LAETUS LIFE SCIENCES ERP

A full-stack **Pharmaceutical ERP (Enterprise Resource Planning)** built with the **MERN stack** for managing sales, purchases, inventory, products, batches, customers, suppliers, payments, ledgers, outstanding balances, GST workflows, GSTR reporting, business documents, exports, audit logging, notifications and operational reporting.

The system is designed as a **single-company pharmaceutical ERP** for **L LAETUS LIFE SCIENCES, Surat, Gujarat**, with authenticated access for authorized ERP users.

---

## Table of Contents

* [Project Overview](#project-overview)
* [Key Highlights](#key-highlights)
* [Core Modules](#core-modules)
* [Business Workflows](#business-workflows)
* [GST & Tax Calculation](#gst--tax-calculation)
* [Financial Year Management](#financial-year-management)
* [Inventory & Batch Management](#inventory--batch-management)
* [Payments, Ledgers & Outstanding](#payments-ledgers--outstanding)
* [GST & GSTR Reporting](#gst--gstr-reporting)
* [Documents, PDF, Print & Exports](#documents-pdf-print--exports)
* [Authentication & Security](#authentication--security)
* [Database Architecture](#database-architecture)
* [Application Architecture](#application-architecture)
* [Technology Stack](#technology-stack)
* [Project Structure](#project-structure)
* [API Architecture](#api-architecture)
* [Data Persistence & Transaction Safety](#data-persistence--transaction-safety)
* [Responsive Design](#responsive-design)
* [Testing & QA](#testing--qa)
* [Environment Configuration](#environment-configuration)
* [Local Development Setup](#local-development-setup)
* [Production Deployment](#production-deployment)
* [Deployment Architecture](#deployment-architecture)
* [Backups & Data Protection](#backups--data-protection)
* [Public Repository Security](#public-repository-security)
* [Development Principles](#development-principles)
* [Project Documentation](#project-documentation)
* [Current Project Status](#current-project-status)
* [Author](#author)

---

# Project Overview

**L LAETUS LIFE SCIENCES ERP** is a business management system built specifically around pharmaceutical distribution and inventory workflows.

The system combines:

* Master data management
* Pharmaceutical product and batch management
* Purchase management
* Sales and invoice management
* Inventory and stock tracking
* Sales returns
* Purchase returns
* Customer and supplier payments
* Customer and supplier ledgers
* Outstanding management
* GST calculations
* GSTR-oriented reporting
* Financial-year based reporting
* PDF generation
* A4 printing
* Excel exports
* CSV exports
* DOCX exports
* Audit logging
* Notifications
* Dashboard analytics
* Database backup utilities
* Responsive web UI
* Role-based authorization

The project follows a **database-driven architecture**, where MongoDB is the source of truth for business records and the frontend communicates with the backend through authenticated HTTP APIs.

---

# Key Highlights

## Pharmaceutical-focused ERP

The application is designed around pharmaceutical business requirements rather than generic CRUD screens.

It supports concepts such as:

* Batch number
* Manufacturing date
* Expiry date
* MRP
* Purchase rates
* Sale rates
* HSN
* GST rates
* Stock quantities
* Free quantities
* Product-level and batch-level inventory
* Supplier relationships
* Customer relationships
* Stock movement history

---

## Transaction-safe financial operations

Financial operations are designed so that related changes happen consistently.

For example, a Sale may affect:

* Sale record
* Invoice number
* Product batch stock
* Stock movement
* Customer ledger
* Payment status
* Payment record
* Audit history

These related operations are designed around MongoDB transaction/session handling so that a partially completed transaction is avoided.

---

## Server-side business validation

Important business calculations are not trusted only to the frontend.

The backend validates and recalculates critical values such as:

* GST
* Taxable amount
* Invoice totals
* Stock availability
* Batch validity
* Outstanding amount
* Payment limits
* Financial-year related document numbering

This reduces the risk of manipulating critical business values through client-side requests.

---

# Core Modules

## 1. Authentication

The ERP requires authenticated access.

There is no public customer/supplier signup system.

Business entities such as:

* Customers
* Doctors
* Clinics
* Hospitals
* Medical stores
* Suppliers

are maintained as master records and are **not ERP login accounts**.

Only authorized ERP users can access protected application modules.

---

## 2. Dashboard

The dashboard provides an operational overview of the ERP.

Typical information includes:

* Sales summary
* Purchase summary
* Stock information
* Outstanding amounts
* Receivables
* Payables
* Financial-year filtered information
* Business charts
* Notifications
* Important operational indicators

Dashboard information is intended to reflect the latest committed database state.

---

## 3. Company Settings

Company Settings provide the central source of company information used by the application.

Company configuration can be consumed by:

* Sales invoices
* Purchase documents
* Returns
* Receipts
* Payment documents
* PDF reports
* GST reports
* GSTR reports
* Print layouts
* Exported business documents

The goal is to avoid maintaining different company information in individual templates.

---

## 4. Customer Management

Customer master management supports:

* Customer creation
* Customer editing
* Customer search
* Customer details
* Business type
* Doctor/organization information
* GST details
* Contact information
* Payment terms
* Credit limit
* Opening outstanding
* Customer status

Customers can be linked to:

* Sales
* Payments
* Customer ledger
* Outstanding
* Returns
* Reports

---

## 5. Supplier Management

Supplier master management supports:

* Supplier creation
* Supplier editing
* Supplier search
* Supplier contact details
* GST details
* Payment terms
* Opening payable
* Supplier status

Suppliers can be linked to:

* Purchases
* Purchase returns
* Payments
* Supplier ledger
* Outstanding
* Stock/batch sourcing

---

## 6. Product Management

Product master management supports:

* Product ID
* SKU
* Product name
* Generic name
* Manufacturer
* Category
* Product type
* HSN
* GST rate
* Unit
* Packaging
* MRP
* Purchase rate
* Sale rate
* Minimum stock
* Reorder level
* Current stock

SKU uniqueness is preserved as an important product identity rule.

---

## 7. Product Batch Management

Pharmaceutical inventory requires batch-level tracking.

The ERP supports:

* Batch ID
* Product association
* Manufacturer batch number
* Manufacturing date
* Expiry date
* MRP
* Purchase rate
* Sale rate
* Current quantity
* Supplier association
* Batch status

Stock is tracked against the exact product and batch.

This enables batch-sensitive sales and inventory operations.

---

# Business Workflows

## Purchase Workflow

Typical flow:

```text
Supplier
   ↓
Purchase
   ↓
Purchase Items
   ↓
GST Calculation
   ↓
Product Batch
   ↓
Stock Increase
   ↓
Stock Movement
   ↓
Supplier Ledger
   ↓
Optional Payment
   ↓
Purchase Status
```

A purchase can affect inventory, supplier balances and accounting-related records together.

---

## Sales Workflow

Typical flow:

```text
Customer
   ↓
Sales Invoice
   ↓
Product + Exact Batch
   ↓
Stock Validation
   ↓
GST Calculation
   ↓
Financial-Year Invoice Number
   ↓
Stock Deduction
   ↓
Stock Movement
   ↓
Customer Ledger
   ↓
Optional Payment
   ↓
Audit Log
```

The backend is responsible for validating the exact batch and available stock.

---

## Sales Return Workflow

A Sales Return can:

* Reference the original sale
* Validate return quantity
* Adjust the relevant batch
* Create stock movement
* Adjust customer financial position
* Maintain transaction history
* Record audit information

---

## Purchase Return Workflow

A Purchase Return can:

* Reference the original purchase
* Validate returned quantity
* Adjust stock
* Create stock movement
* Adjust supplier-related balances
* Maintain transaction history
* Record audit information

---

# GST & Tax Calculation

GST calculations are centralized so that the same business logic can be reused across:

* Sales
* Purchases
* Reports
* GST summaries
* GSTR-related reporting
* PDF documents
* Exports

The calculation flow follows:

```text
Gross Amount
    ↓
Discount
    ↓
Taxable Amount
    ↓
GST
    ↓
CGST / SGST OR IGST
    ↓
Line Total
```

### Gross Amount

```text
grossAmount = qty × rate
```

### Discount

```text
discountAmount =
grossAmount × discountPercent / 100
```

### Taxable Amount

```text
taxableAmount =
grossAmount - discountAmount
```

### GST Amount

```text
gstAmount =
taxableAmount × gstRate / 100
```

---

## Intra-State GST

For intra-state transactions:

```text
CGST = GST / 2
SGST = GST / 2
IGST = 0
```

---

## Inter-State GST

For inter-state transactions:

```text
IGST = GST
CGST = 0
SGST = 0
```

---

## Final Line Total

```text
lineTotal =
taxableAmount + CGST + SGST + IGST
```

Amounts are rounded appropriately to two decimal places before final aggregation to reduce floating-point calculation drift.

---

# Financial Year Management

The ERP follows the Indian financial year structure:

```text
1 April → 31 March
```

Examples:

```text
FY 2025-26
1 Apr 2025 → 31 Mar 2026

FY 2026-27
1 Apr 2026 → 31 Mar 2027

FY 2027-28
1 Apr 2027 → 31 Mar 2028
```

The Financial Year logic is designed to be **dynamic rather than dependent on manually adding every future year**.

Future financial years should be generated from the date-based financial-year rule instead of maintaining a permanently hardcoded list.

Financial-year aware functionality can apply to:

* Sales
* Purchases
* Returns
* Payments
* Ledgers
* Outstanding
* Reports
* GST
* GSTR workflows
* Invoice numbering
* Exports

Important boundaries include:

```text
31 March
1 April
```

The application must correctly distinguish the previous and new financial year at this boundary.

---

# Inventory & Batch Management

Inventory is maintained at product and batch level.

Stock-affecting operations create stock movement records.

Typical movement sources include:

* Purchase
* Sale
* Sales Return
* Purchase Return
* Stock adjustment where supported

A simplified relationship is:

```text
Product
  ↓
Product Batch
  ↓
Stock Movement
```

This enables historical visibility into how stock changed.

---

## Exact Batch Sales

A sale references the exact batch being sold.

This is important for pharmaceutical inventory because:

* expiry differs between batches
* MRP can differ
* purchase rate can differ
* quantities are batch-specific
* stock must be deducted from the correct batch

---

# Payments, Ledgers & Outstanding

The ERP maintains customer and supplier financial information through:

* Payments
* Customer Ledger
* Supplier Ledger
* Outstanding
* Invoice balances
* Payment status

---

## Customer Ledger

Customer financial events may include:

* Sales
* Payments
* Returns
* Opening outstanding
* Other supported adjustments

---

## Supplier Ledger

Supplier financial events may include:

* Purchases
* Payments
* Purchase returns
* Opening payable
* Other supported adjustments

---

## Outstanding Management

Outstanding calculations can be used for:

* Customer receivables
* Supplier payables
* Invoice balances
* Ageing information
* Payment follow-up

Payments are validated against outstanding amounts according to the backend business rules.

---

# GST & GSTR Reporting

The ERP contains GST-oriented reporting workflows.

Supported/implemented reporting areas include:

* GST summary
* GSTR-1
* Inward / ITC reporting workflow
* GSTR-2B reconciliation support where applicable
* GSTR-3B-style reporting
* HSN-oriented summaries
* Document summaries
* GST reconciliation

The application uses underlying sales and purchase records as the source for report generation.

---

## GSTR-1

GSTR-1 reporting focuses on outward supplies derived from sales data.

The reporting workflow may include:

* B2B information
* B2C information
* Taxable values
* CGST
* SGST
* IGST
* HSN summary
* Document information

The exact report structure depends on the current implementation and supported business scenarios.

---

## Inward / ITC

Purchase-side GST information can be used to support:

* Input tax reporting
* Purchase GST analysis
* Supplier invoice references
* Book ITC
* Reconciliation workflows

---

## GSTR-2B Reconciliation

Where supported, GSTR-2B reconciliation can distinguish differences such as:

* Matched
* Books only
* GSTR-2B only
* Value mismatch
* Tax mismatch
* GSTIN mismatch
* Invoice mismatch

The reconciliation layer should not destroy or overwrite the underlying purchase book.

---

## GSTR-3B

GSTR-3B-style reporting is designed around the underlying transaction data and supported GST adjustments rather than assuming all purchase GST is automatically claimable ITC.

The internal ERP report should not be treated as an official government filing unless an authorized GST filing integration is specifically implemented.

---

# Documents, PDF, Print & Exports

The ERP includes business-document generation and export workflows.

Supported formats include:

* PDF
* A4 Print
* Excel/XLSX
* CSV
* DOCX

---

## PDF Generation

The PDF architecture uses a server-side generation pipeline.

```text
MongoDB
   ↓
Backend Controller / Service
   ↓
Document Builder / HTML Template
   ↓
Puppeteer
   ↓
PDF Buffer
   ↓
HTTP Response
   ↓
Frontend Blob / Preview / Download
```

The application is designed to keep binary PDF responses binary instead of serializing them into JSON.

---

## PDF Use Cases

PDF generation can be used for:

* Invoices
* Purchase documents
* Returns
* Receipts
* Ledgers
* Outstanding reports
* Stock reports
* GST reports
* GSTR-related reports
* Other supported business reports

---

## A4 Printing

Business documents are designed around practical A4 printing requirements.

Print layouts consider:

* A4 dimensions
* margins
* table overflow
* page breaks
* totals
* headers
* footers
* long addresses
* long product names
* GST details
* multi-page documents

Normal browser printing is supported through user-triggered browser print behavior.

---

## Excel / XLSX

Excel exports can support data such as:

* Products
* Customers
* Suppliers
* Sales
* Purchases
* Returns
* Payments
* Ledgers
* Outstanding
* Stock
* GST reports
* GSTR reports

The goal is to use consistent underlying report data across screen and export formats.

---

## CSV

CSV exports are designed for portability and external spreadsheet processing.

CSV handling should correctly support:

* UTF-8
* headers
* commas inside values
* long text
* quoted fields
* addresses
* customer names
* product names

---

## DOCX

DOCX export is provided for supported reports/documents.

The generated file is intended to be a standard Office Open XML document that can be opened in compatible word-processing software.

---

## Google Compatibility

The system does not automatically imply native Google Drive/Google Docs/Google Sheets API integration.

Instead, standard exported formats are designed to be portable:

```text
CSV  → Google Sheets
XLSX → Google Sheets
DOCX → Google Docs
PDF  → Browser / Google Drive preview
```

Actual Google API integration would require separate Google authentication/API configuration.

---

# Authentication & Security

Security is a core part of the ERP architecture.

## Authentication

The backend uses:

* JWT authentication
* bcrypt password hashing
* protected API routes
* authenticated frontend access

---

## Authorization

The backend enforces role/permission checks.

Frontend UI visibility is not considered sufficient security by itself.

The API must independently validate whether an authenticated user is allowed to perform a protected action.

---

## No Public Signup

The ERP is not designed as a public registration application.

Only authorized ERP users can access the system.

Business entities such as customers and suppliers are maintained as master records rather than login users.

---

## Environment Secrets

Sensitive values are kept outside the public source repository.

Examples include:

* MongoDB connection string
* JWT secret
* production admin bootstrap password
* API credentials
* deployment secrets

Public `.env.example` files contain placeholders rather than production secrets.

---

# Database Architecture

The application uses:

```text
MongoDB
+
Mongoose
```

Core models/collections include:

* Company
* User
* Customer
* Supplier
* Product
* ProductBatch
* Purchase
* PurchaseReturn
* Sale
* SalesReturn
* Payment
* Expense
* StockMovement
* CustomerLedger
* SupplierLedger
* AuditLog
* Notification
* Backup
* Counter
* GSTR2BImport where supported

---

# Important Data Relationships

Simplified relationship structure:

```text
Customer
   ├── Sales
   ├── Payments
   └── Customer Ledger

Supplier
   ├── Purchases
   ├── Payments
   ├── Product Batches
   └── Supplier Ledger

Product
   ├── Product Batches
   ├── Sales
   └── Purchases

Product Batch
   ├── Sales
   └── Stock Movements
```

The application uses stable business identifiers such as:

```text
CUST-000001
SUPP-000001
PRD-000001
BAT-000001
PUR-000001
INV-000001
SR-000001
PR-000001
PAY-000001
EXP-000001
```

where applicable.

---

# Application Architecture

High-level architecture:

```text
┌──────────────────────────────────────┐
│            React Frontend            │
│                                      │
│ Pages / Components / Context / Hooks │
└──────────────────┬───────────────────┘
                   │
                   ▼
             Axios API Layer
                   │
                   ▼
┌──────────────────────────────────────┐
│          Node.js + Express           │
│                                      │
│ Routes                               │
│   ↓                                  │
│ Authentication / Authorization       │
│   ↓                                  │
│ Controllers                          │
│   ↓                                  │
│ Services                             │
│   ├── GST                            │
│   ├── Stock                          │
│   ├── Ledger                         │
│   ├── Invoice Number                 │
│   ├── Reports                        │
│   ├── PDF                            │
│   ├── Export                         │
│   ├── Backup                         │
│   └── Audit                          │
└──────────────────┬───────────────────┘
                   │
                   ▼
             Mongoose Models
                   │
                   ▼
              MongoDB
```

---

# Technology Stack

## Frontend

* React 18
* Vite
* React Router
* Axios
* Recharts
* Day.js
* CSS / responsive styling

---

## Backend

* Node.js
* Express
* MongoDB
* Mongoose
* JWT
* bcryptjs
* Express Validator
* Helmet
* CORS
* Express Rate Limit
* Morgan
* Multer
* Day.js

---

## Reporting & Documents

* Puppeteer
* ExcelJS
* DOCX
* CSV generation
* Browser Print APIs

---

## Testing

* Jest
* Supertest
* MongoDB Memory Server where applicable
* Deterministic QA scripts
* Financial-year test utilities
* PDF/export test utilities

---

# Project Structure

```text
Laetus-Life-Sciences-ERP/
│
├── frontend/
│   │
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── invoice/
│   │   │   ├── layout/
│   │   │   └── system/
│   │   ├── config/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   ├── batches/
│   │   │   ├── company/
│   │   │   ├── customers/
│   │   │   ├── dashboard/
│   │   │   ├── gst/
│   │   │   ├── inventory/
│   │   │   ├── ledger/
│   │   │   ├── payments/
│   │   │   ├── products/
│   │   │   ├── purchases/
│   │   │   ├── reports/
│   │   │   ├── returns/
│   │   │   ├── sales/
│   │   │   ├── suppliers/
│   │   │   └── users/
│   │   ├── styles/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js
│   └── ...
│
├── backend/
│   │
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── jobs/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── templates/
│   │   ├── utils/
│   │   └── validators/
│   │
│   ├── seed/
│   ├── scripts/
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
├── docs/
├── README.md
├── API_CONTRACT.md
├── DATABASE_SCHEMA.md
├── SETUP.md
├── TESTING.md
├── DEPLOYMENT.md
└── ...
```

---

# API Architecture

The frontend communicates with the Express backend through dedicated API modules.

Examples include APIs for:

* Authentication
* Customers
* Suppliers
* Products
* Batches
* Purchases
* Sales
* Returns
* Payments
* Dashboard
* Ledger
* GST
* Reports
* Exports
* Notifications
* Company Settings
* Backups
* Audit logs

A centralized Axios/API configuration is used to keep the frontend API layer consistent.

---

# Data Persistence & Transaction Safety

MongoDB is the source of truth for business data.

The application should not treat:

* React state
* localStorage
* sessionStorage

as the permanent source of truth for financial transactions.

Important operations are designed around MongoDB transactions where atomicity is required.

---

## Sale Transaction Example

A successful Sale may perform:

```text
Validate Customer
        ↓
Validate Product
        ↓
Validate Exact Batch
        ↓
Validate Stock
        ↓
Validate Expiry
        ↓
Calculate GST
        ↓
Generate Invoice Number
        ↓
Create Sale
        ↓
Deduct Stock
        ↓
Create Stock Movement
        ↓
Create Customer Ledger Entry
        ↓
Create Payment if applicable
        ↓
Update balances/status
        ↓
Create Audit Log
```

If a transactional failure occurs, the related operations should roll back together when transaction support is available.

---

# Responsive Design

The frontend is designed for:

* Mobile
* Tablet
* Desktop

Important responsive considerations include:

* Navigation
* Forms
* Tables
* Dialogs
* Invoice layouts
* Reports
* Dashboard cards
* Search controls
* Dropdowns
* Export actions

Representative responsive testing sizes include:

```text
Mobile:
320px
360px
375px
390px
414px

Tablet:
768px
820px
1024px

Desktop:
1280px+
1366px+
1440px+
1920px+
```

Large business tables should remain usable without losing critical information.

---

# Testing & QA

The project includes automated and deterministic testing utilities.

Important areas include:

* Authentication
* RBAC
* Customers
* Products
* Purchases
* Sales
* Payments
* Returns
* GST calculations
* Invoice numbering
* Export/report behavior

---

## End-to-End QA Areas

The ERP can be validated through workflows such as:

```text
Login
 ↓
Company Settings
 ↓
Customer
 ↓
Supplier
 ↓
Product
 ↓
Batch
 ↓
Purchase
 ↓
Stock
 ↓
Sale
 ↓
Invoice
 ↓
Payment
 ↓
Ledger
 ↓
Outstanding
 ↓
Return
 ↓
GST
 ↓
GSTR
 ↓
Exports
 ↓
Dashboard
```

---

## Financial-Year QA

Important financial-year boundary tests include:

```text
31 March 2026
1 April 2026

31 March 2027
1 April 2027

31 March 2028
1 April 2028
```

The goal is to ensure that future financial years can be recognized dynamically instead of requiring manual source-code changes.

---

# Environment Configuration

The repository intentionally uses example environment files.

Backend configuration may include values such as:

```env
NODE_ENV=
PORT=
MONGO_URI=
JWT_SECRET=
JWT_EXPIRES_IN=
CLIENT_ORIGIN=
UPLOAD_DIR=
BACKUP_DIR=
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
```

Frontend configuration may include the production API base URL, for example:

```env
VITE_API_BASE_URL=
```

Exact variable names should always follow the repository's current `.env.example` files.

---

## Important Security Rule

Never commit:

```text
.env
.env.local
.env.production
production passwords
MongoDB credentials
JWT secrets
API keys
private tokens
private certificates
business backups
```

Use environment variables provided by the deployment platform.

---

# Local Development Setup

## 1. Clone the repository

```bash
git clone https://github.com/Vaibhav-dev2026/Laetus-Life-Sciences-ERP.git
cd Laetus-Life-Sciences-ERP
```

---

## 2. Backend Setup

```bash
cd backend
npm install
```

Create:

```text
backend/.env
```

using:

```text
backend/.env.example
```

Configure the required backend values.

Then run:

```bash
npm start
```

or for development:

```bash
npm run dev
```

---

## 3. Frontend Setup

Open a second terminal:

```bash
cd frontend
npm install
```

Create:

```text
frontend/.env
```

using:

```text
frontend/.env.example
```

Configure the backend API URL.

Then run:

```bash
npm run dev
```

---

## Local Application

Typical development endpoints:

```text
Frontend:
http://localhost:5173

Backend:
http://localhost:5000

API:
http://localhost:5000/api
```

Exact ports should follow the current environment configuration.

---

# Production Deployment

The planned production architecture is:

```text
GitHub
   │
   ├───────────────┐
   ▼               ▼
Vercel           Render
Frontend         Backend
                    │
                    ▼
              MongoDB Atlas
```

---

# Deployment Architecture

## Frontend — Vercel

The React/Vite frontend can be deployed from:

```text
frontend/
```

The frontend receives its production API URL through environment configuration.

Example concept:

```env
VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

Do not expose:

* MongoDB URI
* JWT secret
* database password
* private API secrets

through frontend variables.

---

## Backend — Render

The backend can be deployed as a Node/Express web service.

Typical configuration:

```text
Root Directory:
backend
```

The backend should use:

* production environment variables
* MongoDB Atlas
* correct PORT handling
* CORS configuration
* portable Puppeteer/Chromium configuration
* secure JWT configuration

---

## Database — MongoDB Atlas

MongoDB Atlas is intended to host the production MongoDB database.

The frontend must never connect directly to MongoDB Atlas.

The correct flow is:

```text
Browser
   ↓
Vercel
   ↓
Render API
   ↓
MongoDB Atlas
```

Database credentials remain server-side.

---

# Production PDF / Puppeteer

PDF generation uses Puppeteer and therefore requires a compatible browser runtime on the backend host.

Production deployment must ensure:

* Chromium/browser availability
* compatible launch configuration
* Linux-compatible executable configuration where required
* sufficient memory
* correct timeout handling

The application should not depend on a Windows-only Chrome executable path.

---

# Backups & Data Protection

The ERP includes backup-related functionality.

Where supported, backup functionality can include:

* Manual backup
* Backup records
* Restore utilities
* Scheduled backup jobs

MongoDB Atlas's own backup facilities should be considered an important production safety layer for the primary database.

Application-level backup tools should be treated as an additional operational layer.

---

# File Storage

The ERP can work with uploaded/generated files such as:

* Company logos
* Generated reports
* Documents
* Temporary exports
* Backup artifacts

Production deployments should distinguish between:

### Temporary/reproducible files

These can be regenerated when needed.

### Important business files

These should use durable storage when the hosting environment's local filesystem is not permanent.

---

# Public Repository Security

This repository is public for project showcase purposes.

Public source code does not mean the production database or credentials should be public.

The repository intentionally excludes sensitive values such as:

* MongoDB credentials
* JWT secrets
* Production passwords
* API keys
* Private tokens
* Production environment files

Production credentials must be supplied through secure deployment environment variables.

---

# Development Principles

The project follows several important engineering principles.

## Single Source of Truth

Important business calculations should not be independently reimplemented in every page.

Examples:

* GST calculations
* Financial-year calculation
* Company information
* Invoice numbering
* Stock logic
* Reporting data

---

## Backend as the Business Authority

Critical financial and inventory validation belongs on the backend.

Frontend values should not be treated as inherently trusted.

---

## Transaction Safety

Financial workflows should avoid partial updates.

---

## Auditability

Important business actions should be traceable through audit logs where supported.

---

## Historical Data Protection

Historical financial transactions should not be casually hard-deleted.

Appropriate workflows may include:

* cancellation
* voiding
* reversal
* deactivation
* archival

instead of destructive deletion.

---

## Safe Cleanup

QA/test data should be clearly identifiable before cleanup.

Production data must never be removed using indiscriminate database operations.

---

# Project Documentation

Additional documentation in this repository includes:

## API Contract

`API_CONTRACT.md`

Documents the API structure and endpoint behavior.

---

## Database Schema

`DATABASE_SCHEMA.md`

Documents:

* models
* important fields
* indexes
* relationships
* transactions
* GST calculation structure

---

## Setup Guide

`SETUP.md`

Contains local setup and development information.

---

## Testing Guide

`TESTING.md`

Contains testing workflows and test coverage information.

---

## Deployment Guide

`DEPLOYMENT.md`

Contains deployment-related instructions and environment requirements.

---

# Current Project Status

The project is being prepared for production deployment using:

```text
GitHub
   ↓
Vercel
   +
Render
   ↓
MongoDB Atlas
```

The intended release process is:

```text
Final Code Audit
      ↓
QA / Dummy Data Testing
      ↓
Bug Fixing
      ↓
Retesting
      ↓
Financial-Year Verification
      ↓
PDF / Print / Excel / CSV / DOCX Verification
      ↓
Responsive Testing
      ↓
Database Persistence Verification
      ↓
QA Data Cleanup
      ↓
Clean-State Smoke Test
      ↓
GitHub
      ↓
MongoDB Atlas
      ↓
Render
      ↓
Vercel
      ↓
Live Production Smoke Test
      ↓
Real Business Data Entry
```

The live production URL will be added here after successful deployment:

```text
Live Application:
https://your-production-domain.example
```

---

# Important Usage Notes

This project is an ERP application rather than a generic public website.

Production operation should therefore prioritize:

* data integrity
* authentication
* authorization
* transaction consistency
* database persistence
* auditability
* document accuracy
* GST calculation accuracy
* inventory correctness
* backup strategy

Before entering real production business data, the deployed environment should be tested end-to-end using controlled QA data.

---

# Screenshots

Screenshots can be added here for project showcase.

Recommended screenshots:

1. Login screen
2. Dashboard
3. Customer management
4. Supplier management
5. Product management
6. Batch management
7. Purchase entry
8. Sales billing
9. Invoice preview
10. Stock report
11. Customer ledger
12. Supplier ledger
13. Outstanding report
14. GST report
15. GSTR-1
16. GSTR-3B
17. PDF invoice
18. Mobile responsive UI
19. Tablet responsive UI

Do not upload screenshots containing:

* passwords
* JWT tokens
* MongoDB credentials
* private API keys
* sensitive production customer information
* private financial records

Use sanitized or demonstration data for public screenshots.

---

# Future Enhancement Areas

Potential future enhancements include:

* Advanced analytics
* More comprehensive GST reconciliation
* Cloud object storage for business files
* Advanced notification workflows
* Fine-grained permission management
* More automated reporting
* Advanced audit analytics
* Multi-location inventory
* Barcode/QR workflows
* E-invoicing integration where applicable
* Authorized GST API integrations where applicable
* Additional integrations with external business services

These should be introduced without compromising the existing transactional and financial architecture.

---

# Disclaimer

This is an application-level ERP implementation intended to support pharmaceutical business operations.

GST/GSTR screens and reports should be reviewed against the applicable current statutory requirements before being used for formal tax filing.

The application should not be represented as an official government filing portal unless an authorized filing integration has actually been implemented.

---

# Author

## Vaibhav Tiwari

Full-Stack Developer

### Project

**L LAETUS LIFE SCIENCES ERP**

### Location

Surat, Gujarat, India

### Technologies

```text
React.js
Node.js
Express.js
MongoDB
Mongoose
JWT
bcrypt
Puppeteer
ExcelJS
DOCX
Jest
Supertest
Vite
Recharts
Day.js
```

---

# Repository

GitHub:

https://github.com/Vaibhav-dev2026/Laetus-Life-Sciences-ERP

---

## Built With

```text
React
+
Node.js
+
Express
+
MongoDB
+
Mongoose
+
JWT
+
Puppeteer
+
ExcelJS
+
DOCX
+
Jest
```

---

## Project Vision

The goal of L LAETUS LIFE SCIENCES ERP is to provide a practical, secure and maintainable pharmaceutical business-management platform that combines:

```text
Inventory
+
Purchasing
+
Sales
+
Billing
+
Payments
+
Ledgers
+
Outstanding
+
GST
+
GSTR Reporting
+
Documents
+
Analytics
+
Auditability
```

into one integrated system.

