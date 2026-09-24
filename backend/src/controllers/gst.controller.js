const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { GSTR2BImport } = require('../models');
const gstReportService = require('../services/gstReport.service');

const gstr1 = asyncHandler(async (req, res) => {
  const data = await gstReportService.getGstr1Data(req.query);
  return ApiResponse.success(res, { data });
});

const gstr2bReconciliation = asyncHandler(async (req, res) => {
  const data = await gstReportService.getGstr2bReconciliationData(req.query);
  return ApiResponse.success(res, { data });
});

const importGstr2b = asyncHandler(async (req, res) => {
  const { period, financialYear, records } = req.body;
  if (!period || !Array.isArray(records) || records.length === 0) {
    throw ApiError.badRequest('period and a non-empty records array are required');
  }

  const fy = financialYear || '2026-27';
  const savedRecords = [];

  for (const r of records) {
    if (!r.supplierGstin || !r.invoiceNo || !r.invoiceDate || r.taxableValue == null) {
      continue;
    }
    const record = await GSTR2BImport.findOneAndUpdate(
      { taxPeriod: period, supplierGstin: r.supplierGstin.trim(), invoiceNo: r.invoiceNo.trim() },
      {
        taxPeriod: period,
        financialYear: fy,
        supplierGstin: r.supplierGstin.trim(),
        supplierName: r.supplierName || '',
        invoiceNo: r.invoiceNo.trim(),
        invoiceDate: new Date(r.invoiceDate),
        invoiceValue: Number(r.invoiceValue || r.taxableValue),
        taxableValue: Number(r.taxableValue),
        cgst: Number(r.cgst || 0),
        sgst: Number(r.sgst || 0),
        igst: Number(r.igst || 0),
        isRcm: Boolean(r.isRcm),
        itcAvailability: r.itcAvailability || 'Available',
        source: 'Portal Import',
        importedBy: req.user?.name || 'Admin',
      },
      { upsert: true, new: true }
    );
    savedRecords.push(record);
  }

  const reconData = await gstReportService.getGstr2bReconciliationData({ period, financialYear: fy });
  return ApiResponse.created(res, {
    message: `Imported ${savedRecords.length} GSTR-2B records successfully`,
    data: { importedCount: savedRecords.length, reconciliation: reconData },
  });
});

const gstr3bSummary = asyncHandler(async (req, res) => {
  const data = await gstReportService.getGstr3bData(req.query);
  return ApiResponse.success(res, { data });
});

const crossReconciliation = asyncHandler(async (req, res) => {
  const data = await gstReportService.getGstCrossReconciliationData(req.query);
  return ApiResponse.success(res, { data });
});

module.exports = {
  gstr1,
  gstr2bReconciliation,
  itcReconciliation: gstr2bReconciliation,
  importGstr2b,
  gstr3bSummary,
  crossReconciliation,
};
