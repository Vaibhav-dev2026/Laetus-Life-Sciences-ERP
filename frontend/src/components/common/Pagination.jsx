import React from 'react';
import './common.css';

export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="pagination">
      <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
        Showing {from}–{to} of {total}
      </span>
      <div className="page-controls">
        {onPageSizeChange && (
          <select className="form-control" style={{ width: 84 }} value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} aria-label="Rows per page">
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}/page</option>)}
          </select>
        )}
        <button onClick={() => onPageChange(1)} disabled={page === 1} aria-label="First page">«</button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1} aria-label="Previous page">‹</button>
        {pages.map((p) => (
          <button key={p} className={p === page ? 'active' : ''} onClick={() => onPageChange(p)} aria-current={p === page ? 'page' : undefined}>{p}</button>
        ))}
        <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages} aria-label="Next page">›</button>
        <button onClick={() => onPageChange(totalPages)} disabled={page === totalPages} aria-label="Last page">»</button>
      </div>
    </div>
  );
}
