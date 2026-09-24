const { round2 } = require('../utils/money');

// Single source of truth for GST math — reused by purchase, sale, GST reports
// and PDF generation so calculations never drift between modules.
// Backend always recalculates from qty/rate/discount/gstRate; totals
// submitted by the frontend are never trusted.
function calcLine({ qty = 0, rate = 0, discountPct = 0, gstRate = 0, isInterState = false, sameState = true }) {
  const isInter = isInterState || !sameState;
  const q = Number(qty) || 0;
  const r = Number(rate) || 0;
  const discPct = Number(discountPct) || 0;
  const gRate = Number(gstRate) || 0;

  const gross = round2(q * r);
  const discountAmt = round2(gross * (discPct / 100));
  const taxableValue = round2(gross - discountAmt);
  const gstAmount = round2(taxableValue * (gRate / 100));

  let cgst = 0, sgst = 0, igst = 0;
  if (isInter) {
    igst = gstAmount;
  } else {
    cgst = round2(gstAmount / 2);
    sgst = round2(gstAmount / 2);
  }

  const total = round2(taxableValue + cgst + sgst + igst);

  return {
    gross,
    discountAmt,
    taxableValue,
    taxable: taxableValue,
    gstAmount,
    gstAmt: gstAmount,
    cgst,
    sgst,
    igst,
    total,
  };
}

function calcDocumentTotals(computedLines = []) {
  return {
    grossTotal: round2(computedLines.reduce((a, l) => a + (Number(l.gross) || 0), 0)),
    discountTotal: round2(computedLines.reduce((a, l) => a + (Number(l.discountAmt) || 0), 0)),
    taxableTotal: round2(computedLines.reduce((a, l) => a + (Number(l.taxableValue !== undefined ? l.taxableValue : l.taxable) || 0), 0)),
    cgstTotal: round2(computedLines.reduce((a, l) => a + (Number(l.cgst) || 0), 0)),
    sgstTotal: round2(computedLines.reduce((a, l) => a + (Number(l.sgst) || 0), 0)),
    igstTotal: round2(computedLines.reduce((a, l) => a + (Number(l.igst) || 0), 0)),
    grandTotal: round2(computedLines.reduce((a, l) => a + (Number(l.total) || 0), 0)),
  };
}

function isInterState(companyStateCode, partyStateCode) {
  if (!partyStateCode) return false;
  return String(companyStateCode) !== String(partyStateCode);
}

module.exports = { calcLine, calcDocumentTotals, isInterState };

