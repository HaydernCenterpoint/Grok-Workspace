import * as XLSX from "xlsx";
import type { OfficeDoc } from "./types";
import { isFormulaCell } from "./xml";

/** SheetJS workbook bytes — already-installed xlsx, not hand-rolled sheet XML. */
export function compileXlsxBytes(doc: OfficeDoc): Uint8Array {
  const wb = XLSX.utils.book_new();
  const sheets = doc.sheets ?? [];
  if (sheets.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[doc.title]]), "Sheet1");
  }
  for (const sheet of sheets) {
    const header = sheet.columns.map((c) => c.label);
    const aoa: (string | number | boolean)[][] = [header];
    const formulas: { r: number; c: number; f: string }[] = [];
    sheet.rows.forEach((row, ri) => {
      const line: (string | number | boolean)[] = [];
      sheet.columns.forEach((col, ci) => {
        const v = row[col.key];
        if (isFormulaCell(v)) {
          line.push("");
          formulas.push({ r: ri + 1, c: ci, f: v.slice(1) });
          return;
        }
        if (v == null) {
          line.push("");
          return;
        }
        line.push(v);
      });
      aoa.push(line);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    for (const f of formulas) {
      const ref = XLSX.utils.encode_cell({ r: f.r, c: f.c });
      const cell = ws[ref] ?? { t: "n" };
      cell.f = f.f;
      ws[ref] = cell;
    }
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31) || "Sheet");
  }
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
