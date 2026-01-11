/**
 * Robust CSV parser that handles quoted strings, newlines within quotes, and BOM.
 */
export const parseCSV = <T>(csvText: string): T[] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuote = false;
  
  // Normalize line endings to \n for consistent processing
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuote) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" becomes "
          currentField += '"';
          i++; // Skip the next quote
        } else {
          // End of quoted field
          insideQuote = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuote = true;
      } else if (char === ',') {
        // End of field
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n') {
        // End of row
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Handle the very last field/row if file doesn't end with newline
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Filter out empty rows (sometimes trailing newlines create a row with one empty string)
  const validRows = rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
  
  if (validRows.length === 0) return [];

  // Extract headers from first row
  // Remove BOM from the first header if present
  const headers = validRows[0].map((h, idx) => {
    let header = h.trim();
    if (idx === 0) {
       header = header.replace(/^\ufeff/, '');
    }
    return header;
  });

  const result: T[] = [];

  for (let i = 1; i < validRows.length; i++) {
    const row = validRows[i];
    // Map row values to header keys
    const obj: any = {};
    // We iterate over headers to ensure consistent object structure.
    // If row has fewer cols, they are undefined. If more, ignored.
    headers.forEach((header, index) => {
      if (header) { // Only map if header is not empty
        obj[header] = row[index]?.trim(); 
      }
    });
    result.push(obj);
  }

  return result;
};