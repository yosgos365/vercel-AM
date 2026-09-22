import { ArrowRight } from "lucide-react";
import { Home } from "../pages/Home";

export function DonationsSeatingView({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-stone-100" dir="rtl">
      <header className="bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div><h1 className="text-xl font-bold text-stone-900">אחוות מנחם</h1><p className="text-sm text-stone-500">מפת בית הכנסת</p></div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"><ArrowRight className="w-4 h-4" /> חזרה לאזור האישי</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8"><Home initialViewMode lockViewMode /></main>
    </div>
  );
}
