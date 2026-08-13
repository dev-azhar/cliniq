import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Calendar, CheckCircle2, ChevronRight, AlertCircle, ArrowLeft, Ticket } from "lucide-react";
import { api } from "../../../lib/api";
import TestPaymentModal, { type TestPaymentResult } from "../../../components/TestPaymentModal";
import { Card } from "../../../components/ui";

interface LabOrdersAlertProps {
  orders: any[];
  refetchLab: () => void;
  refetchEnc: () => void;
  refetchP360: () => void;
  patientId?: string;
}

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const isSlotBooked = (timeStr: string) => {
  return ["09:00 AM", "10:00 AM", "11:00 AM", "01:00 PM", "03:00 PM"].includes(timeStr);
};

export default function LabOrdersAlert({ 
  orders, 
  refetchLab, 
  refetchEnc, 
  refetchP360,
  patientId: propPatientId
}: LabOrdersAlertProps) {
  const [step, setStep] = useState<"alert" | "date" | "slots" | "payment" | "success">("alert");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [bookingBusy, setBookingBusy] = useState(false);
  const [labToken, setLabToken] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const pendingOrders = orders?.filter((o: any) => o.status === "CREATED") || [];
  const confirmedOrders = orders?.filter((o: any) => o.status === "CONFIRMED" || o.status === "PREPAID") || [];

  // Default to success step if orders are already paid/confirmed
  const isPaid = confirmedOrders.length > 0;
  const currentStep = (pendingOrders.length === 0 && isPaid) ? "success" : step;

  if (pendingOrders.length === 0 && confirmedOrders.length === 0 && currentStep !== "success") return null;

  const totalCharges = pendingOrders.reduce(
    (sum: number, l: any) => sum + (l.price || 250), 
    0
  );

  const patientId = propPatientId || orders?.[0]?.patient_id || pendingOrders?.[0]?.patient_id;

  const { data: labSchedules } = useQuery({
    queryKey: ["patient-lab-schedules"],
    queryFn: () => api.listLabSchedules("ALL"),
  });

  const generateLabSlots = (dateVal: string) => {
    if (!dateVal) return [];
    
    // Convert YYYY-MM-DD to day of week (0 = Monday, 6 = Sunday)
    const dObj = new Date(`${dateVal}T00:00:00`);
    const dayOfWeek = (dObj.getDay() + 6) % 7;
    
    const daySched = labSchedules?.find((s: any) => s.day_of_week === dayOfWeek);
    
    // Default fallback if no custom schedule is set (8 AM to 10 PM, 20-min slots)
    let startHour = 8;
    let startMin = 0;
    let endHour = 22;
    let endMin = 0;
    let intervalMins = 20;

    if (daySched) {
      if (!daySched.active) return []; // Lab closed on this day
      if (daySched.start_time) {
        const [sh, sm] = daySched.start_time.split(":").map(Number);
        startHour = sh;
        startMin = sm || 0;
      }
      if (daySched.end_time) {
        const [eh, em] = daySched.end_time.split(":").map(Number);
        endHour = eh;
        endMin = em || 0;
      }
      if (daySched.slot_duration_minutes) {
        intervalMins = daySched.slot_duration_minutes;
      }
    }
    
    const slots: string[] = [];
    const now = new Date();
    const today = todayIso();
    const isToday = dateVal === today;

    let currentTotalMins = startHour * 60 + startMin;
    const endTotalMins = endHour * 60 + endMin;

    while (currentTotalMins < endTotalMins) {
      const h = Math.floor(currentTotalMins / 60);
      const m = currentTotalMins % 60;
      
      const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const slotDateTime = new Date(`${dateVal}T${timeStr}:00`);

      if (!isToday || slotDateTime > now) {
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        const displayStr = `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
        slots.push(displayStr);
      }

      currentTotalMins += intervalMins;
    }
    
    return slots;
  };



  const handleConfirmBooking = async () => {
    if (!patientId) {
      alert("Error: patient context not loaded");
      return;
    }
    setBookingBusy(true);
    try {
      const order = await api.createRazorpayLabOrder({
        patient_id: patientId,
        amount: totalCharges,
        lab_order_ids: pendingOrders.map((o: any) => o.lab_order_id),
      });
      setPendingOrderId(order.order_id);
      setShowPayModal(true);
    } catch (err: any) {
      alert(err.message || "Failed to initiate payment.");
    } finally {
      setBookingBusy(false);
    }
  };

  const handlePaymentSuccess = async (payment: TestPaymentResult) => {
    try {
      await api.verifyRazorpayLabPayment({
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_signature: payment.razorpay_signature,
        lab_order_ids: pendingOrders.map((o: any) => o.lab_order_id),
      });
      setShowPayModal(false);
      setStep("success");
      await refetchLab();
      await refetchEnc();
      await refetchP360();
    } catch (err: any) {
      alert(err.message || "Failed to confirm booking.");
    }
  };

  const handleLabCheckIn = async () => {
    if (!patientId) return;
    setBookingBusy(true);
    try {
      const res = await api.labCheckIn({
        patient_id: patientId,
        booking_date: selectedDate || todayIso(),
        booking_slot: selectedSlot || "09:00 AM",
      });
      setLabToken(res.token_number);
      await refetchEnc();
      await refetchP360();
    } catch (err: any) {
      alert(err?.message || "Failed to check-in for lab visit.");
    } finally {
      setBookingBusy(false);
    }
  };

  const availableSlots = selectedDate ? generateLabSlots(selectedDate) : [];
  const activeDate = selectedDate || todayIso();
  const activeSlot = selectedSlot || "11:40 AM";
  const isTodayVisit = !selectedDate || selectedDate === todayIso();

  return (
    <>
    <Card 
      className="lab-orders-alert border border-dashed relative overflow-hidden animate-in fade-in duration-200"
      style={{ 
        borderColor: currentStep === "success" ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)",
        background: currentStep === "success" 
          ? "radial-gradient(150px 50px at 0% 0%, rgba(16,185,129,0.06), transparent)"
          : "radial-gradient(150px 50px at 0% 0%, rgba(245,158,11,0.06), transparent)" 
      }}
    >
      {currentStep === "alert" && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <h4 className="lab-orders-alert__warning font-extrabold text-sm flex items-center gap-1.5">
              ⚠️ Action Required: Lab Tests Ordered
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              Your doctor has ordered the following tests: <span className="text-[var(--cyan)]">{pendingOrders.map((l: any) => l.test).join(", ")}</span>.
              Please select a slot and complete the payment to confirm your lab booking.
            </p>
            <div className="text-xs text-[var(--dim)] font-bold pt-1">
              Estimated Charges: <span className="text-white text-sm">₹{totalCharges}</span>
            </div>
          </div>
          <div className="flex flex-col items-stretch md:items-end gap-3 shrink-0">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PAYMENT &amp; SLOT STATUS</div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25 w-fit mt-1">
                <Clock size={12} className="animate-pulse" /> PENDING BOOKING
              </span>
            </div>
            <button 
              onClick={() => setStep("date")}
              className="lab-orders-alert__primary btn text-xs !py-1.5 px-3.5 font-extrabold flex items-center gap-1 w-full md:w-auto"
            >
              Book Slot &amp; Pay <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {currentStep === "date" && (
        <div className="space-y-3">
          <h4 className="lab-orders-alert__title font-bold text-sm flex items-center gap-1.5">
            <Calendar size={16} className="text-[var(--cyan)]" /> Select Lab Visit Date
          </h4>
          <p className="text-xs text-[var(--dim)]">Choose a date for your laboratory test collection.</p>
          <div className="flex items-center gap-3">
            <input 
              type="date" 
              min={todayIso()} 
              value={selectedDate} 
              onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(""); }} 
              className="input max-w-xs" 
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button className="btn ghost sm text-xs lab-orders-alert__secondary" onClick={() => setStep("alert")}>Cancel</button>
            <button 
              className="lab-orders-alert__primary btn sm text-xs"
              disabled={!selectedDate} 
              onClick={() => setStep("slots")}
            >
              Next: View Slots
            </button>
          </div>
        </div>
      )}

      {currentStep === "slots" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="lab-orders-alert__title font-bold text-sm flex items-center gap-1.5">
              <Clock size={16} className="text-[var(--cyan)]" /> Select Time Slot
            </h4>
            <span className="text-xs text-[var(--dim)] font-semibold">{selectedDate}</span>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {availableSlots.length === 0 ? (
              <div className="text-xs text-red-400 py-1.5 flex items-center gap-1.5">
                <AlertCircle size={14} /> All slots are completed/fully booked for today. Please select another date.
              </div>
            ) : (
              availableSlots.map((timeStr) => {
                const booked = isSlotBooked(timeStr);
                const active = selectedSlot === timeStr;
                return (
                  <button
                    key={timeStr}
                    disabled={booked}
                    onClick={() => setSelectedSlot(timeStr)}
                    className={`lab-orders-alert__slot btn text-xs shrink-0 py-1 px-3 border transition-all ${
                      active 
                        ? "lab-orders-alert__slot--active border-[var(--cyan)] bg-[rgba(0,120,212,0.15)]"
                        : booked
                          ? "lab-orders-alert__slot--booked line-through cursor-not-allowed"
                          : "lab-orders-alert__slot--available"
                    }`}
                  >
                    {timeStr} {booked && <span className="text-[8px] opacity-70 ml-1">(Full)</span>}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <button className="btn-link text-xs flex items-center gap-1 lab-orders-alert__back" onClick={() => setStep("date")}>
              <ArrowLeft size={14} /> Back
            </button>
            <button 
              className="lab-orders-alert__primary btn sm text-xs"
              disabled={!selectedSlot} 
              onClick={() => setStep("payment")}
            >
              Continue to Payment
            </button>
          </div>
        </div>
      )}

      {currentStep === "payment" && (
        <div className="space-y-4">
          <h4 className="lab-orders-alert__title font-bold text-sm">Booking &amp; Payment Summary</h4>
          <div className="holo text-xs space-y-2 p-3">
            <div className="kv"><span>Department</span><b>Clinical Laboratory</b></div>
            <div className="kv"><span>Tests ordered</span><b className="text-[var(--cyan)]">{pendingOrders.map((o) => o.test).join(", ")}</b></div>
            <div className="kv"><span>Date</span><b>{selectedDate}</b></div>
            <div className="kv"><span>Time Slot</span><b>{selectedSlot}</b></div>
            <div className="kv pt-2 border-t border-white/5 text-sm">
              <span>Total consultation fee</span>
              <b className="text-white text-base">₹{totalCharges}</b>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <button className="btn-link text-xs flex items-center gap-1 lab-orders-alert__back" onClick={() => setStep("slots")} disabled={bookingBusy}>
              <ArrowLeft size={14} /> Back
            </button>
            <button 
              className="lab-orders-alert__primary btn sm text-xs px-4"
              onClick={handleConfirmBooking}
              disabled={bookingBusy}
            >
              {bookingBusy ? "Processing payment..." : `Pay ₹${totalCharges}`}
            </button>
          </div>
        </div>
      )}

      {currentStep === "success" && (
        <div className="text-center py-2 space-y-3">
          <CheckCircle2 className="mx-auto text-emerald-400" size={36} />
          <div className="space-y-1">
            <h4 className="font-extrabold text-sm text-emerald-400">Payment &amp; Booking Successful!</h4>
            <p className="text-xs text-slate-300">
              Your lab appointment is scheduled for <span className="font-bold text-white">{activeDate}</span> at <span className="font-bold text-white">{activeSlot}</span>.
            </p>
          </div>

          {labToken ? (
            <div 
              className="token-highlight flex flex-col items-center justify-center p-3 rounded-2xl border border-emerald-400/20 max-w-xs mx-auto space-y-1 mt-2"
              style={{ background: "rgba(16,185,129,0.06)" }}
            >
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Lab Visit Token</span>
              <span className="text-3xl font-black text-white tracking-widest drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{labToken}</span>
              <span className="text-[11px] text-slate-300 font-semibold mt-1">Room: Lab Room 1 (Ground Floor)</span>
            </div>
          ) : (
            <div className="pt-2">
              {isTodayVisit ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-[var(--dim)] leading-relaxed">
                    You can check-in now to generate your queue token for sample collection.
                  </p>
                  <button 
                    onClick={handleLabCheckIn}
                    className="btn sm text-xs font-bold w-full max-w-xs mx-auto flex items-center justify-center gap-1.5"
                    style={{ background: "linear-gradient(135deg, #10b981, #047857)", border: "none", color: "white" }}
                    disabled={bookingBusy}
                  >
                    <Ticket size={14} /> {bookingBusy ? "Generating token..." : "Complete Lab Check-in"}
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-sky-600/5 border border-sky-600/20 text-sky-400 rounded-xl text-xs flex gap-2.5 items-start text-left max-w-sm mx-auto">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Check-In Unavailable</span>
                    Your token will be generated on that particular day. You can check-in on <span className="font-bold text-white">{activeDate}</span>.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
    <TestPaymentModal
      open={showPayModal}
      orderId={pendingOrderId ?? "lab_order"}
      amountPaise={Math.round(totalCharges * 100)}
      title="Lab Test Payment"
      description={`${pendingOrders.length} test(s): ${pendingOrders.map((o: any) => o.test_name || o.test).join(", ").slice(0, 60)}`}
      onSuccess={handlePaymentSuccess}
      onCancel={() => setShowPayModal(false)}
    />
    </>
  );
}
