import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import ExportActions from '../../components/common/ExportActions.jsx';
import SearchBox from '../../components/common/SearchBox.jsx';
import DateRangeFilter from '../../components/common/DateRangeFilter.jsx';
import StatCard from '../../components/common/StatCard.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { gstApi } from '../../api/gstApi.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

import { getDynamicFinancialYears, getCurrentFinancialYear, formatFyLabel } from '../../utils/financialYear.js';

export default function ITCReconciliation() {
  usePageTitle('GSTR-2 / Inward & ITC Reconciliation');
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [financialYear, setFinancialYear] = useState(searchParams.get('financialYear') || getCurrentFinancialYear());
  const [range, setRange] = useState({
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  });
  const debouncedSearch = useDebounce(search, 250);

  const fyOptions = getDynamicFinancialYears();

  const { data: rawData, loading, error, reload } = useAsync(
    () => gstApi.itcReconciliation({ from: range.from, to: range.to, financialYear }),
    [range.from, range.to, financialYear]
  );

  const rows = useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    return rawData.rows || [];
  }, [rawData]);

  const recoSummary = rawData?.summary || {};
  const hasPortalData = (recoSummary.totalImported2b || 0) > 0;

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQ = !q || (
        (r.supplierGstin || '').toLowerCase().includes(q) ||
        (r.supplierName || '').toLowerCase().includes(q) ||
        (r.invoiceNo || '').toLowerCase().includes(q)
      );
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchesQ && matchesStatus;
    });
  }, [rows, debouncedSearch, statusFilter]);

  const metrics = useMemo(() => {
    const m = { inputCgst: 0, inputSgst: 0, inputIgst: 0, totalBookItc: 0, matched: 0, booksOnly: 0, portalOnly: 0, mismatch: 0 };
    rows.forEach((r) => {
      m.inputCgst += Number(r.bookCgst || 0);
      m.inputSgst += Number(r.bookSgst || 0);
      m.inputIgst += Number(r.bookIgst || 0);
      m.totalBookItc += Number(r.bookTotalTax || 0);
      if (r.status === 'MATCHED') m.matched += Number(r.bookTotalTax || 0);
      else if (r.status === 'BOOKS ONLY') m.booksOnly += Number(r.bookTotalTax || 0);
      else if (r.status === 'GSTR2B ONLY') m.portalOnly += Number(r.portalTotalTax || 0);
      else m.mismatch += Number(r.bookTotalTax || 0);
    });
    return m;
  }, [rows]);

  const statusBadgeClass = (status) => {
    switch (status) {
      case 'MATCHED': return 'badge-success';
      case 'BOOKS ONLY': return 'badge-warning';
      case 'GSTR2B ONLY': return 'badge';
      case 'TAX MISMATCH': return 'badge-danger';
      case 'VALUE MISMATCH': return 'badge-danger';
      default: return 'badge-secondary';
    }
  };

  const columns = [
    {
      key: 'status',
      label: 'Status',
      render: (r) => <span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span>,
    },
    { key: 'supplierName', label: 'Supplier Name', sortable: true },
    { key: 'supplierGstin', label: 'Supplier GSTIN', className: 'mono' },
    { key: 'invoiceNo', label: 'Invoice No', className: 'mono' },
    { key: 'invoiceDate', label: 'Invoice Date', sortable: true, render: (r) => formatDate(r.invoiceDate) },
    { key: 'bookTaxable', label: 'Books Taxable', align: 'right', render: (r) => formatCurrency(r.bookTaxable) },
    { key: 'bookCgst', label: 'Books CGST', align: 'right', render: (r) => formatCurrency(r.bookCgst) },
    { key: 'bookSgst', label: 'Books SGST', align: 'right', render: (r) => formatCurrency(r.bookSgst) },
    { key: 'bookIgst', label: 'Books IGST', align: 'right', render: (r) => formatCurrency(r.bookIgst) },
    { key: 'bookTotalTax', label: 'Books Total Tax', align: 'right', render: (r) => <strong>{formatCurrency(r.bookTotalTax)}</strong> },
    { key: 'portalTaxable', label: 'Portal Taxable', align: 'right', render: (r) => formatCurrency(r.portalTaxable) },
    { key: 'portalTotalTax', label: 'Portal Tax', align: 'right', render: (r) => formatCurrency(r.portalTotalTax) },
    {
      key: 'difference',
      label: 'Difference',
      align: 'right',
      render: (r) => {
        const d = Number(r.difference || 0);
        return <span style={{ color: d === 0 ? 'inherit' : '#e03131', fontWeight: d !== 0 ? 700 : 400 }}>{formatCurrency(d)}</span>;
      },
    },
  ];

  return (
    <div className="page-body">
      <PageHeader
        title="GSTR-2 / Inward Supplies & ITC Reconciliation"
        description="Purchase inward register reconciled against GSTR-2B portal data for ITC verification."
        actions={
          <ExportActions
            reportKey="itc_reconciliation"
            filename="gstr2_itc_reconciliation"
            params={{ from: range.from, to: range.to, financialYear, status: statusFilter }}
          />
        }
      />

      {/* Portal data notice */}
      {!hasPortalData && !loading && (
        <div className="card card-pad mb-4" style={{ background: '#fff9db', border: '1px solid #f59f00', color: '#7a4100', fontSize: 13 }}>
          <strong>📋 Books Data Available — Portal GSTR-2B Not Imported</strong><br />
          Records below are from ERP purchase books. To reconcile against supplier GSTR-2B uploads, import portal JSON from the GST Portal.
          All records are currently classified as <em>BOOKS ONLY</em>.
        </div>
      )}

      {/* Summary Cards */}
      <div className="stat-grid mb-6">
        <StatCard label="Total Book ITC" value={formatCurrency(metrics.totalBookItc)} icon="📥" />
        <StatCard label="Matched ITC" value={formatCurrency(metrics.matched)} icon="✅" />
        <StatCard label="Books Only" value={formatCurrency(metrics.booksOnly)} icon="⚠️" />
        <StatCard label="Portal Only (Missing in Books)" value={formatCurrency(metrics.portalOnly)} icon="🔴" />
        <StatCard label="Tax / Value Mismatch" value={formatCurrency(metrics.mismatch)} icon="❗" />
      </div>

      <div className="card">
        <div className="list-toolbar no-print">
          <div className="toolbar-left" style={{ flexWrap: 'wrap' }}>
            <SearchBox value={search} onChange={setSearch} placeholder="Search supplier, GSTIN, invoice…" />
            <select
              className="form-control"
              style={{ width: 160 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {['All', 'MATCHED', 'BOOKS ONLY', 'GSTR2B ONLY', 'TAX MISMATCH', 'VALUE MISMATCH'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              className="form-control"
              style={{ width: 140 }}
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
            >
              {fyOptions.map((fy) => <option key={fy} value={fy}>{formatFyLabel(fy)}</option>)}
            </select>
            <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
          </div>
          <div className="toolbar-right">
            <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
              {filtered.length} records&nbsp;·&nbsp; Book ITC: <strong>{formatCurrency(metrics.totalBookItc)}</strong>
            </span>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={loading}
          error={error}
          onRetry={reload}
          getRowId={(r) => r.purchaseId || r._id}
          cardTitleKey="invoiceNo"
          emptyTitle="No purchase records for this period."
          emptyDescription="Recorded supplier bills will appear here for ITC reconciliation."
        />
      </div>
    </div>
  );
}
