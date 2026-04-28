"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { Trash2, ExternalLink, Calendar, Table as TableIcon } from "lucide-react";
import DataTable from "@/components/DataTable";

interface ScanRecord {
  id: string;
  columns: string[];
  rows: any[][];
  image_url: string;
  created_at: string;
}

export default function HistoryList() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchScans();
  }, []);

  const fetchScans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("scan_results")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching scans:", error);
    } else {
      setScans(data || []);
    }
    setLoading(false);
  };

  const deleteScan = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this scan?")) return;

    const { error } = await supabase.from("scan_results").delete().eq("id", id);
    if (error) {
      alert("Error deleting scan");
    } else {
      setScans(scans.filter(s => s.id !== id));
    }
  };

  const filteredScans = scans.filter((scan) => {
    const dateStr = formatDate(scan.created_at).toLowerCase();
    const columnStr = scan.columns.join(" ").toLowerCase();
    const query = searchQuery.toLowerCase();
    return dateStr.includes(query) || columnStr.includes(query);
  });

  if (selectedScan) {
    return (
      <DataTable 
        initialColumns={selectedScan.columns}
        initialRows={selectedScan.rows}
        imageUrl={selectedScan.image_url}
        onReset={() => setSelectedScan(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Loading your scan history...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Scan History</h2>
          <p className="text-slate-500">{scans.length} documents archived in Supabase</p>
        </div>

        <div className="w-full md:w-80 relative">
          <input
            type="text"
            placeholder="Search by date or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {filteredScans.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">
            {searchQuery ? "No results match your search." : "No scans found yet. Start scanning documents!"}
          </p>
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="mt-2 text-blue-600 font-bold hover:underline"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScans.map((scan) => (
            <div 
              key={scan.id}
              onClick={() => setSelectedScan(scan)}
              className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-900 transition-all cursor-pointer"
            >
              <div className="aspect-video relative overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img 
                  src={scan.image_url} 
                  alt="Scan thumbnail" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-white text-xs font-bold flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Click to open
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
                      {formatDate(scan.created_at)}
                    </span>
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">
                      {scan.columns[0] || "Unnamed Scan"}
                    </h3>
                  </div>
                  <button 
                    onClick={(e) => deleteScan(scan.id, e)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <TableIcon className="w-3.5 h-3.5" /> {scan.rows.length} Rows
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                    {scan.columns.length} Columns
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
