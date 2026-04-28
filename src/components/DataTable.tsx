"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Download, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToExcel } from "@/lib/excel";

interface DataTableProps {
  initialColumns: string[];
  initialRows: any[][];
  imageUrl?: string;
  onReset: () => void;
}

export default function DataTable({ initialColumns, initialRows, imageUrl, onReset }: DataTableProps) {
  const [columns, setColumns] = useState<string[]>(initialColumns);
  const [rows, setRows] = useState<any[][]>(initialRows);

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...rows];
    newRows[rowIndex][colIndex] = value;
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, new Array(columns.length).fill("")]);
  };

  const deleteRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleExport = () => {
    exportToExcel(columns, rows);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full max-w-7xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Image Preview Sidebar */}
      {imageUrl && (
        <div className="lg:w-1/3 flex flex-col gap-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Scanned Document</h3>
          <div className="sticky top-8 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 shadow-lg">
            <img src={imageUrl} alt="Scan preview" className="w-full h-auto object-contain bg-slate-100" />
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="lg:flex-1 overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Extracted Data</h2>
            <p className="text-slate-500 text-sm">{rows.length} rows detected • Highlighted cells may need review</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={onReset}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition font-medium"
            >
              <RefreshCcw className="w-4 h-4" /> Scan Another
            </button>
            <button
              onClick={handleExport}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium shadow-md shadow-blue-200 dark:shadow-none"
            >
              <Download className="w-4 h-4" /> Export Excel
            </button>
          </div>
        </div>

        <div className="relative overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50">
                {columns.map((col, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    {col}
                  </th>
                ))}
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  {row.map((cell, colIndex) => (
                    <td key={colIndex} className="p-0 border-r border-slate-100 dark:border-slate-800 last:border-r-0">
                      <input
                        type="text"
                        value={cell || ""}
                        onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                        className={cn(
                          "w-full px-4 py-3 bg-transparent outline-none transition-colors focus:bg-blue-50/50 dark:focus:bg-blue-900/10",
                          !cell && "bg-yellow-50/50 dark:bg-yellow-900/10 placeholder:text-yellow-600/50"
                        )}
                        placeholder="Empty..."
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteRow(rowIndex)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete Row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="py-20 text-center text-slate-500">
              No data extracted. Try scanning again.
            </div>
          )}
        </div>

        <button
          onClick={addRow}
          className="mt-4 flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-900 transition-all font-medium"
        >
          <Plus className="w-4 h-4" /> Add New Row
        </button>
      </div>
    </div>
  );
}
