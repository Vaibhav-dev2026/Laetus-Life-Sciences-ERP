import { downloadFile } from '../utils/download';

// Download XLSX from GET /api/exports/:report/xlsx
export async function downloadExcel(reportKey, filename, params = {}) {
  await downloadFile(`/exports/${reportKey}/xlsx`, `${filename}.xlsx`, params);
}

// Download DOCX from GET /api/exports/:report/docx
export async function downloadDocx(reportKey, filename, params = {}) {
  await downloadFile(`/exports/${reportKey}/docx`, `${filename}.docx`, params);
}

// Download CSV from GET /api/exports/:report/csv
export async function downloadCsv(reportKey, filename, params = {}) {
  await downloadFile(`/exports/${reportKey}/csv`, `${filename}.csv`, params);
}
