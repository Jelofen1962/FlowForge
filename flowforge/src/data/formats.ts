export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('Invalid CSV: unterminated quoted field');
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const nonEmptyRows = rows.filter((values) => values.some((value) => value.length > 0));
  if (!nonEmptyRows.length) return [];
  const seen = new Map<string, number>();
  const headers = nonEmptyRows[0].map((value, index) => {
    const base = value.trim() || `column_${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1; seen.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
  return nonEmptyRows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

export function parseTextLines(text: string): { lineNumber: number; text: string }[] {
  return text.replace(/\r\n?/g, '\n').split('\n').map((line, index) => ({ lineNumber: index + 1, text: line })).filter((line) => line.text.length > 0);
}

export function stringifyCsv(rows: object[]): string {
  const records = rows.map((row) => row as Record<string, unknown>);
  const headers = [...new Set(records.flatMap((row) => Object.keys(row)))];
  const encode = (value: unknown) => {
    const text = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value) ?? '';
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.map(encode).join(','), ...records.map((row) => headers.map((header) => encode(row[header])).join(','))].join('\r\n');
}
