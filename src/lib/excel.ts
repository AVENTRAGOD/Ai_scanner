import * as XLSX from 'xlsx';

export function exportToExcel(columns: string[], rows: any[][]) {
  const data = [columns, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Scan Results");
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const filename = `scan_${timestamp}.xlsx`;
  
  XLSX.writeFile(wb, filename);
}
