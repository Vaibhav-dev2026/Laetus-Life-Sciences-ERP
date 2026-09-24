/**
 * companyHelper.js
 *
 * Single source of truth for normalizing Company Mongoose documents
 * (or plain objects) into the canonical shape that all PDF templates,
 * report builders, DOCX/Excel exports, and print previews consume.
 *
 * The Company Mongoose model stores address as two separate fields:
 *   addressLine1   e.g. "1st Floor, 249 Sukhinagar, Bamroli Gam Road"
 *   addressLine2   e.g. "Pandesara, Surat – 394221, Gujarat"
 *
 * Legacy templates incorrectly used `comp.address` which was always
 * undefined → causing stale hardcoded fallback addresses to appear.
 *
 * This helper composes a correct `address` field so that:
 *   - All templates get `comp.address` correctly populated
 *   - `comp.phone` always returns the unmasked value from DB
 *   - No template ever needs to independently reconstruct address
 */

/**
 * Normalize a raw Company DB object into a flat template-ready object.
 * @param {Object} rawCompany - Mongoose document (or plain object) from Company.findOne()
 * @returns {Object} Flat object safe for use in all PDF/HTML/DOCX/Excel templates
 */
function normalizeCompany(rawCompany) {
  const c = rawCompany && typeof rawCompany.toObject === 'function'
    ? rawCompany.toObject()
    : (rawCompany || {});

  // Compose full address from addressLine1 + addressLine2
  const line1 = (c.addressLine1 || '').trim();
  const line2 = (c.addressLine2 || '').trim();
  const composedAddress = [line1, line2].filter(Boolean).join(', ');

  return {
    // Primary identification
    name: c.name || 'L LAETUS LIFE SCIENCES',

    // Address — templates can use comp.address (full), comp.addressLine1, comp.addressLine2
    address: composedAddress || '1st Floor, 249 Sukhinagar, Bamroli Gam Road, Pandesara, Surat – 394221',
    addressLine1: line1 || '1st Floor, 249 Sukhinagar, Bamroli Gam Road',
    addressLine2: line2 || 'Pandesara, Surat – 394221, Gujarat',

    // Contact — single canonical `phone` field from DB (unmasked with mandatory fallback)
    phone: (c.phone && c.phone.trim().length > 0 && !c.phone.includes('X') && !c.phone.includes('*')) ? c.phone.trim() : '9662031042',
    email: c.email || 'laetuslifesciences@gmail.com',

    // GST / Legal
    gstin: c.gstin || '24AFSPT7471H1ZR',
    pan: c.pan || '',
    state: c.state || 'Gujarat',
    stateCode: c.stateCode || '24',
    drugLicence: c.drugLicence || '',

    // Branding
    logo: c.logo || '',
    signatoryLabel: c.signatoryLabel || 'for L LAETUS LIFE SCIENCES',

    // Bank details
    bank: {
      bankName: (c.bank && c.bank.bankName) || '',
      accountNumber: (c.bank && c.bank.accountNumber) || '',
      ifsc: (c.bank && c.bank.ifsc) || '',
    },

    // Invoice settings
    invoice: {
      prefix: (c.invoice && c.invoice.prefix) || 'LLS',
      numberFormat: (c.invoice && c.invoice.numberFormat) || 'LLS/{FY}/{SEQ}',
      financialYearStart: (c.invoice && c.invoice.financialYearStart) || 'April',
      startNumber: (c.invoice && c.invoice.startNumber) || 1001,
      dueDateDays: (c.invoice && c.invoice.dueDateDays) || 30,
      expiryPolicy: (c.invoice && c.invoice.expiryPolicy) || 'Warn',
    },

    // Terms
    terms: Array.isArray(c.terms) ? c.terms : [],

    // Financial Years
    currentFinancialYear: c.currentFinancialYear || '2026-27',
    availableFinancialYears: (Array.isArray(c.availableFinancialYears) && c.availableFinancialYears.length > 0)
      ? c.availableFinancialYears
      : ['2024-25', '2025-26', '2026-27', '2027-28', '2028-29', '2029-30'],
  };
}

module.exports = { normalizeCompany };
