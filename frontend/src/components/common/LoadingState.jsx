import React from 'react';

export function TableSkeleton({ rows = 6, cols = 6 }) {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex-gap-3" style={{ marginBottom: 12 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton" style={{ height: 14, flex: 1, borderRadius: 4 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ height = 100 }) {
  return <div className="skeleton" style={{ height, borderRadius: 'var(--radius-lg)' }} />;
}

export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="state-block">
      <div className="state-icon" aria-hidden>⏳</div>
      <div className="state-title">{label}</div>
    </div>
  );
}
