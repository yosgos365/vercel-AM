import { useEffect, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { MAX_COLS, MAX_ROWS, SEATS } from "../MapData";

type PublicSeat = {
  status: "available" | "pending" | "taken";
  approvedNames: string[];
  pendingNames: string[];
};

export function PublicSeatingView() {
  const [seats, setSeats] = useState<Record<string, PublicSeat>>({});
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = async () => {
    try {
      const response = await fetch("/api/public-seating");
      if (!response.ok) throw new Error("טעינה נכשלה");
      const data = await response.json();
      setSeats(data.seats || {});
      setUpdatedAt(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(refresh);
  }, []);

  return <div className="space-y-5">
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Eye className="h-6 w-6 text-indigo-700" /><h1 className="text-2xl font-semibold text-slate-900">צפייה בשיבוץ</h1></div>
          <p className="mt-1 text-sm text-slate-600">מפת המקומות המעודכנת בבית הכנסת.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> רענון</button>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm border border-emerald-600 bg-emerald-200" />מקום מאושר</span>
        <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm border border-amber-500 bg-amber-100" />ממתין לאישור</span>
        <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm border border-slate-300 bg-white" />מקום פנוי</span>
      </div>

      {loading ? <div className="flex h-96 items-center justify-center text-slate-500">טוען את השיבוץ…</div> : <div className="mt-5 overflow-x-auto pb-4" dir="ltr">
        <div className="public-seat-map public-seating-map inline-grid gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm" style={{ gridTemplateColumns: `repeat(${MAX_COLS}, 72px)`, gridTemplateRows: `repeat(${MAX_ROWS}, 68px)` }}>
          <div style={{ gridRow: "14 / 17", gridColumn: "1 / 35" }} className="pointer-events-none h-full w-full rounded-3xl border border-slate-200/60 bg-slate-100/70" />
          <div style={{ gridRow: "1 / 2", gridColumn: "14 / 18" }} className="pointer-events-none flex items-center justify-center border border-indigo-200 bg-indigo-100 text-sm font-bold text-indigo-950">ארון קודש</div>
          <div style={{ gridRow: "5 / 8", gridColumn: "14 / 17", width: "230px", justifySelf: "start" }} className="pointer-events-none flex items-center justify-center border border-indigo-200 bg-indigo-50 text-sm font-bold text-indigo-900">בימה</div>
          <div className="pointer-events-none flex items-center justify-center text-lg font-bold tracking-widest text-slate-400" style={{ gridRow: "14 / 17", gridColumn: "1", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>עזרת נשים</div>
          {SEATS.map(seat => {
            const entry = seats[seat.id] || { status: "available", approvedNames: [], pendingNames: [] };
            const names = entry.status === "taken" ? entry.approvedNames : entry.pendingNames;
            return <div key={seat.id} style={{ gridRow: seat.row + 1, gridColumn: seat.col + 1 }} className={clsx("relative z-10 flex min-h-0 flex-col items-center justify-center overflow-hidden rounded-md border px-1 text-center shadow-sm", entry.status === "taken" && "border-emerald-600 bg-emerald-100 text-emerald-950", entry.status === "pending" && "border-amber-400 bg-amber-50 text-amber-950", entry.status === "available" && "border-slate-300 bg-white text-slate-300")}>
              {names.length > 0 ? <><span className="max-w-full break-words text-[11px] font-semibold leading-tight">{names.join(" · ")}</span>{entry.status === "taken" && entry.pendingNames.length > 0 && <span className="mt-1 text-[8px] leading-tight text-amber-800">ממתין: {entry.pendingNames.join(" · ")}</span>}</> : null}
            </div>;
          })}
        </div>
      </div>}
      {updatedAt && <p className="text-xs text-slate-400">עודכן: {updatedAt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</p>}
    </div>
  </div>;
}
