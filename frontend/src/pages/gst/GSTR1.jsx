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

const TAB_STYLE = (active) => ({
  background: 'none', border: 'none', padding: '10px 16px', cursor: 'pointer',
  fontWeight: active ? 700 : 400,
  borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
  marginBottom: -2, fontSize: 13,
  color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
});

export default function GSTR1() {
  usePageTitle('GSTR-1 Report');
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [financialYear, setFinancialYear] = useState(searchParams.get('financialYear') || getCurrentFinancialYear());
  const [range, setRange] = useState({
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  });
  const [activeTab, setActiveTab] = useState('invoices');
  const debouncedSearch = useDebounce(search, 250);

  const fyOptions = getDynamicFinancialYears();

  const { data: rawData, loading, error, reload } = useAsync(
    () => gstApi.gstr1({ from: range.from, to: range.to, financialYear }),
    [range.from, range.to, financialYear]
  );

  const rows = useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    return [...(rawData.b2bRows || []), ...(rawData.b2cRows || [])];
  }, [rawData]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQ = !q || (
        (r.gstin || '').toLowerCase().includes(q) ||
        (r.invoiceNo || '').toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q)
      );
      const matchesCat = selectedCategory === 'All' || r.category === selectedCategory;
      return matchesQ && matchesCat;
    });
  }, [rows, debouncedSearch, selectedCategory]);

  const summary = useMemo(() => {
    const s = { B2B: 0, 'B2C Large': 0, 'B2C Small': 0, 'Nil Rated': 0, Export: 0, 'Credit Note': 0, grossTotal: 0, taxableTotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0, totalGst: 0 };
    filtered.forEach((r) => {
      if (s[r.category] !== undefined) s[r.category] += Number(r.invoiceValue || 0);
      s.grossTotal += Number(r.invoiceValue || 0);
      s.taxableTotal += Number(r.taxable || r.taxableValue || 0);
      s.cgstTotal += Number(r.cgst || 0);
      s.sgstTotal += Number(r.sgst || 0);
      s.igstTotal += Number(r.igst || 0);
      s.totalGst += Number(r.totalGst || r.totalTax || 0);
    });
    return s;
  }, [filtered]);

  const hsnRows = rawData?.hsnRows || [];
  const warnings = rawData?.validationWarnings || [];
  const docDetails = rawData?.documentDetails;

  const columns = [
    { key: 'category', label: 'Category', render: (r) => <span className="badge badge-secondary">{r.category}</span> },
    { key: 'customerName', label: 'Customer Name', sortable: true },
    { key: 'gstin', label: 'GSTIN', className: 'mono', sortable: true },
    { key: 'date', label: 'Invoice Date', sortable: true, render: (r) => formatDate(r.invoiceDate || r.date) },
    { key: 'invoiceNo', label: 'Invoice No', className: 'mono' },
    { key: 'invoiceValue', label: 'Invoice Value', align: 'right', sortable: true, render: (r) => formatCurrency(r.invoiceValue) },
    { key: 'taxable', label: 'Taxable Value', align: 'right', render: (r) => formatCurrency(r.taxable || r.taxableValue) },
    { key: 'cgst', label: 'CGST', align: 'right', render: (r) => formatCurrency(r.cgst) },
    { key: 'sgst', label: 'SGST', align: 'right', render: (r) => formatCurrency(r.sgst) },
    { key: 'igst', label: 'IGST', align: 'right', render: (r) => formatCurrency(r.igst) },
    { key: 'totalGst', label: 'Total GST', align: 'right', render: (r) => <strong>{formatCurrency(r.totalGst || r.totalTax)}</strong> },
  ];

  const hsnColumns = [
    { key: 'hsn', label: 'HSN Code' },
    { key: 'description', label: 'Description' },
    { key: 'gstRate', label: 'GST %', align: 'right', render: (r) => `${r.gstRate}%` },
    { key: 'isB2B', label: 'Type', render: (r) => <span className="badge badge-secondary">{r.isB2B ? 'B2B' : 'B2C'}</span> },
    { key: 'qty', label: 'Qty', align: 'right' },
    { key: 'taxableValue', label: 'Taxable', align: 'right', render: (r) => formatCurrency(r.taxableValue) },
    { key: 'cgst', label: 'CGST', align: 'right', render: (r) => formatCurrency(r.cgst) },
    { key: 'sgst', label: 'SGST', align: 'right', render: (r) => formatCurrency(r.sgst) },
    { key: 'igst', label: 'IGST', align: 'right', render: (r) => formatCurrency(r.igst) },
    { key: 'totalTax', label: 'Total Tax', align: 'right', render: (r) => <strong>{formatCurrency(r.totalTax)}</strong> },
  ];

  return (
    <div className="page-body">
      <PageHeader
        title="GSTR-1 — Outward Supplies"
        description="B2B & B2C invoices, HSN summary, and document details for GST filing."
        actions={
          <ExportActions
            reportKey="gstr1"
            filename="gstr1_outward_supplies"
            params={{ from: range.from, to: range.to, financialYear, category: selectedCategory }}
          />
        }
      />

      {/* Summary Stat Cards */}
      <div className="stat-grid mb-6">
        <StatCard label="B2B Supplies" value={formatCurrency(summary.B2B)} icon="🏢" />
        <StatCard label="B2C Supplies" value={formatCurrency(summary['B2C Large'] + summary['B2C Small'])} icon="🛒" />
        <StatCard label="Total Output GST" value={formatCurrency(summary.totalGst)} icon="💰" />
        <StatCard label="Total Taxable" value={formatCurrency(summary.taxableTotal)} icon="📋" />
        <StatCard label="CGST" value={formatCurrency(summary.cgstTotal)} icon="🔵" />
        <StatCard label="SGST / IGST" value={formatCurrency(summary.sgstTotal + summary.igstTotal)} icon="🟢" />
      </div>

      <div className="card">
        {/* Filters */}
        <div className="list-toolbar no-print">
          <div className="toolbar-left" style={{ flexWrap: 'wrap' }}>
            <SearchBox value={search} onChange={setSearch} placeholder="Search GSTIN, invoice, customer…" />
            <select className="form-control" style={{ width: 140 }} value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              {['All', 'B2B', 'B2C Large', 'B2C Small', 'Nil Rated', 'Export', 'Credit Note'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select className="form-control" style={{ width: 140 }} value={financialYear} onChange={(e) => setFinancialYear(e.target.value)}>
              {fyOptions.map((fy) => <option key={fy} value={fy}>{formatFyLabel(fy)}</option>)}
            </select>
            <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
          </div>
          <div className="toolbar-right">
            <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
              {filtered.length} records&nbsp;·&nbsp; Taxable: <strong>{formatCurrency(summary.taxableTotal)}</strong>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border)', padding: '0 16px' }}>
          {[
            { id: 'invoices', label: `Invoices (${filtered.length})` },
            { id: 'hsn', label: `HSN Summary (${hsnRows.length})` },
            { id: 'documents', label: 'Document Details' },
            ...(warnings.length > 0 ? [{ id: 'warnings', label: `⚠️ Warnings (${warnings.length})` }] : []),
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={TAB_STYLE(activeTab === tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'invoices' && (
          <DataTable
            columns={columns}
            rows={filtered}
            loading={loading}
            error={error}
            onRetry={reload}
            cardTitleKey="invoiceNo"
            emptyTitle="No outward supplies recorded for this period."
            emptyDescription="Sales invoices with tax values will appear here in GSTR-1 format."
          />
        )}

        {activeTab === 'hsn' && (
          <DataTable
            columns={hsnColumns}
            rows={hsnRows}
            loading={loading}
            error={error}
            onRetry={reload}
            getRowId={(r) => `${r.hsn}_${r.isB2B}_${r.gstRate}`}
            emptyTitle="No HSN data for this period."
          />
        )}

        {activeTab === 'documents' && (
          <div style={{ padding: 24 }}>
            {docDetails ? (
              <table className="data-table" style={{ maxWidth: 500 }}>
                <tbody>
                  <tr><td><strong>Document Series</strong></td><td className="mono">{docDetails.series}</td></tr>
                  <tr><td><strong>From Sr. No.</strong></td><td>{docDetails.fromNo}</td></tr>
                  <tr><td><strong>To Sr. No.</strong></td><td>{docDetails.toNo}</td></tr>
                  <tr><td><strong>Total Issued</strong></td><td>{docDetails.totalIssued}</td></tr>
                  <tr><td><strong>Total Cancelled</strong></td><td>{docDetails.totalCancelled}</td></tr>
                  <tr><td><strong>Net Issued</strong></td><td><strong>{docDetails.netIssued}</strong></td></tr>
                </tbody>
              </table>
            ) : (
              <div className="text-muted">No document details available for this period.</div>
            )}
          </div>
        )}

        {activeTab === 'warnings' && (
          <div style={{ padding: 16 }}>
            {warnings.length === 0 ? (
              <div className="text-muted">✅ No validation warnings.</div>
            ) : (
              warnings.map((w, i) => (
                <div key={i} style={{ padding: '8px 12px', background: '#fff3cd', borderLeft: '4px solid #f59f00', marginBottom: 8, borderRadius: 4, fontSize: 13 }}>
                  <strong>{w.reference}</strong>: {w.party} — {w.issue}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
