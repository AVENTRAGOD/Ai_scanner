"use client";

import { useState } from "react";
import Scanner from "@/components/Scanner";
import DataTable from "@/components/DataTable";
import Link from "next/link";
import { History, Camera as CameraIcon } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

export default function Home() {
  const [view, setView] = useState<"camera" | "results">("camera");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    columns: string[];
    rows: string[][];
    image_url: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async (image: string) => {
    setIsScanning(true);
    setError(null);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to scan document");
      }

      setScanResult(data);
      setView("results");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <ScanIcon className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">AI SCAN</h1>
          </div>
          
          <nav className="flex items-center gap-4">
            <Link 
              href="/history"
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              <History className="w-4 h-4" /> History
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-3 animate-shake">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        {view === "camera" ? (
          <div className="flex flex-col items-center gap-8">
            <div className="text-center max-w-xl">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3">Scan Your Document</h2>
              <p className="text-slate-500 dark:text-slate-400">
                Align your invoice or receipt within the guide and tap scan. 
                Gemini AI will automatically extract all line items for you.
              </p>
            </div>
            
            <Scanner onCapture={handleCapture} isScanning={isScanning} />
            
            {isScanning && (
              <div className="flex flex-col items-center gap-3 animate-pulse">
                <Spinner className="w-10 h-10 border-blue-600" />
                <p className="text-blue-600 font-bold uppercase tracking-widest text-xs">Processing with Gemini Vision...</p>
              </div>
            )}
          </div>
        ) : (
          scanResult && (
            <DataTable 
              initialColumns={scanResult.columns}
              initialRows={scanResult.rows}
              imageUrl={scanResult.image_url}
              onReset={() => setView("camera")}
            />
          )
        )}
      </div>
    </main>
  );
}

function ScanIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M7 12h10" />
      <path d="M12 7v10" />
    </svg>
  );
}
