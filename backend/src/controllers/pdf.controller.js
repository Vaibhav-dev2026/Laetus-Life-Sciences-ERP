const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Sale, Purchase, Payment, Customer, Supplier, Company, CustomerLedger, SupplierLedger } = require('../models');
const { normalizeCompany } = require('../utils/companyHelper');
const {
  generateInvoicePdf,
  generatePurchasePdf,
  generatePaymentPdf,
  generateLedgerPdf,
} = require('../services/pdf.service');

function sendPdfResponse(res, filename, buffer) {
  // Defensive: verify the buffer is genuinely a PDF (starts with %PDF-)
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const isPdf = buf.length > 5 && buf.subarray(0, 5).toString('utf-8') === '%PDF-';

  if (!isPdf) {
    // PDF generation produced non-PDF output — never serve it as a PDF.
    // eslint-disable-next-line no-console
    console.error('[pdf.controller] sendPdfResponse: buffer does not begin with %PDF- — aborting. First bytes:', buf.subarray(0, 20).toString('utf-8'));
    return res.status(503).json({
      success: false,
      message: 'PDF generation failed on the server. The document could not be rendered as PDF.',
      code: 'PDF_UNAVAILABLE',
    });
  }

  const cleanFilename = filename.replace(/\.pdf$/i, '') + '.pdf';
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
  res.setHeader('Content-Length', buf.length);
  return res.status(200).end(buf);
}

// GET /api/sales/:id/pdf or /api/pdf/invoice/:id
const downloadInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isObjId = require('mongoose').Types.ObjectId.isValid(id);
  const sale = await Sale.findOne({ $or: [{ id }, { invoiceNo: id }, ...(isObjId ? [{ _id: id }] : [])] });
  if (!sale) throw ApiError.notFound('Invoice not found');

  const customer = await Customer.findOne({ $or: [{ id: sale.customerId }, ...(require('mongoose').Types.ObjectId.isValid(sale.customerId) ? [{ _id: sale.customerId }] : [])] });
  const company = normalizeCompany(await Company.findOne());

  try {
    const pdfBuffer = await generateInvoicePdf({ company, customer, sale });
    return sendPdfResponse(res, `${(sale.invoiceNo || sale.id).replace(/\//g, '-')}.pdf`, pdfBuffer);
  } catch (err) {
    throw ApiError.internal(`PDF generation failed: ${err.message}`);
  }
});

// GET /api/purchases/:id/pdf or /api/pdf/purchase/:id
const downloadPurchase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isObjId = require('mongoose').Types.ObjectId.isValid(id);
  const purchase = await Purchase.findOne({ $or: [{ id }, { purchaseInvoiceNo: id }, ...(isObjId ? [{ _id: id }] : [])] });
  if (!purchase) throw ApiError.notFound('Purchase order/invoice not found');

  const supplier = await Supplier.findOne({ $or: [{ id: purchase.supplierId }, ...(require('mongoose').Types.ObjectId.isValid(purchase.supplierId) ? [{ _id: purchase.supplierId }] : [])] });
  const company = normalizeCompany(await Company.findOne());

  try {
    const pdfBuffer = await generatePurchasePdf({ company, supplier, purchase });
    return sendPdfResponse(res, `${(purchase.purchaseInvoiceNo || purchase.id).replace(/\//g, '-')}.pdf`, pdfBuffer);
  } catch (err) {
    throw ApiError.internal(`PDF generation failed: ${err.message}`);
  }
});

// GET /api/payments/:id/pdf or /api/pdf/payment/:id
const downloadPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isObjId = require('mongoose').Types.ObjectId.isValid(id);
  const payment = await Payment.findOne({ $or: [{ id }, ...(isObjId ? [{ _id: id }] : [])] });
  if (!payment) throw ApiError.notFound('Payment receipt not found');

  let party = null;
  const isPartyObjId = require('mongoose').Types.ObjectId.isValid(payment.partyId);
  if (payment.partyType === 'Customer') {
    party = await Customer.findOne({ $or: [{ id: payment.partyId }, ...(isPartyObjId ? [{ _id: payment.partyId }] : [])] });
  } else {
    party = await Supplier.findOne({ $or: [{ id: payment.partyId }, ...(isPartyObjId ? [{ _id: payment.partyId }] : [])] });
  }
  const company = normalizeCompany(await Company.findOne());

  try {
    const pdfBuffer = await generatePaymentPdf({ company, party, payment });
    return sendPdfResponse(res, `Receipt-${payment.id}.pdf`, pdfBuffer);
  } catch (err) {
    throw ApiError.internal(`PDF generation failed: ${err.message}`);
  }
});

// GET /api/ledger/customer/pdf
const downloadCustomerLedger = asyncHandler(async (req, res) => {
  const { customerId, from, to } = req.query;
  if (!customerId) throw ApiError.badRequest('customerId is required');
  const isCustObjId = require('mongoose').Types.ObjectId.isValid(customerId);
  const customer = await Customer.findOne({ $or: [{ id: customerId }, ...(isCustObjId ? [{ _id: customerId }] : [])] });
  if (!customer) throw ApiError.notFound('Customer not found');

  const query = { partyId: customer.id || customerId };
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }
  const entries = await CustomerLedger.find(query).sort({ date: 1, createdAt: 1 });
  const closingBalance = entries.length ? entries[entries.length - 1].balance : (customer.openingOutstanding || 0);
  const company = normalizeCompany(await Company.findOne());
  const dateRange = (from && to) ? `${from} to ${to}` : 'All Time';

  try {
    const pdfBuffer = await generateLedgerPdf({
      company,
      party: customer,
      partyType: 'Customer',
      entries,
      openingBalance: customer.openingOutstanding || 0,
      closingBalance,
      dateRange,
    });
    return sendPdfResponse(res, `Ledger-${(customer.partyName || customerId).replace(/\s+/g, '_')}.pdf`, pdfBuffer);
  } catch (err) {
    throw ApiError.internal(`PDF generation failed: ${err.message}`);
  }
});

// GET /api/ledger/supplier/pdf
const downloadSupplierLedger = asyncHandler(async (req, res) => {
  const { supplierId, from, to } = req.query;
  if (!supplierId) throw ApiError.badRequest('supplierId is required');
  const isSuppObjId = require('mongoose').Types.ObjectId.isValid(supplierId);
  const supplier = await Supplier.findOne({ $or: [{ id: supplierId }, ...(isSuppObjId ? [{ _id: supplierId }] : [])] });
  if (!supplier) throw ApiError.notFound('Supplier not found');

  const query = { partyId: supplier.id || supplierId };
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }
  const entries = await SupplierLedger.find(query).sort({ date: 1, createdAt: 1 });
  const closingBalance = entries.length ? entries[entries.length - 1].balance : (supplier.openingPayable || 0);
  const company = normalizeCompany(await Company.findOne());
  const dateRange = (from && to) ? `${from} to ${to}` : 'All Time';

  try {
    const pdfBuffer = await generateLedgerPdf({
      company,
      party: supplier,
      partyType: 'Supplier',
      entries,
      openingBalance: supplier.openingPayable || 0,
      closingBalance,
      dateRange,
    });
    return sendPdfResponse(res, `Ledger-${(supplier.partyName || supplierId).replace(/\s+/g, '_')}.pdf`, pdfBuffer);
  } catch (err) {
    throw ApiError.internal(`PDF generation failed: ${err.message}`);
  }
});

module.exports = {
  downloadInvoice,
  downloadPurchase,
  downloadPayment,
  downloadCustomerLedger,
  downloadSupplierLedger,
};
