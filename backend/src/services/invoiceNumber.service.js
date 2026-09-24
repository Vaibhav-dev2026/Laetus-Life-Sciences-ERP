const dayjs = require('dayjs');
const Counter = require('../models/Counter');

// India financial year: April–March.
// IMPORTANT: We derive the FY in IST (UTC+05:30) regardless of the server's
// system timezone. This matters on Render/Linux where the server runs in UTC:
// "1 Apr 2026 00:00 IST" is "31 Mar 2026 18:30 UTC" — without the IST offset
// correction, dates in the first 5.5 hours of any April 1 would be mis-assigned
// to the previous FY.
function currentFinancialYear(date = new Date()) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30
  const istMs = new Date(date).getTime() + IST_OFFSET_MS;
  const ist = new Date(istMs);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth(); // 0-indexed; 3 = April
  const startYear = month < 3 ? year - 1 : year;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

// Atomic, FY-aware invoice numbering. Two concurrent requests can never
// receive the same number: the increment happens in a single findOneAndUpdate
// with $inc + upsert, which MongoDB guarantees is atomic per document.
// If a model is passed, the generated invoiceNo is verified not to collide
// with pre-existing records (same pattern as generateId collision safety).
async function nextInvoiceNumber({ series = 'SALE', financialYear, format, session, model, modelField = 'invoiceNo' } = {}) {
  const fy = financialYear || currentFinancialYear();
  const key = `invoice:${series}:${fy}`;
  const template = format || 'LLS/{FY}/{SEQ}';

  let seq, invoiceNo;

  // Generate and verify until non-colliding
  do {
    const counter = await Counter.findOneAndUpdate(
      { key },
      { $inc: { value: 1 } },
      { new: true, upsert: true, session }
    );
    seq = counter.value;
    const padded = String(seq).padStart(6, '0');
    invoiceNo = template.replace('{FY}', fy).replace('{SEQ}', padded);

    if (model) {
      let query = model.findOne({ [modelField]: invoiceNo });
      if (session) query = query.session(session);
      const exists = await query;
      if (!exists) break; // No collision, use this invoiceNo
      // Collision found — loop will increment again
    } else {
      break; // No model to check against, trust the counter
    }
  // eslint-disable-next-line no-constant-condition -- intentional retry loop, exited via break above
  } while (true);

  return { invoiceNo, financialYear: fy, sequence: seq };
}

module.exports = { nextInvoiceNumber, currentFinancialYear };
