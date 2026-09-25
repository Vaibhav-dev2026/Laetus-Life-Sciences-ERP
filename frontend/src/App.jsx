import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import ErrorBoundary from './components/layout/ErrorBoundary.jsx';
import LoadingState from './components/common/LoadingState.jsx';

const Login = lazy(() => import('./pages/auth/Login.jsx'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard.jsx'));

const CustomerList = lazy(() => import('./pages/customers/CustomerList.jsx'));
const CustomerForm = lazy(() => import('./pages/customers/CustomerForm.jsx'));
const CustomerDetail = lazy(() => import('./pages/customers/CustomerDetail.jsx'));

const SupplierList = lazy(() => import('./pages/suppliers/SupplierList.jsx'));
const SupplierForm = lazy(() => import('./pages/suppliers/SupplierForm.jsx'));
const SupplierDetail = lazy(() => import('./pages/suppliers/SupplierDetail.jsx'));

const ProductList = lazy(() => import('./pages/products/ProductList.jsx'));
const ProductForm = lazy(() => import('./pages/products/ProductForm.jsx'));
const ProductDetail = lazy(() => import('./pages/products/ProductDetail.jsx'));

const BatchList = lazy(() => import('./pages/batches/BatchList.jsx'));
const BatchDetail = lazy(() => import('./pages/batches/BatchDetail.jsx'));

const InventoryDashboard = lazy(() => import('./pages/inventory/InventoryDashboard.jsx'));

const PurchaseList = lazy(() => import('./pages/purchases/PurchaseList.jsx'));
const PurchaseForm = lazy(() => import('./pages/purchases/PurchaseForm.jsx'));
const PurchaseDetail = lazy(() => import('./pages/purchases/PurchaseDetail.jsx'));

const SalesList = lazy(() => import('./pages/sales/SalesList.jsx'));
const SalesInvoiceForm = lazy(() => import('./pages/sales/SalesInvoiceForm.jsx'));
const SalesInvoiceView = lazy(() => import('./pages/sales/SalesInvoiceView.jsx'));
const SalesInvoiceEditForm = lazy(() => import('./pages/sales/SalesInvoiceEditForm.jsx'));

const PaymentList = lazy(() => import('./pages/payments/PaymentList.jsx'));
const SalesReturn = lazy(() => import('./pages/returns/SalesReturn.jsx'));
const PurchaseReturn = lazy(() => import('./pages/returns/PurchaseReturn.jsx'));
const ExpenseList = lazy(() => import('./pages/expenses/ExpenseList.jsx'));

const OutstandingReport = lazy(() => import('./pages/outstanding/OutstandingReport.jsx'));
const CustomerLedger = lazy(() => import('./pages/ledger/CustomerLedger.jsx'));
const SupplierLedger = lazy(() => import('./pages/ledger/SupplierLedger.jsx'));

const SalesPurchaseStockReport = lazy(() => import('./pages/reports/ReportsCenter.jsx').then((m) => ({ default: m.SalesPurchaseStockReport })));
const FinancialReport = lazy(() => import('./pages/reports/ReportsCenter.jsx').then((m) => ({ default: m.FinancialReport })));

const GSTR1 = lazy(() => import('./pages/gst/GSTR1.jsx'));
const ITCReconciliation = lazy(() => import('./pages/gst/ITCReconciliation.jsx'));
const GSTR3B = lazy(() => import('./pages/gst/GSTR3B.jsx'));
const GSTReportsCenter = lazy(() => import('./pages/gst/GSTReportsCenter.jsx'));

const AuditLogs = lazy(() => import('./pages/audit/AuditLogs.jsx'));
const CompanySettings = lazy(() => import('./pages/company/CompanySettings.jsx'));
const MyAccount = lazy(() => import('./pages/users/MyAccount.jsx'));
const DatabaseMaintenance = lazy(() => import('./pages/maintenance/DatabaseMaintenance.jsx'));
const NotificationCenter = lazy(() => import('./pages/notifications/NotificationCenter.jsx'));
const BackupScreen = lazy(() => import('./pages/backup/BackupScreen.jsx'));

const NotFound = lazy(() => import('./pages/errors/NotFound.jsx'));

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div style={{ padding: 60 }}><LoadingState label="Loading Laetus Life Sciences ERP…" /></div>}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/customers" element={<CustomerList />} />
            <Route path="/customers/new" element={<CustomerForm />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/customers/:id/edit" element={<CustomerForm />} />

            <Route path="/suppliers" element={<SupplierList />} />
            <Route path="/suppliers/new" element={<SupplierForm />} />
            <Route path="/suppliers/:id" element={<SupplierDetail />} />
            <Route path="/suppliers/:id/edit" element={<SupplierForm />} />

            <Route path="/products" element={<ProductList />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/products/:id/edit" element={<ProductForm />} />

            <Route path="/batches" element={<BatchList />} />
            <Route path="/batches/:id" element={<BatchDetail />} />

            <Route path="/inventory" element={<InventoryDashboard />} />

            <Route path="/purchases" element={<PurchaseList />} />
            <Route path="/purchases/new" element={<PurchaseForm />} />
            <Route path="/purchases/:id" element={<PurchaseDetail />} />
            <Route path="/purchases/:id/edit" element={<PurchaseForm />} />

            <Route path="/sales" element={<SalesList />} />
            <Route path="/sales/new" element={<SalesInvoiceForm />} />
            <Route path="/sales/:id/edit" element={<SalesInvoiceEditForm />} />
            <Route path="/sales/:id" element={<SalesInvoiceView />} />

            <Route path="/payments" element={<PaymentList />} />
            <Route path="/sales-return" element={<SalesReturn />} />
            <Route path="/purchase-return" element={<PurchaseReturn />} />
            <Route path="/expenses" element={<ExpenseList />} />

            <Route path="/outstanding" element={<OutstandingReport />} />
            <Route path="/outstanding/customer/:id" element={<OutstandingReport />} />
            <Route path="/ledger/customer" element={<CustomerLedger />} />
            <Route path="/ledger/supplier" element={<SupplierLedger />} />

            <Route path="/reports/financial" element={<FinancialReport />} />
            <Route path="/reports/:type" element={<SalesPurchaseStockReport />} />

            <Route path="/gst/reports" element={<GSTReportsCenter />} />
            <Route path="/gst/gstr1" element={<GSTR1 />} />
            <Route path="/gst/itc-reconciliation" element={<ITCReconciliation />} />
            <Route path="/gst/gstr3b" element={<GSTR3B />} />

            <Route path="/audit-logs" element={<ProtectedRoute roles={['Admin']}><AuditLogs /></ProtectedRoute>} />
            <Route path="/notifications" element={<NotificationCenter />} />

            <Route path="/settings/company" element={<ProtectedRoute roles={['Admin']}><CompanySettings /></ProtectedRoute>} />
            <Route path="/settings/account" element={<ProtectedRoute roles={['Admin']}><MyAccount /></ProtectedRoute>} />
            <Route path="/settings/maintenance" element={<ProtectedRoute roles={['Admin']}><DatabaseMaintenance /></ProtectedRoute>} />
            <Route path="/settings/backup" element={<ProtectedRoute roles={['Admin']}><BackupScreen /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
