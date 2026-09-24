import React, { useMemo, useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import SearchBox from '../../components/common/SearchBox.jsx';
import DateRangeFilter from '../../components/common/DateRangeFilter.jsx';
import Drawer from '../../components/common/Drawer.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { auditApi } from '../../api/auditApi.js';
import { formatDateTime } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

export default function AuditLogs() {
  usePageTitle('Audit Logs');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [actionFilter, setActionFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const debouncedSearch = useDebounce(search, 250);
  const { data, loading, error, reload } = useAsync(() => auditApi.list(), []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = debouncedSearch.trim().toLowerCase();
    return data.filter((l) => {
      const matchesQ = !q || [l.user, l.module, l.reference].join(' ').toLowerCase().includes(q);
      const matchesAction = actionFilter === 'All' || l.action === actionFilter;
      const day = l.date.slice(0, 10);
      const matchesDate = (!range.from || day >= range.from) && (!range.to || day <= range.to);
      return matchesQ && matchesAction && matchesDate;
    });
  }, [data, debouncedSearch, actionFilter, range]);

  const columns = [
    { key: 'date', label: 'Date', sortable: true, render: (r) => formatDateTime(r.date) },
    { key: 'user', label: 'User' },
    { key: 'action', label: 'Action' },
    { key: 'module', label: 'Module' },
    { key: 'reference', label: 'Reference', className: 'mono' },
    { key: 'view', label: '', render: (r) => <button className="btn btn-ghost btn-sm" onClick={() => setSelected(r)}>View</button> },
  ];

  return (
    <div className="page-body">
      <PageHeader title="Audit Logs" description="Track create, update and delete activity across the ERP." />
      <div className="card">
        <div className="list-toolbar">
          <div className="toolbar-left">
            <SearchBox value={search} onChange={setSearch} placeholder="Search user, module, reference…" />
            <select className="form-control" style={{ width: 150 }} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              {['All', 'Create', 'Update', 'Delete'].map((a) => <option key={a}>{a}</option>)}
            </select>
            <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
          </div>
        </div>
        <DataTable columns={columns} rows={filtered} loading={loading} error={error} onRetry={reload} cardTitleKey="module" emptyTitle="No audit activity recorded." />
      </div>

      <Drawer open={!!selected} title={`Audit Detail — ${selected?.reference || ''}`} onClose={() => setSelected(null)}>
        {selected && (
          <div>
            <p><strong>{selected.user}</strong> performed <strong>{selected.action}</strong> on <strong>{selected.module}</strong> at {formatDateTime(selected.date)}.</p>
            <div className="form-section-title mt-4">Before Value</div>
            <pre className="mono" style={{ background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, fontSize: 12 }}>{JSON.stringify(selected.before, null, 2) || 'null'}</pre>
            <div className="form-section-title mt-4">After Value</div>
            <pre className="mono" style={{ background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, fontSize: 12 }}>{JSON.stringify(selected.after, null, 2) || 'null'}</pre>
          </div>
        )}
      </Drawer>
    </div>
  );
}
