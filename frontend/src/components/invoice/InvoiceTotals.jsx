import React from 'react';
import { formatCurrency } from '../../utils/format.js';
import './invoice.css';

export default function InvoiceTotals({ beforeTax, discount, cgst, sgst, igst, courierCharges = 0, grandTotal }) {
  return (
    <div className="invoice-totals">
      <div className="row"><span>Amount Before Tax</span><span>{formatCurrency(beforeTax)}</span></div>
      <div className="row"><span>Discount</span><span>- {formatCurrency(discount)}</span></div>
      {cgst > 0 && <div className="row"><span>CGST Payable</span><span>{formatCurrency(cgst)}</span></div>}
      {sgst > 0 && <div className="row"><span>SGST Payable</span><span>{formatCurrency(sgst)}</span></div>}
      {igst > 0 && <div className="row"><span>IGST Payable</span><span>{formatCurrency(igst)}</span></div>}
      {courierCharges > 0 && <div className="row"><span>Courier Charges</span><span>{formatCurrency(courierCharges)}</span></div>}
      <div className="row grand"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
    </div>
  );
}
