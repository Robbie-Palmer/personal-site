import { format, isValid, parse } from "date-fns";

export type PastedHistoryRow = {
  /** Calendar date; each pasted series accepts at most one row per day. */
  date: string;
  value: number;
};

export type PastedHistoryIssue = {
  line: number;
  message: string;
};

export type PastedHistoryResult = {
  rows: PastedHistoryRow[];
  issues: PastedHistoryIssue[];
};

const HEADER_DATE = /^(date|month)$/i;
const HEADER_VALUE =
  /^(value|market value|current value|balance|amount|deposits?\/withdrawals?|deposit|withdrawal|flow)$/i;
const DATE_FORMATS = ["yyyy-MM-dd", "dd/MM/yyyy", "dd-MM-yyyy", "yyyy/MM/dd"];
const MAX_PASTED_HISTORY_CHARACTERS = 1_000_000;

function csvFields(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");

  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const character = line[i];
    if (character === '"') {
      if (quoted && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

function normaliseDate(raw: string): string | null {
  const value = raw.trim();
  for (const dateFormat of DATE_FORMATS) {
    const parsed = parse(value, dateFormat, new Date(2000, 0, 1));
    if (isValid(parsed) && format(parsed, dateFormat) === value) {
      return format(parsed, "yyyy-MM-dd");
    }
  }
  return null;
}

function parseAmount(rawFields: string[]): number | null {
  // Joining trailing fields also accepts an unquoted thousands separator,
  // e.g. 2024-01-31,£1,234.56 copied from a simple CSV export.
  const normalised = rawFields
    .join("")
    .trim()
    .replace(/[\p{Sc}\s]/gu, "")
    .replaceAll(",", "");
  const parenthesised = normalised.startsWith("(") && normalised.endsWith(")");
  const cleaned = normalised.replace(/^\((.*)\)$/, "$1");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return parenthesised ? -value : value;
}

/**
 * Parses two-column spreadsheet history. CSV and tab-separated clipboard data
 * are accepted, with an optional header. Dates are normalised to ISO and all
 * issues are returned together so the UI can reject the import atomically.
 */
export function parsePastedHistory(input: string): PastedHistoryResult {
  if (input.length > MAX_PASTED_HISTORY_CHARACTERS) {
    return {
      rows: [],
      issues: [
        {
          line: 1,
          message: "Paste is too large (maximum 1,000,000 characters)",
        },
      ],
    };
  }

  const rows: PastedHistoryRow[] = [];
  const issues: PastedHistoryIssue[] = [];
  const seenDates = new Set<string>();

  for (const [index, rawLine] of input.split(/\r?\n/).entries()) {
    if (rawLine.trim() === "") continue;
    const line = index + 1;
    const fields = csvFields(rawLine).map((field) => field.trim());
    if (
      fields.length >= 2 &&
      HEADER_DATE.test(fields[0] ?? "") &&
      HEADER_VALUE.test(fields[1] ?? "")
    ) {
      continue;
    }
    if (fields.length < 2) {
      issues.push({ line, message: "Expected two columns: date and value" });
      continue;
    }

    const date = normaliseDate(fields[0] ?? "");
    if (date == null) {
      issues.push({
        line,
        message: "Use YYYY-MM-DD or DD/MM/YYYY for the date",
      });
      continue;
    }
    const value = parseAmount(fields.slice(1));
    if (value == null) {
      issues.push({ line, message: "Value must be a valid number" });
      continue;
    }
    if (seenDates.has(date)) {
      issues.push({ line, message: `Duplicate date ${date}` });
      continue;
    }
    seenDates.add(date);
    rows.push({ date, value });
  }

  return {
    rows: rows.toSorted((a, b) => a.date.localeCompare(b.date)),
    issues,
  };
}
