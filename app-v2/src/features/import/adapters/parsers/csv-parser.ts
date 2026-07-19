export function parseCsv(
  content: string,
  options: { delimiter?: string; hasHeader?: boolean } = {},
): { headers: string[]; rows: string[][] } {
  const delimiter = options.delimiter ?? ',';
  const hasHeader = options.hasHeader ?? true;
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(current);
      current = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(current);
      current = '';
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim().length > 0)) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  if (hasHeader) {
    return { headers: rows[0] ?? [], rows: rows.slice(1) };
  }

  const headers = rows[0]?.map((_, index) => `column_${index + 1}`) ?? [];
  return { headers, rows };
}

export function mapCsvRow(
  headers: string[],
  row: string[],
): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    record[header.trim()] = row[index]?.trim() ?? '';
  });
  return record;
}
