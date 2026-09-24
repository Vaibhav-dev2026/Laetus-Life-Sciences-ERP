import React from 'react';

const MAP = {
  Active: 'success', Inactive: 'neutral', Healthy: 'success', Available: 'success',
  'Low Stock': 'warning', 'Near Expiry': 'warning', Pending: 'warning', Partial: 'warning', Unmatched: 'warning',
  Expired: 'danger', 'Out of Stock': 'danger', Overdue: 'danger', Unpaid: 'danger', Rejected: 'danger',
  Paid: 'success', Matched: 'success', Approved: 'success', Read: 'neutral', Unread: 'info',
};

export default function StatusBadge({ status }) {
  const variant = MAP[status] || 'neutral';
  return <span className={`badge badge-${variant}`}>{status}</span>;
}
