import React from 'react';
import { COMPANY_CONFIG } from '../../config/company.js';
import { useCompany } from '../../context/CompanyContext.jsx';
import { calcLine } from '../../utils/gst.js';
import { formatCurrency, formatDate, amountInWords } from '../../utils/format.js';
import './invoice.css';

// Reusable, print-ready GST invoice document aligned with pharmaceutical distribution format.
export default function InvoicePreview({ invoice, customer }) {
  const { company: contextCompany } = useCompany();
  const company = contextCompany || COMPANY_CONFIG;
  const bank = company.bank || COMPANY_CONFIG.bank;
  const terms = Array.isArray(company.terms) && company.terms.length ? company.terms : COMPANY_CONFIG.terms;

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
      rate: `${rate.toFixed(2)}%`,
      amount: taxableAmt,
      cgst: cTax,
      sgst: sTax,
      igst: iTax,
      total: totalTax,
    };
  });

  const logoText = company.name ? company.name.split(' ').map((w) => w[0]).filter(Boolean).join('').slice(0, 3) : 'LLS';

  return (
    <div className="invoice-preview-doc print-area">
      {/* Top dual header */}
      <div className="inv-header-grid">
        <div className="inv-header-box company-side">
          <div className="company-branding">
            {company.logo ? (
              <img src={company.logo} alt="Company Logo" style={{ maxHeight: 36, maxWidth: 100, objectFit: 'contain' }} />
            ) : (
              <div className="company-logo-badge">
                <span className="logo-text">{logoText}</span>
              </div>
            )}
            <div className="company-title">{company.name}</div>
          </div>
          <div className="company-info">
            <div>{company.addressLine1}</div>
            <div>{company.addressLine2}</div>
            <div><strong>Phone:</strong> {company.phone}</div>
            <div><strong>D.L. No.:</strong> {company.drugLicence || 'GJ-SUR-20-244992/21-244993'}</div>
            <div><strong>E-Mail:</strong> {company.email}</div>
            <div><strong>GSTIN:</strong> {company.gstin}</div>
          </div>
        </div>


        <div className="inv-header-box customer-side">
          <div className="customer-title">M/s {customer?.partyName || 'CASH SALE'}</div>
          <div className="customer-info">
            <div>{customer?.address || 'Address: N/A'}</div>
            <div>{customer?.city || ''}{customer?.state ? `, ${customer.state}` : ''}</div>
            <div><strong>Ph. No.:</strong> {customer?.phone || customer?.mobile || '-'}</div>
            <div><strong>GSTIN:</strong> {customer?.gstin || '-'} &nbsp; <strong>D.L. No.:</strong> {customer?.drugLicence || '-'}</div>
          </div>
        </div>
      </div>

      {/* Title & Metadata Strip */}
      <div className="inv-title-bar">
        <div className="inv-title-text">TAX INVOICE</div>
        <div className="inv-meta-grid">
          <div><strong>Sales Man:</strong> {invoice.salesman || '-'}</div>
          <div><strong>Invoice No.:</strong> <span className="mono bold">{invoice.invoiceNo}</span></div>
          <div><strong>Invoice Date:</strong> {formatDate(invoice.date)}</div>
          <div><strong>Due Date:</strong> {invoice.dueDate ? formatDate(invoice.dueDate) : formatDate(invoice.date)}</div>
        </div>
      </div>

      {/* Main Items Table */}
      <table className="invoice-table">
        <thead>
          <tr>
            <th style={{ width: '3%' }}>Sr.</th>
            <th style={{ width: '20%' }}>Product</th>
            <th style={{ width: '8%' }}>Packing</th>
            <th style={{ width: '7%' }}>Mfg</th>
            <th style={{ width: '5%' }}>Qty</th>
            <th style={{ width: '5%' }}>Free</th>
            <th style={{ width: '8%' }}>Batch</th>
            <th style={{ width: '7%' }}>Exp</th>
            <th style={{ width: '7%' }}>HSN</th>
            <th style={{ width: '6%' }}>MRP</th>
            <th style={{ width: '6%' }}>PTR/Rate</th>
            <th style={{ width: '5%' }}>Dis%</th>
            {sameState ? (
              <>
                <th style={{ width: '4%' }}>SGST%</th>
                <th style={{ width: '5%' }}>SGST</th>
                <th style={{ width: '4%' }}>CGST%</th>
                <th style={{ width: '5%' }}>CGST</th>
              </>
            ) : (
              <>
                <th style={{ width: '5%' }}>IGST%</th>
                <th style={{ width: '6%' }}>IGST</th>
              </>
            )}
            <th style={{ width: '8%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {computed.map((l, i) => {
            const halfGstRate = Number(l.gstRate || 0) / 2;
            return (
              <tr key={i}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td style={{ textAlign: 'left', fontWeight: 600 }}>{l.productName || l.productId}</td>
                <td style={{ textAlign: 'center' }}>{l.pack || '-'}</td>
                <td style={{ textAlign: 'center' }}>{l.mfg || '-'}</td>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{l.qty}</td>
                <td style={{ textAlign: 'center' }}>{l.freeQty || 0}</td>
                <td style={{ textAlign: 'center' }}>{l.batchNo || l.batchId}</td>
                <td style={{ textAlign: 'center' }}>{l.expDate ? formatDate(l.expDate) : '-'}</td>
                <td style={{ textAlign: 'center' }}>{l.hsn || '-'}</td>
                <td style={{ textAlign: 'right' }}>{Number(l.mrp !== undefined ? l.mrp : l.rate).toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{Number(l.rate).toFixed(2)}</td>
                <td style={{ textAlign: 'center' }}>{l.discountPct || 0}</td>
                {sameState ? (
                  <>
                    <td style={{ textAlign: 'center' }}>{halfGstRate}%</td>
                    <td style={{ textAlign: 'right' }}>{Number(l.sgst || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'center' }}>{halfGstRate}%</td>
                    <td style={{ textAlign: 'right' }}>{Number(l.cgst || 0).toFixed(2)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ textAlign: 'center' }}>{l.gstRate || 0}%</td>
                    <td style={{ textAlign: 'right' }}>{Number(l.igst || 0).toFixed(2)}</td>
                  </>
                )}
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(l.total).toFixed(2)}</td>
              </tr>
            );
          })}
          {/* Fill empty lines for consistent layout if small line count */}
          {computed.length < 3 && Array.from({ length: 3 - computed.length }).map((_, idx) => (
            <tr key={`empty-${idx}`} className="empty-row">
              <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
              {sameState ? <><td></td><td></td><td></td><td></td></> : <><td></td><td></td></>}
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bottom Section with 3 Compartments */}
      <div className="inv-bottom-section">
        {/* Left: Bank details & Terms & Scan */}
        <div className="inv-bottom-col left-col">
          <div className="bank-box">
            <div className="box-heading">BANK DETAILS:</div>
            <div className="bank-details-content">
              <div><strong>{COMPANY_CONFIG.bank.bankName.toUpperCase()}</strong></div>
              <div>A/C NO: {COMPANY_CONFIG.bank.accountNumber}</div>
              <div>IFSC CODE: {COMPANY_CONFIG.bank.ifsc}</div>
            </div>
            <div className="ledger-balance-row">
              <strong>LEDGER BALANCE :</strong> Rs. {Number(customer?.currentBalance ?? 0).toFixed(2)}
            </div>
          </div>

          <div className="terms-box">
            <div className="box-heading">Terms &amp; Conditions</div>
            <ol className="terms-list">
              {COMPANY_CONFIG.terms.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>

          <div className="scan-pay-strip">
            <strong>Scan &amp; Pay:</strong> UPI: laetuslifesciences@okhdfcbank
          </div>
        </div>

        {/* Middle: GST Tax Slab Summary */}
        <div className="inv-bottom-col mid-col">
          <div className="box-heading text-center">GST SUMMARY</div>
          <table className="gst-summary-table">
            <thead>
              <tr>
                <th>GST Rate</th>
                <th>Taxable</th>
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
                  <td>{slab.rate}</td>
                  <td>{slab.amount.toFixed(2)}</td>
                  {sameState ? (
                    <>
                      <td>{slab.cgst.toFixed(2)}</td>
                      <td>{slab.sgst.toFixed(2)}</td>
                    </>
                  ) : (
                    <td>{slab.igst.toFixed(2)}</td>
                  )}
                  <td>{slab.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: Calculations and Totals */}
        <div className="inv-bottom-col right-col">
          <div className="totals-table">
            <div className="total-line">
              <span>AMOUNT BEFORE TAX</span>
              <span className="total-val">{formatCurrency(grossBeforeDiscount)}</span>
            </div>
            <div className="total-line">
              <span>DISCOUNT</span>
              <span className="total-val">{formatCurrency(discountTotal)}</span>
            </div>
            <div className="total-line">
              <span>TAXABLE TOTAL</span>
              <span className="total-val">{formatCurrency(taxableTotal)}</span>
            </div>
            {sameState ? (
              <>
                <div className="total-line">
                  <span>SGST PAYABLE</span>
                  <span className="total-val">{formatCurrency(sgst)}</span>
                </div>
                <div className="total-line">
                  <span>CGST PAYABLE</span>
                  <span className="total-val">{formatCurrency(cgst)}</span>
                </div>
              </>
            ) : (
              <div className="total-line">
                <span>IGST PAYABLE</span>
                <span className="total-val">{formatCurrency(igst)}</span>
              </div>
            )}
            {courier > 0 && (
              <div className="total-line">
                <span>COURIER / OTHER</span>
                <span className="total-val">{formatCurrency(courier)}</span>
              </div>
            )}
            <div className="total-line grand-total-line">
              <span>GRAND TOTAL</span>
              <span className="total-val-grand">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
          <div className="amount-words-strip">
            <strong>Amount in Words:</strong> Rupees {amountInWords(grandTotal)} Only
          </div>
        </div>
      </div>

      {/* Signature Strip */}
      <div className="inv-signature-strip">
        <div className="sig-box left-sig">
          <div className="sig-line"></div>
          <div>Receiver Signature &amp; Stamp</div>
        </div>
        <div className="sig-box right-sig">
          <div className="sig-company-name">{COMPANY_CONFIG.signatoryLabel}</div>
          <div className="sig-line"></div>
          <div>Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
}

