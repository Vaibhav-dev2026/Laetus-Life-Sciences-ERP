// Centralized company / branding configuration.
// In production this is fetched from GET /api/company and cached in CompanyContext.
// Every screen (invoice, settings, sidebar header) should read from here rather than
// hardcoding company details.
export const COMPANY_CONFIG = {
  name: 'L LAETUS LIFE SCIENCES',
  displayName: 'Laetus Life Sciences',
  tagline: 'love, life and lifesaving care',
  addressLine1: '1st Floor, 249 Sukhinagar, Bamroli Gam Road',
  addressLine2: 'Pandesara, Surat – 394221, Gujarat',
  state: 'Gujarat',
  stateCode: '24',
  gstin: '24AFSPT7471H1ZR',
  pan: 'AFSPT7471H',
  drugLicence: 'GJ-SUR-20-XXXXXX / 21-XXXXXX',
  phone: '9662031042',
  email: 'laetuslifesciences@gmail.com',
  logo: '/logo.png',
  bank: {
    bankName: 'HDFC Bank Ltd',
    accountNumber: '00000000000000',
    ifsc: 'HDFC0000000',
  },
  invoice: {
    prefix: 'LLS',
    numberFormat: 'LLS/{FY}/{SEQ}',
    financialYearStart: 'April',
    startNumber: 1001,
    dueDateDays: 30,
  },
  terms: [
    'Goods once sold will not be taken back or exchanged.',
    'Bills not paid due date will attract 24% interest.',
    'All disputes subject to Surat jurisdiction only.',
    'Prescribed Sales Tax declaration will be given.',
  ],
  signatoryLabel: 'for L LAETUS LIFE SCIENCES',
  currentFinancialYear: '2026-27',
  availableFinancialYears: ['2024-25', '2025-26', '2026-27', '2027-28', '2028-29', '2029-30'],
};

export const APP_NAME = 'Laetus Life Sciences ERP';
