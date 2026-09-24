const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildExcel, buildDocx } = require('../services/export.service');
const { generateReportPdf } = require('../services/pdf.service');
const { Company } = require('../models');
const { normalizeCompany } = require('../utils/companyHelper');
const { outstandingRows, salesRows, purchasesRows, stockRows, customersRows, suppliersRows, productsRows, gstr1Rows, itcRows, gstr3bRows, paymentsRows, expensesRows } = require('../services/reportRows.service');

// Central export endpoint: GET /api/exports/:report?format=xlsx|docx|csv|pdf
// report ∈ outstanding | sales | purchases | stock | customers | suppliers | products | gstr1 | itc_reconciliation | gstr3b | payments | expenses
const REPORT_BUILDERS = {
  outstanding: outstandingRows,
  sales: salesRows,
  purchases: purchasesRows,
  stock: stockRows,
  customers: customersRows,
  suppliers: suppliersRows,
  products: productsRows,
  gstr1: gstr1Rows,
  itc_reconciliation: itcRows,
  gstr3b: gstr3bRows,
  payments: paymentsRows,
  expenses: expensesRows,
};

const exportReport = asyncHandler(async (req, res) => {
  const { report, format } = req.params;
  const builder = REPORT_BUILDERS[report];
  if (!builder) throw ApiError.notFound(`No export is defined for report "${report}"`);

  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');

  const { columns, rows, title } = await builder(req.query);

  if (format === 'pdf') {
    const company = normalizeCompany(await Company.findOne());
    try {
      const rawPdf = await generateReportPdf({ title, columns, rows, company, filters: req.query });
      const pdfBuffer = Buffer.isBuffer(rawPdf) ? rawPdf : Buffer.from(rawPdf);
      const isPdf = pdfBuffer.length > 5 && pdfBuffer.slice(0, 5).toString('utf-8') === '%PDF-';
      const mimeType = isPdf ? 'application/pdf' : 'text/html; charset=utf-8';
      const ext = isPdf ? '.pdf' : '.html';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${report}${ext}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.status(200).end(pdfBuffer);
    } catch (err) {
      throw ApiError.internal(`PDF generation failed: ${err.message}`);
    }
  }

  if (format === 'xlsx') {
    const buffer = await buildExcel({ sheetName: title, columns, rows });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${report}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).end(buffer);
  }

  if (format === 'docx') {
    const buffer = await buildDocx({ title, columns, rows });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${report}.docx"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).end(buffer);
  }

  if (format === 'csv') {
    const headerLine = columns.map((c) => `"${String(c.label).replace(/"/g, '""')}"`).join(',');
    const dataLines = rows.map((row) =>
      columns.map((c) => `"${String(row[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headerLine, ...dataLines].join('\r\n');
    const buffer = Buffer.from('\ufeff' + csvContent, 'utf-8');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${report}.csv"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).end(buffer);
  }

  throw ApiError.badRequest('format must be xlsx, docx, csv, or pdf');
});

module.exports = { exportReport };
