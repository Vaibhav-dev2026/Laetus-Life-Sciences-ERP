import React from 'react';
import './invoice.css';

export default function InvoiceActions({ onSave, onSaveAndPreview, onPrint, onDownloadPdf, onExport, onCancel, saving, downloading }) {
  return (
    <div className="invoice-actions-bar no-print">
      {onCancel && <button className="btn btn-secondary" onClick={onCancel} disabled={saving || downloading}>Cancel</button>}
      {onExport && <button className="btn btn-secondary" onClick={onExport} disabled={saving || downloading}>Export</button>}
      {onDownloadPdf && (
        <button className="btn btn-secondary" onClick={onDownloadPdf} disabled={saving || downloading}>
          {downloading ? 'Downloading PDF…' : 'Download PDF'}
        </button>
      )}
      {onPrint && <button className="btn btn-primary" onClick={onPrint} disabled={saving || downloading}>Print Invoice</button>}
      {onSaveAndPreview && <button className="btn btn-secondary" onClick={onSaveAndPreview} disabled={saving || downloading}>Save &amp; Preview</button>}
      {onSave && <button className="btn btn-primary" onClick={onSave} disabled={saving || downloading}>{saving ? 'Saving…' : 'Save'}</button>}
    </div>
  );
}

