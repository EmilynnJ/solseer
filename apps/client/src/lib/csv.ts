export type CsvColumn<T> = { header: string; value: (row: T) => unknown };

// Cells starting with = + - @ are prefixed so spreadsheet apps don't run them
// as formulas (user names and reasons are user-supplied).
function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  let text =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);
  if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  return [
    columns.map((column) => cell(column.header)).join(","),
    ...rows.map((row) => columns.map((column) => cell(column.value(row))).join(",")),
  ].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(
    new Blob([String.fromCharCode(0xfeff), csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const dollars = (cents: unknown) =>
  typeof cents === "number" ? (cents / 100).toFixed(2) : "";
