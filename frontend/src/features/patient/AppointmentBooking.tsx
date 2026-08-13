import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, CreditCard, UserRound } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import TestPaymentModal, { type TestPaymentResult } from "../../components/TestPaymentModal";
import { getPortalPatient } from "../../lib/patientAuth";
import { Field, SectionTitle } from "../../components/ui";

type Slot = {
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  department?: string;
  location?: string;
  room?: string;
  scheduled_start: string;
  scheduled_end: string;
  opd_fee?: number;
};



type Step = "reason" | "date" | "slots" | "payment" | "details";

function safeRedirect(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/patient";
}

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function dateLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

function timeLabel(value: string) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : "Something went wrong";
}

export default function AppointmentBooking() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const session = getPortalPatient()!;
  const redirect = safeRedirect(params.get("redirect"));
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayIso());
  const [specialty, setSpecialty] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [appointment, setAppointment] = useState<any>(null);
  const [showPaymentDone, setShowPaymentDone] = useState(false);
  const [checkoutEmail, setCheckoutEmail] = useState(session.email || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPayModal, setShowPayModal] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<any>(null);

  const doctors = useMemo(() => {
    const grouped = new Map<string, { doctor: Slot; slots: Slot[] }>();
    for (const slot of slots) {
      const current = grouped.get(slot.doctor_id);
      if (current) current.slots.push(slot);
      else grouped.set(slot.doctor_id, { doctor: slot, slots: [slot] });
    }
    return [...grouped.values()];
  }, [slots]);

  async function findAvailability() {
    setBusy(true);
    setError("");
    setNotice("");
    setSelectedSlot(null);
    try {
      let queryDate = date;
      let result = await api.appointmentSlots({
        patient_id: session.patient_id,
        appointment_date: queryDate,
        reason,
      });
      // Today's slots may have already passed (after operating hours), or the day may be closed.
      // Look ahead up to a week for the next day that still has open slots.
      let lookAhead = 0;
      while ((result.slots?.length ?? 0) === 0 && lookAhead < 7) {
        lookAhead += 1;
        queryDate = addDaysIso(date, lookAhead);
        result = await api.appointmentSlots({
          patient_id: session.patient_id,
          appointment_date: queryDate,
          reason,
        });
      }
      setSpecialty(result.specialty);
      setSlots(result.slots ?? []);
      if (queryDate !== date && (result.slots?.length ?? 0) > 0) {
        setDate(queryDate);
        setNotice(`No remaining slots for ${dateLabel(date)}. Showing the next available day: ${dateLabel(queryDate)}.`);
      }
      setStep("slots");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function payAndBook() {
    if (!selectedSlot) return;
    setBusy(true);
    setError("");
    try {
      const amount = Math.round(Number(selectedSlot.opd_fee) * 100);
      if (!Number.isFinite(amount) || amount < 100) {
        throw new Error("A valid consultation fee is not configured for this doctor.");
      }
      const order = await api.createRazorpayOrder({
        patient_id: session.patient_id,
        doctor_id: selectedSlot.doctor_id,
        scheduled_start: selectedSlot.scheduled_start,
        scheduled_end: selectedSlot.scheduled_end,
        reason,
        specialty: selectedSlot.specialty,
        appointment_type: "OPD",
        channel: "PORTAL",
        checkout_email: checkoutEmail.trim(),
      });
      setPendingOrder(order);
      setShowPayModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function handlePaymentSuccess(payment: TestPaymentResult) {
    try {
      const result = await api.verifyRazorpayPayment(payment);
      setAppointment(result.appointment);
      setShowPayModal(false);
      setShowPaymentDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : errorText(e));
    }
  }

  async function cancelAndReturn() {
    if (!appointment?.appointment_id) return nav(redirect, { replace: true });
    setBusy(true);
    setError("");
    try {
      await api.cancelAppointment(appointment.appointment_id);
      nav(redirect, { replace: true });
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return <div className="patient-page space-y-4 sm:space-y-5">
    <div className="glass px-5 py-4"><SectionTitle sub={`Logged in as ${session.name}`}>Book appointment</SectionTitle></div>
    <section className="card mx-auto max-w-3xl space-y-5">
      {error && <div className="alertbox">{error}</div>}

      {step === "reason" && <>
        <h3 className="text-lg font-extrabold">Reason for visit</h3>
        <textarea className="input min-h-[130px]" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe symptoms or reason for the appointment" />
        <div className="actions-row between">
          <button className="btn-link" onClick={() => nav(redirect)}><ArrowLeft size={14} /> Cancel</button>
          <button className="btn g" disabled={!reason.trim()} onClick={() => setStep("date")}>Next</button>
        </div>
      </>}

      {step === "date" && <>
        <h3 className="text-lg font-extrabold">Select appointment date</h3>
        <Field label="Date"><input className="input" type="date" min={todayIso()} value={date} onChange={(event) => setDate(event.target.value)} /></Field>
        <div className="actions-row between">
          <button className="btn-link" onClick={() => setStep("reason")}><ArrowLeft size={14} /> Back</button>
          <button className="btn g" disabled={busy || !date} onClick={() => void findAvailability()}>Show availability</button>
        </div>
      </>}

      {step === "slots" && <>
        <div>
          <h3 className="text-lg font-extrabold">Available doctors and slots</h3>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Mapped speciality: <b>{specialty}</b> · {dateLabel(date)}</p>
        </div>
        {notice && <div className="holo" style={{ color: "var(--muted)" }}>{notice}</div>}
        {busy && <div className="holo">Loading {specialty} doctors and slots...</div>}
        {!busy && !doctors.length && <div className="holo">No {specialty} doctors have open slots in the next 7 days. Please try a different reason or date.</div>}
        {doctors.map(({ doctor, slots: doctorSlots }) => <div className="holo" key={doctor.doctor_id}>
          <div className="flex items-start justify-between gap-3"><div><b>{doctor.doctor_name}</b><div className="text-xs" style={{ color: "var(--muted)" }}>{doctor.specialty}</div></div><UserRound size={18} /></div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">{doctorSlots.map((slot) => {
            const selected = selectedSlot?.doctor_id === slot.doctor_id && selectedSlot?.scheduled_start === slot.scheduled_start;
            return (
              <button 
                className="appointment-time-slot" 
                style={selected ? { 
                  color: "#ffffff", 
                  background: "linear-gradient(135deg, var(--cyan), var(--blue))", 
                  boxShadow: "0 0 14px rgba(0,120,212, 0.3)", 
                  borderColor: "transparent" 
                } : undefined} 
                key={slot.scheduled_start} 
                onClick={() => setSelectedSlot(slot)}
              >
                {timeLabel(slot.scheduled_start)}
              </button>
            );
          })}</div>
        </div>)}
        <div className="actions-row between">
          <button className="btn-link" onClick={() => setStep("date")}><ArrowLeft size={14} /> Change date</button>
          <button className="btn g" disabled={!selectedSlot} onClick={() => setStep("payment")}>Continue to payment</button>
        </div>
      </>}

      {step === "payment" && selectedSlot && <>
        <h3 className="text-lg font-extrabold">Payment</h3>
        <div className="holo space-y-2"><Detail label="Doctor" value={selectedSlot.doctor_name} /><Detail label="Speciality" value={selectedSlot.specialty} /><Detail label="Date" value={selectedSlot.scheduled_start.slice(0, 10)} /><Detail label="Time" value={timeLabel(selectedSlot.scheduled_start)} /><Detail label="Consultation fee" value={selectedSlot.opd_fee != null ? `₹${Number(selectedSlot.opd_fee).toFixed(2)}` : "Not configured"} /></div>
        <Field label="Billing email (Optional)"><input className="input" type="email" autoComplete="email" value={checkoutEmail} onChange={(event) => setCheckoutEmail(event.target.value)} placeholder="patient@example.com" /></Field>
        <div className="actions-row between"><button className="btn-link" disabled={busy} onClick={() => setStep("slots")}><ArrowLeft size={14} /> Back</button><button className="btn g" disabled={busy || selectedSlot.opd_fee == null || (checkoutEmail.trim() !== "" && !/^\S+@\S+\.\S+$/.test(checkoutEmail.trim()))} onClick={payAndBook}><CreditCard size={16} /> {busy ? "Opening checkout..." : `Pay ₹${Number(selectedSlot.opd_fee || 0).toFixed(2)}`}</button></div>
      </>}

      {step === "details" && appointment && <>
        <h3 className="text-lg font-extrabold">Appointment details</h3>
        <div className="holo grid gap-x-6 md:grid-cols-2"><Detail label="Doctor" value={appointment.doctor?.name} /><Detail label="Speciality" value={appointment.specialty} /><Detail label="Reason for visit" value={appointment.reason} /><Detail label="Date" value={appointment.scheduled_start.slice(0, 10)} /><Detail label="Time" value={timeLabel(appointment.scheduled_start)} /><Detail label="Room / floor" value={[appointment.doctor?.room, appointment.doctor?.floor].filter(Boolean).join(" / ")} /><Detail label="Payment" value="Paid" /><Detail label="Status" value={appointment.status} /></div>
        <div className="actions-row between"><button className="btn ghost" disabled={busy} onClick={cancelAndReturn}>Cancel appointment</button><button className="btn g" onClick={() => nav(redirect, { replace: true })}>OK</button></div>
      </>}
    </section>

    {showPaymentDone && <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="dialog" aria-modal="true"><div className="card w-full max-w-sm text-center"><CheckCircle2 className="mx-auto mb-3" size={44} color="var(--mint)" /><h3 className="text-lg font-extrabold">Payment done</h3><p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Your appointment has been booked successfully.</p><button className="btn g mt-4" onClick={() => { setShowPaymentDone(false); setStep("details"); }}>View appointment</button></div></div>}
    <TestPaymentModal
      open={showPayModal}
      orderId={pendingOrder?.order_id ?? "appt_order"}
      amountPaise={pendingOrder ? Math.round(Number(selectedSlot?.opd_fee ?? 500) * 100) : 50000}
      title="Consultation Payment"
      description={selectedSlot ? `${selectedSlot.specialty} — ${selectedSlot.doctor_name}` : "Appointment booking"}
      onSuccess={handlePaymentSuccess}
      onCancel={() => setShowPayModal(false)}
    />
  </div>;
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return <div className="kv"><span>{label}</span><b>{value || "Not available"}</b></div>;
}
