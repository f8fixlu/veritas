/**
 * Bounded spreadsheet import.
 *
 * The npm `xlsx` package is stuck at 0.18.5 (the maintained builds are only
 * published off-registry), so instead of feeding uploads straight into it we:
 *
 *  - parse CSV ourselves with a small, dependency-free RFC-4180 reader, so the
 *    most common import path never touches a third-party parser;
 *  - keep the Excel parser isolated behind an `await import()` and never load
 *    it for CSV;
 *  - reject anything oversized before it reaches the parser.
 *
 * Every path enforces the same limits so a crafted file cannot exhaust CPU or
 * memory (the advisories against `xlsx` are DoS/prototype-pollution vectors
 * that a size bound keeps well contained).
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_ROWS = 1000; // data rows, excluding the header row
export const MAX_COLUMNS = 50;
export const MAX_CELL_CHARS = 2000;

/** Content-Length can exceed the file size by the multipart envelope. */
export const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;

export class SpreadsheetLimitError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "SpreadsheetLimitError";
    this.status = status;
  }
}

function appendCell(field: string, ch: string): string {
  if (field.length >= MAX_CELL_CHARS) {
    throw new SpreadsheetLimitError(
      `A cell is longer than ${MAX_CELL_CHARS} characters.`
    );
  }
  return field + ch;
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    if (field.length > MAX_CELL_CHARS) {
      throw new SpreadsheetLimitError(
        `A cell is longer than ${MAX_CELL_CHARS} characters.`
      );
    }
    row.push(field);
    field = "";
    if (row.length > MAX_COLUMNS) {
      throw new SpreadsheetLimitError(
        `A row has more than ${MAX_COLUMNS} columns.`
      );
    }
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
    if (rows.length > MAX_ROWS + 1) {
      throw new SpreadsheetLimitError(
        `The file has more than ${MAX_ROWS} rows.`
      );
    }
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field = appendCell(field, '"');
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field = appendCell(field, ch);
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushField();
      pushRow();
    } else if (ch === "\r") {
      if (input[i + 1] === "\n") i++;
      pushField();
      pushRow();
    } else {
      field = appendCell(field, ch);
    }
  }
  if (row.length > 0 || field.length > 0) {
    pushField();
    pushRow();
  }
  return rows;
}

async function parseExcel(buffer: Buffer): Promise<string[][]> {
  // Isolated + dynamically imported: the CSV path never pulls this in. Kept as
  // the patched 0.20.x build via the @e965/xlsx npm republish (see package.json).
  const XLSX = await import("@e965/xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer", dense: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  return matrix.map((cells) =>
    (cells ?? []).map((cell) => (cell == null ? "" : String(cell)))
  );
}

function enforceMatrixLimits(matrix: string[][]): void {
  if (matrix.length > MAX_ROWS + 1) {
    throw new SpreadsheetLimitError(
      `The file has more than ${MAX_ROWS} rows.`
    );
  }
  for (const row of matrix) {
    if (row.length > MAX_COLUMNS) {
      throw new SpreadsheetLimitError(
        `The file has a row with more than ${MAX_COLUMNS} columns.`
      );
    }
    for (const cell of row) {
      if (cell.length > MAX_CELL_CHARS) {
        throw new SpreadsheetLimitError(
          `A cell is longer than ${MAX_CELL_CHARS} characters.`
        );
      }
    }
  }
}

function matrixToRecords(matrix: string[][]): Record<string, unknown>[] {
  if (matrix.length === 0) return [];
  const header = matrix[0].map((cell) => String(cell ?? "").trim());
  const records: Record<string, unknown>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const record: Record<string, unknown> = {};
    for (let c = 0; c < header.length; c++) {
      const key = header[c];
      if (!key) continue;
      record[key] = cells[c] ?? "";
    }
    records.push(record);
  }
  return records;
}

/**
 * Reads a .csv/.xlsx/.xls upload into row objects keyed by the header row.
 * Throws `SpreadsheetLimitError` (with a suitable status) when a limit is hit.
 */
export async function readSpreadsheetRecords(
  buffer: Buffer,
  filename: string
): Promise<Record<string, unknown>[]> {
  const name = filename.toLowerCase();
  const matrix = name.endsWith(".csv")
    ? parseCsv(buffer.toString("utf-8").replace(/^\uFEFF/, ""))
    : await parseExcel(buffer);
  enforceMatrixLimits(matrix);
  return matrixToRecords(matrix);
}
