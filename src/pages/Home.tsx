import { useEffect, useState } from "react";
import { SEATS, MAX_ROWS, MAX_COLS } from "../MapData";
import { clsx } from "clsx";
import { Eye, Map as MapIcon } from "lucide-react";

interface SeatStatus {
  status: "available" | "pending" | "taken";
}

interface PublicSeat extends SeatStatus {
  approvedNames: string[];
  pendingNames: string[];
}

export function Home() {
  const [seatStatuses, setSeatStatuses] = useState<Record<string, SeatStatus>>({});
  const [publicSeats, setPublicSeats] = useState<Record<string, PublicSeat>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(false);

  useEffect(() => {
    fetch("/api/seats")
      .then((res) => res.json())
      .then((data) => {
        setSeatStatuses(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load seats", err);
        setLoading(false);
      });
    fetch("/api/public-seating")
      .then((res) => res.json())
      .then((data) => setPublicSeats(data.seats || {}))
      .catch((err) => console.error("Failed to load public seating", err));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-800 mb-2">{viewMode ? "צפייה בשיבוץ" : "מפת המושבים"}</h1>
            <p className="text-slate-500">{viewMode ? "מפת המקומות המעודכנת בבית הכנסת." : "כאן תוכלו לראות את מצב המושבים בבית הכנסת לקראת השנה החדשה."}</p>
          </div>
          <button type="button" onClick={() => setViewMode(current => !current)} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 transition-colors hover:bg-indigo-100">
            {viewMode ? <><MapIcon className="h-4 w-4" /> חזרה למפה</> : <><Eye className="h-4 w-4" /> צפייה בשיבוץ</>}
          </button>
        </div>

        <div className="flex gap-4 mb-8 justify-center flex-wrap">
          <div className="flex items-center gap-2">
            <div className={clsx("w-4 h-4 border", viewMode ? "bg-white border-slate-300 rounded-sm" : "bg-emerald-100 border-emerald-300 rounded-full")}></div>
            <span className="text-sm">{viewMode ? "מקום פנוי" : "פנוי"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={clsx("w-4 h-4 bg-amber-100 border border-amber-300", viewMode ? "rounded-sm" : "rounded-full")}></div>
            <span className="text-sm">{viewMode ? "ממתין לאישור" : "בהמתנה לאישור"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={clsx("w-4 h-4 border", viewMode ? "bg-emerald-200 border-emerald-600 rounded-sm" : "bg-rose-200 border-rose-500 rounded-full")}></div>
            <span className="text-sm">{viewMode ? "מקום מאושר" : "תפוס"}</span>
          </div>
        </div>

        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="animate-pulse text-slate-400">טוען מפה...</div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-4" dir="ltr">
            <div 
              className={clsx("public-seat-map inline-grid gap-1.5 mx-auto p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm relative", viewMode && "public-seating-map")}
              style={{
                gridTemplateColumns: `repeat(${MAX_COLS}, ${viewMode ? 72 : 38}px)`,
                gridTemplateRows: `repeat(${MAX_ROWS}, ${viewMode ? 68 : 26}px)`,
              }}
            >
              {/* Static Elements */}
              <div style={{ gridRow: '14 / 17', gridColumn: '1 / 35' }} className="rounded-3xl w-full h-full bg-slate-100/60 border border-slate-200/60 pointer-events-none z-0">
              </div>
              <div style={{ gridRow: '1 / 2', gridColumn: '14 / 18' }} className="bg-indigo-100 border border-indigo-200 flex items-center justify-center text-sm font-bold text-indigo-900 shadow-sm z-0">
                ארון קודש
              </div>
              <div style={{ gridRow: '5 / 8', gridColumn: '14 / 17', width: viewMode ? '230px' : '126px', justifySelf: 'start' }} className="bg-indigo-50/80 border border-indigo-200/50 flex items-center justify-center text-sm font-bold text-indigo-800 shadow-sm z-20">
                בימה
              </div>
              
              <div className="flex items-center justify-center text-lg font-bold text-slate-400 tracking-widest z-0" style={{ gridRow: '14 / 17', gridColumn: '1', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                עזרת נשים
              </div>

              {SEATS.map((seat) => {
                const status = seatStatuses[seat.id]?.status || "available";
                const publicSeat = publicSeats[seat.id];
                const publicStatus = publicSeat?.status || status;
                const names = publicStatus === "taken" ? publicSeat?.approvedNames || [] : publicSeat?.pendingNames || [];
                
                return (
                  <div
                    key={seat.id}
                    className={clsx(
                      viewMode ? "flex min-h-0 flex-col items-center justify-center overflow-hidden rounded-md border px-1 text-center shadow-sm z-10 relative" : "flex items-center justify-center text-xs font-medium rounded-full shadow-sm border transition-colors z-10 relative",
                      !viewMode && status === "available" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                      !viewMode && status === "pending" && "bg-amber-50 text-amber-700 border-amber-200",
                      !viewMode && status === "taken" && "bg-rose-200 text-rose-900 border-rose-500 ring-1 ring-rose-300",
                      viewMode && publicStatus === "available" && "bg-white text-slate-300 border-slate-300",
                      viewMode && publicStatus === "pending" && "bg-amber-50 text-amber-950 border-amber-400",
                      viewMode && publicStatus === "taken" && "bg-emerald-100 text-emerald-950 border-emerald-600",
                    )}
                    style={{
                      gridRow: seat.row + 1,
                      gridColumn: seat.col + 1,
                    }}
                    title={`${seat.label} - ${status === 'available' ? 'פנוי' : status === 'pending' ? 'בהמתנה' : 'תפוס'}`}
                  >
                    {viewMode ? (names.length > 0 ? <><span className="max-w-full break-words text-[11px] font-semibold leading-tight">{names.join(" · ")}</span>{publicStatus === "taken" && publicSeat?.pendingNames.length ? <span className="mt-1 text-[8px] leading-tight text-amber-800">ממתין: {publicSeat.pendingNames.join(" · ")}</span> : null}</> : <span className="text-xs font-medium text-slate-500">{seat.label}</span>) : seat.label}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
