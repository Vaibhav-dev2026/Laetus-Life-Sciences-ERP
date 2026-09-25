const fs = require('fs');
const puppeteer = require('puppeteer');
const { renderInvoiceHtml } = require('../templates/invoice.html');
const { renderPurchaseHtml } = require('../templates/purchase.html');
const { renderPaymentReceiptHtml } = require('../templates/paymentReceipt.html');
const { renderLedgerHtml } = require('../templates/ledger.html');
const { renderReportTableHtml } = require('../templates/reportTable.html');

const SYSTEM_CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

function getSystemChromePath() {
  for (const p of SYSTEM_CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

let sparticuzChromium = null;
try {
  sparticuzChromium = require('@sparticuz/chromium');
} catch (_) {
  sparticuzChromium = null;
}

async function launchBrowser() {
  const launchArgs = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  };

  // 1. Priority: Explicit PUPPETEER_EXECUTABLE_PATH env var if file exists on disk
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return await puppeteer.launch({ ...launchArgs, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH });
  }

  // 2. Serverless / Linux Container Priority (@sparticuz/chromium)
  if (sparticuzChromium && process.platform === 'linux') {
    try {
      const execPath = await sparticuzChromium.executablePath();
      if (execPath) {
        return await puppeteer.launch({
          args: [...sparticuzChromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process'],
          defaultViewport: sparticuzChromium.defaultViewport,
          executablePath: execPath,
          headless: sparticuzChromium.headless,
        });
      }
    } catch (cErr) {
      // eslint-disable-next-line no-console
      console.warn('[pdf.service] @sparticuz/chromium launch attempt:', cErr.message);
    }
  }

  // 3. Standard puppeteer launch
  try {
    return await puppeteer.launch(launchArgs);
  } catch (err) {
    // 4. System Chrome fallback
    const systemPath = getSystemChromePath();
    if (systemPath) {
      return await puppeteer.launch({ ...launchArgs, executablePath: systemPath });
    }
    throw err;
  }
}

/**
 * Universal PDF generator with system Chrome auto-detection.
 * Returns Buffer (PDF binary starting with %PDF- or clean HTML string buffer).
 */
async function generatePdfFromHtml(html, options = {}) {
  try {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        landscape: options.landscape || false,
        printBackground: true,
        margin: options.margin || { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
      });
      await page.close();
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[pdf.service] Puppeteer rendering unavailable, returning clean HTML print view:', err.message);
    return Buffer.from(html, 'utf-8');
  }
}

async function generateInvoicePdf({ company, customer, sale }) {
  const html = renderInvoiceHtml({ company, customer, sale });
  return generatePdfFromHtml(html, { format: 'A4', landscape: false });
}

async function generatePurchasePdf({ company, supplier, purchase }) {
  const html = renderPurchaseHtml({ company, supplier, purchase });
  return generatePdfFromHtml(html, { format: 'A4', landscape: false });
}

async function generatePaymentPdf({ company, party, payment }) {
  const html = renderPaymentReceiptHtml({ company, party, payment });
  return generatePdfFromHtml(html, { format: 'A4', landscape: false });
}

async function generateLedgerPdf({ company, party, partyType, entries, openingBalance, closingBalance, dateRange }) {
  const html = renderLedgerHtml({ company, party, partyType, entries, openingBalance, closingBalance, dateRange });
  return generatePdfFromHtml(html, { format: 'A4', landscape: false });
}

async function generateReportPdf({ title, columns, rows, company, filters }) {
  const html = renderReportTableHtml({ title, columns, rows, company, filters });
  return generatePdfFromHtml(html, { format: 'A4', landscape: true });
}

module.exports = {
  generatePdfFromHtml,
  generateInvoicePdf,
  generatePurchasePdf,
  generatePaymentPdf,
  generateLedgerPdf,
  generateReportPdf,
};
