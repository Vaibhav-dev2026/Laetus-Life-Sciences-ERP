import React, { useEffect, useState, useRef } from 'react';
import Modal from './Modal.jsx';
import axiosClient from '../../api/axiosClient.js';
import { downloadFile } from '../../utils/download.js';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * PdfPreviewModal — In-App PDF Preview Component
 *
 * Displays a generated PDF document inside an interactive modal using
 * an in-memory Blob URL (never local file:// filesystem paths).
 *
 * Props:
 *   open     {boolean}   Whether the modal is visible
 *   url      {string}    API endpoint for the PDF (e.g. "/exports/products/pdf", "/sales/123/pdf")
 *   title    {string}    Document title displayed in modal header
 *   filename {string}    Base filename for download (default: "document.pdf")
 *   params   {object}    Optional query params
 *   onClose  {function}  Callback when modal closes
 */
export default function PdfPreviewModal({ open, url, title = 'PDF Preview', filename = 'document.pdf', params = {}, onClose }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!open || !url) {
      setBlobUrl(null);
      setError(null);
      return;
    }

    let isMounted = true;
    let activeBlobUrl = null;

    async function loadPdf() {
      setLoading(true);
      setError(null);

      try {
        let targetUrl = url;
        if (targetUrl.startsWith('/api/')) {
          targetUrl = targetUrl.substring(4);
        } else if (targetUrl.startsWith('api/')) {
          targetUrl = '/' + targetUrl.substring(4);
        }

        const response = await axiosClient.get(targetUrl, {
          responseType: 'blob',
          params,
          timeout: 60000,
        });

        if (!response.data || response.data.size === 0) {
          throw new Error('Server returned an empty PDF document.');
        }

        const contentType = response.headers?.['content-type'] || response.data?.type || 'application/pdf';

        if (contentType.includes('application/json')) {
          const text = await response.data.text();
          let message = 'Failed to generate PDF.';
          try {
            const parsed = JSON.parse(text);
            message = parsed.message || message;
          } catch (_) {
            if (text) message = text;
          }
          throw new Error(message);
        }

        const isHtml = contentType.includes('text/html');
        const blob = new Blob([response.data], { type: isHtml ? 'text/html;charset=utf-8' : 'application/pdf' });
        activeBlobUrl = URL.createObjectURL(blob);

        if (isMounted) {
          setBlobUrl(activeBlobUrl);
        } else {
          URL.revokeObjectURL(activeBlobUrl);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to generate PDF preview.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
      }
    };
  }, [open, url, JSON.stringify(params)]);

  async function handleDownload() {
    if (!url || downloading) return;
    setDownloading(true);
    try {
      const saveName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      await downloadFile(url, saveName, params);
      toast.success('File downloaded successfully.');
    } catch (err) {
      toast.error(err.message || 'Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch (_) {
        /* Fallback if iframe cross-origin printing is blocked */
      }
    }
    if (blobUrl) {
      const win = window.open(blobUrl, '_blank');
      if (win) {
        let printed = false;
        const doPrint = () => {
          if (printed) return;
          printed = true;
          try {
            win.focus();
            win.print();
          } catch (_) {
            /* window may already be closed by the user */
          }
        };
        win.addEventListener('load', doPrint);
        // Safety net: some browsers' built-in PDF viewer never fires a
        // reliable 'load' event on the popup window, which previously
        // caused window.print() to fire before the document was ready and
        // print only a partial page.
        setTimeout(doPrint, 800);
        return;
      }
    }
    window.print();
  }

  if (!open) return null;

  const modalFooter = (
    <div className="flex-between" style={{ width: '100%' }}>
      <div className="flex-gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleDownload}
          disabled={downloading || loading || !!error}
        >
          {downloading ? 'Downloading…' : '📥 Download PDF'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handlePrint}
          disabled={loading || !!error}
        >
          🖨️ Print
        </button>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
        Close
      </button>
    </div>
  );

  return (
    <Modal open={open} title={title} footer={modalFooter} onClose={onClose} size="lg">
      <div style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>Generating PDF preview…</p>
          </div>
        )}

        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '30px 20px', background: 'rgba(229, 72, 93, 0.08)', borderRadius: '8px', border: '1px solid rgba(229, 72, 93, 0.2)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-danger)' }}>Unable to preview PDF</h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{error}</p>
            <div className="flex-gap-2" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownload}>
                Try Direct Download
              </button>
            </div>
          </div>
        )}

        {blobUrl && !loading && !error && (
          <div style={{ width: '100%', height: '70vh', background: '#333', borderRadius: '6px', overflow: 'hidden' }}>
            <iframe
              ref={iframeRef}
              src={blobUrl}
              title={title}
              width="100%"
              height="100%"
              style={{ border: 'none', background: '#ffffff' }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
