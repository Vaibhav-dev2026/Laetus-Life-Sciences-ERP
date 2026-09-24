import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import StatCard from '../../components/common/StatCard.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import ExportActions from '../../components/common/ExportActions.jsx';
import DateRangeFilter from '../../components/common/DateRangeFilter.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { reportApi } from '../../api/reportApi.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

import { getDynamicFinancialYears, getCurrentFinancialYear, formatFyLabel } from '../../utils/financialYear.js';

const REPORT_DEFS = {
  sales: {
    title: 'Sales Report', description: 'Daily, monthly, customer-wise and product-wise sales.',
    fetch: (params) => reportApi.salesReport(params),
    columns: [
      { key: 'invoiceNo', label: 'Invoice No' }, { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
      { key: 'customer', label: 'Customer' }, { key: 'items', label: 'Items', align: 'right' },
      { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatCurrency(r.amount) },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ],
  },
  purchases: {
    title: 'Purchase Report', description: 'Supplier-wise and product-wise purchase totals.',
    fetch: (params) => reportApi.purchaseReport(params),
    columns: [
      { key: 'purchaseInvoiceNo', label: 'Purchase Invoice' }, { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
      { key: 'supplier', label: 'Supplier' }, { key: 'items', label: 'Items', align: 'right' },
      { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatCurrency(r.amount) },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ],
  },
  stock: {
    title: 'Stock Report', description: 'Current stock, valuation and expiry status by batch.',
    fetch: (params) => reportApi.stockReport(params),
    columns: [
      { key: 'product', label: 'Product' }, { key: 'batchNo', label: 'Batch', className: 'mono' },
      { key: 'expiry', label: 'Expiry', render: (r) => formatDate(r.expiry) }, { key: 'qty', label: 'Qty', align: 'right' },
      { key: 'value', label: 'Stock Value', align: 'right', render: (r) => formatCurrency(r.value) },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ],
  },
};

export function SalesPurchaseStockReport() {
  const { type } = useParams();
  const def = REPORT_DEFS[type] || REPORT_DEFS.sales;
  usePageTitle(def.title);

  const [financialYear, setFinancialYear] = useState(() => getCurrentFinancialYear());
  const [range, setRange] = useState({ from: '', to: '' });

  const queryParams = { ...range, financialYear };
  const { data, loading, error, reload } = useAsync(() => def.fetch(queryParams), [type, range.from, range.to, financialYear]);

  const fyOptions = getDynamicFinancialYears();

  return (
    <div className="page-body">
      <PageHeader
        title={def.title}
        description={def.description}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-control" style={{ width: 140 }} value={financialYear} onChange={(e) => setFinancialYear(e.target.value)}>
              {fyOptions.map((fy) => <option key={fy} value={fy}>{formatFyLabel(fy)}</option>)}
            </select>
            <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
            <ExportActions reportKey={type || 'sales'} filename={`${type || 'sales'}_report`} params={queryParams} />
          </div>
        }
      />

      <div className="card">
        <DataTable columns={def.columns} rows={data || []} loading={loading} error={error} onRetry={reload} emptyTitle="No data available for this report yet." />
      </div>
    </div>
  );
}

export function FinancialReport() {
  usePageTitle('Financial Reports');

  const [financialYear, setFinancialYear] = useState(() => getCurrentFinancialYear());
  const [range, setRange] = useState({ from: '', to: '' });

  const queryParams = { ...range, financialYear };
  const { data, loading, error, reload } = useAsync(() => reportApi.financialReport(queryParams), [range.from, range.to, financialYear]);

  const fyOptions = getDynamicFinancialYears();

  return (
    <div className="page-body">
      <PageHeader
        title="Financial Reports"
        description="Customer outstanding, supplier payable, payments and expenses."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-control" style={{ width: 140 }} value={financialYear} onChange={(e) => setFinancialYear(e.target.value)}>
              {fyOptions.map((fy) => <option key={fy} value={fy}>{formatFyLabel(fy)}</option>)}
            </select>
            <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
            <ExportActions reportKey="sales" filename="financial_report" params={queryParams} />
          </div>
        }
      />

      {loading || error ? (
        error ? (
          <div className="card card-pad"><span className="form-error">{error}</span> <button className="btn btn-secondary btn-sm" onClick={reload}>Retry</button></div>
        ) : (
          <div className="skeleton" style={{ height: 200 }} />
        )
      ) : (
        <div className="stat-grid">
          <StatCard label="Customer Outstanding" value={formatCurrency(data?.receivable || 0)} icon="📋" />
          <StatCard label="Supplier Payable" value={formatCurrency(data?.payable || 0)} icon="📕" />
          <StatCard label="Total Payments Received" value={formatCurrency(data?.totalPayments || 0)} icon="💳" />
          <StatCard label="Total Expenses" value={formatCurrency(data?.totalExpenses || 0)} icon="💰" />
        </div>
      )}
    </div>
  );
}
