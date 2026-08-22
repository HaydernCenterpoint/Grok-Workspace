/** XML + spreadsheet helpers for Office OOXML compile. */

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function colLetter(index1: number): string {
  let n = index1;
  let out = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    out = String.fromCharCode(65 + m) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out || "A";
}

export function isFormulaCell(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("=") && value.length > 1;
}
