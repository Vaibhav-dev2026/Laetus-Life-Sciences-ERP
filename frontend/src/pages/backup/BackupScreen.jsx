import React, { useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { backupApi } from '../../api/backupApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDateTime } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

export default function BackupScreen() {
  usePageTitle('Backup');
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => backupApi.list(), []);
  const [creating, setCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  async function handleBackupNow() {
    setCreating(true);
    try {
      const bkp = await backupApi.createBackup();
      toast.success(`Backup ${bkp.id} created & verified successfully.`);
      reload();
    } catch (err) {
      toast.error(err.message || 'Backup failed.');
    } finally {
      setCreating(false);
    }
  }

  async function handleTestRestore(row) {
    setTestingId(row.id);
    try {
      const res = await backupApi.testRestore(row.id);
      toast.success(`Isolated restore test PASSED: ${res.collectionsVerified} collections & ${res.documentsVerified} documents verified. Production DB unchanged.`);
      reload();
    } catch (err) {
      toast.error(err.message || 'Isolated restore test failed.');
    } finally {
      setTestingId(null);
    }
  }

  async function handleRestore() {
    if (confirmText !== 'RESTORE') { toast.error('Type RESTORE to confirm this irreversible action.'); return; }
    setRestoring(true);
    try {
      await backupApi.restoreBackup(restoreTarget.id);
      toast.success('Restore completed.');
      setRestoreTarget(null);
      setConfirmText('');
      reload();
    } catch (err) {
      toast.error(err.message || 'Restore failed.');
    } finally {
      setRestoring(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await backupApi.removeBackup(deleteTarget.id);
      toast.success('Backup deleted successfully.');
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message || 'Failed to delete backup.');
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    { key: 'id', label: 'Backup ID', className: 'mono', sortable: true },
    { key: 'date', label: 'Date & Time', render: (r) => formatDateTime(r.date), sortable: true },
    { key: 'type', label: 'Type', render: (r) => <span className="badge badge-secondary">{r.type}</span> },
    { key: 'size', label: 'Size' },
    {
      key: 'contents',
      label: 'Contents',
      render: (r) => (
        <span style={{ fontSize: 12 }}>
          {r.collectionCount ? `${r.collectionCount} cols / ${r.docCount} docs` : 'Full Dump'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Integrity',
      render: (r) => <span className="badge badge-success">{r.status || 'VERIFIED'}</span>,
    },
    {
      key: 'restoreTestStatus',
      label: 'Isolated Test',
      render: (r) => (
        <span className={`badge ${r.restoreTestStatus === 'PASSED' ? 'badge-success' : 'badge-warning'}`}>
          {r.restoreTestStatus === 'PASSED' ? '✅ PASSED' : 'NOT TESTED'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="flex-gap-2" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleTestRestore(r)}
            disabled={testingId === r.id}
            title="Perform isolated restore test in temporary DB without altering production data"
          >
            {testingId === r.id ? 'Testing…' : '🧪 Test Restore'}
          </button>
          <button className="btn btn-warning btn-sm" onClick={() => setRestoreTarget(r)}>Restore</button>
          <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(r)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-body">
      <PageHeader
        title="Backup & Data Security"
        description="Create real database backups, verify artifact integrity, and perform isolated restore testing. Admin-only."
        actions={(
          <button className="btn btn-primary" onClick={handleBackupNow} disabled={creating}>
            {creating ? 'Creating Backup…' : '+ Backup Now'}
          </button>
        )}
      />

      <div className="card card-pad mb-4" style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', fontSize: 13 }}>
        🔒 <strong>Database Protection:</strong> Backups generate timestamped snapshots with SHA-256 integrity checksums. "Test Restore" verifies restore capability inside an isolated temporary test database without altering real business data.
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          rows={data || []}
          loading={loading}
          error={error}
          onRetry={reload}
          emptyTitle="No backups recorded yet."
          emptyDescription="Click '+ Backup Now' above to generate an immediate database snapshot."
        />
      </div>

      <ConfirmDialog
        open={!!restoreTarget}
        title="⚠ Restore Production Database — Irreversible Action"
        message={
          <>
            Restoring <strong>{restoreTarget && formatDateTime(restoreTarget.date)}</strong> will overwrite ALL active production data with this snapshot.
            This action cannot be undone. Type <strong>RESTORE</strong> below to confirm.
            <input
              className="form-control mt-3"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RESTORE to confirm"
            />
          </>
        }
        confirmLabel="Restore Now"
        danger
        loading={restoring}
        onConfirm={handleRestore}
        onClose={() => { setRestoreTarget(null); setConfirmText(''); }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Backup Snapshot?"
        message={`Are you sure you want to permanently delete backup ${deleteTarget?.id} (${deleteTarget && formatDateTime(deleteTarget.date)})? This will remove the backup files from server storage.`}
        confirmLabel="Delete Backup"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
