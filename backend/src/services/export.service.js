const ExcelJS = require('exceljs');
const { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun } = require('docx');

// Generic reusable exporters — any report controller can call these with its
// own column/row shape rather than re-implementing ExcelJS/docx wiring.

async function buildExcel({ sheetName = 'Report', columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(14, c.label.length + 4) }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  return workbook.xlsx.writeBuffer();
}

async function buildDocx({ title, columns, rows }) {
  const headerRow = new TableRow({
    children: columns.map((c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c.label, bold: true })] })] })),
  });
  const dataRows = rows.map((row) => new TableRow({
    children: columns.map((c) => new TableCell({ children: [new Paragraph(String(row[c.key] ?? ''))] })),
  }));

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 32 })] }),
        new Paragraph({ text: '' }),
        new Table({ rows: [headerRow, ...dataRows] }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildExcel, buildDocx };
