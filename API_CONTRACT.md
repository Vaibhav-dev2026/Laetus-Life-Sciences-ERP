# API CONTRACT — Laetus Life Sciences ERP

Base URL: `{{baseUrl}}` = `http://localhost:5000/api` (see Postman collection in `backend/postman/`)

All responses follow:

```json
{ "success": true, "message": "…", "data": {} }
{ "success": true, "data": [ … ], "pagination": { "page": 1, "limit": 25, "total": 250, "totalPages": 10 } }
{ "success": false, "message": "Validation failed", "errors": [ { "field": "gstin", "message": "…" } ] }
```

Every route below requires `Authorization: Bearer <token>` unless marked **Public**.

## Auth
| Method | Path | Permission | Body | Notes |
|---|---|---|---|---|
| POST | /auth/login | Public | `{ email, password }` | Rate-limited. Returns `{ accessToken, user }` |
| GET | /auth/me | Any | – | Current user |
| POST | /auth/logout | Any | – | Stateless — client discards token |

## Company
| Method | Path | Permission |
|---|---|---|
| GET | /company | Any |
| PUT | /company | Admin |

## Users
| Method | Path | Permission |
|---|---|---|
| GET | /users | Admin |
| POST | /users | Admin |
| PUT | /users/:id | Admin |

## Customers / Suppliers / Products (identical shape)
| Method | Path | Permission |
|---|---|---|
| GET | /customers?search=&status=&page=&limit= | Any |
| GET | /customers/:id | Any |
| POST | /customers | Admin, Billing |
| PUT | /customers/:id | Admin, Billing |
| PATCH | /customers/:id/status | Admin, Billing |

Same shape for `/suppliers` (Admin, Purchase) and `/products` (Admin, Inventory).

## Batches
| Method | Path | Permission |
|---|---|---|
| GET | /batches?productId=&supplierId=&status=&search= | Any |
| GET | /batches/:id | Any |
| POST | /batches/adjust | Admin, Inventory — `{ batchId, type: Increase\|Decrease, qty, reason, remarks }` |

## Purchases
| Method | Path | Permission | Body |
|---|---|---|---|
| GET | /purchases?search=&supplierId= | Any |
| GET | /purchases/:id | Any |
| POST | /purchases | Admin, Purchase | `{ purchaseInvoiceNo, purchaseDate, supplierId, supplierInvoiceNo, dueDate, lines:[{productId,batchNo,mfgDate,expDate,qty,freeQty,rate,discountPct,gstRate}], amountPaid }` |
| PATCH | /purchases/:id/cancel | Admin | `{ reason }` |

## Sales
| Method | Path | Permission | Body |
|---|---|---|---|
| GET | /sales?search=&customerId= | Any |
| GET | /sales/:id | Any |
| POST | /sales | Admin, Billing | `{ customerId, date, dueDate, lines:[{productId,batchId,qty,rate,discountPct,gstRate,hsn,productName}], amountReceived, paymentMode }` |
| PATCH | /sales/:id/cancel | Admin | `{ reason }` |

Server recalculates every GST figure and rejects if a batch is out of stock or (per company policy) expired. Invoice numbers are generated atomically and are FY-aware (`LLS/25-26/000123`).

## Payments
| Method | Path | Permission | Body |
|---|---|---|---|
| GET | /payments?partyId=&partyType= | Any |
| POST | /payments | Admin, Accounts, Billing | `{ partyId, partyType: Customer\|Supplier, invoiceId?, amount, mode, date, reference, remarks }` |

Rejects with 400 if `amount` exceeds the current outstanding/payable.

## Returns
| Method | Path | Permission | Body |
|---|---|---|---|
| GET | /returns/sales | Any |
| POST | /returns/sales | Admin, Billing | `{ saleId, lineIndex, qty, reason }` |
| GET | /returns/purchases | Any |
| POST | /returns/purchases | Admin, Purchase | `{ purchaseId, lineIndex, qty, reason }` |

## Expenses
| Method | Path | Permission |
|---|---|---|
| GET / POST / PUT | /expenses | Admin, Accounts |

## Outstanding / Ledger
| Method | Path | Permission |
|---|---|---|
| GET | /outstanding?customerId=&from=&to=&ageing= | Any — returns `{ rows, ageingTotals }` |
| GET | /ledger/customer?customerId=&from=&to= | Any — returns `{ customer, entries }` |
| GET | /ledger/supplier?supplierId=&from=&to= | Any — returns `{ supplier, entries }` |

## Reports
| Method | Path |
|---|---|
| GET | /reports/sales?from=&to= |
| GET | /reports/purchases?from=&to= |
| GET | /reports/stock |
| GET | /reports/financial |

## GST
| Method | Path |
|---|---|
| GET | /gst/gstr1?from=&to= |
| GET | /gst/itc-reconciliation |
| GET | /gst/gstr3b |

## Dashboard (aggregation-backed)
| Method | Path |
|---|---|
| GET | /dashboard/summary |
| GET | /dashboard/sales-trend |
| GET | /dashboard/purchase-vs-sales |
| GET | /dashboard/top-products |
| GET | /dashboard/outstanding-ageing |
| GET | /dashboard/gst-summary |

## Notifications
| Method | Path |
|---|---|
| GET | /notifications |
| PATCH | /notifications/:id/read |
| PATCH | /notifications/read-all |

## Audit Logs
| Method | Path | Permission |
|---|---|---|
| GET | /audit-logs?module=&action=&from=&to=&search= | Admin |

## Backup
| Method | Path | Permission | Body |
|---|---|---|---|
| GET | /backup | Admin |
| POST | /backup/create | Admin |
| POST | /backup/restore/:id | Admin (SuperAdmin re-checked in controller) | `{ confirm: "RESTORE" }` |

## Uploads
| Method | Path | Permission |
|---|---|---|
| POST | /uploads/logo (multipart, field `file`) | Admin |

## Exports
| Method | Path |
|---|---|
| GET | /exports/:report/:format  (report=outstanding, format=xlsx\|docx) |

## PDF
| Method | Path |
|---|---|
| GET | /pdf/invoice/:id — streams a generated A4 GST invoice PDF |

## Health
| Method | Path | Public |
|---|---|---|
| GET | /health | Yes |

---

### Error responses

| Status | Meaning |
|---|---|
| 400 | Validation failed / business rule violated (e.g. insufficient stock, overpayment) |
| 401 | Missing/invalid token, or inactive account |
| 403 | Authenticated but not permitted for this action |
| 404 | Resource not found |
| 409 | Duplicate key (e.g. SKU, batch, invoice number) |
| 500 | Unexpected server error (message withheld in production) |
