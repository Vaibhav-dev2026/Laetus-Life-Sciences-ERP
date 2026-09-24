import React from 'react';

export default function DateRangeFilter({ from, to, onChange }) {
  return (
    <div className="flex-gap-2">
      <input type="date" className="form-control" value={from || ''} onChange={(e) => onChange({ from: e.target.value, to })} aria-label="From date" />
      <span className="text-muted">to</span>
      <input type="date" className="form-control" value={to || ''} onChange={(e) => onChange({ from, to: e.target.value })} aria-label="To date" />
    </div>
  );
}
