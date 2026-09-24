// Authoritative GST calculation rules across the ERP.
// Single shared calculation service for lines and documents.
export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function calcLine({ qty = 0, rate = 0, discountPct = 0, gstRate = 0, sameState = true, isInterState = false }) {
  const isInter = isInterState || !sameState;
  const q = Number(qty) || 0;
  const r = Number(rate) || 0;
  const discPct = Number(discountPct) || 0;
  const gRate = Number(gstRate) || 0;

  const gross = round2(q * r);
  const discountAmt = round2(gross * (discPct / 100));
  const taxable = round2(gross - discountAmt);
  const gstAmt = round2(taxable * (gRate / 100));

  let cgst = 0, sgst = 0, igst = 0;
  if (!isInter) {
    cgst = round2(gstAmt / 2);
    sgst = round2(gstAmt / 2);
  } else {
    igst = gstAmt;
  }
  const total = round2(taxable + cgst + sgst + igst);

  return {
    gross,
    discountAmt,
    taxable,
    taxableValue: taxable,
    cgst,
    sgst,
    igst,
    gstAmt,
    gstAmount: gstAmt,
    total,
  };
}

export function sumLines(lines = [], key) {
  return round2(lines.reduce((acc, l) => acc + (Number(l[key]) || 0), 0));
}

