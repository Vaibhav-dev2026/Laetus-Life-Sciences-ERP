import React, { useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import StatCard from '../../components/common/StatCard.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { maintenanceApi } from '../../api/maintenanceApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DatabaseMaintenance() {
  usePageTitle('Database Maintenance');
  const toast = useToast();

  const { data: diag, loading: diagLoading, reload: reloadDiag } = useAsync(() => maintenanceApi.getDiagnostics(), []);
  const [retentionMonths, setRetentionMonths] = useState(12);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [candidates, setCandidates] = useState(null);

  // Cleanup options
  const [cleanOrphans, setCleanOrphans] = useState(false);
  const [cleanNotifications, setCleanNotifications] = useState(false);
  const [cleanTempExports, setCleanTempExports] = useState(false);
  const [cleanQaData, setCleanQaData] = useState(false);

  // Execution state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  async function handleScan() {
    setScanning(true);
    setCleanupResult(null);
    try {
      const res = await maintenanceApi.scanCandidates(retentionMonths);
      setCandidates(res);
      toast.success('System scan completed.');
    } catch (err) {
      toast.error(err.message || 'Scan failed.');
    } finally {
      setScanning(false);
    }
  }

  async function handleExecuteCleanup() {
    setCleaning(true);
    try {
      const res = await maintenanceApi.runCleanup({
        cleanOrphans,
        cleanNotifications,
        cleanTempExports,
        cleanQaData,
      });
      toast.success('Database maintenance cleanup completed successfully.');
      setCleanupResult(res.data);
      setConfirmOpen(false);
      reloadDiag();
      handleScan();
    } catch (err) {
      toast.error(err.message || 'Cleanup failed.');
    } finally {
      setCleaning(false);
    }
  }

  const selectedCount = (cleanOrphans ? 1 : 0) + (cleanNotifications ? 1 : 0) + (cleanTempExports ? 1 : 0) + (cleanQaData ? 1 : 0);

  return (
    <div className="page-body">
      <PageHeader
        title="Database Maintenance & Storage Management"
        description="Database health diagnostics, controlled safe cleanup, and 1-year minimum data retention management."
      />

      {/* Diagnostics Stat Grid */}
      <div className="stat-grid mb-6">
        <StatCard label="Database Status" value={diag?.status === 'Connected' ? '🟢 Connected' : '🔴 Disconnected'} icon="🗄️" />
        <StatCard label="Database Name" value={diag?.databaseName || '—'} icon="💾" />
        <StatCard label="Total Collections" value={diag?.collectionCount || 0} icon="📁" />
        <StatCard label="Total Documents" value={diag?.totalDocCount || 0} icon="📄" />
        <StatCard label="Upload Media Storage" value={formatBytes(diag?.uploads?.totalBytes)} icon="🖼️" />
        <StatCard label="Obsolete Notifications (>90d)" value={diag?.obsoleteNotificationsCount || 0} icon="🔔" />
      </div>

      {/* Largest Collections */}
      <div className="card mb-6">
        <div className="card-header"><span className="card-title">Largest Database Collections</span></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Collection Name</th>
                <th style={{ textAlign: 'right' }}>Document Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {diagLoading ? (
                <tr><td colSpan="3" className="text-muted" style={{ textAlign: 'center', padding: 20 }}>Loading diagnostics…</td></tr>
              ) : (diag?.collections || []).map((col) => (
                <tr key={col.name}>
                  <td><strong className="mono">{col.name}</strong></td>
                  <td style={{ textAlign: 'right' }}>{col.count}</td>
                  <td><span className="badge badge-success">Healthy</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safe Cleanup Center (Scan -> Preview -> Confirm -> Execute) */}
      <div className="card mb-6">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">🧹 Safe Cleanup Center</span>
          <button className="btn btn-secondary btn-sm" onClick={handleScan} disabled={scanning}>
            {scanning ? 'Scanning…' : '🔍 Scan Cleanup Candidates'}
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {!candidates ? (
            <div className="text-muted" style={{ fontSize: 13, padding: '12px 0' }}>
              Click <strong>"Scan Cleanup Candidates"</strong> above to perform a non-destructive analysis of temporary files, expired notifications, and QA records.
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>Candidate Items for Controlled Cleanup</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
                {/* Temporary upload orphans */}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: 12, background: 'var(--color-surface-alt)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, cursor: 'pointer' }}>
                    <input type="checkbox" checked={cleanOrphans} onChange={(e) => setCleanOrphans(e.target.checked)} />
                    Orphan Upload Files ({candidates.temporary.orphanFilesCount})
                  </label>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    Unreferenced media files in uploads folder. Space: <strong>{formatBytes(candidates.temporary.orphanBytes)}</strong>
                  </div>
                </div>

                {/* Obsolete notifications */}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: 12, background: 'var(--color-surface-alt)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, cursor: 'pointer' }}>
                    <input type="checkbox" checked={cleanNotifications} onChange={(e) => setCleanNotifications(e.target.checked)} />
                    Expired Notifications ({candidates.temporary.obsoleteNotificationsCount})
                  </label>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    System notifications older than 90 days.
                  </div>
                </div>

                {/* Temporary exports */}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: 12, background: 'var(--color-surface-alt)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, cursor: 'pointer' }}>
                    <input type="checkbox" checked={cleanTempExports} onChange={(e) => setCleanTempExports(e.target.checked)} />
                    Temporary Export Files ({candidates.temporary.tempExportsCount})
                  </label>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    Generated PDF/Excel export files in cache. Space: <strong>{formatBytes(candidates.temporary.tempExportsBytes)}</strong>
                  </div>
                </div>

                {/* QA Test Data */}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: 12, background: 'var(--color-surface-alt)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, cursor: 'pointer' }}>
                    <input type="checkbox" checked={cleanQaData} onChange={(e) => setCleanQaData(e.target.checked)} />
                    QA / Test Run Data ({candidates.qaData.totalQaRecords})
                  </label>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    Records created with QA test tags (Sales: {candidates.qaData.salesCount}, Purchases: {candidates.qaData.purchasesCount}, Products: {candidates.qaData.productsCount}).
                  </div>
                </div>
              </div>

              {selectedCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                  <button className="btn btn-primary" onClick={() => setConfirmOpen(true)}>
                    Confirm & Execute Selected Cleanup ({selectedCount} categories)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cleanup Result Summary */}
          {cleanupResult && (
            <div className="mt-4" style={{ padding: 14, background: '#e6fcf5', border: '1px solid #20c997', borderRadius: 6, fontSize: 13 }}>
              <strong>✅ Maintenance Cleanup Executed:</strong> Scanned: {cleanupResult.scanned}, Removed: <strong>{cleanupResult.removed}</strong> records/files, Skipped: {cleanupResult.skipped}, Space Freed: <strong>{formatBytes(cleanupResult.bytesFreed)}</strong>.
            </div>
          )}
        </div>
      </div>

      {/* 1-Year Retention & Archive Review */}
      <div className="card card-pad">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>🛡️ 1-Year Minimum Data Retention & Archive Review</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
          Genuine financial and business records (Sales, Purchases, Ledgers, GST history) are <strong>preserved for a minimum of 1 year</strong>. The retention scanner identifies historical records older than the retention threshold for explicit <em>Admin Review</em>. Production business records are <strong>NEVER automatically deleted</strong>.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 12 }}>Retention Threshold</label>
            <select
              className="form-control"
              style={{ width: 180 }}
              value={retentionMonths}
              onChange={(e) => setRetentionMonths(Number(e.target.value))}
            >
              <option value={12}>12 Months (1 Year)</option>
              <option value={24}>24 Months (2 Years)</option>
              <option value={36}>36 Months (3 Years)</option>
            </select>
          </div>

          <button className="btn btn-secondary" style={{ marginTop: 18 }} onClick={handleScan} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Scan Retention Review Candidates'}
          </button>
        </div>

        {candidates?.retention && (
          <div className="mt-4" style={{ padding: 12, background: '#e7f5ff', border: '1px solid #339af0', borderRadius: 6, fontSize: 13 }}>
            📊 <strong>Retention Review Scan ({retentionMonths} Months Cutoff):</strong> Candidates for Review: <strong>{candidates.retention.candidatesTotal}</strong> records (Sales: {candidates.retention.salesCount}, Purchases: {candidates.retention.purchasesCount}, Expenses: {candidates.retention.expensesCount}).<br />
            <span style={{ fontSize: 12, color: '#1864ab' }}>All financial history records remain safely stored in MongoDB until explicitly reviewed by Admin.</span>
          </div>
        )}
      </div>

      {/* Confirm Cleanup Modal */}
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Database Maintenance Cleanup"
        message={
          <>
            You are about to execute targeted maintenance cleanup for selected categories:
            <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13 }}>
              {cleanOrphans && <li>Orphan Upload Media Files ({candidates?.temporary?.orphanFilesCount || 0})</li>}
              {cleanNotifications && <li>Expired Notifications &gt;90d ({candidates?.temporary?.obsoleteNotificationsCount || 0})</li>}
              {cleanTempExports && <li>Temporary Export PDF/Excel Files ({candidates?.temporary?.tempExportsCount || 0})</li>}
              {cleanQaData && <li>QA / Test Run Records ({candidates?.qaData?.totalQaRecords || 0})</li>}
            </ul>
            Real business transactions and active Company Settings are protected and will NOT be modified. Proceed?
          </>
        }
        confirmLabel="Execute Cleanup"
        loading={cleaning}
        onConfirm={handleExecuteCleanup}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
