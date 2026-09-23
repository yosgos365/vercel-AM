import { ArrowRight } from "lucide-react";
import { Home } from "../pages/Home";

export function DonationsSeatingView({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-stone-100" dir="rtl">
      <header className="bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0"><h1 className="truncate text-lg font-bold text-stone-900 sm:text-xl">אחוות מנחם</h1><p className="text-sm text-stone-500">מפת בית הכנסת</p></div>
          <button type="button" onClick={onBack} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 sm:gap-2 sm:px-4 sm:text-sm"><ArrowRight className="w-4 h-4" /> חזרה לאזור האישי</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8"><Home initialViewMode lockViewMode /></main>
    </div>
  );
}
