import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import SearchBox from '../../components/common/SearchBox.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import RowActions from '../../components/common/RowActions.jsx';
import ExportActions from '../../components/common/ExportActions.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { purchaseApi } from '../../api/purchaseApi.js';
import { supplierApi } from '../../api/supplierApi.js';
import { calcLine } from '../../utils/gst.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';
import { downloadFile } from '../../utils/download.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function PurchaseList() {
  usePageTitle('Purchases');
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const { data: purchases, loading, error, reload } = useAsync(() => purchaseApi.list(), []);
  const { data: suppliers } = useAsync(() => supplierApi.list(), []);

  const rows = useMemo(() => {
    if (!purchases) return [];
    return purchases.map((p) => ({
      ...p,
      supplierName: suppliers?.find((s) => s.id === p.supplierId)?.company || p.supplierId,
      amount: p.grandTotal || (p.lines || []).reduce((a, l) => a + calcLine(l).total, 0),
    }));
  }, [purchases, suppliers]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rows.filter((r) => !q || [r.purchaseInvoiceNo, r.supplierName, r.supplierInvoiceNo].join(' ').toLowerCase().includes(q));
  }, [rows, debouncedSearch]);

  async function handlePdfDownload(row) {
    try {
      await downloadFile(`/api/purchases/${row.id}/pdf`, `${(row.purchaseInvoiceNo || row.id).replace(/\//g, '-')}.pdf`);
      toast.success('Purchase voucher PDF downloaded.');
    } catch (err) {
      toast.error(err.message || 'PDF download failed.');
    }
  }

  const columns = [
    { key: 'purchaseInvoiceNo', label: 'Purchase Invoice No', render: (r) => <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/purchases/${r.id}`); }}><strong>{r.purchaseInvoiceNo}</strong></a> },
    { key: 'purchaseDate', label: 'Date', sortable: true, render: (r) => formatDate(r.purchaseDate) },
    { key: 'supplierName', label: 'Supplier', sortable: true },
    { key: 'supplierInvoiceNo', label: 'Supplier Invoice No', render: (r) => r.supplierInvoiceNo || '-' },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatCurrency(r.amount) },
    { key: 'dueDate', label: 'Due Date', render: (r) => formatDate(r.dueDate) },
    { key: 'paymentStatus', label: 'Status', render: (r) => <StatusBadge status={r.paymentStatus} /> },
    {
      key: 'actions', label: '', render: (r) => (
        <RowActions
          onView={() => navigate(`/purchases/${r.id}`)}
          onEdit={r.status !== 'Cancelled' ? () => navigate(`/purchases/${r.id}/edit`) : undefined}
          onPdf={() => handlePdfDownload(r)}
        />
      ),
    },
  ];

  return (
    <div className="page-body">
      <PageHeader
        title="Purchases"
        description="Record stock inward from suppliers."
        actions={(
          <>
            <ExportActions reportKey="purchases" filename="purchases" />
            <button className="btn btn-primary" onClick={() => navigate('/purchases/new')}>+ New Purchase</button>
          </>
        )}
      />
      <div className="card">
        <div className="list-toolbar">
          <div className="toolbar-left"><SearchBox value={search} onChange={setSearch} placeholder="Search invoice, supplier…" /></div>
          <div className="toolbar-right text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{filtered.length} purchases</div>
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          loading={loading}
          error={error}
          onRetry={reload}
          cardTitleKey="purchaseInvoiceNo"
          emptyTitle="No purchases have been recorded yet."
          emptyDescription="Create a purchase entry to bring stock into inventory."
          emptyAction={!loading && !error && <button className="btn btn-primary btn-sm" onClick={() => navigate('/purchases/new')}>+ New Purchase</button>}
        />
      </div>
    </div>
  );
}
