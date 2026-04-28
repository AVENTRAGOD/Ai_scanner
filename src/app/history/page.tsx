import HistoryList from "@/components/HistoryList";
import Link from "next/link";
import { ChevronLeft, Scan } from "lucide-react";

export default function HistoryPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-blue-600 transition-colors">
              <ChevronLeft className="text-slate-600 dark:text-slate-400 group-hover:text-white w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
              Back to Scanner
            </span>
          </Link>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <ScanIcon className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">AI SCAN</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <HistoryList />
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
