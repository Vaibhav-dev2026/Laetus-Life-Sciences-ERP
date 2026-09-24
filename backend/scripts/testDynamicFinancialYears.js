const assert = require('assert');
const { getCurrentFinancialYear, parseFinancialYear, getDynamicFinancialYears } = require('../src/utils/dateRange.util');

console.log('=== FINANCIAL YEAR DYNAMIC SYSTEM REGRESSION TEST ===\n');

// 1. Test Indian Financial Year Date Boundaries (Section 49)
const testCases = [
  { date: '2026-03-31T23:59:59+05:30', expected: '2025-26' },
  { date: '2026-04-01T00:00:00+05:30', expected: '2026-27' },
  { date: '2027-03-31T23:59:59+05:30', expected: '2026-27' },
  { date: '2027-04-01T00:00:00+05:30', expected: '2027-28' },
  { date: '2028-04-01T00:00:00+05:30', expected: '2028-29' },
];

console.log('1. Testing Date Boundary Rules (Section 49):');
testCases.forEach(({ date, expected }) => {
  const result = getCurrentFinancialYear(new Date(date));
  console.log(`  Date: ${date} → Expected: ${expected} | Result: ${result}`);
  assert.strictEqual(result, expected, `Date boundary test failed for ${date}`);
});
console.log('  ✅ ALL DATE BOUNDARY TESTS PASSED.\n');

// 2. Test Dynamic Future FY Generation (Section 37 & 50)
console.log('2. Testing Future FY Auto-Inclusion without Code Modifications:');
const simDate2027 = new Date('2027-04-02T10:00:00+05:30');
const fy2027 = getCurrentFinancialYear(simDate2027);
console.log(`  On 02-Apr-2027, Current FY evaluated as: ${fy2027}`);
assert.strictEqual(fy2027, '2027-28');

const dynamicYearsOn2027 = getDynamicFinancialYears([], [fy2027]);
console.log('  Dynamic FY Options list on Apr 2027:', dynamicYearsOn2027);
assert.ok(dynamicYearsOn2027.includes('2027-28'), 'FY 2027-28 must automatically be in list');
assert.ok(dynamicYearsOn2027.includes('2028-29'), 'Future FY 2028-29 must automatically be in list');
console.log('  ✅ AUTOMATIC FUTURE FY CREATION VERIFIED.\n');

// 3. Test parseFinancialYear Start/End ISO Dates (Section 41)
console.log('3. Testing FY Date Boundaries Parsing (Section 41):');
const parsed = parseFinancialYear('2027-28');
console.log('  Parsed 2027-28 Start Date (UTC):', parsed.startDate.toISOString());
console.log('  Parsed 2027-28 End Date (UTC):', parsed.endDate.toISOString());
assert.strictEqual(parsed.startDate.toISOString(), '2027-04-01T00:00:00.000Z');
assert.strictEqual(parsed.endDate.toISOString(), '2028-03-31T23:59:59.999Z');
console.log('  ✅ FY DATE BOUNDARIES PARSING VERIFIED.\n');

console.log('=== ALL FINANCIAL YEAR SYSTEM TESTS PASSED SUCCESSFULLY ===');
