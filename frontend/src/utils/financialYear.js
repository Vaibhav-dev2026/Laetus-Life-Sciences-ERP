/**
 * Single source of truth for Indian Financial Year logic across the Frontend.
 * Indian Financial Year: April 1 -> March 31.
 */

/**
 * Calculates current Financial Year dynamically from a Date object (defaults to today).
 * IST Timezone aware (+05:30) so dates on April 1st inside 00:00-05:30 IST are correctly attributed.
 * Returns canonical format: "YYYY-YY" (e.g. "2026-27").
 */
export function getCurrentFinancialYear(date = new Date()) {
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
 * Parses any FY format ("2026-27", "26-27", "2026-2027", "FY 2026-27")
 * to structured details and exact start/end Date objects.
 */
export function parseFinancialYear(fyString) {
  if (!fyString || typeof fyString !== 'string') return null;
  const clean = fyString.replace(/^FY\s*/i, '').trim();
  const match = clean.match(/^(\d{2,4})-(\d{2,4})$/);
  if (!match) return null;

  let startYear = parseInt(match[1], 10);
  let endYear = parseInt(match[2], 10);
  if (startYear < 100) startYear += 2000;
  if (endYear < 100) endYear += 2000;

  const shortFy = `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
  const canonicalFy = `${startYear}-${String(endYear).slice(-2)}`;
  const fullFy = `${startYear}-${endYear}`;

  return {
    startYear,
    endYear,
    shortFy,
    canonicalFy,
    fullFy,
    startDate: new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0)),
    endDate: new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999)),
  };
}

/**
 * Dynamically computes array of Financial Year strings.
 * Always includes past years, current FY (calculated from today's date),
 * future years, and any company/custom registered years.
 *
 * Guaranteed to auto-include FY 2027-28 on 1 Apr 2027 without source code edits!
 */
export function getDynamicFinancialYears(companyYears = [], extraYears = []) {
  const currentFy = getCurrentFinancialYear();
  const parsedCurrent = parseFinancialYear(currentFy);
  const currentStartYear = parsedCurrent ? parsedCurrent.startYear : new Date().getFullYear();

  const set = new Set();

  // 1. Generate range around current year (e.g. 3 past years, current year, 2 future years)
  for (let y = currentStartYear - 3; y <= currentStartYear + 2; y++) {
    const endY = y + 1;
    set.add(`${y}-${String(endY).slice(-2)}`);
  }

  // 2. Add current FY explicitly
  set.add(currentFy);

  // 3. Add company / custom years passed in
  const allCustom = Array.isArray(companyYears) ? companyYears : [];
  const allExtra = Array.isArray(extraYears) ? extraYears : [];
  [...allCustom, ...allExtra].forEach((yStr) => {
    const parsed = parseFinancialYear(yStr);
    if (parsed) {
      set.add(parsed.canonicalFy);
    }
  });

  // Sort chronologically in descending order (newest FY first)
  const sorted = Array.from(set).sort((a, b) => {
    const pa = parseFinancialYear(a);
    const pb = parseFinancialYear(b);
    return (pb?.startYear || 0) - (pa?.startYear || 0);
  });

  return sorted;
}

/**
 * Format FY for UI display: "2026-27" -> "FY 2026-27"
 */
export function formatFyLabel(fyString) {
  const parsed = parseFinancialYear(fyString);
  if (!parsed) return fyString;
  return `FY ${parsed.canonicalFy}`;
}
