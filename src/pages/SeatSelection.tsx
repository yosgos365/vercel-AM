import React from "react";
import { useState, useEffect, useRef } from "react";
import { SEATS, MAX_ROWS, MAX_COLS } from "../MapData";
import { clsx } from "clsx";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SeatStatus {
  status: "available" | "pending" | "taken";
}

interface BookingPolicy {
  priorityWindow: boolean;
  lastYearOccupiedSeats: string[];
  effectiveDate: string;
}

const SEAT_PRICE = 150;
const MAX_PAYMENT_IMAGE_BYTES = 1_000_000;
const MAX_PAYMENT_IMAGE_DIMENSION = 2000;
const PURCHASE_DRAFT_KEY = "ahavat-menachem-seat-purchase-draft";

export function SeatSelection() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  });
  
  const [seatStatuses, setSeatStatuses] = useState<Record<string, SeatStatus>>({});
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [paymentImage, setPaymentImage] = useState<string>("");
  const [imageNotice, setImageNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [lastYearData, setLastYearData] = useState<{ found: boolean; name?: string; seats?: string[] } | null>(null);
  const [bookingPolicy, setBookingPolicy] = useState<BookingPolicy | null>(null);
  const [showLastYearModal, setShowLastYearModal] = useState(false);
  const [lastYearModalPhase, setLastYearModalPhase] = useState<"identity" | "choice">("identity");
  const [lastYearChoice, setLastYearChoice] = useState<"same-seat" | "different-seats" | "not-confirmed">("not-confirmed");
  const [draftRestored, setDraftRestored] = useState(false);
  const lastYearSeatFocusRef = useRef<string>("");
  const totalAmount = selectedSeats.length * SEAT_PRICE;
  const recognizedSeatIds = lastYearChoice !== "not-confirmed" && lastYearData?.found ? lastYearData.seats || [] : [];
  const recognizedSeats = SEATS.filter(seat => recognizedSeatIds.includes(seat.id));
  const firstRecognizedSeat = recognizedSeats[0];
  const priorityAllowedSeatIds = bookingPolicy?.priorityWindow
    ? new Set(
      lastYearChoice !== "not-confirmed" && lastYearData?.found
        ? [
            ...(lastYearData.seats || []),
            ...SEATS.map((seat) => seat.id).filter((seatId) => !bookingPolicy.lastYearOccupiedSeats.includes(seatId)),
          ]
        : SEATS.map((seat) => seat.id).filter((seatId) => !bookingPolicy.lastYearOccupiedSeats.includes(seatId)),
    )
    : null;
  
  useEffect(() => {
    fetch("/api/seats")
      .then((res) => res.json())
      .then((data) => setSeatStatuses(data));
  }, []);

  // A PayBox payment opens outside this page.  Keep the customer's details and
  // seat choice in this browser tab even if the page is refreshed on return.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(PURCHASE_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft && draft.step && draft.step < 4) {
          setStep(draft.step);
          setFormData(draft.formData || { firstName: "", lastName: "", phone: "" });
          setSelectedSeats(Array.isArray(draft.selectedSeats) ? draft.selectedSeats : []);
          setLastYearData(draft.lastYearData || null);
          setBookingPolicy(draft.bookingPolicy || null);
          setLastYearChoice(draft.lastYearChoice || "not-confirmed");
        }
      }
    } catch {
      // A blocked browser storage must never prevent submitting a request.
    } finally {
      setDraftRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!draftRestored || step === 4) return;
    try {
      sessionStorage.setItem(PURCHASE_DRAFT_KEY, JSON.stringify({ step, formData, selectedSeats, lastYearData, bookingPolicy, lastYearChoice }));
    } catch {
      // The page remains usable if private-mode storage is unavailable.
    }
  }, [bookingPolicy, draftRestored, formData, lastYearChoice, lastYearData, selectedSeats, step]);

  useEffect(() => {
    if (step !== 2 || !firstRecognizedSeat || lastYearSeatFocusRef.current === firstRecognizedSeat.id) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`seat-${firstRecognizedSeat.id}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      lastYearSeatFocusRef.current = firstRecognizedSeat.id;
    }, 180);
    return () => window.clearTimeout(timer);
  }, [firstRecognizedSeat, step]);

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/check-last-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: formData.firstName, lastName: formData.lastName, phone: formData.phone }),
      });
      const data = await res.json();
      setLastYearData(data);
      setBookingPolicy({
        priorityWindow: Boolean(data.priorityWindow),
        lastYearOccupiedSeats: Array.isArray(data.lastYearOccupiedSeats) ? data.lastYearOccupiedSeats : [],
        effectiveDate: data.effectiveDate || "",
      });
      if (data.found && data.seats && data.seats.length > 0) {
        setLastYearModalPhase("identity");
        setShowLastYearModal(true);
      } else {
        setStep(2);
      }
    } catch (error) {
      setStep(2);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeatClick = (seatId: string) => {
    if (seatStatuses[seatId] && seatStatuses[seatId].status === "taken") return;
    
    setSelectedSeats(prev => 
      prev.includes(seatId) ? prev.filter(s => s !== seatId) : [...prev, seatId]
    );
  };

  const readImage = (file: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("לא ניתן לקרוא את התמונה"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  const compressPaymentImage = async (file: File) => {
    if (file.size <= MAX_PAYMENT_IMAGE_BYTES) return readImage(file);
    const source = await readImage(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("קובץ התמונה אינו תקין"));
      element.src = source;
    });
    const scale = Math.min(1, MAX_PAYMENT_IMAGE_DIMENSION / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("לא ניתן להכין את התמונה להעלאה");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.92;
    let output = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    while (output && output.size > MAX_PAYMENT_IMAGE_BYTES && quality > 0.55) {
      quality -= 0.08;
      output = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    }
    if (!output) throw new Error("לא ניתן לדחוס את התמונה");
    return readImage(output);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageNotice("מכין את צילום התשלום להעלאה...");
    try {
      const image = await compressPaymentImage(file);
      setPaymentImage(image);
      setImageNotice(file.size > MAX_PAYMENT_IMAGE_BYTES ? "התמונה נדחסה לשמירה על העלאה מהירה וקריאה." : "");
    } catch (error) {
      setPaymentImage("");
      setImageNotice(error instanceof Error ? error.message : "לא ניתן להכין את התמונה להעלאה");
    }
  };

  const submitFinalRequest = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          seats: selectedSeats,
          paymentImage,
          isLastYearUser: lastYearChoice !== "not-confirmed",
          lastYearIdentityConfirmed: lastYearChoice !== "not-confirmed",
          lastYearChoice,
          lastYearSeats: lastYearChoice === "not-confirmed" ? [] : lastYearData?.seats || [],
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "לא ניתן היה לשלוח את הבקשה");
      }
      try { sessionStorage.removeItem(PURCHASE_DRAFT_KEY); } catch { /* ignore unavailable storage */ }
      setStep(4);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "אירעה שגיאה בשליחת הטופס, נסה שוב.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Progress Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className={clsx("text-xs sm:text-sm font-medium whitespace-nowrap", step >= 1 ? "text-indigo-600" : "text-slate-400")}>1. פרטים</div>
            <div className="flex-1 h-px bg-stone-200 mx-2 sm:mx-4"></div>
            <div className={clsx("text-xs sm:text-sm font-medium whitespace-nowrap", step >= 2 ? "text-indigo-600" : "text-slate-400")}>2. מושבים</div>
            <div className="flex-1 h-px bg-stone-200 mx-2 sm:mx-4"></div>
            <div className={clsx("text-xs sm:text-sm font-medium whitespace-nowrap", step >= 3 ? "text-indigo-600" : "text-slate-400")}>3. תשלום</div>
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleDetailsSubmit}
                className="relative space-y-6"
              >
                <h2 className="text-2xl font-semibold text-slate-800">פרטים אישיים</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">שם פרטי</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                      value={formData.firstName}
                      onChange={e => setFormData({...formData, firstName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">שם משפחה</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                      value={formData.lastName}
                      onChange={e => setFormData({...formData, lastName: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">מספר טלפון</label>
                    <input
                      required
                      type="tel"
                      inputMode="tel"
                      pattern="(?:TRE|tre|0(?:[2-4]|[8-9]|5[0-9]|7[0-9])[0-9]{7}|\\+972(?:[2-4]|[8-9]|5[0-9]|7[0-9])[0-9]{7})"
                      title="הזן מספר טלפון ישראלי תקין, למשל 0501234567"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "בודק..." : "המשך לבחירת מושבים"}
                </button>
              </motion.form>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-end">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-800">בחירת מושבים</h2>
                    <p className="text-slate-500 mt-1">בחרו את המושבים הרצויים מהמפה.</p>
                    {bookingPolicy?.priorityWindow && <p className="mt-2 text-sm font-medium text-amber-800">{lastYearChoice !== "not-confirmed" && lastYearData?.found ? "עד יום ראשון, 6.9.26, המקומות שרכשת בשנה שעברה שמורים עבורך. ניתן להמשיך עם אותם המקומות או לוותר עליהם ולבחור מקומות פנויים אחרים." : "עד יום ראשון, 6.9.26, לקוחות חדשים יכולים לבחור מושבים שהיו פנויים בשנה שעברה."}</p>}
                  </div>
                  <div className="text-sm font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                    נבחרו: {selectedSeats.length}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700" aria-label="מקרא צבעי מושבים">
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-400" />פנוי</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-400" />ממתין לאישור</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" />תפוס</span>
                  {recognizedSeats.length > 0 && <span className="inline-flex items-center gap-1.5 text-indigo-700"><i className="h-2.5 w-2.5 rounded-full bg-indigo-600" />המקומות שלך</span>}
                </div>

                <div className="overflow-x-auto pb-4" dir="ltr">
                  <div 
                    className="public-seat-map inline-grid gap-1.5 mx-auto p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm relative"
                    style={{
                      gridTemplateColumns: `repeat(${MAX_COLS}, 38px)`,
                      gridTemplateRows: `repeat(${MAX_ROWS}, 26px)`,
                    }}
                  >
                    {/* Static Elements */}
                    <div style={{ gridRow: '14 / 17', gridColumn: '1 / 35' }} className="rounded-3xl w-full h-full bg-slate-100/60 border border-slate-200/60 pointer-events-none z-0">
                    </div>
                    <div style={{ gridRow: '1 / 2', gridColumn: '14 / 18' }} className="bg-indigo-100 border border-indigo-200 flex items-center justify-center text-sm font-bold text-indigo-900 shadow-sm pointer-events-none z-0">
                      ארון קודש
                    </div>
                    <div style={{ gridRow: '5 / 8', gridColumn: '14 / 17', width: '126px', justifySelf: 'start' }} className="bg-indigo-50/80 border border-indigo-200/50 flex items-center justify-center text-sm font-bold text-indigo-800 shadow-sm pointer-events-none z-20">
                      בימה
                    </div>
                    
                    <div className="flex items-center justify-center text-lg font-bold text-slate-400 tracking-widest pointer-events-none z-0" style={{ gridRow: '14 / 17', gridColumn: '1', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                      עזרת נשים
                    </div>

                    {firstRecognizedSeat && <div
                      className="pointer-events-none z-30 self-end justify-self-start whitespace-nowrap rounded-full bg-indigo-700 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
                      style={{ gridRow: Math.max(1, firstRecognizedSeat.row), gridColumn: firstRecognizedSeat.col + 1 }}
                    >
                      המקומות שלך
                    </div>}

                    {SEATS.map((seat) => {
                      const status = seatStatuses[seat.id]?.status || "available";
                      const isTaken = status === "taken";
                      const isPending = status === "pending";
                      const isSelected = selectedSeats.includes(seat.id);
                      const isUnavailableByPriority = Boolean(priorityAllowedSeatIds && !priorityAllowedSeatIds.has(seat.id));
                      
                      return (
                        <button
                          key={seat.id}
                          id={`seat-${seat.id}`}
                          onClick={() => handleSeatClick(seat.id)}
                          disabled={isTaken || isUnavailableByPriority}
                          className={clsx(
                            "flex items-center justify-center text-xs font-medium rounded-full shadow-sm border transition-colors z-10 relative",
                            isTaken 
                              ? "bg-rose-200 text-rose-900 border-rose-500 ring-1 ring-rose-300 cursor-not-allowed" 
                              : isUnavailableByPriority
                                ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                              : isSelected
                                ? "bg-indigo-600 text-white border-indigo-700 transform scale-105 shadow-md"
                                : recognizedSeatIds.includes(seat.id)
                                  ? "bg-indigo-100 text-indigo-900 border-indigo-600 ring-2 ring-indigo-300 shadow-md hover:bg-indigo-200"
                                : isPending
                                  ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          )}
                          style={{ gridRow: seat.row + 1, gridColumn: seat.col + 1 }}
                        >
                          {seat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between gap-3 pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-5 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    חזור
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={selectedSeats.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
                  >
                    המשך לתשלום
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-semibold text-slate-800">אישור תשלום</h2>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-center text-indigo-950">
                  <p className="text-sm font-medium">לתשלום עבור {selectedSeats.length} {selectedSeats.length === 1 ? "מושב" : "מושבים"}</p>
                  <p className="mt-1 text-3xl font-bold" dir="ltr">₪{totalAmount.toLocaleString("he-IL")}</p>
                  <p className="mt-1 text-xs text-indigo-700">₪{SEAT_PRICE} לכל מושב</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3 text-yellow-800">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm">
                    העלאת צילום מסך של התשלום
                  </p>
                </div>

                <a
                  href="https://links.payboxapp.com/CrEzbkwjMUb"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
                >
                  למעבר לתשלום ב־PayBox
                </a>
                <p className="-mt-3 text-center text-sm font-semibold text-indigo-800">לאחר התשלום חזרו לעמוד זה והעלו צילום מסך של ההעברה.</p>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">צילום מסך של התשלום (חובה)</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {paymentImage ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                        <span className="text-sm font-medium text-slate-600">תמונה הועלתה בהצלחה</span>
                        <img src={paymentImage} alt="Payment preview" className="mt-4 max-h-32 border border-slate-200 shadow-sm" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">לחץ להעלאת תמונה או גרור לכאן</span>
                      </div>
                    )}
                  </div>
                  {imageNotice && <p className="mt-2 text-xs text-slate-600">{imageNotice}</p>}
                </div>

                <div className="flex justify-between gap-3 pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-5 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    חזור
                  </button>
                  <button
                    onClick={submitFinalRequest}
                    disabled={!paymentImage || isSubmitting}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? "שולח..." : "שלח בקשה"}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12 space-y-4"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-3xl font-semibold text-slate-800">הבקשה נשלחה בהצלחה!</h2>
                <div className="mx-auto max-w-lg space-y-3 text-slate-600">
                  <p className="text-lg font-medium text-slate-800">הבקשה עבור {selectedSeats.join(", ")} התקבלה בהצלחה. סכום ששולם: {totalAmount.toLocaleString("he-IL")} ₪.</p>
                  <p>לאחר בדיקת התשלום הנהלת בית הכנסת תאשר את המקומות והסטטוס במפה יתעדכן.</p>
                </div>
                <div className="pt-8">
                  <button
                    onClick={() => window.location.href = '/'}
                    className="text-indigo-600 font-medium hover:underline"
                  >
                    חזרה למפת המושבים
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Last Year Modal */}
      <AnimatePresence>
        {showLastYearModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-6"
            >
              {lastYearModalPhase === "identity" ? <>
                <h3 className="text-xl font-semibold text-slate-800">זיהוי שיבוץ משנה שעברה</h3>
                <p className="text-slate-600">ברשומות השיבוץ של תשפ״ו מופיע כי <strong>{lastYearData?.name}</strong> שובץ {lastYearData?.seats?.length === 1 ? "בכיסא" : "בכיסאות"} <strong>{lastYearData?.seats?.join(", ")}</strong>. האם מדובר בך?</p>
                <div className="overflow-x-auto" dir="ltr"><div className="inline-grid gap-1 p-3 bg-slate-50 border rounded-xl" style={{ gridTemplateColumns: `repeat(${MAX_COLS}, 20px)`, gridTemplateRows: `repeat(${MAX_ROWS}, 18px)` }}>
                  <div style={{ gridRow: "1 / 2", gridColumn: "14 / 18" }} className="bg-indigo-100 border text-[7px] flex items-center justify-center">ארון קודש</div><div style={{ gridRow: "5 / 8", gridColumn: "14 / 18" }} className="bg-indigo-50 border text-[7px] flex items-center justify-center">בימה</div>
                  {SEATS.map(seat => <div key={seat.id} style={{ gridRow: seat.row + 1, gridColumn: seat.col + 1 }} className={clsx("rounded-sm border text-[7px] flex items-center justify-center", lastYearData?.seats?.includes(seat.id) ? "bg-indigo-600 text-white border-indigo-800 ring-1 ring-indigo-300" : "bg-white text-slate-400 border-slate-200")}>{seat.label}</div>)}
                </div></div>
                <div className="flex gap-3 pt-2"><button onClick={() => { setLastYearData(null); setLastYearChoice("not-confirmed"); setShowLastYearModal(false); setStep(2); }} className="flex-1 bg-stone-100 hover:bg-stone-200 text-slate-700 font-medium py-2 rounded-lg">לא, זה לא אני</button><button onClick={() => setLastYearModalPhase("choice")} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg">כן, זה אני</button></div>
              </> : <>
                <h3 className="text-xl font-semibold text-slate-800">המשך שיבוץ</h3><p className="text-slate-600">האם תרצה לשבת במקום זה גם בשנה הבאה?</p>
                <div className="flex gap-3 pt-2"><button onClick={() => { setLastYearChoice("different-seats"); setShowLastYearModal(false); setStep(2); }} className="flex-1 bg-stone-100 hover:bg-stone-200 text-slate-700 font-medium py-2 rounded-lg">בחירת מושבים שונים</button><button onClick={() => { const previousSeats = lastYearData?.seats || []; const selectableSeats = previousSeats.filter(seat => seatStatuses[seat]?.status !== "taken"); setSelectedSeats(selectableSeats); setLastYearChoice("same-seat"); setShowLastYearModal(false); setStep(selectableSeats.length === previousSeats.length ? 3 : 2); }} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg">כן</button></div>
              </>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
