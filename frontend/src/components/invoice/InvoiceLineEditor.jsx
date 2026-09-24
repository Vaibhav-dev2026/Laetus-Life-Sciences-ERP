import React from "react";
import { calcLine } from "../../utils/gstCalc";
import { formatCurrency, formatDate } from "../../utils/formatters";

let rowIdCounter = 1000;

export function makeEmptyLine() {
  rowIdCounter += 1;
  return {
    rowId: rowIdCounter,
    productId: "",
    productName: "",
    batchId: "",
    batchNo: "",
    expiry: "",
    hsn: "",
    mrp: 0,
    qty: 1,
    freeQty: 0,
    pack: "",
    rate: 0,
    discountPct: 0,
    gstRate: 0,
  };
}

/**
 * Reusable editable line-item table for Purchase and Sales/Billing screens.
 * `products` and `batchesByProduct` drive the pickers; `isIntraState` toggles CGST+SGST vs IGST.
 */
export default function InvoiceLineEditor({
  lines,
  onChange,
  products = [],
  batchesByProduct = {},
  isIntraState = true,
  expiredBatchPolicy = "block", // 'block' | 'warn'
}) {
  function updateLine(rowId, patch) {
    onChange(lines.map((l) => (l.rowId === rowId ? { ...l, ...patch } : l)));
  }

  function removeLine(rowId) {
    onChange(lines.filter((l) => l.rowId !== rowId));
  }

  function addLine() {
    onChange([...lines, makeEmptyLine()]);
  }

  function handleProductSelect(rowId, productId) {
    const product = products.find((p) => p.id === productId);
    updateLine(rowId, {
      productId,
      productName: product?.name || "",
      hsn: product?.hsn || "",
      mrp: product?.mrp || 0,
      pack: product?.pack || "",
      rate: product?.saleRate ?? product?.purchaseRate ?? 0,
      gstRate: product?.gstRate || 0,
      batchId: "",
      batchNo: "",
      expiry: "",
    });
  }

  function handleBatchSelect(rowId, batchId) {
    const line = lines.find((l) => l.rowId === rowId);
    const batch = (batchesByProduct[line.productId] || []).find((b) => b.id === batchId);
    if (!batch) return;
    if (batch.status === "Expired" && expiredBatchPolicy === "block") {
      return; // disabled in UI already; safety no-op
    }
    updateLine(rowId, {
      batchId,
      batchNo: batch.batchNo,
      expiry: batch.expiryDate,
      mrp: batch.mrp,
      rate: batch.saleRate ?? batch.purchaseRate ?? line.rate,
    });
  }

  return (
    <div className="table-wrap">
      <table className="data-table" style={{ minWidth: 1100 }}>
        <thead>
          <tr>
            <th>Product</th>
            <th>Batch</th>
            <th>Expiry</th>
            <th>HSN</th>
            <th style={{ textAlign: "right" }}>MRP</th>
            <th style={{ textAlign: "right" }}>Qty</th>
            <th style={{ textAlign: "right" }}>Free</th>
            <th style={{ textAlign: "right" }}>Rate</th>
            <th style={{ textAlign: "right" }}>Disc %</th>
            <th style={{ textAlign: "right" }}>GST %</th>
            <th style={{ textAlign: "right" }}>Taxable</th>
            <th style={{ textAlign: "right" }}>CGST</th>
            <th style={{ textAlign: "right" }}>SGST</th>
            <th style={{ textAlign: "right" }}>IGST</th>
            <th style={{ textAlign: "right" }}>Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const calc = calcLine({ qty: line.qty, rate: line.rate, discountPct: line.discountPct, gstRate: line.gstRate, isIntraState });
            const batches = batchesByProduct[line.productId] || [];
            return (
              <tr key={line.rowId}>
                <td>
                  <select value={line.productId} onChange={(e) => handleProductSelect(line.rowId, e.target.value)} style={{ minWidth: 150 }}>
                    <option value="">Select product</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td>
                  <select value={line.batchId} onChange={(e) => handleBatchSelect(line.rowId, e.target.value)} disabled={!line.productId} style={{ minWidth: 130 }}>
                    <option value="">Select batch</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id} disabled={b.status === "Expired" && expiredBatchPolicy === "block"}>
                        {b.batchNo} · Stk {b.currentQty} {b.status === "Expired" ? "(Expired)" : b.status === "Near Expiry" ? "(Near Expiry)" : ""}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{line.expiry ? formatDate(line.expiry, "MM/YYYY") : "-"}</td>
                <td>{line.hsn || "-"}</td>
                <td style={{ textAlign: "right" }}>{line.mrp ? formatCurrency(line.mrp) : "-"}</td>
                <td style={{ textAlign: "right" }}>
                  <input type="number" min="0" value={line.qty} onChange={(e) => updateLine(line.rowId, { qty: Number(e.target.value) })} style={{ width: 60, textAlign: "right" }} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <input type="number" min="0" value={line.freeQty} onChange={(e) => updateLine(line.rowId, { freeQty: Number(e.target.value) })} style={{ width: 50, textAlign: "right" }} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <input type="number" min="0" value={line.rate} onChange={(e) => updateLine(line.rowId, { rate: Number(e.target.value) })} style={{ width: 70, textAlign: "right" }} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <input type="number" min="0" value={line.discountPct} onChange={(e) => updateLine(line.rowId, { discountPct: Number(e.target.value) })} style={{ width: 55, textAlign: "right" }} />
                </td>
                <td style={{ textAlign: "right" }}>{line.gstRate}%</td>
                <td style={{ textAlign: "right" }}>{formatCurrency(calc.taxable)}</td>
                <td style={{ textAlign: "right" }}>{formatCurrency(calc.cgst)}</td>
                <td style={{ textAlign: "right" }}>{formatCurrency(calc.sgst)}</td>
                <td style={{ textAlign: "right" }}>{formatCurrency(calc.igst)}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(calc.amount)}</td>
                <td>
                  <button type="button" className="btn btn-ghost btn-sm" aria-label="Remove line" onClick={() => removeLine(line.rowId)}>✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ padding: "var(--space-3) var(--space-4)" }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>+ Add Row</button>
      </div>
    </div>
  );
}
