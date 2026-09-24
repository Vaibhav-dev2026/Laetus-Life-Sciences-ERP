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

  Object.assign(company, req.body);
  await company.save();
  await logAudit({ user: req.user?.name, action: 'Update', module: 'Company Settings', reference: 'company', before, after: company.toObject() });
  return ApiResponse.success(res, { message: 'Company settings saved', data: company });
});

module.exports = { get, update };
