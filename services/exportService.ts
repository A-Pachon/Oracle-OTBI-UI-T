import { QueryResult } from '../types';

declare const XLSX: any; // From CDN

export const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportToCSV = (result: QueryResult, filename = 'export.csv') => {
  if (result.rows.length === 0) return;

  const headers = result.columns.join(',');
  const rows = result.rows.map(row => 
    result.columns.map(col => {
      const val = row[col] || '';
      // Escape quotes and wrap in quotes if contains comma
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  ).join('\n');

  const csvContent = `${headers}\n${rows}`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
};

export const exportToJSON = (result: QueryResult, filename = 'export.json') => {
  const jsonContent = JSON.stringify(result.rows, null, 2);
  downloadFile(jsonContent, filename, 'application/json');
};

export const exportToMarkdown = (result: QueryResult, filename = 'export.md') => {
  if (result.rows.length === 0) return;

  const headers = `| ${result.columns.join(' | ')} |`;
  const separator = `| ${result.columns.map(() => '---').join(' | ')} |`;
  const rows = result.rows.map(row => 
    `| ${result.columns.map(col => (row[col] || '').replace(/\n/g, ' ')).join(' | ')} |`
  ).join('\n');

  const mdContent = `${headers}\n${separator}\n${rows}`;
  downloadFile(mdContent, filename, 'text/markdown');
};

export const exportToXLSX = (result: QueryResult, filename = 'export.xlsx') => {
    if (typeof XLSX === 'undefined') {
        alert("Excel export library not loaded. Please refresh the page.");
        return;
    }

    // 1. Prepare data
    // XLSX.utils.json_to_sheet expects an array of objects
    const ws = XLSX.utils.json_to_sheet(result.rows, { header: result.columns });
    
    // 2. Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");

    // 3. Write file
    XLSX.writeFile(wb, filename);
};