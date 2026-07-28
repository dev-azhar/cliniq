import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Search, UserPlus, CheckCircle, RefreshCw, Clock, ArrowRight } from "lucide-react";
import { api } from "../../lib/api";
import { Card, Metric, Empty, Tag } from "../../components/ui";
import WalkInModal from "./components/WalkInModal";
import LabPaymentCounter from "./components/LabPaymentCounter";

export default function ReceptionWorkspace() {
  const qc = useQueryClient();
  const [searchMobile, setSearchMobile] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [busyCheckinId, setBusyCheckinId] = useState<string | null>(null);
  
  // Success toast/receipt state
  const [successInfo, setSuccessInfo] = useState<{ token: string; name: string } | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Live hospital metrics
  const { data: metrics, refetch: refetchMetrics } = useQuery({
    queryKey: ["reception-metrics"],
    queryFn: api.metrics,
    refetchInterval: 10000,
  });

  // Mobile profile search
  const { data: searchResults, refetch: triggerSearch, isFetching: searching } = useQuery({
    queryKey: ["patient-search", searchMobile],
    queryFn: () => api.mobileProfiles(searchMobile),
    enabled: searchMobile.length === 10,
  });

  // Today's appointments for selected patient
  const { data: appointmentsData, refetch: refetchAppointments, isFetching: loadingAppts } = useQuery({
    queryKey: ["patient-appointments", selectedPatient?.patient_id],
    queryFn: () => api.todayAppointments(selectedPatient.patient_id),
    enabled: !!selectedPatient,
  });
  const appointments = appointmentsData?.appointments || [];

  // Hospital-wide today's appointments (all patients)
  const { data: hospitalAppointmentsData, refetch: refetchHospitalAppointments, isFetching: loadingHospitalAppts } = useQuery({
    queryKey: ["hospital-appointments-today"],
    queryFn: api.hospitalTodayAppointments,
  });
  const hospitalAppointments = hospitalAppointmentsData?.appointments || [];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchMobile.length === 10) {
      triggerSearch();
      setSelectedPatient(null);
    }
  };

  const handleCheckIn = async (appointmentId: string, patientId?: string) => {
    try {
      setBusyCheckinId(appointmentId);
      setSuccessInfo(null);

      const resolvedPatientId = patientId || selectedPatient?.patient_id;
      if (!resolvedPatientId) throw new Error("Patient ID not resolved for check-in");

      const res = await api.checkin({
        appointment_id: appointmentId,
        patient_id: resolvedPatientId,
        channel: "WALKIN",
      });
      refetchAppointments();
      refetchHospitalAppointments();
      refetchMetrics();
      qc.invalidateQueries({ queryKey: ["triage-queue"] });

      let patientName = "Patient";
      if (selectedPatient) {
        patientName = `${selectedPatient.first_name} ${selectedPatient.last_name || ""}`.trim();
      } else {
        const apptObj = hospitalAppointments.find((a: any) => a.appointment_id === appointmentId);
        if (apptObj) patientName = apptObj.patient_name;
      }

      setSuccessInfo({
        token: res.token?.number || "A-000",
        name: patientName,
      });
    } catch (err: any) {
      alert(err.message || "Failed to check-in patient");
    } finally {
      setBusyCheckinId(null);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm("Are you sure you want to cancel this appointment? This action cannot be undone.")) return;
    try {
      setCancellingId(appointmentId);
      await api.cancelAppointment(appointmentId);
      alert("Appointment has been cancelled successfully.");
      if (selectedPatient) {
        refetchAppointments();
      }
      refetchHospitalAppointments();
      refetchMetrics();
    } catch (err: any) {
      alert(err.message || "Failed to cancel appointment");
    } finally {
      setCancellingId(null);
    }
  };

  const handleWalkInSuccess = (token: string, name: string) => {
    setShowWalkInModal(false);
    setSuccessInfo({ token, name });
    refetchMetrics();
    refetchHospitalAppointments();
    qc.invalidateQueries({ queryKey: ["triage-queue"] });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="grad-text text-xl font-extrabold flex items-center gap-2">
            <ClipboardList size={22} className="text-[var(--cyan)]" /> Reception Desk
          </h2>
          <p className="text-[13px] mt-1 text-[var(--muted)]">
            Manage walk-in registrations, help patients check in, and collect physical cash/UPI payments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSuccessInfo(null);
              setShowWalkInModal(true);
            }}
            className="btn flex items-center gap-1.5 text-xs font-bold"
            style={{ background: "linear-gradient(to right, var(--cyan), var(--violet))" }}
          >
            <UserPlus size={15} /> Register Walk-In
          </button>
          <span className="live">LIVE VIEW</span>
        </div>
      </Card>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric value={metrics?.headline?.patients_today ?? "—"} label="Total patients today" />
        <Metric value={metrics?.headline?.in_queue ?? "—"} label="Patients in queue" />
        <Metric value={metrics ? `${metrics.headline.door_to_doctor_min}m` : "—"} label="Avg wait time" />
        <Metric
          value={
            <button
              onClick={() => {
                refetchMetrics();
                refetchHospitalAppointments();
                if (selectedPatient) refetchAppointments();
              }}
              className="p-1 hover:bg-white/10 rounded text-[var(--cyan)] flex items-center gap-1 text-[11px] font-bold"
            >
              <RefreshCw size={12} /> Sync Dashboard
            </button>
          }
          label="Status sync"
        />
      </div>

      {/* Success Notification / Printed Receipt */}
      {successInfo && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-4 duration-300">
          <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={18} />
          <div>
            <div className="font-extrabold text-sm text-white">Check-In Successful!</div>
            <div className="text-xs mt-1">
              Receipt generated for <b>{successInfo.name}</b>. Token <b>{successInfo.token}</b> assigned.
            </div>
            <div className="mt-2.5">
              <span className="tag mint font-bold uppercase text-[10px]">Token {successInfo.token}</span>
              <span className="text-[11px] text-[var(--muted)] ml-2">Please direct patient to Triage Desk.</span>
            </div>
          </div>
          <button
            onClick={() => setSuccessInfo(null)}
            className="ml-auto text-[var(--muted)] hover:text-white text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_clamp(340px,28vw,480px)] 2xl:gap-6">
        {/* Left Column: Search & Check-in Assist */}
        <div className="space-y-4">
          <Card className="space-y-4">
            <h3 className="text-sm font-extrabold text-[var(--ink)] flex items-center gap-2">
              <Search size={15} className="text-[var(--cyan)]" /> Check-In Assistant
            </h3>
            
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="tel"
                  maxLength={10}
                  className="input font-mono pl-9"
                  placeholder="Enter patient 10-digit mobile number..."
                  value={searchMobile}
                  onChange={(e) => setSearchMobile(e.target.value.replace(/\D/g, ""))}
                />
                <Search size={14} className="absolute left-3 top-3 text-[var(--muted)]" />
              </div>
              <button
                type="submit"
                disabled={searchMobile.length !== 10 || searching}
                className="btn ghost text-xs font-bold px-4"
              >
                {searching ? "Searching..." : "Search"}
              </button>
            </form>

            {/* Profile Lookup Results */}
            {searchMobile.length === 10 && searchResults && (
              <div className="space-y-2 border-t border-white/5 pt-3">
                <div className="text-[11px] font-extrabold text-[var(--muted)] uppercase tracking-wider">
                  Select Patient Profile
                </div>
                {searchResults.profiles?.length === 0 ? (
                  <Empty>
                    No patient registered with mobile <b>{searchMobile}</b>. 
                    <button
                      onClick={() => {
                        setSuccessInfo(null);
                        setShowWalkInModal(true);
                      }}
                      className="text-[var(--cyan)] font-extrabold underline block mt-2 hover:text-[var(--blue)]"
                    >
                      Click here to register them as a Walk-In patient →
                    </button>
                  </Empty>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {searchResults.profiles?.map((p: any) => {
                      const isSelected = selectedPatient?.patient_id === p.patient_id;
                      return (
                        <div
                          key={p.patient_id}
                          onClick={() => {
                            setSelectedPatient(p);
                            setSuccessInfo(null);
                          }}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                            isSelected
                              ? "bg-[var(--cyan)]/10 border-[var(--cyan)] text-white font-bold"
                              : "bg-white/[0.01] border-white/5 hover:bg-white/5 text-[var(--ink)]"
                          }`}
                        >
                          <div className="font-extrabold text-white">
                            👤 {p.first_name} {p.last_name || ""}
                          </div>
                          <div className="text-[10px] mt-1 text-[var(--muted)] flex justify-between">
                            <span>Gender: {p.gender}</span>
                            <span>MRN: {p.mrn || "Pending"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Selected Patient Details & Today's Appointments */}
          {selectedPatient && (
            <Card className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    {selectedPatient.first_name} {selectedPatient.last_name || ""}
                  </h3>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5 font-mono">
                    Mobile: {selectedPatient.mobile} · MRN: {selectedPatient.mrn || "Pending"}
                  </p>
                </div>
                <Tag tone="violet">Patient Account</Tag>
              </div>

              <div>
                <h4 className="text-xs font-extrabold text-[var(--muted)] mb-2 uppercase tracking-wider">
                  Today's Appointments
                </h4>

                {loadingAppts ? (
                  <div className="text-xs text-[var(--muted)] py-4 text-center">
                    Loading appointments...
                  </div>
                ) : appointments?.length === 0 ? (
                  <Empty>
                    No appointments booked for today.
                    <button
                      onClick={() => {
                        setSuccessInfo(null);
                        setShowWalkInModal(true);
                      }}
                      className="text-[var(--cyan)] font-extrabold underline block mt-2 hover:text-[var(--blue)]"
                    >
                      Book a walk-in consult for this patient →
                    </button>
                  </Empty>
                ) : (
                  <div className="space-y-2">
                    {appointments?.map((appt: any) => {
                      const startTime = new Date(appt.scheduled_start).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const isBooked = appt.status === "BOOKED";
                      const isChecking = busyCheckinId === appt.appointment_id;

                      return (
                        <div
                          key={appt.appointment_id}
                          className="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="font-extrabold text-white">
                              Dr. {appt.doctor?.name || "General Practitioner"}
                            </div>
                            <div className="text-[10px] text-[var(--muted)] mt-0.5">
                              {appt.department || "Consultation"} · Scheduled {startTime}
                            </div>
                            <div className="mt-1.5 flex gap-1">
                              <span className={`tag text-[9px] font-bold ${
                                appt.status === "BOOKED" ? "amber" : appt.status === "CHECKED_IN" ? "blue" : "green"
                              }`}>
                                {appt.status}
                              </span>
                            </div>
                          </div>

                          {isBooked ? (
                            <div className="flex gap-2 items-center shrink-0">
                              <button
                                disabled={cancellingId === appt.appointment_id}
                                onClick={() => handleCancelAppointment(appt.appointment_id)}
                                className="text-[10px] text-red-400 hover:text-red-300 font-bold border border-red-500/20 px-2 py-1 rounded-lg transition"
                                type="button"
                              >
                                Cancel
                              </button>
                              <button
                                disabled={isChecking}
                                onClick={() => handleCheckIn(appt.appointment_id)}
                                className="btn text-[10.5px] py-1 px-3 flex items-center gap-1 font-bold"
                                style={{ background: "linear-gradient(to right, var(--cyan), var(--violet))" }}
                              >
                                {isChecking ? "Checking In..." : <>Check In <ArrowRight size={12} /></>}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                              ✓ Arrived
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          )}

          {!selectedPatient && (
            <Card className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    📅 Today's Reception Queue &amp; Appointments
                  </h3>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">
                    Live schedule of all self-booked (portal) and walk-in patients for today.
                  </p>
                </div>
                <button
                  onClick={() => refetchHospitalAppointments()}
                  className="p-1 hover:bg-white/10 rounded text-[var(--cyan)]"
                  title="Reload appointments list"
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              {loadingHospitalAppts ? (
                <div className="text-xs text-[var(--muted)] py-8 text-center">
                  Loading hospital schedule...
                </div>
              ) : hospitalAppointments.length === 0 ? (
                <Empty>
                  No appointments booked or registered for today.
                  <button
                    onClick={() => {
                      setSuccessInfo(null);
                      setShowWalkInModal(true);
                    }}
                    className="btn mt-3 text-xs"
                    style={{ background: "linear-gradient(to right, var(--cyan), var(--violet))" }}
                  >
                    <UserPlus size={13} /> Register First Patient
                  </button>
                </Empty>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {hospitalAppointments.map((appt: any) => {
                    const startTime = new Date(appt.scheduled_start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const isBooked = appt.status === "BOOKED";
                    const isChecking = busyCheckinId === appt.appointment_id;

                    return (
                      <div
                        key={appt.appointment_id}
                        className="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex items-center justify-between gap-3 text-xs hover:bg-white/[0.02] transition"
                      >
                        <div>
                          <div className="font-extrabold text-white">
                            👤 {appt.patient_name} <span className="font-normal text-[var(--dim)] ml-1.5 font-mono">({appt.patient_mobile})</span>
                          </div>
                          <div className="text-[10px] text-[var(--muted)] mt-1">
                            Dr. {appt.doctor_name} · {appt.department} · Scheduled {startTime}
                          </div>
                          <div className="mt-2 flex gap-1.5 items-center">
                            <span className={`tag text-[9px] font-bold ${
                              appt.status === "BOOKED" ? "amber" : appt.status === "CHECKED_IN" ? "blue" : "green"
                            }`}>
                              {appt.status}
                            </span>
                            <span className="text-[10px] text-[var(--dim)] font-semibold">
                              via {appt.channel || "Portal"}
                            </span>
                          </div>
                        </div>

                        {isBooked ? (
                          <div className="flex gap-2 items-center shrink-0">
                            <button
                              disabled={cancellingId === appt.appointment_id}
                              onClick={() => handleCancelAppointment(appt.appointment_id)}
                              className="text-[10px] text-red-400 hover:text-red-300 font-bold border border-red-500/20 px-2 py-1 rounded-lg transition"
                              type="button"
                            >
                              Cancel
                            </button>
                            <button
                              disabled={isChecking}
                              onClick={() => handleCheckIn(appt.appointment_id, appt.patient_id)}
                              className="btn text-[10.5px] py-1 px-3 flex items-center gap-1 font-bold"
                              style={{ background: "linear-gradient(to right, var(--cyan), var(--violet))" }}
                            >
                              {isChecking ? "Checking In..." : <>Check In <ArrowRight size={12} /></>}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                            ✓ Arrived
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right Column: Lab Payments counter */}
        <div>
          <LabPaymentCounter />
        </div>
      </div>

      {/* Walk-in Registration Modal Wizard */}
      {showWalkInModal && (
        <WalkInModal
          onClose={() => setShowWalkInModal(false)}
          onSuccess={handleWalkInSuccess}
        />
      )}
    </div>
  );
}
