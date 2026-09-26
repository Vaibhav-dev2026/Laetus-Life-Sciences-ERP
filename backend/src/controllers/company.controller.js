const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const { Company } = require('../models');
const { logAudit } = require('../services/audit.service');
const { parseFinancialYear } = require('../utils/dateRange.util');

const get = asyncHandler(async (req, res) => {
  let company = await Company.findOne();
  if (!company) company = await Company.create({});
  return ApiResponse.success(res, { data: company });
});

const update = asyncHandler(async (req, res) => {
  let company = await Company.findOne();
  if (!company) company = new Company({});
  const before = company.toObject();

  if (req.body.availableFinancialYears) {
    if (!Array.isArray(req.body.availableFinancialYears)) {
      return ApiResponse.badRequest(res, 'availableFinancialYears must be an array');
    }
    const validFys = [];
    for (const fy of req.body.availableFinancialYears) {
      const parsed = parseFinancialYear(fy);
      if (!parsed) {
        return ApiResponse.badRequest(res, `Invalid Financial Year format: ${fy}. Expected YYYY-YY (e.g. 2027-28)`);
      }
      const canonicalCode = `${parsed.startYear}-${String(parsed.endYear).slice(-2)}`;
      if (!validFys.includes(canonicalCode)) {
        validFys.push(canonicalCode);
      }
    }
    validFys.sort((a, b) => parseInt(a.split('-')[0], 10) - parseInt(b.split('-')[0], 10));
    req.body.availableFinancialYears = validFys;
  }

  if (req.body.currentFinancialYear) {
    const parsed = parseFinancialYear(req.body.currentFinancialYear);
    if (!parsed) {
      return ApiResponse.badRequest(res, `Invalid Financial Year format: ${req.body.currentFinancialYear}`);
    }
    const canonicalCode = `${parsed.startYear}-${String(parsed.endYear).slice(-2)}`;
    req.body.currentFinancialYear = canonicalCode;
    if (company.availableFinancialYears && !company.availableFinancialYears.includes(canonicalCode)) {
      company.availableFinancialYears.push(canonicalCode);
    }
  }

  const topLevelFields = ['name', 'logo', 'addressLine1', 'addressLine2', 'state', 'stateCode', 'pin', 'phone', 'email', 'gstin', 'pan', 'drugLicence', 'signatoryLabel', 'currentFinancialYear', 'availableFinancialYears', 'terms'];
  topLevelFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      company[field] = req.body[field];
    }
  });

  if (req.body.bank && typeof req.body.bank === 'object') {
    if (!company.bank) company.bank = {};
    if (req.body.bank.bankName !== undefined) company.bank.bankName = req.body.bank.bankName;
    if (req.body.bank.accountNumber !== undefined) company.bank.accountNumber = req.body.bank.accountNumber;
    if (req.body.bank.ifsc !== undefined) company.bank.ifsc = req.body.bank.ifsc;
  }

  if (req.body.invoice && typeof req.body.invoice === 'object') {
    if (!company.invoice) company.invoice = {};
    if (req.body.invoice.prefix !== undefined) company.invoice.prefix = req.body.invoice.prefix;
    if (req.body.invoice.numberFormat !== undefined) company.invoice.numberFormat = req.body.invoice.numberFormat;
    if (req.body.invoice.financialYearStart !== undefined) company.invoice.financialYearStart = req.body.invoice.financialYearStart;
    if (req.body.invoice.startNumber !== undefined) company.invoice.startNumber = req.body.invoice.startNumber;
    if (req.body.invoice.dueDateDays !== undefined) company.invoice.dueDateDays = req.body.invoice.dueDateDays;
    if (req.body.invoice.expiryPolicy !== undefined) company.invoice.expiryPolicy = req.body.invoice.expiryPolicy;
  }

  await company.save();
  await logAudit({ user: req.user?.name, action: 'Update', module: 'Company Settings', reference: 'company', before, after: company.toObject() });
  return ApiResponse.success(res, { message: 'Company settings saved', data: company });
});

module.exports = { get, update };
