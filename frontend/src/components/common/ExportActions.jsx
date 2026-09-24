import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { downloadExcel, downloadDocx, downloadCsv } from '../../api/exportApi.js';
import { downloadFile } from '../../utils/download.js';
import PdfPreviewModal from './PdfPreviewModal.jsx';

/**
 * ExportActions — Renders CSV / Excel / DOCX / PDF / Print buttons.
 *
 * Props:
 *   reportKey  {string}  Backend report key for /exports/:reportKey/:format
 *                        e.g. "sales", "outstanding", "purchases", "stock", "gstr1", "gstr3b", "itc_reconciliation", "payments", "expenses", "products", "customers", "suppliers"
 *   pdfUrl     {string}  Direct custom PDF URL (e.g. "/sales/INV-1001/pdf", "/purchases/PUR-1/pdf")
 *   filename   {string}  Base filename without extension (default: reportKey or "report")
 *   params     {object}  Optional query params forwarded to export endpoints
 *   hidePrint  {boolean} Whether to hide the Print button
 */
export default function ExportActions({ reportKey, pdfUrl, filename, params = {}, hidePrint = false }) {
  const toast = useToast();
  const [loading, setLoading] = useState(null); // 'excel' | 'docx' | 'csv' | null
  const [showPdfModal, setShowPdfModal] = useState(false);

  const baseName = filename || reportKey || 'report';
  const targetPdfUrl = pdfUrl || (reportKey ? `/exports/${reportKey}/pdf` : null);

  async function handleExcel() {
    if (!reportKey) {
      toast.error('Excel export is not configured for this view.');
      return;
    }
    setLoading('excel');
    try {
      await downloadExcel(reportKey, baseName, params);
      toast.success('Excel file downloaded successfully.');
    } catch (err) {
      toast.error(err.message || 'Excel export failed.');
    } finally {
      setLoading(null);
    }
  }

  async function handleDocx() {
    if (!reportKey) {
      toast.error('DOCX export is not configured for this view.');
      return;
    }
    setLoading('docx');
    try {
      await downloadDocx(reportKey, baseName, params);
      toast.success('DOCX file downloaded successfully.');
    } catch (err) {
      toast.error(err.message || 'DOCX export failed.');
    } finally {
      setLoading(null);
    }
  }

  async function handleCsv() {
    if (reportKey) {
      setLoading('csv');
      try {
        await downloadCsv(reportKey, baseName, params);
        toast.success('CSV file downloaded successfully.');
      } catch (err) {
        toast.error(err.message || 'CSV export failed.');
      } finally {
        setLoading(null);
      }
    } else {
      const exported = exportTableToCsvDom(baseName);
      if (exported) {
        toast.success('CSV downloaded from current table view.');
      } else {
        toast.error('No table data found to export.');
      }
    }
  }

  function handlePrint() {
    window.print();
  }

  const disabled = loading !== null;

  return (
    <>
      <div className="flex-gap-2 no-print export-actions-bar">
        {targetPdfUrl && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowPdfModal(true)}
            disabled={disabled}
            title="Preview & Download PDF Document"
          >
            📄 PDF
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleCsv}
          disabled={disabled}
          title="Download CSV"
        >
          {loading === 'csv' ? '…' : 'CSV'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleExcel}
          disabled={disabled}
          title="Download Excel (.xlsx)"
        >
          {loading === 'excel' ? '…' : 'Excel'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleDocx}
          disabled={disabled}
          title="Download DOCX"
        >
          {loading === 'docx' ? '…' : 'DOCX'}
        </button>
        {!hidePrint && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handlePrint}
            disabled={disabled}
            title="Print this page"
          >
            🖨️ Print
          </button>
        )}
      </div>

      {showPdfModal && targetPdfUrl && (
        <PdfPreviewModal
          open={showPdfModal}
          url={targetPdfUrl}
          title={`${baseName.replace(/_/g, ' ').toUpperCase()} PDF`}
          filename={`${baseName}.pdf`}
          params={params}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </>
  );
}

function exportTableToCsvDom(name = 'export') {
  const table = document.querySelector('table.data-table') || document.querySelector('table');
  if (!table) return false;
  const rows = Array.from(table.querySelectorAll('tr'));
  if (!rows.length) return false;

  const csvContent = rows.map((r) => {
    const cells = Array.from(r.querySelectorAll('th, td'));
    return cells.map((c) => {
      const text = (c.innerText || c.textContent || '').replace(/"/g, '""').trim();
      return `"${text}"`;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${name}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
