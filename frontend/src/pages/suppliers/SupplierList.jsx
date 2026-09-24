import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import SearchBox from '../../components/common/SearchBox.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import RowActions from '../../components/common/RowActions.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import ExportActions from '../../components/common/ExportActions.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useToast } from '../../context/ToastContext.jsx';
import { supplierApi } from '../../api/supplierApi.js';
import { formatCurrency } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

export default function SupplierList() {
  usePageTitle('Suppliers');
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const debouncedSearch = useDebounce(search, 250);
  const { data, loading, error, reload } = useAsync(() => supplierApi.list(), []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = debouncedSearch.trim().toLowerCase();
    return data.filter((s) => !q || [s.company, s.mobile, s.gstin, s.id].join(' ').toLowerCase().includes(q));
  }, [data, debouncedSearch]);

  async function handleDeactivate() {
    if (!confirmTarget) return;
    await supplierApi.update(confirmTarget.id, { ...confirmTarget, status: confirmTarget.status === 'Active' ? 'Inactive' : 'Active' });
    toast.success(`${confirmTarget.company} updated.`);
    setConfirmTarget(null);
    reload();
  }

  const columns = [
    { key: 'id', label: 'Supplier ID', sortable: true },
    { key: 'company', label: 'Company', sortable: true, render: (r) => <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/suppliers/${r.id}`); }}>{r.company}</a> },
    { key: 'contact', label: 'Contact' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'gstin', label: 'GSTIN', className: 'mono' },
    { key: 'openingPayable', label: 'Payable', align: 'right', sortable: true, render: (r) => formatCurrency(r.openingPayable) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', label: '', render: (r) => (
      <RowActions onView={() => navigate(`/suppliers/${r.id}`)} onEdit={() => navigate(`/suppliers/${r.id}/edit`)}
        onDeactivate={() => setConfirmTarget(r)} deactivateLabel={r.status === 'Active' ? 'Deactivate' : 'Activate'} />
    ) },
  ];

  return (
    <div className="page-body">
      <PageHeader title="Suppliers" description="Pharmaceutical manufacturers and distributors you purchase from."
        actions={<><ExportActions reportKey="suppliers" filename="suppliers" /><button className="btn btn-primary" onClick={() => navigate('/suppliers/new')}>+ Add Supplier</button></>} />
      <div className="card">
        <div className="list-toolbar">
          <div className="toolbar-left"><SearchBox value={search} onChange={setSearch} placeholder="Search company, mobile, GSTIN…" /></div>
          <div className="toolbar-right text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{filtered.length} suppliers</div>
        </div>
        <DataTable columns={columns} rows={filtered} loading={loading} error={error} onRetry={reload} cardTitleKey="company"
          emptyTitle="No suppliers found." emptyDescription="Add a supplier to start recording purchases."
          emptyAction={!loading && !error && <button className="btn btn-primary btn-sm" onClick={() => navigate('/suppliers/new')}>+ Add Supplier</button>} />
      </div>
      <ConfirmDialog open={!!confirmTarget} title="Update supplier status"
        message={`Are you sure you want to ${confirmTarget?.status === 'Active' ? 'deactivate' : 'activate'} ${confirmTarget?.company}?`}
        confirmLabel={confirmTarget?.status === 'Active' ? 'Deactivate' : 'Activate'} danger={confirmTarget?.status === 'Active'}
        onConfirm={handleDeactivate} onClose={() => setConfirmTarget(null)} />
    </div>
  );
}
