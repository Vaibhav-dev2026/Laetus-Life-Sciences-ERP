import React from 'react';
import { useCompany } from '../../context/CompanyContext.jsx';
import { calcLine } from '../../utils/gst.js';
import { formatCurrency, formatDate, amountInWords } from '../../utils/format.js';
import './invoice.css';

/**
 * InvoicePreview — Print-ready GST Invoice component strictly styled
 * to match the classic pharmaceutical bill reference layout.
 */
export default function InvoicePreview({ invoice, customer }) {
  const { company: contextCompany } = useCompany();
  const company = contextCompany || {};
  const bank = company.bank || {};
  const terms = Array.isArray(company.terms) && company.terms.length ? company.terms : [
    'Goods once sold will not be taken back or exchanged.',
    'Bills not paid due date will attract 24% interest.',
    'All disputes subject to Surat jurisdiction only.',
    'Prescribed Sales Tax declaration will be given.',
  ];

  const sameState = (customer?.stateCode || company.stateCode) === company.stateCode;
  const computed = (invoice.lines || []).map((l) => ({ ...l, ...calcLine({ ...l, sameState }) }));
  const grossBeforeDiscount = computed.reduce((a, l) => a + (l.gross || (Number(l.qty) * Number(l.rate))), 0);
  const discountTotal = computed.reduce((a, l) => a + (l.discountAmt || 0), 0);
  const taxableTotal = computed.reduce((a, l) => a + (l.taxableValue || (l.gross - l.discountAmt)), 0);
  const cgst = computed.reduce((a, l) => a + (l.cgst || 0), 0);
  const sgst = computed.reduce((a, l) => a + (l.sgst || 0), 0);
  const igst = computed.reduce((a, l) => a + (l.igst || 0), 0);
  const courier = Number(invoice.courierCharge || 0);
  const grandTotal = Math.round(taxableTotal + cgst + sgst + igst + courier);

  const standardRates = [5, 12, 18, 28];
  const gstSummary = standardRates.map((rate) => {
    const lines = computed.filter((l) => Math.abs(Number(l.gstRate || 0) - rate) < 0.1);
    const taxableAmt = lines.reduce((sum, l) => sum + (l.gross - l.discountAmt), 0);
    const cTax = lines.reduce((sum, l) => sum + (l.cgst || 0), 0);
    const sTax = lines.reduce((sum, l) => sum + (l.sgst || 0), 0);
    const iTax = lines.reduce((sum, l) => sum + (l.igst || 0), 0);
    const totalTax = sameState ? (cTax + sTax) : iTax;
    return {
      rate: `${rate.toFixed(2)} %`,
      amount: taxableAmt,
      cgst: cTax,
      sgst: sTax,
      igst: iTax,
      total: totalTax,
    };
  });

  // Minimum row count to ensure natural tall grid lines like reference
  const minRows = 8;
  const emptyRowsCount = Math.max(0, minRows - computed.length);

  return (
    <div className="invoice-preview-doc print-area">
      {/* Top Header Grid: Company (Left) & Customer (Right) */}
      <div className="inv-header-grid">
        <div className="inv-header-box company-side">
          <div className="comp-title">{company.name || 'LAETUS LIFE SCIENCES'}</div>
          <div className="comp-address">
            {company.addressLine1 && <div>{company.addressLine1}</div>}
            {company.addressLine2 && <div>{company.addressLine2}</div>}
            <div>Phone : {company.phone || '0261-2345678'}</div>
          </div>
          <div className="comp-divider"></div>
          <div className="comp-meta">
            <div>GSTIN : {company.gstin || '-'}</div>
            {company.email && <div>Email : {company.email}</div>}
            {company.website && <div>Website : {company.website}</div>}
            {company.drugLicence && company.drugLicence.trim() && (
              <div>D.L. No. : {company.drugLicence}</div>
            )}
          </div>
        </div>

        <div className="inv-header-box customer-side">
          <div className="cust-title">M/s {customer?.partyName || 'CASH SALE'}</div>
          <div className="cust-info">
            {customer?.address ? <div>{customer.address}</div> : <div>Address: N/A</div>}
            {(customer?.city || customer?.state) && (
              <div>{customer?.city || ''}{customer?.state ? `, ${customer.state}` : ''}</div>
            )}
            <div>Ph No: {customer?.phone || customer?.mobile || '-'}</div>
            <div>GST: {customer?.gstin || '-'}</div>
            {customer?.drugLicence && <div>D.L. No.: {customer.drugLicence}</div>}
          </div>
        </div>
      </div>

      {/* Middle Bar: GST INVOICE Title Badge + Invoice Metadata */}
      <div className="inv-title-bar">
        <div className="title-badge-wrap">
          <div className="gst-invoice-badge">GST INVOICE</div>
        </div>
        <div className="inv-meta-grid">
          <div className="meta-cell"><span>Invoice No. :</span> <strong className="mono">{invoice.invoiceNo}</strong></div>
          <div className="meta-cell"><span>Date :</span> <span>{formatDate(invoice.date)}</span></div>
          <div className="meta-cell"><span>Sales Man :</span> <span>{invoice.salesman || '-'}</span></div>
          <div className="meta-cell"><span>Due Date :</span> <span>{invoice.dueDate ? formatDate(invoice.dueDate) : formatDate(invoice.date)}</span></div>
        </div>
      </div>

      {/* Main Items Table Grid */}
      <table className="invoice-table">
        <thead>
          <tr>
            <th style={{ width: '4%' }}>Sr.</th>
            <th style={{ width: '22%' }}>Product</th>
            <th style={{ width: '8%' }}>Mfg.</th>
            <th style={{ width: '5%' }}>Qty.</th>
            <th style={{ width: '7%' }}>Pack</th>
            <th style={{ width: '9%' }}>Batch</th>
            <th style={{ width: '6%' }}>Exp.</th>
            <th style={{ width: '8%' }}>HSN</th>
            <th style={{ width: '7%' }}>MRP</th>
            <th style={{ width: '7%' }}>Rate</th>
            <th style={{ width: '4%' }}>Dis</th>
            {sameState ? (
              <>
                <th style={{ width: '5%' }}>SGST</th>
                <th style={{ width: '5%' }}>CGST</th>
              </>
            ) : (
              <th style={{ width: '10%' }}>IGST</th>
            )}
            <th style={{ width: '9%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {computed.map((l, i) => {
            const halfGstRate = Number(l.gstRate || 0) / 2;
            return (
              <tr key={i}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td style={{ textAlign: 'left', fontWeight: 700 }}>{l.productName || l.productId}</td>
                <td style={{ textAlign: 'center' }}>{l.mfg || '-'}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{l.qty}</td>
                <td style={{ textAlign: 'center' }}>{l.pack || '-'}</td>
                <td style={{ textAlign: 'center' }}>{l.batchNo || l.batchId}</td>
                <td style={{ textAlign: 'center' }}>{l.expDate ? formatDate(l.expDate) : '-'}</td>
                <td style={{ textAlign: 'center' }}>{l.hsn || '-'}</td>
                <td style={{ textAlign: 'right' }}>{Number(l.mrp !== undefined ? l.mrp : l.rate).toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{Number(l.rate).toFixed(2)}</td>
                <td style={{ textAlign: 'center' }}>{Number(l.discountPct || 0).toFixed(2)}</td>
                {sameState ? (
                  <>
                    <td style={{ textAlign: 'right' }}>{Number(l.sgst || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{Number(l.cgst || 0).toFixed(2)}</td>
                  </>
                ) : (
                  <td style={{ textAlign: 'right' }}>{Number(l.igst || 0).toFixed(2)}</td>
                )}
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{Number(l.total).toFixed(2)}</td>
              </tr>
            );
          })}

          {/* Empty rows filler to maintain tall structured grid lines matching reference */}
          {Array.from({ length: emptyRowsCount }).map((_, idx) => (
            <tr key={`empty-${idx}`} className="empty-row">
              <td>&nbsp;</td>
              <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
              {sameState ? <><td></td><td></td></> : <td></td>}
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bottom Section with 3 Compartments */}
      <div className="inv-bottom-section">
        {/* Left Compartment: Bank Details, Ledger Balance, Terms */}
        <div className="inv-bottom-col left-col">
          <div className="bank-box">
            <div className="box-heading-bold">BANK DETAIL:</div>
            <div className="bank-details-content">
              {bank.bankName ? (
                <div><strong>{bank.bankName.toUpperCase()}</strong></div>
              ) : null}
              {bank.accountNumber ? (
                <div>A/C NO-{bank.accountNumber}</div>
              ) : null}
              {bank.ifsc ? (
                <div>IFSC CODE-{bank.ifsc}</div>
              ) : null}
              {!bank.bankName && !bank.accountNumber && !bank.ifsc && (
                <div style={{ color: '#777', fontStyle: 'italic' }}>Bank details not configured</div>
              )}
            </div>
          </div>

          <div className="ledger-balance-strip">
            <strong>LEDGER BALANCE :</strong> Rs. {Number(customer?.currentBalance ?? 0).toFixed(2)}
          </div>

          <div className="terms-box">
            <div className="terms-heading">Terms &amp; Conditions:</div>
            <ol className="terms-list">
              {terms.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
            <div className="scan-pay-prompt">Scan &amp; Pay</div>
          </div>
        </div>

        {/* Middle Compartment: GST Summary Table */}
        <div className="inv-bottom-col mid-col">
          <table className="gst-summary-table">
            <thead>
              <tr>
                <th>GST</th>
                <th>Amount</th>
                {sameState ? (
                  <>
                    <th>CGST</th>
                    <th>SGST</th>
                  </>
                ) : (
                  <th>IGST</th>
                )}
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {gstSummary.map((slab, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'center' }}>{slab.rate}</td>
                  <td style={{ textAlign: 'right' }}>{slab.amount.toFixed(2)}</td>
                  {sameState ? (
                    <>
                      <td style={{ textAlign: 'right' }}>{slab.cgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{slab.sgst.toFixed(2)}</td>
                    </>
                  ) : (
                    <td style={{ textAlign: 'right' }}>{slab.igst.toFixed(2)}</td>
                  )}
                  <td style={{ textAlign: 'right' }}>{slab.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right Compartment: Totals Stack & Grand Total */}
        <div className="inv-bottom-col right-col">
          <div className="totals-table">
            <div className="total-line">
              <span>AMOUNT BEFORE TAX</span>
              <span className="total-val">{Number(grossBeforeDiscount).toFixed(2)}</span>
            </div>
            <div className="total-line">
              <span>DISCOUNT :</span>
              <span className="total-val">{Number(discountTotal).toFixed(2)}</span>
            </div>
            {sameState ? (
              <>
                <div className="total-line">
                  <span>SGST PAYBLE</span>
                  <span className="total-val">{Number(sgst).toFixed(2)}</span>
                </div>
                <div className="total-line">
                  <span>CGST PAYBLE</span>
                  <span className="total-val">{Number(cgst).toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="total-line">
                <span>IGST PAYBLE</span>
                <span className="total-val">{Number(igst).toFixed(2)}</span>
              </div>
            )}
            <div className="total-line">
              <span>COURIER CHR</span>
              <span className="total-val">{Number(courier).toFixed(2)}</span>
            </div>
            <div className="total-line grand-total-line">
              <span>GRAND TOTAL</span>
              <span className="total-val-grand">{Number(grandTotal).toFixed(2)}</span>
            </div>
          </div>
          <div className="amount-words-box">
            <span>Rs. {amountInWords(grandTotal)} Only</span>
          </div>
        </div>
      </div>

      {/* Footer / Signature Strip */}
      <div className="inv-signature-strip">
        <div className="sig-box left-sig">
          <div className="sig-label">Receiver</div>
          <div className="sig-space"></div>
        </div>
        <div className="sig-box right-sig">
          <div className="sig-company-title">For {company.name || 'LAETUS LIFE SCIENCES'}</div>
          <div className="sig-space"></div>
        </div>
      </div>
    </div>
  );
}
