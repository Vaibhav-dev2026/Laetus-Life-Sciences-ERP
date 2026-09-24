const dayjs = require('dayjs');

/**
 * Normalizes any Financial Year string (e.g. "2026-27", "26-27", "2026-2027")
 * to exact start & end JavaScript Date objects for the Indian Financial Year (April 1 to March 31).
 */
function parseFinancialYear(fyString) {
  if (!fyString || typeof fyString !== 'string') return null;
  const match = fyString.trim().match(/^(\d{2,4})-(\d{2,4})$/);
  if (!match) return null;
  
  let startYear = parseInt(match[1], 10);
  let endYear = parseInt(match[2], 10);
  if (startYear < 100) startYear += 2000;
  if (endYear < 100) endYear += 2000;

  // Indian Financial Year: April 1 startYear -> March 31 endYear
  const startDate = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0)); // April 1 00:00:00.000 UTC
  const endDate = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999)); // March 31 23:59:59.999 UTC

  const shortFy = `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
  const fullFy = `${startYear}-${String(endYear).slice(-2)}`;

  return { startYear, endYear, startDate, endDate, shortFy, fullFy };
}

/**
 * Builds a clean Mongoose/MongoDB query condition for a date field
 * handling financialYear, from date, and to date properly.
 * 
 * Ensures 'from' starts at 00:00:00.000 and 'to' includes full 23:59:59.999 end of day.
 */
function buildDateQuery({ from, to, financialYear } = {}) {
  const range = {};

  let startDate = null;
  let endDate = null;

  if (financialYear) {
    const fyParsed = parseFinancialYear(financialYear);
    if (fyParsed) {
      startDate = fyParsed.startDate;
      endDate = fyParsed.endDate;
    }
  }

  if (from) {
    const fDate = new Date(from);
    if (!isNaN(fDate.getTime())) {
      if (typeof from === 'string' && !from.includes('T')) {
        fDate.setUTCHours(0, 0, 0, 0);
      }
      startDate = startDate ? (fDate > startDate ? fDate : startDate) : fDate;
    }
  }

  if (to) {
    const tDate = new Date(to);
    if (!isNaN(tDate.getTime())) {
      if (typeof to === 'string' && !to.includes('T')) {
        tDate.setUTCHours(23, 59, 59, 999);
      }
      endDate = endDate ? (tDate < endDate ? tDate : endDate) : tDate;
    }
  }

  if (startDate || endDate) {
    if (startDate) range.$gte = startDate;
    if (endDate) range.$lte = endDate;
  }

  return Object.keys(range).length > 0 ? range : null;
}

/**
 * Calculates current Financial Year dynamically from a Date object (defaults to today).
 * IST Timezone aware (+05:30) so dates on April 1st inside 00:00-05:30 IST are correctly attributed.
 * Returns canonical format: "YYYY-YY" (e.g. "2026-27").
 */
function getCurrentFinancialYear(date = new Date()) {
  const d = new Date(date);
  const istMs = d.getTime() + (5.5 * 60 * 60 * 1000);
  const ist = new Date(istMs);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth(); // 0 = Jan, 3 = April
  const startYear = month < 3 ? year - 1 : year;
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

/**
 * Dynamically computes array of Financial Year strings.
 */
function getDynamicFinancialYears(companyYears = [], extraYears = []) {
  const currentFy = getCurrentFinancialYear();
  const parsedCurrent = parseFinancialYear(currentFy);
  const currentStartYear = parsedCurrent ? parsedCurrent.startYear : new Date().getFullYear();

  const set = new Set();
  for (let y = currentStartYear - 3; y <= currentStartYear + 2; y++) {
    const endY = y + 1;
    set.add(`${y}-${String(endY).slice(-2)}`);
  }
  set.add(currentFy);

  const allCustom = Array.isArray(companyYears) ? companyYears : [];
  const allExtra = Array.isArray(extraYears) ? extraYears : [];
  [...allCustom, ...allExtra].forEach((yStr) => {
    const parsed = parseFinancialYear(yStr);
    if (parsed) set.add(parsed.fullFy || `${parsed.startYear}-${String(parsed.endYear).slice(-2)}`);
  });

  return Array.from(set).sort((a, b) => {
    const pa = parseFinancialYear(a);
    const pb = parseFinancialYear(b);
    return (pb?.startYear || 0) - (pa?.startYear || 0);
  });
}

module.exports = {
  getCurrentFinancialYear,
  parseFinancialYear,
  getDynamicFinancialYears,
  buildDateQuery,
};
