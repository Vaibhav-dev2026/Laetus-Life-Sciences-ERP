import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import SearchBox from '../../components/common/SearchBox.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { batchApi } from '../../api/batchApi.js';
import { productApi } from '../../api/productApi.js';
import { supplierApi } from '../../api/supplierApi.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

import ExportActions from '../../components/common/ExportActions.jsx';

export default function BatchList() {

  usePageTitle('Batches');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const debouncedSearch = useDebounce(search, 250);

  const { data: batches, loading, error, reload } = useAsync(() => batchApi.list(), []);
  const { data: products } = useAsync(() => productApi.list(), []);
  const { data: suppliers } = useAsync(() => supplierApi.list(), []);

  const rows = useMemo(() => {
    if (!batches) return [];
    return batches.map((b) => ({
      ...b,
      productName: products?.find((p) => p.id === b.productId)?.name || b.productId,
      supplierName: suppliers?.find((s) => s.id === b.supplierId)?.company || '-',
    }));
  }, [batches, products, suppliers]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQ = !q || [r.batchNo, r.productName, r.supplierName].join(' ').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchesQ && matchesStatus;
    });
  }, [rows, debouncedSearch, statusFilter]);

  const columns = [
    { key: 'productName', label: 'Product', sortable: true, render: (r) => <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/batches/${r.id}`); }}>{r.productName}</a> },
    { key: 'batchNo', label: 'Batch Number', className: 'mono' },
    { key: 'mfgDate', label: 'Mfg Date', render: (r) => formatDate(r.mfgDate) },
    { key: 'expDate', label: 'Expiry Date', sortable: true, render: (r) => formatDate(r.expDate) },
    { key: 'mrp', label: 'MRP', align: 'right', render: (r) => formatCurrency(r.mrp) },
    { key: 'purchaseRate', label: 'Purchase Rate', align: 'right', render: (r) => formatCurrency(r.purchaseRate) },
    { key: 'saleRate', label: 'Sale Rate', align: 'right', render: (r) => formatCurrency(r.saleRate) },
    { key: 'currentQty', label: 'Current Qty', align: 'right', sortable: true },
    { key: 'supplierName', label: 'Supplier' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="page-body">
      <PageHeader
        title="Batch Management"
        description="Track manufacture, expiry, stock and status per batch."
        actions={<ExportActions reportKey="stock" filename="batch_inventory" />}
      />

      <div className="card">
        <div className="list-toolbar">
          <div className="toolbar-left">
            <SearchBox value={search} onChange={setSearch} placeholder="Search product, batch, supplier…" />
            <select className="form-control" style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {['All', 'Healthy', 'Low Stock', 'Near Expiry', 'Expired', 'Out of Stock'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="toolbar-right text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{filtered.length} batches</div>
        </div>
        <DataTable columns={columns} rows={filtered} loading={loading} error={error} onRetry={reload} cardTitleKey="productName"
          emptyTitle="No batches are currently near expiry or recorded." emptyDescription="Batches are created automatically when purchases are recorded." />
      </div>
    </div>
  );
}
