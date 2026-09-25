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
import { saleApi } from '../../api/saleApi.js';
import { customerApi } from '../../api/customerApi.js';
import { calcLine } from '../../utils/gst.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';
import { downloadFile } from '../../utils/download.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function SalesList() {
  usePageTitle('Sales / Billing');
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const { data: sales, loading, error, reload } = useAsync(() => saleApi.list(), []);
  const { data: customers } = useAsync(() => customerApi.list(), []);

  const rows = useMemo(() => {
    if (!sales) return [];
    return sales.map((s) => ({
      ...s,
      customerName: customers?.find((c) => c.id === s.customerId)?.partyName || s.customerId,
      amount: s.grandTotal || (s.lines || []).reduce((a, l) => a + calcLine(l).total, 0),
    }));
  }, [sales, customers]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rows.filter((r) => !q || [r.invoiceNo, r.customerName].join(' ').toLowerCase().includes(q));
  }, [rows, debouncedSearch]);

  async function handlePdfDownload(row) {
    try {
      await downloadFile(`/api/sales/${row.id}/pdf`, `${(row.invoiceNo || row.id).replace(/\//g, '-')}.pdf`);
      toast.success('Invoice PDF downloaded.');
    } catch (err) {
      toast.error(err.message || 'PDF download failed.');
    }
  }

  const columns = [
    { key: 'invoiceNo', label: 'Invoice No', render: (r) => <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/sales/${r.id}`); }}><strong>{r.invoiceNo}</strong></a> },
    { key: 'date', label: 'Date', sortable: true, render: (r) => formatDate(r.date) },
    { key: 'customerName', label: 'Customer', sortable: true },
    { key: 'amount', label: 'Amount', align: 'right', sortable: true, render: (r) => formatCurrency(r.amount) },
    { key: 'amountReceived', label: 'Received', align: 'right', render: (r) => formatCurrency(r.amountReceived || 0) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', label: '', render: (r) => (
        <RowActions
          onView={() => navigate(`/sales/${r.id}`)}
          onEdit={r.status !== 'Cancelled' ? () => navigate(`/sales/${r.id}/edit`) : undefined}
          onPdf={() => handlePdfDownload(r)}
        />
      ),
    },
  ];

  return (
    <div className="page-body">
      <PageHeader
        title="Sales / Billing"
        description="GST invoices raised to customers."
        actions={(
          <>
            <ExportActions reportKey="sales" filename="sales_invoices" params={{ search }} />
            <button className="btn btn-primary" onClick={() => navigate('/sales/new')}>+ New Invoice</button>
          </>
        )}
      />
      <div className="card">
        <div className="list-toolbar">
          <div className="toolbar-left"><SearchBox value={search} onChange={setSearch} placeholder="Search invoice, customer…" /></div>
          <div className="toolbar-right text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{filtered.length} invoices</div>
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          loading={loading}
          error={error}
          onRetry={reload}
          cardTitleKey="invoiceNo"
          emptyTitle="No invoices have been billed yet."
          emptyDescription="Create your first GST invoice."
          emptyAction={!loading && !error && <button className="btn btn-primary btn-sm" onClick={() => navigate('/sales/new')}>+ New Invoice</button>}
        />
      </div>
    </div>
  );
}
