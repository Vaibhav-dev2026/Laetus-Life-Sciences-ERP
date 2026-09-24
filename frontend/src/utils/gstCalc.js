// GST preview calculations used across Purchase and Sales line editors.
// IMPORTANT: These are FRONTEND PREVIEW calculations only.
// The backend is authoritative and must recompute/validate all totals on save.

export function calcLine({ qty = 0, rate = 0, discountPct = 0, gstRate = 0, isIntraState = true }) {
  const gross = Number(qty) * Number(rate);
  const discountAmt = gross * (Number(discountPct) / 100);
  const taxable = gross - discountAmt;
  const gstAmt = taxable * (Number(gstRate) / 100);

  let cgst = 0, sgst = 0, igst = 0;
  if (isIntraState) {
    cgst = gstAmt / 2;
    sgst = gstAmt / 2;
  } else {
    igst = gstAmt;
  }

  const amount = taxable + gstAmt;

  return {
    gross: round2(gross),
    discountAmt: round2(discountAmt),
    taxable: round2(taxable),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    gstAmt: round2(gstAmt),
    amount: round2(amount),
  };
}

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function sumLines(lines) {
  return lines.reduce(
    (acc, line) => {
      acc.gross += line.gross || 0;
      acc.discountAmt += line.discountAmt || 0;
      acc.taxable += line.taxable || 0;
      acc.cgst += line.cgst || 0;
      acc.sgst += line.sgst || 0;
      acc.igst += line.igst || 0;
      acc.amount += line.amount || 0;
      return acc;
    },
    { gross: 0, discountAmt: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, amount: 0 }
  );
}
