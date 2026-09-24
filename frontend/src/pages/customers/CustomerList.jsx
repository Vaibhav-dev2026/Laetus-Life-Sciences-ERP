import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import SearchBox from '../../components/common/SearchBox.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import RowActions from '../../components/common/RowActions.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import ExportActions from '../../components/common/ExportActions.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useToast } from '../../context/ToastContext.jsx';
import { customerApi } from '../../api/customerApi.js';
import { formatCurrency } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

export default function CustomerList() {
  usePageTitle('Customers');
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const debouncedSearch = useDebounce(search, 250);

  const { data, loading, error, reload } = useAsync(() => customerApi.list(), []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = debouncedSearch.trim().toLowerCase();
    return data.filter((c) => {
      const matchesQ = !q || [c.partyName, c.mobile, c.gstin, c.doctorName, c.id].join(' ').toLowerCase().includes(q);
      const matchesType = typeFilter === 'All' || c.type === typeFilter;
      return matchesQ && matchesType;
    });
  }, [data, debouncedSearch, typeFilter]);

  async function handleDeactivate() {
    if (!confirmTarget) return;
    await customerApi.update(confirmTarget.id, { ...confirmTarget, status: confirmTarget.status === 'Active' ? 'Inactive' : 'Active' });
    toast.success(`${confirmTarget.partyName} marked ${confirmTarget.status === 'Active' ? 'inactive' : 'active'}.`);
    setConfirmTarget(null);
    reload();
  }

  const columns = [
    { key: 'id', label: 'Customer ID', sortable: true },
    { key: 'partyName', label: 'Party Name', sortable: true, render: (r) => <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/customers/${r.id}`); }}>{r.partyName}</a> },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'doctorName', label: 'Doctor Name', render: (r) => r.doctorName || '-' },
    { key: 'organization', label: 'Organization', render: (r) => r.organization || '-' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'gstin', label: 'GSTIN', className: 'mono', render: (r) => r.gstin || '-' },
    { key: 'openingOutstanding', label: 'Outstanding', align: 'right', sortable: true, render: (r) => formatCurrency(r.openingOutstanding) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', label: '', render: (r) => (
        <RowActions
          onView={() => navigate(`/customers/${r.id}`)}
          onEdit={() => navigate(`/customers/${r.id}/edit`)}
          onDeactivate={() => setConfirmTarget(r)}
          deactivateLabel={r.status === 'Active' ? 'Deactivate' : 'Activate'}
        />
      ),
    },
  ];

  return (
    <div className="page-body">
      <PageHeader
        title="Customers"
        description="Doctors, clinics, hospitals, medical stores and distributors."
        actions={<>
          <ExportActions reportKey="customers" filename="customers" />
          <button className="btn btn-primary" onClick={() => navigate('/customers/new')}>+ Add Customer</button>
        </>}
      />
      <div className="card">
        <div className="list-toolbar">
          <div className="toolbar-left">
            <SearchBox value={search} onChange={setSearch} placeholder="Search name, mobile, GSTIN, doctor…" />
            <select className="form-control" style={{ width: 180 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {['All', 'Doctor', 'Clinic', 'Hospital', 'Medical Store', 'Distributor', 'Other'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="toolbar-right text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{filtered.length} customers</div>
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          loading={loading}
          error={error}
          onRetry={reload}
          cardTitleKey="partyName"
          emptyTitle="No customers found."
          emptyDescription="Add your first customer to start billing."
          emptyAction={!loading && !error && <button className="btn btn-primary btn-sm" onClick={() => navigate('/customers/new')}>+ Add Customer</button>}
        />
      </div>
      <ConfirmDialog
        open={!!confirmTarget}
        title={confirmTarget?.status === 'Active' ? 'Deactivate customer' : 'Activate customer'}
        message={`Are you sure you want to ${confirmTarget?.status === 'Active' ? 'deactivate' : 'activate'} ${confirmTarget?.partyName}?`}
        confirmLabel={confirmTarget?.status === 'Active' ? 'Deactivate' : 'Activate'}
        danger={confirmTarget?.status === 'Active'}
        onConfirm={handleDeactivate}
        onClose={() => setConfirmTarget(null)}
      />
    </div>
  );
}
