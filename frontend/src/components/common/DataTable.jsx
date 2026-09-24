import React, { useMemo, useState } from 'react';
import { TableSkeleton } from './LoadingState.jsx';
import EmptyState from './EmptyState.jsx';
import ErrorState from './ErrorState.jsx';
import Pagination from './Pagination.jsx';
import './DataTable.css';

/**
 * Reusable enterprise DataTable.
 * columns: [{ key, label, sortable, align: 'left'|'right', render: (row) => node, className }]
 */
export default function DataTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyAction,
  getRowId = (row) => row?.id || row?._id,
  pageSize = 10,
  selectable = false,
  selectedIds,
  onSelectionChange,
  cardTitleKey,
  footer,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pgSize, setPgSize] = useState(pageSize);

  const sorted = useMemo(() => {
    if (!rows) return [];
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pgSize));
  const pageRows = sorted.slice((page - 1) * pgSize, page * pgSize);

  function toggleSort(col) {
    if (!col.sortable) return;
    if (sortKey === col.key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(col.key); setSortDir('asc'); }
  }

  function toggleSelectAll() {
    if (!onSelectionChange) return;
    const allIds = pageRows.map(getRowId);
    const allSelected = allIds.every((id) => selectedIds?.includes(id));
    onSelectionChange(allSelected ? [] : allIds);
  }

  function toggleSelectRow(id) {
    if (!onSelectionChange) return;
    const set = new Set(selectedIds || []);
    set.has(id) ? set.delete(id) : set.add(id);
    onSelectionChange(Array.from(set));
  }

  if (loading) return <TableSkeleton />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!rows || rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  return (
    <div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 36 }}>
                  <input type="checkbox" aria-label="Select all rows" onChange={toggleSelectAll}
                    checked={pageRows.length > 0 && pageRows.every((r) => selectedIds?.includes(getRowId(r)))} />
                </th>
              )}
              {columns.map((col, cIdx) => (
                <th key={col.key || `col-${cIdx}`} className={`${col.sortable ? 'sortable' : ''}`} style={{ textAlign: col.align === 'right' ? 'right' : 'left' }} onClick={() => toggleSort(col)}>
                  {col.label}{sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rIdx) => (
              <tr key={getRowId(row) || `row-${rIdx}`} data-card-title={cardTitleKey ? row[cardTitleKey] : undefined}>
                {selectable && (
                  <td>
                    <input type="checkbox" aria-label="Select row" checked={!!selectedIds?.includes(getRowId(row))} onChange={() => toggleSelectRow(getRowId(row))} />
                  </td>
                )}
                {columns.map((col, cIdx) => (
                  <td key={col.key || `cell-${cIdx}`} className={`${col.align === 'right' ? 'num' : ''} ${col.className || ''}`} data-label={col.label}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      <Pagination page={page} pageSize={pgSize} total={sorted.length}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPgSize(n); setPage(1); }} />
    </div>
  );
}
