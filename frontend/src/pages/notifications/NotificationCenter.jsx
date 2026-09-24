import React from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { CardSkeleton } from '../../components/common/LoadingState.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { notificationApi } from '../../api/notificationApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDateTime } from '../../utils/format.js';
import { usePageTitle } from '../../context/PageTitleContext.jsx';

const TYPE_ICON = { 'Low Stock': '📉', 'Near Expiry': '⏳', Expired: '⛔', 'Outstanding Overdue': '📋', 'Purchase Created': '🧾', 'Sales Created': '🧮', 'Payment Received': '💳', 'System Alert': '⚙️' };

export default function NotificationCenter() {
  usePageTitle('Notifications');
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => notificationApi.list(), []);

  async function markAllRead() {
    await notificationApi.markAllRead();
    toast.success('All notifications marked as read.');
    reload();
  }

  const grouped = React.useMemo(() => {
    if (!data) return {};
    return data.reduce((acc, n) => { (acc[n.type] = acc[n.type] || []).push(n); return acc; }, {});
  }, [data]);

  return (
    <div className="page-body">
      <PageHeader title="Notifications" description="Stock, expiry, outstanding and system alerts."
        actions={<button className="btn btn-secondary" onClick={markAllRead}>Mark all read</button>} />
      {loading ? <CardSkeleton height={240} /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState title="You're all caught up." description="No notifications right now." />
      ) : (
        Object.entries(grouped).map(([type, items]) => (
          <div className="card mb-4" key={type}>
            <div className="card-header"><span className="card-title">{TYPE_ICON[type] || '🔔'} {type}</span></div>
            <ul>
              {items.map((n) => (
                <li key={n.id} className="flex-between" style={{ padding: '12px 24px', borderBottom: '1px solid var(--color-border)', background: n.read ? 'transparent' : 'var(--color-surface-alt)' }}>
                  <span>{n.message}</span>
                  <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap', marginLeft: 12 }}>{formatDateTime(n.date)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
