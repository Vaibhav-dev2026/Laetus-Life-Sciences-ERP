import React from 'react';
import Dropdown from './Dropdown.jsx';

export default function RowActions({
  onView,
  onEdit,
  onPdf,
  onPrint,
  onDeactivate,
  deactivateLabel = 'Deactivate',
  onCancel,
  onDelete,
  extra
}) {
  return (
    <Dropdown trigger={<button className="btn btn-ghost btn-sm btn-icon" aria-label="Row actions" title="Actions">⋮</button>}>
      {onView && <button onClick={onView}>View details</button>}
      {onEdit && <button onClick={onEdit}>Edit</button>}
      {onPdf && <button onClick={onPdf}>PDF Download</button>}
      {onPrint && <button onClick={onPrint}>Print</button>}
      {extra}
      {onCancel && <button className="danger" onClick={onCancel}>Cancel</button>}
      {onDeactivate && <button className="danger" onClick={onDeactivate}>{deactivateLabel}</button>}
      {onDelete && <button className="danger" onClick={onDelete}>Delete</button>}
    </Dropdown>
  );
}
