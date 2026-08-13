import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LogOut, Clipboard, Camera, UserRound, ArrowLeft, CheckCircle2,
  AlertCircle, Download, Clock, MapPin, Ticket, Receipt, Info, Mail, Phone, Calendar, Trash2, Syringe, Droplet, CreditCard
} from "lucide-react";
import { api } from "../../lib/api";
import { useJourney } from "../../lib/store";
import { useRealtime } from "../../lib/realtime";
import { getPortalPatient, savePortalPatient, clearPortalPatient } from "../../lib/patientAuth";
import { Card, Tag, Empty } from "../../components/ui";

import StageTracker from "./components/StageTracker";
import ConsultationSummary from "./components/ConsultationSummary";
import VitalsAndLabs from "./components/VitalsAndLabs";
import PrescriptionSlip from "./components/PrescriptionSlip";
import LabOrdersAlert from "./components/LabOrdersAlert";

const STATUS_STAGE: Record<string, number> = {
  CHECKED_IN: 0,
  TRIAGED: 1,
  EMERGENCY: 1,
  IN_CONSULT: 2,
  DISCHARGED: 6,
};

const TOPIC_STAGE: Record<string, number> = {
  "patient.checkedin": 0,
  "triage.completed": 1,
  "token.issued": 1,
  "note.approved": 2,
  "laborder.created": 3,
  "labresult.published": 4,
  "result.abnormal": 4,
  "prescription.approved": 5,
  "invoice.generated": 5,
  "payment.completed": 5,
  "visit.discharged": 6,
};

type StoredStatusSelection =
  | { type: "appointment"; id: string }
  | { type: "encounter"; id: string };

function statusSelectionKey(patientId: string) {
  return `patient-status-selection:${patientId}`;
}

function readStatusSelection(patientId: string): StoredStatusSelection | null {
  try {
    const raw = sessionStorage.getItem(statusSelectionKey(patientId));
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      (value?.type === "appointment" || value?.type === "encounter") &&
      typeof value.id === "string"
    ) {
      return value;
    }
  } catch {
    // Ignore invalid or unavailable browser storage and use the normal default.
  }
  return null;
}

export default function PatientDashboard() {
  const nav = useNavigate();
  const location = useLocation();
  const journey = useJourney();
  const events = useRealtime((s) => s.events);
  const portalSession = getPortalPatient()!;
  const portalPatientId = portalSession.patient_id;
  const portalPatientName = portalSession.name;
  const [initialStatusSelection] = useState(() => readStatusSelection(portalPatientId));

  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(
    initialStatusSelection?.type === "encounter" ? initialStatusSelection.id : null
  );
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(
    initialStatusSelection?.type === "appointment" ? initialStatusSelection.id : null
  );
  const [showMobileVisitList, setShowMobileVisitList] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [episodeTimelineTab, setEpisodeTimelineTab] = useState<"care" | "billing">("care");

  // Follow-up consultation state variables
  const [showRevisitModal, setShowRevisitModal] = useState(false);
  const [revisitDate, setRevisitDate] = useState("");
  const [revisitSlot, setRevisitSlot] = useState("");
  const [uploadingReport, setUploadingReport] = useState(false);
  const [uploadedDocUri, setUploadedDocUri] = useState<string | null>(null);
  const [uploadedDocName, setUploadedDocName] = useState<string | null>(null);
  const [bookingRevisit, setBookingRevisit] = useState(false);
  const [revisitSuccessMsg, setRevisitSuccessMsg] = useState("");
  const [requestingEconsult, setRequestingEconsult] = useState(false);
  const [econsultSuccessMsg, setEconsultSuccessMsg] = useState("");
  const [revisitError, setRevisitError] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(() => {
    const shouldOpen = sessionStorage.getItem("open-patient-profile") === "true";
    if (shouldOpen) sessionStorage.removeItem("open-patient-profile");
    return shouldOpen;
  });
  const [profileModalTab, setProfileModalTab] = useState<"info" | "history">("info");

  useEffect(() => {
    if (showProfileModal) setProfileModalTab("info");
  }, [showProfileModal]);

  useEffect(() => {
    if (location.state?.openPatientProfile) {
      sessionStorage.removeItem("open-patient-profile");
      setShowProfileModal(true);
      nav(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, nav]);

  function timeLabel(value: string) {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function appointmentDate(value: string) {
    if (!value) return "";
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value.slice(0, 10);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(parsed);
  }

  async function handlePhotoUpload(file?: File) {
    if (!file) return;
    setPhotoError("");
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError("Profile photo must be 2 MB or smaller.");
      return;
    }

    setPhotoUploading(true);
    try {
      const profilePhoto = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const result = await api.updatePatientProfilePhoto(portalPatientId, profilePhoto);
      savePortalPatient({ ...portalSession, profile_photo: result.patient.profile_photo });
      await refetchP360();
    } catch {
      setPhotoError("Unable to upload the profile photo. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handlePhotoDelete() {
    if (!window.confirm("Delete your profile photo?")) return;
    setPhotoUploading(true);
    setPhotoError("");
    try {
      await api.updatePatientProfilePhoto(portalPatientId, null);
      savePortalPatient({ ...portalSession, profile_photo: undefined });
      await refetchP360();
    } catch {
      setPhotoError("Unable to delete the profile photo. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  }

  // Query patient records. This drives the whole "My Status" board (active
  // episode/encounter detection, stage tracker, token). Staff-side actions
  // (triage completed, note approved, lab published, etc.) update this from
  // the *other* side — the WS event stream is a best-effort nudge, not a
  // guarantee (it can drop/reconnect), so this must also poll on its own,
  // same as the doctor-side Patient360 view of the identical endpoint —
  // otherwise a staff-driven change can sit stale on the patient's board
  // indefinitely instead of just for a few seconds.
  const { data: p360, refetch: refetchP360, isFetched: isP360Fetched } = useQuery({
    queryKey: ["portal-p360", portalPatientId],
    queryFn: () => api.patient360(portalPatientId!),
    enabled: !!portalPatientId,
    refetchInterval: 5000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: appointmentData, refetch: refetchAppointments, isFetched: areAppointmentsFetched } = useQuery({
    queryKey: ["portal-upcoming-appointments", portalPatientId],
    queryFn: () => api.upcomingAppointments(portalPatientId),
    enabled: !!portalPatientId,
  });

  const { data: triageStaffList } = useQuery({
    queryKey: ["triage-staff"],
    queryFn: () => api.triageStaff(),
  });

  // Only used to conditionally surface the "Cancer Care" quick-access card below —
  // most patients have no oncology record, so this stays empty for them.
  const { data: oncologyDiagnoses } = useQuery({
    queryKey: ["oncology-diagnoses", portalPatientId],
    queryFn: () => api.oncologyDiagnoses(portalPatientId),
    enabled: !!portalPatientId,
  });

  const handleSignOut = () => {
    clearPortalPatient();
    journey.reset();
    nav("/patient/login?redirect=/patient", { replace: true });
  };

  function handleEpisodeClick(ep: any) {
    const activeLab = ep.labs?.find((l: any) => l.status !== "DISCHARGED");
    const activeFollowup = ep.followups?.find((f: any) => f.status !== "DISCHARGED");
    if (activeLab) {
      setSelectedEncounterId(activeLab.encounter_id);
    } else if (activeFollowup) {
      setSelectedEncounterId(activeFollowup.encounter_id);
    } else {
      setSelectedEncounterId(ep.encounter_id);
    }
    setSelectedAppointmentId(null);
    setShowMobileVisitList(false);
  }

  const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const episodes = p360?.episodes ?? [];
  const hasActiveVisit = (ep: any) =>
    ep.status !== "DISCHARGED" ||
    ep.labs?.some((lab: any) => lab.status !== "DISCHARGED") ||
    ep.followups?.some((followup: any) => followup.status !== "DISCHARGED");
  const activeEpisodes = episodes.filter(hasActiveVisit);
  const pastEpisodes = episodes.filter((ep: any) => !hasActiveVisit(ep));
  const appointments = appointmentData?.appointments ?? [];

  useEffect(() => {
    const selection: StoredStatusSelection | null = selectedAppointmentId
      ? { type: "appointment", id: selectedAppointmentId }
      : selectedEncounterId
        ? { type: "encounter", id: selectedEncounterId }
        : null;

    if (selection) {
      sessionStorage.setItem(statusSelectionKey(portalPatientId), JSON.stringify(selection));
    }
  }, [portalPatientId, selectedAppointmentId, selectedEncounterId]);

  useEffect(() => {
    if (!isP360Fetched || !areAppointmentsFetched) return;

    if (
      selectedAppointmentId &&
      !appointments.some((appointment: any) => appointment.appointment_id === selectedAppointmentId)
    ) {
      setSelectedAppointmentId(null);
      sessionStorage.removeItem(statusSelectionKey(portalPatientId));
      return;
    }

    if (selectedEncounterId) {
      const encounterStillExists = episodes.some((episode: any) =>
        episode.encounter_id === selectedEncounterId ||
        episode.labs?.some((lab: any) => lab.encounter_id === selectedEncounterId) ||
        episode.followups?.some((followup: any) => followup.encounter_id === selectedEncounterId)
      );
      if (!encounterStillExists) {
        setSelectedEncounterId(null);
        sessionStorage.removeItem(statusSelectionKey(portalPatientId));
      }
    }
  }, [
    appointments,
    areAppointmentsFetched,
    episodes,
    isP360Fetched,
    portalPatientId,
    selectedAppointmentId,
    selectedEncounterId,
  ]);

  // Every visit, most-recent first — feeds the "Token & Billing History" tab in the
  // patient profile modal so a patient can see every queue token + invoice in one place,
  // the same way a doctor sees a full Patient 360 view for a chart.
  const historyEpisodes = [...episodes].sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

  const historyInvoiceQueries = useQueries({
    queries: historyEpisodes.map((ep: any) => ({
      queryKey: ["portal-history-invoice", ep.encounter_id],
      queryFn: () => api.invoice(ep.encounter_id),
      enabled: showProfileModal && profileModalTab === "history" && !!ep.encounter_id,
      staleTime: 30_000,
    })),
  });

  const latestDischargeEvent = events.find((event) =>
    event.topic === "visit.discharged" &&
    p360?.encounters?.some((encounter: any) => encounter.encounter_id === event.payload?.encounter_id)
  );

  useEffect(() => {
    if (latestDischargeEvent) {
      void refetchP360();
    }
  }, [latestDischargeEvent?.ts, refetchP360]);

  // Find active episode/encounter
  const activeEpisode = episodes.find((ep: any) => {
    if (ep.status !== "DISCHARGED") return true;
    const hasActiveLab = ep.labs?.some((l: any) => l.status !== "DISCHARGED");
    const hasActiveFollowup = ep.followups?.some((f: any) => f.status !== "DISCHARGED");
    return hasActiveLab || hasActiveFollowup;
  });

  const isTodayEpisode = activeEpisode?.date === today;
  const hasBookedAppointment = appointments.length > 0;

  let defaultAppId = null;
  let defaultEncId = null;

  if (activeEpisode && (isTodayEpisode || !hasBookedAppointment)) {
    let activeEncId = activeEpisode.encounter_id;
    const activeFollowup = activeEpisode.followups?.find((f: any) => f.status !== "DISCHARGED");
    const activeLab = activeEpisode.labs?.find((l: any) => l.status !== "DISCHARGED");
    if (activeFollowup) {
      activeEncId = activeFollowup.encounter_id;
    } else if (activeLab) {
      activeEncId = activeLab.encounter_id;
    }
    defaultEncId = activeEncId;
  } else if (hasBookedAppointment) {
    defaultAppId = appointments[0].appointment_id;
  } else if (episodes.length > 0) {
    const latestEp = episodes[0];
    let latestEncId = latestEp.encounter_id;
    if (latestEp.followups && latestEp.followups.length > 0) {
      latestEncId = latestEp.followups[0].encounter_id;
    } else if (latestEp.labs && latestEp.labs.length > 0) {
      latestEncId = latestEp.labs[0].encounter_id;
    }
    defaultEncId = latestEncId;
  }

  const showAppointmentId = selectedAppointmentId || (selectedEncounterId ? null : defaultAppId);
  const showEncounterId = selectedEncounterId || (showAppointmentId ? null : defaultEncId);

  const currentEpisode = episodes.find((ep: any) => 
    ep.encounter_id === showEncounterId || 
    ep.labs?.some((l: any) => l.encounter_id === showEncounterId) || 
    ep.followups?.some((f: any) => f.encounter_id === showEncounterId)
  );

  const parentEncounterId = currentEpisode?.encounter_id || showEncounterId;

  const { data: parentEncDetails, refetch: refetchParentEnc } = useQuery({
    queryKey: ["portal-encounter-parent", parentEncounterId],
    queryFn: () => api.encounter(parentEncounterId!),
    enabled: !!parentEncounterId,
    refetchInterval: 5000,
  });

  const { data: episodeInvoice, isLoading: episodeInvoiceLoading } = useQuery({
    queryKey: ["portal-episode-invoice", parentEncounterId],
    queryFn: () => api.invoice(parentEncounterId!),
    enabled: Boolean(parentEncounterId && currentEpisode),
    refetchInterval: 5000,
  });

  useEffect(() => {
    setEpisodeTimelineTab("care");
  }, [parentEncounterId]);

  const { data: encDetails, refetch: refetchEnc } = useQuery({
    queryKey: ["portal-encounter", showEncounterId],
    queryFn: () => api.encounter(showEncounterId!),
    enabled: !!showEncounterId,
    refetchInterval: 5000,
  });

  const { data: labDetails, refetch: refetchLab } = useQuery({
    queryKey: ["portal-lab", showEncounterId],
    queryFn: () => api.encounterLab(showEncounterId!),
    enabled: !!showEncounterId,
    refetchInterval: 5000,
  });

  const mine = events.filter((e) => e.payload?.encounter_id === showEncounterId);
  let stage = STATUS_STAGE[encDetails?.status ?? "CHECKED_IN"] ?? 0;
  
  const isLabVisit = encDetails?.visit_type === "LAB" || encDetails?.department === "Laboratory";
  if (isLabVisit) {
    if (encDetails.status === "DISCHARGED") {
      stage = 6; // Discharged
    } else {
      const labOrders = labDetails?.orders || encDetails.labs || [];
      const anyResulted = labOrders.some((o: any) => o.status === "RESULTED");
      const allResulted = labOrders.length > 0 && labOrders.every((o: any) => o.status === "RESULTED");
      if (allResulted) {
        stage = 6;
      } else if (anyResulted) {
        stage = 4; // Under review / partial results
      } else {
        stage = 3; // Diagnostics / checked in & waiting
      }
    }
  } else {
    if (encDetails?.note?.status === "APPROVED") stage = Math.max(stage, 2);
    if (encDetails?.labs?.length) stage = Math.max(stage, 3);
    if (encDetails?.labs?.some((order: any) => order.results?.length)) stage = Math.max(stage, 4);
    if (encDetails?.prescription?.status === "APPROVED") stage = Math.max(stage, 5);
  }
  for (const e of mine) stage = Math.max(stage, TOPIC_STAGE[e.topic] ?? -1);

  const token = encDetails?.token;

  async function handleDirectCheckin(app: any) {
    if (!app) return;
    setCheckingIn(true);
    setCheckInError("");
    try {
      const result = await api.checkin({
        patient_id: portalPatientId,
        appointment_id: app.appointment_id,
        mobile: portalSession.mobile,
        channel: "PORTAL",
        reason: app.reason,
      });
      journey.set({
        patientId: result.patient.patient_id,
        patientName: result.patient.name,
        encounterId: result.encounter_id
      });
      await Promise.all([
        refetchP360(),
        refetchAppointments(),
      ]);
      setSelectedEncounterId(result.encounter_id);
      setSelectedAppointmentId(null);
    } catch (e: any) {
      setCheckInError(e?.message || "Check-in failed. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  }

  // Trigger E-consultation request
  async function handleRequestEconsult(doctorId: string) {
    if (!doctorId) return;
    setRequestingEconsult(true);
    setEconsultSuccessMsg("");
    setRevisitError("");
    try {
      const res = await api.requestEconsult(portalPatientId, { 
        doctor_id: doctorId,
        parent_encounter_id: parentEncounterId 
      });
      setEconsultSuccessMsg(`E-Consultation requested successfully! Your remote review token is ${res.token_number}. The doctor will review your reports shortly.`);
      if (res.encounter_id) {
        setSelectedEncounterId(res.encounter_id);
      }
      await refetchP360();
    } catch (e: any) {
      setRevisitError(e?.message || "Failed to request E-Consultation. Please try again.");
    } finally {
      setRequestingEconsult(false);
    }
  }

  // Handle external report upload
  async function handleReportUpload(file: File) {
    if (!file) return;
    setUploadingReport(true);
    setRevisitError("");
    try {
      const res = await api.uploadPatientDocument(portalPatientId, file);
      setUploadedDocUri(res.uri);
      setUploadedDocName(res.title);
    } catch (e: any) {
      setRevisitError(e?.message || "Failed to upload document.");
    } finally {
      setUploadingReport(false);
    }
  }

  // Confirm revisit slot booking
  async function handleBookRevisit(doctorId: string) {
    if (!doctorId || !revisitDate || !revisitSlot) {
      setRevisitError("Please select date and slot.");
      return;
    }
    setBookingRevisit(true);
    setRevisitSuccessMsg("");
    setRevisitError("");
    try {
      await api.bookRevisit(portalPatientId, {
        doctor_id: doctorId,
        booking_date: revisitDate,
        booking_slot: revisitSlot,
        parent_encounter_id: parentEncounterId,
        attachment_name: uploadedDocName || undefined,
        attachment_uri: uploadedDocUri || undefined,
      });
      setRevisitSuccessMsg("Re-visit slot booked successfully! Please carry your physical test reports with you to the doctor, irrespective of whether you uploaded them or not.");
      await refetchAppointments();
      await refetchP360();
    } catch (e: any) {
      setRevisitError(e?.message || "Failed to book Re-visit. Please try again.");
    } finally {
      setBookingRevisit(false);
    }
  }

  async function handleCancelAppointment(apptId: string) {
    if (!confirm("Are you sure you want to cancel this appointment? This action cannot be undone.")) return;
    try {
      await api.cancelAppointment(apptId);
      alert("Appointment has been cancelled successfully.");
      void refetchAppointments();
      void refetchP360();
      setSelectedAppointmentId(null);
    } catch (e: any) {
      alert(e?.message || "Failed to cancel appointment.");
    }
  }

  function handleDownloadInvoice(item: any, isEncounter: boolean = false) {
    if (!item) return;
    const appointment = isEncounter ? item.appointment : item;
    const docName = appointment?.doctor?.name || item.triage?.recommended_doctor?.name || "Not assigned";
    const dept = appointment?.specialty || item.triage?.specialty || item.department || "Not recorded";
    const timeVal = appointment?.scheduled_start ? timeLabel(appointment.scheduled_start) : (item.arrival ? timeLabel(item.arrival) : "Not recorded");
    const itemId = isEncounter ? item.encounter_id : item.appointment_id;
    const invId = `INV-${isEncounter ? "ENC" : "APP"}-${itemId.slice(0, 8).toUpperCase()}`;
    const invoiceContent = `================================================\n           SMART HOSPITAL PLATFORM\n              INVOICE SUMMARY\n================================================\nInvoice Number: ${invId}\nDate:           ${new Date().toLocaleDateString()}\nPayment Status: PAID IN FULL\n------------------------------------------------\nPatient Name:   ${portalPatientName}\nPatient ID:     ${portalPatientId}\nDoctor Name:    ${docName}\nDepartment:     ${dept}\nTime:           ${timeVal}\n------------------------------------------------\nDescription               Qty          Amount\n------------------------------------------------\nOPD Consultation           1           ₹500.00\n------------------------------------------------\nTotal:                                 ₹500.00\nPaid Amount:                           ₹500.00\nBalance Due:                           ₹0.00\n------------------------------------------------\nPayment Method: Online (Paid at confirmation)\nThank you for visiting us!\n================================================`;

    const blob = new Blob([invoiceContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Invoice_${invId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function downloadEpisodeInvoice(invoice: any) {
    if (!invoice) return;
    const lineText = (invoice.lines || []).map((line: any) =>
      `${line.description} | Qty ${line.quantity} | ₹${Number(line.amount || 0).toFixed(2)} | ${line.payment_status || "UNPAID"}`
    ).join("\n");
    const invoiceContent = `SMART HOSPITAL PLATFORM\nEPISODE INVOICE\n\nInvoice: ${invoice.invoice_id}\nPatient: ${portalPatientName}\nPatient ID: ${portalPatientId}\nStatus: ${invoice.status}\n\nITEMS\n${lineText || "No billed items"}\n\nTotal: ₹${Number(invoice.total || 0).toFixed(2)}\nPaid: ₹${Number(invoice.paid_amount || 0).toFixed(2)}\nUnpaid: ₹${Number(invoice.unpaid_amount ?? invoice.balance ?? 0).toFixed(2)}\n`;
    const blob = new Blob([invoiceContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Invoice_${invoice.invoice_id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const hasSelection = !!(showEncounterId || showAppointmentId);
  const selectedApp = appointments.find((a: any) => a.appointment_id === showAppointmentId);
  const encounterAppointment = encDetails?.appointment || appointments.find((a: any) =>
    a.encounter_id === showEncounterId || a.appointment_id === encDetails?.appointment_id
  );

  return (
    <div className="patient-page grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[clamp(280px,23vw,360px)_minmax(0,1fr)] 2xl:gap-7 animate-in fade-in duration-300">
      {/* Sidebar - Visits List */}
      <div className={`min-w-0 space-y-4 ${hasSelection && !showMobileVisitList ? "hidden lg:block" : "block"}`}>
        <Card className="!p-5">
          <div className="flex w-full items-center gap-4 text-left">
            <div className="relative shrink-0">
              <div
                className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-full p-[3px]"
                style={{ background: "linear-gradient(150deg,var(--cyan),var(--violet))" }}
              >
                <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-white">
                  {(p360?.patient?.profile_photo || portalSession.profile_photo)
                    ? <img className="h-full w-full object-cover" src={p360?.patient?.profile_photo || portalSession.profile_photo} alt={`${portalPatientName} profile`} />
                    : <UserRound size={32} className="text-[var(--dim)]" />}
                </div>
              </div>
              <label
                htmlFor="patient-profile-photo"
                className={`absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[var(--cyan)] text-white shadow-md transition ${photoUploading ? "cursor-wait opacity-60" : "cursor-pointer hover:scale-105"}`}
                aria-label="Upload profile photo"
                aria-disabled={photoUploading}
                title={photoUploading ? "Uploading photo" : "Upload profile photo"}
              >
                <Camera size={13} />
              </label>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dim)]">Patient profile</div>
              <div className="truncate text-xl font-extrabold text-[var(--ink)]">{portalPatientName}</div>
              <Tag tone="cyan">{p360?.patient?.mrn || portalSession?.mrn || "MRN Pending"}</Tag>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 border-t border-[var(--line)] pt-4 text-[11px] min-[420px]:grid-cols-2">
            {[
              { label: "Mobile", icon: Phone, value: p360?.patient?.mobile || portalSession?.mobile || "N/A" },
              { label: "Email", icon: Mail, value: p360?.patient?.email || portalSession?.email || "N/A" },
              {
                label: "DOB / Age", icon: Calendar, value: (() => {
                  const dobStr = p360?.patient?.dob || portalSession?.dob;
                  if (!dobStr) return "N/A";
                  const birthYear = new Date(dobStr).getFullYear();
                  const age = isNaN(birthYear) ? "" : ` (${new Date().getFullYear() - birthYear} yrs)`;
                  return `${dobStr}${age}`;
                })(),
              },
              { label: "Gender", icon: UserRound, value: p360?.patient?.gender || "N/A" },
              { label: "Blood Group", icon: Droplet, value: p360?.patient?.blood_group || "N/A", tone: "text-[var(--cyan)]" },
              { label: "MRN", icon: CreditCard, value: p360?.patient?.mrn || portalSession?.mrn || "N/A", mono: true },
              { label: "Address", icon: MapPin, value: p360?.patient?.address || "12 MG Road, Pune, Maharashtra" },
            ].map((field) => (
              <div
                key={field.label}
                className={`flex min-w-0 items-start gap-2 rounded-xl border border-[var(--line)] bg-[rgba(20,33,61,0.025)] px-3 py-2.5 transition hover:border-[var(--line2)] hover:bg-[rgba(0,120,212,0.04)] ${field.label === "Address" ? "min-[420px]:col-span-2" : ""}`}
              >
                <field.icon size={14} className="mt-0.5 shrink-0 text-[var(--cyan)]" />
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--dim)]">{field.label}</div>
                  <div className={`break-words font-bold leading-5 ${field.tone || "text-[var(--ink)]"} ${field.mono ? "font-mono" : ""}`}>
                    {field.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <input
              id="patient-profile-photo"
              className="hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={photoUploading}
              onChange={(event) => {
                void handlePhotoUpload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              {(p360?.patient?.profile_photo || portalSession.profile_photo) && (
                <button
                  type="button"
                  onClick={handlePhotoDelete}
                  disabled={photoUploading}
                  className="btn ghost flex min-w-[130px] flex-1 items-center justify-center text-xs !py-1.5 text-rose-700 disabled:opacity-50"
                >
                  <Trash2 size={14} /> Delete photo
                </button>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="btn ghost flex min-w-[110px] flex-1 items-center justify-center text-xs !py-1.5 text-rose-700"
              >
                <LogOut size={14} /> Log out
              </button>
            </div>
            {photoError && <div className="mt-2 text-xs text-rose-700">{photoError}</div>}
            <div className="mt-2 text-[10px] text-[var(--dim)]">JPEG, PNG or WebP · Maximum 2 MB</div>
          </div>
        </Card>

        {/* Booked appointments and all non-discharged visits */}
        <Card className="flex h-[360px] flex-col">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--dim)]">Appointments</h4>
            <button 
              className="btn ghost sm shrink-0 text-[10px] !py-0.5 !px-2 font-extrabold" 
              onClick={() => nav("/patient/appointments/book?redirect=/patient")}
            >
              Book appointment
            </button>
          </div>
          {!appointments.length && !activeEpisodes.length && (
            <div className="holo mt-3 text-xs text-[var(--muted)]">No current or upcoming appointments.</div>
          )}
          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {appointments.map((appointment: any) => {
              const isActive = appointment.appointment_id === showAppointmentId;
              const appointmentDay = appointmentDate(appointment.scheduled_start);
              return (
                <button
                  key={appointment.appointment_id}
                  onClick={() => {
                    setSelectedAppointmentId(appointment.appointment_id);
                    setSelectedEncounterId(null);
                    setShowMobileVisitList(false);
                  }}
                  className="block h-[90px] w-full overflow-hidden rounded-xl border p-2.5 text-left text-xs transition hover:bg-[rgba(0,120,212,0.06)]"
                  style={{
                    borderColor: isActive ? "var(--line2)" : "var(--glass-border)",
                    background: isActive ? "rgba(0,120,212,0.05)" : "rgba(255,255,255,0.01)"
                  }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-[var(--ink)]">
                      {appointmentDay}
                      {appointmentDay === today && <span className="ml-1.5 text-[var(--cyan)]">Today</span>}
                    </span>
                    <Tag tone="amber">{appointment.status || "BOOKED"}</Tag>
                  </div>
                  <div className="truncate text-[var(--muted)]">
                    {appointment.doctor?.name ?? "Assigned doctor"} · {appointment.specialty} · {timeLabel(appointment.scheduled_start)}
                  </div>
                  <div className="mt-1 text-[var(--muted)]">Reason: {appointment.reason || "Not provided"}</div>
                </button>
              );
            })}
            {activeEpisodes.map((ep: any) => {
              const isActive = ep.encounter_id === showEncounterId || 
                               ep.labs?.some((l: any) => l.encounter_id === showEncounterId) || 
                               ep.followups?.some((f: any) => f.encounter_id === showEncounterId);
              const activeChild = ep.labs?.find((l: any) => l.status !== "DISCHARGED") || ep.followups?.find((f: any) => f.status !== "DISCHARGED");
              const displayStatus = activeChild ? activeChild.status : ep.status;
              
              return (
                <button
                  key={ep.encounter_id}
                  onClick={() => handleEpisodeClick(ep)}
                  className="block h-[90px] w-full overflow-hidden rounded-xl border p-2.5 text-left text-xs transition hover:bg-[rgba(0,120,212,0.06)]"
                  style={{
                    borderColor: isActive ? "var(--line2)" : "var(--glass-border)",
                    background: isActive ? "rgba(0,120,212,0.05)" : "rgba(255,255,255,0.01)"
                  }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-[var(--ink)]">
                      {ep.date}
                      {ep.date === today && <span className="ml-1.5 text-[var(--cyan)]">Today</span>}
                    </span>
                    <Tag tone={displayStatus === "DISCHARGED" ? "green" : "blue"}>{displayStatus}</Tag>
                  </div>
                  <div className="text-[var(--muted)]">{ep.department} department</div>
                  <div className="mt-1 text-[var(--muted)]">Reason: {ep.reason || "Not provided"}</div>
                </button>
              );
            })}
          </div>
        </Card>

        {oncologyDiagnoses && oncologyDiagnoses.length > 0 && (
          <button
            type="button"
            className="card w-full text-left cursor-pointer transition hover:bg-[rgba(0,120,212,0.06)]"
            onClick={() => nav("/patient/oncology")}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(0,120,212,0.15)" }}>
                <Syringe size={18} style={{ color: "var(--cyan)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs text-[var(--ink)]">My Cancer Care</div>
                <div className="truncate text-[11px] text-[var(--muted)]">
                  {oncologyDiagnoses[0].cancer_type} · diagnosis, chemo &amp; care team updates
                </div>
              </div>
              <Tag tone="violet">View</Tag>
            </div>
          </button>
        )}

        {/* Past Visits */}
        <Card className="flex h-[360px] flex-col">
          <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--dim)]">Past visits</h4>
          {!pastEpisodes.length && (
            <div className="holo mt-3 text-xs text-[var(--muted)]">No past visits available.</div>
          )}
          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {pastEpisodes.map((ep: any) => {
              const isActive = ep.encounter_id === showEncounterId || 
                               ep.labs?.some((l: any) => l.encounter_id === showEncounterId) || 
                               ep.followups?.some((f: any) => f.encounter_id === showEncounterId);
              
              return (
                <button
                  key={ep.encounter_id}
                  onClick={() => handleEpisodeClick(ep)}
                  className="block h-[90px] w-full overflow-hidden rounded-xl border p-2.5 text-left text-xs transition hover:bg-[rgba(0,120,212,0.06)]"
                  style={{ 
                    borderColor: isActive ? "var(--line2)" : "var(--glass-border)", 
                    background: isActive ? "rgba(0,120,212,0.05)" : "rgba(255,255,255,0.01)" 
                  }}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-bold text-[var(--ink)]">{ep.date}</span>
                    <Tag tone="green">{ep.status}</Tag>
                  </div>
                  <div className="text-[var(--muted)]">{ep.department} department</div>
                  <div className="mt-1 text-[var(--muted)]">Reason: {ep.reason || "Not provided"}</div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Main Panel */}
      <div className={`min-w-0 space-y-4 ${hasSelection && !showMobileVisitList ? "block" : "hidden lg:block"}`}>
        {hasSelection && (
          <button 
            onClick={() => setShowMobileVisitList(true)}
            className="btn ghost lg:hidden mb-2 text-xs flex items-center gap-1.5"
          >
            <ArrowLeft size={14} /> Back to Visits List
          </button>
        )}

        {showEncounterId && encDetails && encDetails.status !== "DISCHARGED" && encDetails.visit_type !== "E_CONSULT" && (
          <StageTracker stage={stage} token={token} />
        )}

        {showEncounterId && (encDetails?.routing_override || parentEncDetails?.routing_override) && (() => {
          const routingChange = encDetails?.routing_override || parentEncDetails?.routing_override;
          return (
            <div className="flex items-start gap-2 rounded-xl border border-sky-600/20 bg-sky-600/5 px-3 py-2 text-xs text-sky-800">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>
                Your doctor was updated by the Triage Department to{" "}
                <b>{routingChange.doctor_name}</b>
                {routingChange.specialty ? ` (${routingChange.specialty})` : ""}.
              </span>
            </div>
          );
        })()}

        {/* State 1: Booked appointment selected but check-in is not done */}
        {showAppointmentId && selectedApp && (
          <Card className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--glass-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(0,120,212,0.12)" }}>
                  <Ticket size={18} className="text-[var(--cyan)]" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">Appointment Overview</span>
                  <h3 className="text-lg font-extrabold text-[var(--ink)]">
                    {selectedApp.scheduled_start?.slice(0, 10) === today ? "Today" : "Upcoming Visit"}
                  </h3>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleCancelAppointment(selectedApp.appointment_id)}
                  className="btn outline sm text-xs flex items-center gap-1.5"
                  style={{ borderColor: "rgba(239,68,68,0.3)", color: "#b91c1c" }}
                >
                  Cancel Visit
                </button>
                <button 
                  onClick={() => handleDownloadInvoice(selectedApp, false)}
                  className="btn ghost sm text-xs flex items-center gap-1.5"
                >
                  <Download size={14} /> Invoice
                </button>
                <Tag tone="amber">Booked</Tag>
              </div>
            </div>

            {checkInError && (
              <div className="alertbox p-3 text-xs bg-rose-500/10 border-rose-500/20 text-rose-700 rounded-xl border">
                {checkInError}
              </div>
            )}

            {/* Alarm Banner / Alert */}
            <div className="p-3 bg-amber-500/5 border border-amber-500/20 text-amber-700 rounded-xl text-xs flex gap-2.5 items-start">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Please check in 15-20 minutes before</span>
                To ensure a smooth workflow and avoid wait times, please complete your check-in 15-20 minutes before your scheduled start of <span className="font-semibold text-[var(--ink)]">{timeLabel(selectedApp.scheduled_start)}</span>.
              </div>
            </div>

            {/* Appointment Details Grid */}
            <div className="grid gap-4 md:grid-cols-2 text-xs">
              <div className="space-y-3 p-3 rounded-xl border bg-[rgba(20,33,61,0.04)]" style={{ borderColor: "var(--glass-border)" }}>
                <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5 border-b border-[var(--line)] pb-1 mb-2">
                  <UserRound size={14} className="text-[var(--cyan)]" /> Doctor & Specialty
                </div>
                <div className="kv"><span>Doctor</span><b>{selectedApp.doctor?.name ?? "Assigned doctor"}</b></div>
                <div className="kv"><span>Speciality</span><b>{selectedApp.specialty}</b></div>
                <div className="kv"><span>Room / Floor</span><b>{[selectedApp.doctor?.room, selectedApp.doctor?.floor].filter(Boolean).join(" / ") || "Not assigned"}</b></div>
              </div>

              <div className="space-y-3 p-3 rounded-xl border bg-[rgba(20,33,61,0.04)]" style={{ borderColor: "var(--glass-border)" }}>
                <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5 border-b border-[var(--line)] pb-1 mb-2">
                  <Clock size={14} className="text-[var(--cyan)]" /> Schedule & Payment
                </div>
                <div className="kv">
                  <span>Date</span>
                  <b>
                    {selectedApp.scheduled_start?.slice(0, 10)}
                    {selectedApp.scheduled_start?.slice(0, 10) === today && <span className="ml-1.5 text-[var(--cyan)]">Today</span>}
                  </b>
                </div>
                <div className="kv"><span>Time Slot</span><b>{timeLabel(selectedApp.scheduled_start)}</b></div>
                <div className="kv"><span>Consultation Fee</span><b>{selectedApp.opd_fee != null ? `₹${Number(selectedApp.opd_fee).toFixed(2)}` : "Not recorded"}</b></div>
              </div>
            </div>

            <div className="p-3 rounded-xl border bg-[rgba(20,33,61,0.04)]" style={{ borderColor: "var(--glass-border)" }}>
              <div className="text-xs text-[var(--muted)]">Reason for Appointment:</div>
              <div className="text-xs font-semibold text-[var(--muted)] mt-1">{selectedApp.reason || "General OPD checkup"}</div>
            </div>

            {(() => {
              const appDate = selectedApp.scheduled_start?.slice(0, 10);
              const isToday = appDate === today;
              if (isToday) {
                return (
                  <div className="flex justify-end pt-2">
                    <button 
                      disabled={checkingIn}
                      onClick={() => handleDirectCheckin(selectedApp)}
                      className="btn g w-full md:w-auto px-6 py-2 flex items-center justify-center gap-2"
                    >
                      {checkingIn ? (
                        <>Checking in...</>
                      ) : (
                        <>
                          Complete Check-In <CheckCircle2 size={16} />
                        </>
                      )}
                    </button>
                  </div>
                );
              } else {
                return (
                  <div className="p-3 bg-sky-600/5 border border-sky-600/20 text-sky-700 rounded-xl text-xs flex gap-2.5 items-start mt-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-sky-700" />
                    <div>
                      <span className="font-bold block mb-0.5">Check-In Offline</span>
                      You can complete your check-in on the day of your visit: <span className="font-semibold text-[var(--ink)]">{new Date(selectedApp.scheduled_start).toLocaleDateString()}</span>.
                    </div>
                  </div>
                );
              }
            })()}
          </Card>
        )}

        {/* Remote E-Consultation Review State */}
        {showEncounterId && encDetails && encDetails.visit_type === "E_CONSULT" && encDetails.status !== "DISCHARGED" && (
          <Card 
            className="space-y-4 animate-in fade-in duration-300 relative overflow-hidden"
            style={{ 
              background: "linear-gradient(135deg, rgba(0,120,212,0.06), rgba(0,69,120,0.06))",
              borderColor: "rgba(0,120,212,0.25)" 
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--glass-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(0,120,212,0.12)" }}>
                  <MapPin size={18} className="text-[var(--cyan)]" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">Remote consultation</span>
                  <h3 className="text-lg font-extrabold text-[var(--ink)]">E-Consultation Review</h3>
                </div>
              </div>
              <div className="flex gap-2">
                <Tag tone="blue">Queue Active</Tag>
              </div>
            </div>

            <div className="p-3.5 bg-sky-600/10 border border-sky-600/20 text-sky-700 rounded-xl text-xs flex gap-2.5 items-start">
              <CheckCircle2 size={18} className="shrink-0 text-sky-700 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5 text-[var(--ink)]">Reports Sent to Doctor!</span>
                Your lab results and vitals have been successfully sent to the doctor. The doctor will review your reports shortly and update your consultation advice.
              </div>
            </div>

            {/* Token Badge */}
            <div 
              className="token-highlight relative flex flex-col items-center justify-center space-y-2 overflow-hidden rounded-2xl border p-3.5 text-center shadow-md max-w-sm mx-auto w-full"
              style={{ 
                background: "rgba(0,120,212,0.03)",
                borderColor: "rgba(0,120,212,0.2)" 
              }}
            >
              <div className="rounded-full border border-sky-500/20 bg-sky-500/5 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--cyan)]">
                E-Consultation Token
              </div>
              <div className="text-4xl font-black tracking-wider text-[var(--ink)] drop-shadow-[0_0_12px_rgba(0,120,212,0.6)]">
                {encDetails.token?.number || "E-PENDING"}
              </div>
              
              <div className="text-xs space-y-1">
                <div className="text-[var(--muted)] font-bold flex items-center justify-center gap-1">
                  <MapPin size={12} className="text-[var(--cyan)]" /> Tele-Consult / Online Review
                </div>
                <div className="text-[10px] text-sky-700/80 bg-[rgba(0,120,212,0.08)] px-2 py-0.5 rounded-full border border-sky-600/20 mt-2 inline-block">
                  Waiting for doctor review...
                </div>
              </div>
            </div>

            {/* Visit Summary info */}
            <div className="space-y-2 text-xs border-t border-[var(--line)] pt-3">
              <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5 pb-1 mb-1">
                <Clipboard size={14} className="text-[var(--cyan)]" /> E-Consult Details
              </div>
              <div className="kv"><span>Consulting Doctor</span><b>{encDetails.appointment?.doctor?.name || parentEncDetails?.appointment?.doctor?.name || parentEncDetails?.triage?.recommended_doctor?.name || "Assigned Doctor"}</b></div>
              <div className="kv"><span>Department</span><b>{encDetails.department || parentEncDetails?.department || "General Medicine"}</b></div>
              <div className="kv"><span>Status</span><b className="text-sky-700">Under Doctor Review</b></div>
            </div>
          </Card>
        )}

        {showEncounterId && encDetails && encDetails.visit_type === "E_CONSULT" && encDetails.status !== "DISCHARGED" && (
          <VitalsAndLabs 
            latestVitals={encDetails.vitals} 
            orders={encDetails.labs || []} 
          />
        )}

        {/* State 2: Checked in but not triaged (stage === 0) */}
        {showEncounterId && stage === 0 && encDetails && encDetails.visit_type !== "E_CONSULT" && !currentEpisode?.followups?.some((f: any) => f.visit_type === "E_CONSULT" && f.status !== "DISCHARGED") && (
          <Card className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--glass-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(0,120,212,0.12)" }}>
                  <Clipboard size={18} className="text-[var(--cyan)]" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">Encounter Overview</span>
                  <h3 className="text-lg font-extrabold text-[var(--ink)]">Active Visit</h3>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleDownloadInvoice(encDetails, true)}
                  className="btn ghost sm text-xs flex items-center gap-1.5"
                >
                  <Download size={14} /> Invoice
                </button>
                <Tag tone="green">Checked In</Tag>
              </div>
            </div>

            {/* Check-in Complete Alert */}
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 text-emerald-700 rounded-xl text-xs flex gap-2.5 items-start">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-700" />
              <div>
                <span className="font-bold block mb-0.5">Check-in Complete!</span>
                {encDetails.visit_type === "E_CONSULT" 
                  ? "Your check-in is complete. Your e-consultation is queued for doctor review."
                  : "Your check-in is complete. You have been placed in the triage queue."}
              </div>
            </div>

            {(() => {
              const isLab = encDetails.visit_type === "LAB" || encDetails.department === "Laboratory";
              const isEconsult = encDetails.visit_type === "E_CONSULT";

              if (isLab) {
                const labTokenNum = encDetails.token?.number || "L-PENDING";
                const patientsAhead = Math.floor((encDetails.token?.eta_minutes || 0) / 5);
                const estWaitMins = patientsAhead * 5;
                const bookedTime = encDetails.appointment?.scheduled_start 
                  ? timeLabel(encDetails.appointment.scheduled_start)
                  : "";
                
                return (
                  <div 
                    className="token-highlight relative flex flex-col items-center justify-center space-y-2 overflow-hidden rounded-2xl border p-3.5 text-center shadow-md max-w-sm mx-auto w-full"
                    style={{ 
                      background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(0,120,212,0.06))",
                      borderColor: "rgba(16,185,129,0.25)" 
                    }}
                  >
                    <div className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--mint)]">
                      Laboratory Queue Token
                    </div>
                    <div className="text-4xl font-black tracking-wider text-[var(--ink)] drop-shadow-[0_0_12px_rgba(16,185,129,0.6)]">
                      {labTokenNum}
                    </div>
                    
                    <div className="text-xs space-y-1">
                      <div className="text-[var(--muted)] font-bold flex items-center justify-center gap-1">
                        <MapPin size={12} className="text-emerald-700" /> Lab Room 1 (Ground Floor)
                      </div>
                      {bookedTime && (
                        <div className="text-xs text-[var(--dim)] font-semibold mt-1">
                          Booked Slot Time: <span className="text-[var(--ink)]">{bookedTime}</span>
                        </div>
                      )}
                      <div className="text-[11px] text-[var(--dim)] mt-1">
                        Patients ahead in queue: <span className="font-semibold text-[var(--ink)]">{patientsAhead}</span>
                      </div>
                      <div className="text-[11px] text-[var(--dim)]">
                        Estimated wait time: <span className="font-semibold text-emerald-700">{estWaitMins} mins</span> <span className="text-[10px] text-[var(--muted)]">(5m per patient)</span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (isEconsult) {
                const tokenNum = encDetails.token?.number || "E-PENDING";
                return (
                  <div 
                    className="token-highlight relative flex flex-col items-center justify-center space-y-2 overflow-hidden rounded-2xl border p-3.5 text-center shadow-md max-w-sm mx-auto w-full"
                    style={{ 
                      background: "linear-gradient(135deg, rgba(0,120,212,0.06), rgba(0,69,120,0.06))",
                      borderColor: "rgba(0,120,212,0.25)" 
                    }}
                  >
                    <div className="rounded-full border border-sky-500/20 bg-sky-500/5 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--cyan)]">
                      E-Consultation Token
                    </div>
                    <div className="text-4xl font-black tracking-wider text-[var(--ink)] drop-shadow-[0_0_12px_rgba(0,120,212,0.6)]">
                      {tokenNum}
                    </div>
                    
                    <div className="text-xs space-y-1">
                      <div className="text-[var(--muted)] font-bold flex items-center justify-center gap-1">
                        <MapPin size={12} className="text-[var(--cyan)]" /> Tele-Consult / Online Review
                      </div>
                      <div className="text-[10px] text-sky-700/80 bg-[rgba(0,120,212,0.08)] px-2 py-0.5 rounded-full border border-sky-600/20 mt-2 inline-block">
                        Waiting for doctor review...
                      </div>
                    </div>
                  </div>
                );
              }

              // Standard Triage Token Card
              const triageStaff = triageStaffList?.find((s: any) => s.role === "NURSE" && s.department === "Triage" && s.available);
              const triageRoom = triageStaff?.room || "Triage Room 1";
              const triageFloor = triageStaff?.floor || "Ground Floor";
              
              // The encounter token is the authoritative queue assignment. The
              // triage queue endpoint returns a plain encounter array and must
              // never be used to manufacture a second token number.
              const triageTokenNum = encDetails.token?.number || "Token pending";
              const tokenRoom = encDetails.token?.room || triageRoom;
              const tokenFloor = encDetails.token?.floor || triageFloor;
              const patientsAhead = encDetails.token?.patients_ahead ?? 0;
              const estWaitMins = encDetails.token?.eta_minutes ?? patientsAhead * 5;

              return (
                <div 
                  className="token-highlight relative flex flex-col items-center justify-center space-y-2 overflow-hidden rounded-2xl border p-3.5 text-center shadow-md max-w-sm mx-auto w-full"
                  style={{ 
                    background: "linear-gradient(135deg, rgba(0,120,212,0.06), rgba(0,69,120,0.06))",
                    borderColor: "rgba(0,120,212,0.25)" 
                  }}
                >
                  <div className="rounded-full border border-sky-500/20 bg-sky-500/5 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--cyan)]">
                    Triage Queue Token
                  </div>
                  <div className="text-4xl font-black tracking-wider text-[var(--ink)] drop-shadow-[0_0_12px_rgba(0,120,212,0.6)]">
                    {triageTokenNum}
                  </div>
                  
                  <div className="text-xs space-y-1">
                    <div className="text-[var(--muted)] font-bold flex items-center justify-center gap-1">
                      <MapPin size={12} className="text-[var(--cyan)]" /> {tokenRoom} ({tokenFloor})
                    </div>
                    <div className="text-[11px] text-[var(--dim)] mt-1">
                      Patients ahead: <span className="font-semibold text-[var(--ink)]">{patientsAhead}</span>
                    </div>
                    {patientsAhead > 0 && (
                      <div className="text-[11px] text-[var(--dim)]">
                        Estimated wait time: <span className="font-semibold text-emerald-700">{estWaitMins} mins</span>
                      </div>
                    )}
                    <div className="mt-3 text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-left leading-relaxed">
                      👉 <b>Next Step:</b> Please proceed to <b>{tokenRoom} ({tokenFloor})</b> for your triage and vitals collection.
                      <div className="mt-1 text-[10px] text-slate-300">
                        ℹ️ Note: Your Doctor Consultation token will be generated automatically after your vitals are collected.
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Brief Appointment Details */}
            <div className="p-3 rounded-xl border bg-[rgba(20,33,61,0.04)] space-y-2 text-xs" style={{ borderColor: "var(--glass-border)" }}>
              <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5 border-b border-[var(--line)] pb-1 mb-1">
                <Clipboard size={14} className={encDetails.visit_type === "LAB" || encDetails.department === "Laboratory" ? "text-emerald-700" : "text-[var(--cyan)]"} /> {encDetails.visit_type === "LAB" || encDetails.department === "Laboratory" ? "Lab Visit Summary" : "Visit Summary"}
              </div>
              {encDetails.visit_type === "LAB" || encDetails.department === "Laboratory" ? (
                <>
                  <div className="kv"><span>Department</span><b>Clinical Laboratory</b></div>
                  <div className="kv"><span>Location</span><b>Lab Room 1 / Ground Floor</b></div>
                  <div className="kv"><span>Services</span><b>Sample Collection & Diagnostics</b></div>
                </>
              ) : (
                <>
                  <div className="kv"><span>Doctor</span><b>{encounterAppointment?.doctor?.name || encDetails.triage?.recommended_doctor?.name || "Not assigned"}</b></div>
                  <div className="kv"><span>Specialty</span><b>{encounterAppointment?.specialty || encDetails.triage?.specialty || encDetails.department || "Not recorded"}</b></div>
                  <div className="kv">
                    <span>Room / Floor</span>
                    <b>{[
                      encounterAppointment?.doctor?.room || encDetails.triage?.recommended_doctor?.room,
                      encounterAppointment?.doctor?.floor || encDetails.triage?.recommended_doctor?.floor,
                    ].filter(Boolean).join(" / ") || "Not assigned"}</b>
                  </div>
                  <div className="kv"><span>Time Slot</span><b>{encounterAppointment?.scheduled_start ? timeLabel(encounterAppointment.scheduled_start) : timeLabel(encDetails.arrival)}</b></div>
                  <div className="kv"><span>Chief Complaint / Reason for Visit</span><b>{encDetails.triage?.chief_complaint || encounterAppointment?.reason || encDetails.reason || "Not provided"}</b></div>
                </>
              )}
            </div>
          </Card>
        )}

        {showEncounterId && stage === 1 && encDetails && encDetails.visit_type !== "E_CONSULT" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--glass-border)] pb-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(0,120,212,0.12)" }}>
                    <Clipboard size={18} className="text-[var(--cyan)]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">Encounter Overview</span>
                    <h3 className="text-lg font-extrabold text-[var(--ink)]">Active Visit</h3>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleDownloadInvoice(encDetails, true)}
                    className="btn ghost sm text-xs flex items-center gap-1.5"
                  >
                    <Download size={14} /> Invoice
                  </button>
                  <Tag tone="blue">Triaged</Tag>
                </div>
              </div>

              {/* Triage Complete status */}
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 text-emerald-700 rounded-xl text-xs flex gap-2.5 items-start">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-700" />
                <div>
                  <span className="font-bold block mb-0.5">Triage Complete!</span>
                  Vitals and symptoms recorded. Your queue token has been generated.
                </div>
              </div>

              {/* Token Card */}
              {encDetails.token ? (
                <div 
                  className="token-highlight relative flex flex-col items-center justify-center space-y-3 overflow-hidden rounded-2xl border-2 p-5 text-center shadow-lg sm:p-7"
                  style={{ 
                    background: "linear-gradient(135deg, rgba(0,120,212,0.1), rgba(0,69,120,0.1))",
                    borderColor: "rgba(0,120,212,0.3)" 
                  }}
                >
                  <div className="absolute top-0 right-0 p-2 opacity-5">
                    <Ticket size={120} />
                  </div>
                  
                  <div className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--cyan)]">Your Queue Token</div>
                  <div className="text-5xl font-black tracking-wider text-[var(--ink)] drop-shadow-[0_0_16px_rgba(0,120,212,0.8)] sm:text-6xl">
                    {encDetails.token.number}
                  </div>
                  
                  <div className="text-xs space-y-1.5">
                    <div className="text-[var(--muted)] font-bold flex items-center justify-center gap-1">
                      <MapPin size={13} className="text-[var(--cyan)]" /> {[encDetails.token.room, encDetails.token.floor].filter(Boolean).join(" · ") || "Location not assigned"}
                    </div>
                    <div className="text-[11px] text-[var(--dim)]">
                      Estimated wait time: <span className="font-semibold text-[var(--ink)]">{encDetails.token.eta_minutes != null ? `${encDetails.token.eta_minutes} mins` : "Not available"}</span>
                    </div>
                  </div>
                  
                  <div className="text-[10px] font-semibold text-sky-700/80 bg-[rgba(0,120,212,0.08)] px-2.5 py-0.5 rounded-full border border-sky-600/20 mt-1 animate-pulse">
                    Waiting for doctor call...
                  </div>
                </div>
              ) : (
                <div className="holo text-center text-xs">Waiting for token generation...</div>
              )}

              {/* Brief Appointment Details */}
              <div className="p-3 rounded-xl border bg-[rgba(20,33,61,0.04)] space-y-2 text-xs" style={{ borderColor: "var(--glass-border)" }}>
                <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5 border-b border-[var(--line)] pb-1 mb-1">
                  <Clipboard size={14} className="text-[var(--cyan)]" /> Visit Summary
                </div>
                <div className="kv"><span>Assigned Doctor</span><b>{encDetails.triage?.recommended_doctor?.name || encDetails.appointment?.doctor?.name || "Not assigned"}</b></div>
                <div className="kv"><span>Specialty</span><b>{encDetails.triage?.specialty || encDetails.appointment?.specialty || encDetails.department || "Not recorded"}</b></div>
                <div className="kv"><span>Room / Floor</span><b>{[
                  encDetails.token?.room || encDetails.triage?.recommended_doctor?.room || encDetails.appointment?.doctor?.room,
                  encDetails.token?.floor || encDetails.triage?.recommended_doctor?.floor || encDetails.appointment?.doctor?.floor,
                ].filter(Boolean).join(" / ") || "Not assigned"}</b></div>
                <div className="kv"><span>Time Slot</span><b>{encDetails.appointment?.scheduled_start ? timeLabel(encDetails.appointment.scheduled_start) : "Not recorded"}</b></div>
                <div className="kv"><span>Acuity Level</span><b>{encDetails.triage?.acuity || "Not recorded"}</b></div>
                <div className="kv"><span>Chief Complaint / Reason for Visit</span><b>{encDetails.triage?.chief_complaint || encDetails.appointment?.reason || "Not recorded"}</b></div>
              </div>
            </Card>

            <VitalsAndLabs
              latestVitals={encDetails.vitals}
              orders={encDetails.labs || []}
            />
          </div>
        )}

        {showEncounterId && stage >= 2 && encDetails && (encDetails.visit_type !== "E_CONSULT" || encDetails.status === "DISCHARGED") && (
          <>
            {currentEpisode && (
              <Card 
                className="p-4 space-y-4 border-sky-600/20 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300"
                style={{ 
                  background: "linear-gradient(135deg, rgba(0,120,212,0.04), rgba(0,69,120,0.04))",
                  borderColor: "rgba(255,255,255,0.05)"
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-2.5">
                  <h4 className="font-extrabold text-[12px] text-white uppercase tracking-wider flex items-center gap-1.5">
                    ✨ Unified Care Episode Timeline
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-[10px] text-[var(--dim)] font-medium sm:inline">Episode Date: {currentEpisode.date}</span>
                    <div className="flex rounded-lg border border-white/10 bg-white/[0.02] p-1">
                      <button
                        type="button"
                        onClick={() => setEpisodeTimelineTab("care")}
                        className={`rounded-lg px-4 py-2 text-xs font-bold transition sm:px-5 ${episodeTimelineTab === "care" ? "bg-white/10 text-white" : "text-[var(--muted)]"}`}
                      >
                        Care Timeline
                      </button>
                      <button
                        type="button"
                        onClick={() => setEpisodeTimelineTab("billing")}
                        className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition sm:px-5 ${episodeTimelineTab === "billing" ? "bg-white/10 text-white" : "text-[var(--muted)]"}`}
                      >
                        <Receipt size={14} /> Billing Details
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className={`${episodeTimelineTab === "care" ? "flex" : "hidden"} relative flex-col md:flex-row md:items-start gap-6 md:gap-4 pl-4 md:pl-0 pt-2 pb-1`}>
                  {/* Step 1: Doctor Consult */}
                  <div className="flex-1 relative flex gap-3.5 items-start">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-emerald-500 text-white shrink-0 mt-0.5 border-4 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                      ✓
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-bold text-white text-[12px]">1. Doctor Consultation</div>
                      <div className="text-[10.5px] text-[var(--muted)]">
                        {currentEpisode.department} · {currentEpisode.status === "DISCHARGED" ? "Discharged" : "Completed"}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Lab Diagnostics */}
                  {(() => {
                    const labOrders = parentEncDetails?.labs || encDetails?.labs || labDetails?.orders || [];
                    const hasLabs = labOrders.length > 0;
                    if (!hasLabs) return null;

                    const allResulted = labOrders.every((o: any) => o.status === "RESULTED");
                    const activeLab = currentEpisode.labs?.find((l: any) => l.status !== "DISCHARGED");
                    
                    let statusText = "Pending Lab Booking";
                    let stepColorClass = "bg-slate-700 text-slate-400 border-slate-700/20";
                    let marker = "2";
                    
                    if (allResulted) {
                      statusText = "Results Published";
                      stepColorClass = "bg-emerald-500 text-white border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
                      marker = "✓";
                    } else if (activeLab) {
                      statusText = `Checked-in (${activeLab.token?.number || "L-101"})`;
                      stepColorClass = "bg-sky-600 text-white border-sky-600/20 shadow-[0_0_10px_rgba(0,120,212,0.3)] animate-pulse";
                      marker = "⚡";
                    }

                    return (
                      <div className="flex-1 relative flex gap-3.5 items-start">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${stepColorClass} shrink-0 mt-0.5 border-4`}>
                          {marker}
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-bold text-white text-[12px]">2. Lab Diagnostics</div>
                          <div className="text-[10.5px] text-[var(--muted)]">{statusText}</div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 3: Follow-Up Review */}
                  {(() => {
                    const activeFollowup = currentEpisode.followups?.find((f: any) => f.status !== "DISCHARGED");
                    const completedFollowup = currentEpisode.followups?.find((f: any) => f.status === "DISCHARGED");
                    
                    let statusText = "Review pending";
                    let stepColorClass = "bg-slate-700 text-slate-400 border-slate-700/20";
                    let marker = "3";
                    
                    if (completedFollowup) {
                      statusText = "Re-visit Completed";
                      stepColorClass = "bg-emerald-500 text-white border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
                      marker = "✓";
                    } else if (activeFollowup) {
                      statusText = activeFollowup.visit_type === "E_CONSULT" 
                        ? `E-Consult Active (${activeFollowup.token?.number || "E-501"})`
                        : `Re-visit Active (${activeFollowup.token?.number || "T-101"})`;
                      stepColorClass = "bg-sky-600 text-white border-sky-600/20 shadow-[0_0_10px_rgba(0,120,212,0.3)] animate-pulse";
                      marker = "⚡";
                    }

                    return (
                      <div className="flex-1 relative flex gap-3.5 items-start">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${stepColorClass} shrink-0 mt-0.5 border-4`}>
                          {marker}
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-bold text-white text-[12px]">3. Follow-Up consultation</div>
                          <div className="text-[10.5px] text-[var(--muted)]">{statusText}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {episodeTimelineTab === "billing" && (
                  <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                    {episodeInvoiceLoading ? (
                      <Empty>Loading billing details...</Empty>
                    ) : episodeInvoice ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">Invoice</div>
                            <div className="text-xs font-semibold text-white">{episodeInvoice.invoice_id}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => downloadEpisodeInvoice(episodeInvoice)}
                              className="btn ghost sm flex items-center gap-1.5 text-xs"
                            >
                              <Download size={13} /> Download Invoice
                            </button>
                            <Tag tone={episodeInvoice.status === "PAID" ? "green" : "amber"}>{episodeInvoice.status}</Tag>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-white/5">
                          {episodeInvoice.lines?.length ? episodeInvoice.lines.map((line: any, index: number) => (
                            <div key={`${line.description}-${index}`} className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2 text-xs last:border-b-0">
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-slate-200">{line.description}</div>
                                <div className="text-[10px] text-[var(--dim)]">{line.category} · Qty {line.quantity}</div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Tag tone={line.payment_status === "PAID" ? "green" : line.payment_status === "PARTIAL" ? "amber" : "red"}>
                                  {line.payment_status || "UNPAID"}
                                </Tag>
                                <b className="text-white">₹{Number(line.amount || 0).toFixed(2)}</b>
                              </div>
                            </div>
                          )) : (
                            <div className="px-3 py-4 text-center text-xs text-[var(--dim)]">No billed items recorded for this visit.</div>
                          )}
                        </div>

                        <div className="hidden">
                          <div className="kv"><span>Consultation</span><b>₹{Number(episodeInvoice.consultation_amt || 0).toFixed(2)}</b></div>
                          <div className="kv"><span>Laboratory</span><b>₹{Number(episodeInvoice.lab_amt || 0).toFixed(2)}</b></div>
                          <div className="kv"><span>Pharmacy</span><b>₹{Number(episodeInvoice.pharmacy_amt || 0).toFixed(2)}</b></div>
                          <div className="kv"><span>Tax</span><b>₹{Number(episodeInvoice.tax || 0).toFixed(2)}</b></div>
                        </div>

                        <div className="flex items-center justify-between border-t border-white/10 pt-3">
                          <span className="text-xs font-bold text-slate-300">Total</span>
                          <b className="text-base text-white">₹{Number(episodeInvoice.total || 0).toFixed(2)}</b>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">Unpaid Amount</span>
                          <b className={Number(episodeInvoice.unpaid_amount ?? episodeInvoice.balance ?? 0) > 0 ? "text-amber-400" : "text-emerald-400"}>
                            ₹{Number(episodeInvoice.unpaid_amount ?? episodeInvoice.balance ?? 0).toFixed(2)}
                          </b>
                        </div>
                      </>
                    ) : (
                      <Empty>No billing details are available for this episode.</Empty>
                    )}
                  </div>
                )}
              </Card>
            )}

            <Card className="space-y-2 !p-3 text-xs">
              <div className="mb-1 flex items-center gap-1.5 border-b border-[var(--line)] pb-2 font-semibold text-[var(--ink)]">
                <Clipboard size={14} className="text-[var(--cyan)]" /> Visit Summary
              </div>
              <div className="grid gap-x-5 sm:grid-cols-2">
                <div className="kv !py-1.5"><span>Doctor</span><b>{parentEncDetails?.triage?.recommended_doctor?.name || parentEncDetails?.appointment?.doctor?.name || encDetails.triage?.recommended_doctor?.name || encDetails.appointment?.doctor?.name || "Not assigned"}</b></div>
                <div className="kv !py-1.5"><span>Specialty</span><b>{parentEncDetails?.triage?.specialty || parentEncDetails?.appointment?.specialty || parentEncDetails?.department || encDetails.triage?.specialty || encDetails.appointment?.specialty || encDetails.department || "Not recorded"}</b></div>
                <div className="kv !py-1.5"><span>Room / Floor</span><b>{[
                  parentEncDetails?.token?.room || parentEncDetails?.triage?.recommended_doctor?.room || parentEncDetails?.appointment?.doctor?.room || encDetails.token?.room || encDetails.triage?.recommended_doctor?.room || encDetails.appointment?.doctor?.room,
                  parentEncDetails?.token?.floor || parentEncDetails?.triage?.recommended_doctor?.floor || parentEncDetails?.appointment?.doctor?.floor || encDetails.token?.floor || encDetails.triage?.recommended_doctor?.floor || encDetails.appointment?.doctor?.floor,
                ].filter(Boolean).join(" / ") || "Not assigned"}</b></div>
                <div className="kv !py-1.5"><span>Time Slot</span><b>{parentEncDetails?.appointment?.scheduled_start ? timeLabel(parentEncDetails.appointment.scheduled_start) : encDetails.appointment?.scheduled_start ? timeLabel(encDetails.appointment.scheduled_start) : "Not recorded"}</b></div>
                <div className="kv !py-1.5 sm:col-span-2"><span>Chief Complaint / Reason for Visit</span><b>{parentEncDetails?.triage?.chief_complaint || parentEncDetails?.appointment?.reason || encDetails.triage?.chief_complaint || encDetails.appointment?.reason || "Not recorded"}</b></div>
              </div>
            </Card>

            <LabOrdersAlert
              orders={parentEncDetails?.labs || encDetails.labs || labDetails?.orders || []}
              refetchLab={refetchLab}
              refetchEnc={refetchEnc}
              refetchP360={refetchP360}
              patientId={portalPatientId}
            />

            {/* Prescription Slip for patient health records */}
            {parentEncDetails?.prescription && (
              <PrescriptionSlip 
                encounterId={parentEncounterId!} 
                prescription={parentEncDetails.prescription}
                patientId={portalPatientId}
                refetchEnc={refetchEnc}
                refetchP360={refetchP360}
              />
            )}

            {(() => {
              const fUp = currentEpisode?.followups?.find((f: any) => f.prescription);
              if (!fUp) return null;
              
              return (
                <PrescriptionSlip 
                  encounterId={fUp.encounter_id} 
                  prescription={fUp.prescription}
                  title="📋 Follow-Up Prescription Slip"
                  patientId={portalPatientId}
                  refetchEnc={refetchEnc}
                  refetchP360={refetchP360}
                />
              );
            })()}

            {isLabVisit && encDetails.token?.number && (
              <Card
                className="relative overflow-hidden border-emerald-500/25 bg-emerald-500/[0.06] text-center"
              >
                <div className="absolute right-0 top-0 p-2 opacity-5">
                  <Ticket size={100} />
                </div>
                <div className="relative flex flex-col items-center gap-2">
                  <div className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">
                    Laboratory Queue Token
                  </div>
                  <div className="text-5xl font-black tracking-wider text-[var(--ink)] drop-shadow-[0_0_14px_rgba(16,185,129,0.65)]">
                    {encDetails.token.number}
                  </div>
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-[var(--muted)]">
                    <MapPin size={13} className="text-emerald-700" />
                    {[encDetails.token.room, encDetails.token.floor].filter(Boolean).join(" / ") || "Laboratory location pending"}
                  </div>
                  {encDetails.token.eta_minutes != null && (
                    <div className="text-[11px] text-[var(--muted)]">
                      Estimated wait: <span className="font-semibold text-emerald-700">{encDetails.token.eta_minutes} minutes</span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Follow-up Care Portal */}
            {parentEncDetails?.status === "DISCHARGED" && parentEncDetails?.visit_type !== "REVISIT" && parentEncDetails?.visit_type !== "E_CONSULT" && (
              <Card 
                className="space-y-3.5 relative overflow-hidden"
                style={{ 
                  background: "linear-gradient(135deg, rgba(0,120,212,0.08), rgba(0,69,120,0.08))", 
                  borderColor: "rgba(0,120,212,0.2)" 
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-sky-700">Follow-up Care Portal</span>
                    <h3 className="text-sm font-black text-[var(--ink)] mt-0.5">Post-Consultation &amp; Lab Review</h3>
                  </div>
                  <Tag tone="green">Ready for Review</Tag>
                </div>

                {(() => {
                  const labOrders = parentEncDetails?.labs || encDetails.labs || labDetails?.orders || [];
                  const hasLabs = labOrders.length > 0;
                  const allResulted = hasLabs && labOrders.every((o: any) => o.status === "RESULTED");
                  
                  const docId = currentEpisode?.doctor_id || parentEncDetails?.doctor_id || encDetails.doctor_id;
                  const docName = currentEpisode?.doctor_name || parentEncDetails?.appointment?.doctor?.name || encDetails?.appointment?.doctor?.name || "the doctor";

                  // Check for active follow-up consultations, completed follow-up, or active lab check-ins in the current episode
                  const activeLab = currentEpisode?.labs?.find((l: any) => l.status !== "DISCHARGED" && (!hasLabs || !allResulted));
                  const activeFollowup = currentEpisode?.followups?.find((f: any) => f.status !== "DISCHARGED");
                  const completedFollowup = currentEpisode?.followups?.find((f: any) => f.status === "DISCHARGED");
                  const bookedRevisit = appointments.find((appointment: any) =>
                    appointment.appointment_type === "REVISIT" &&
                    appointment.reason?.includes(parentEncounterId)
                  );

                  if (completedFollowup) {
                    return (
                      <div className="p-3 text-xs bg-emerald-500/10 border-emerald-500/20 text-emerald-700 rounded-xl border flex gap-2">
                        <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <strong>Follow-up Completed:</strong> Your follow-up consultation is completed. Prescribed medications and doctor advice are updated below.
                        </div>
                      </div>
                    );
                  }

                  if (activeFollowup) {
                    return (
                      <div className="p-3 text-xs bg-sky-600/10 border-sky-600/20 text-sky-700 rounded-xl border flex gap-2">
                        <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <strong>Follow-up Consultation Active:</strong> You are currently in the doctor's queue for report review. Token: <strong>{activeFollowup.token?.number}</strong>.
                        </div>
                      </div>
                    );
                  }

                  if (bookedRevisit) {
                    return (
                      <div className="space-y-3 rounded-xl border border-sky-600/20 bg-sky-600/5 p-3 text-xs">
                        <div className="flex gap-2 text-sky-700">
                          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                          <div>
                            <strong className="block text-[var(--ink)]">Follow-up appointment booked</strong>
                            {new Date(bookedRevisit.scheduled_start).toLocaleDateString()} at {timeLabel(bookedRevisit.scheduled_start)} with {bookedRevisit.doctor?.name || "the consulting doctor"}.
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn w-full justify-center sm:w-auto"
                          onClick={() => {
                            setSelectedAppointmentId(bookedRevisit.appointment_id);
                            setSelectedEncounterId(null);
                            setShowMobileVisitList(false);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          View Appointment
                        </button>
                      </div>
                    );
                  }

                  if (activeLab) {
                    return (
                      <div className="p-3 text-xs bg-sky-600/10 border-sky-600/20 text-sky-700 rounded-xl border flex gap-2">
                        <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <strong>Lab Check-in Active:</strong> Please complete your sample collection at the clinical lab. Token: <strong>{activeLab.token?.number}</strong>.
                        </div>
                      </div>
                    );
                  }

                  if (econsultSuccessMsg) {
                    return (
                      <div className="p-3 text-xs bg-sky-600/10 border-sky-600/20 text-sky-700 rounded-xl border flex gap-2">
                        <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                        <div>{econsultSuccessMsg}</div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3 text-xs">
                      {allResulted ? (
                        <>
                          <p className="text-[var(--dim)] leading-relaxed">
                            All prescribed lab tests are completed. You can choose to consult the doctor in-person or request a remote review:
                          </p>
                          <div className="p-2 bg-[rgba(20,33,61,0.04)] border border-[var(--line)] rounded-xl mb-1 text-[11px] text-[var(--muted)]">
                            Consulting Doctor: <strong className="text-[var(--ink)]">{docName}</strong> (General Medicine)
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button 
                              onClick={() => {
                                setRevisitDate("");
                                setRevisitSlot("");
                                setUploadedDocUri(null);
                                setUploadedDocName(null);
                                setRevisitSuccessMsg("");
                                setRevisitError("");
                                setShowRevisitModal(true);
                              }}
                              className="btn sm"
                              style={{ background: "linear-gradient(135deg, var(--cyan), #004578)", color: "white", border: "none" }}
                            >
                              🏥 Book In-Person Re-Visit
                            </button>
                            <button 
                              onClick={() => handleRequestEconsult(docId)}
                              disabled={requestingEconsult}
                              className="btn outline sm flex items-center gap-1.5"
                              style={{ borderColor: "rgba(0,120,212,0.3)", color: "var(--cyan)" }}
                            >
                              💬 Request E-Consultation (Remote Review)
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-[var(--dim)] leading-relaxed">
                            If you have performed your lab tests externally, please upload your reports to schedule your follow-up re-visit:
                          </p>
                          <div className="p-2 bg-[rgba(20,33,61,0.04)] border border-[var(--line)] rounded-xl mb-1 text-[11px] text-[var(--muted)]">
                            Consulting Doctor: <strong className="text-[var(--ink)]">{docName}</strong> (General Medicine)
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button 
                              onClick={() => {
                                setRevisitDate("");
                                setRevisitSlot("");
                                setUploadedDocUri(null);
                                setUploadedDocName(null);
                                setRevisitSuccessMsg("");
                                setRevisitError("");
                                setShowRevisitModal(true);
                              }}
                              className="btn sm"
                              style={{ background: "linear-gradient(135deg, var(--cyan), #004578)", color: "white", border: "none" }}
                            >
                              📂 Upload Reports &amp; Book Re-Visit
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </Card>
            )}

            <div className="grid gap-4">
              <VitalsAndLabs 
                latestVitals={parentEncDetails?.vitals || encDetails.vitals} 
                orders={parentEncDetails?.labs || encDetails.labs || labDetails?.orders || []} 
              />

              <ConsultationSummary 
                encounterId={parentEncounterId!}
                triage={parentEncDetails?.triage || encDetails.triage} 
                appointment={parentEncDetails?.appointment || encDetails.appointment}
                notes={parentEncDetails?.notes || encDetails.notes}
                note={parentEncDetails?.note || encDetails.note}
              />
            </div>
          </>
        )}

        {/* Default empty state if no selection */}
        {!showAppointmentId && !showEncounterId && (
          <Card className="text-center py-14">
            <div
              className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl"
              style={{ background: "linear-gradient(150deg,rgba(0,120,212,0.12),rgba(0,69,120,0.12))" }}
            >
              <Clipboard size={26} className="text-[var(--cyan)]" />
            </div>
            <h3 className="font-extrabold text-lg text-[var(--ink)]">Select a Visit Record</h3>
            <p className="text-xs max-w-sm mx-auto mt-1.5 text-[var(--muted)]">
              Choose one of your consultation visits or appointments from the list on the left to review details, triage status, queue position, vitals, and notes.
            </p>
          </Card>
        )}

        {/* Re-visit Slot Booking Modal */}
        {showRevisitModal && encDetails && (
          <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="revisit-booking-modal w-full max-w-md space-y-4 relative overflow-hidden animate-in zoom-in-95 duration-200 text-xs">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                <h3 className="text-base font-extrabold text-[var(--ink)] flex items-center gap-2">
                  🏥 Book Free Re-visit
                </h3>
                <button 
                  onClick={() => setShowRevisitModal(false)}
                  className="revisit-booking-modal__close font-extrabold text-xl"
                  aria-label="Close re-visit booking"
                >
                  ×
                </button>
              </div>

              {revisitSuccessMsg ? (
                <div className="space-y-4 py-2">
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 text-emerald-700 rounded-xl flex gap-2">
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                    <div className="leading-relaxed">{revisitSuccessMsg}</div>
                  </div>
                  <button 
                    onClick={() => setShowRevisitModal(false)}
                    className="btn w-full font-bold"
                    style={{ background: "var(--panel)", borderColor: "var(--glass-border)", color: "var(--ink)" }}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5 text-[12.5px]">
                  {revisitError && (
                    <div className="p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-700 text-center">
                      {revisitError}
                    </div>
                  )}

                  {/* Doctor Info */}
                  <div className="revisit-booking-modal__doctor p-2 border rounded-xl text-[11px]">
                    Re-visit Doctor: <strong className="text-[var(--ink)]">{currentEpisode?.doctor_name || parentEncDetails?.appointment?.doctor?.name || encDetails?.appointment?.doctor?.name || "Consulting Doctor"}</strong> (General Medicine)
                  </div>

                  {/* Document upload field (Required if NOT all results completed in-house) */}
                  {(() => {
                    const labOrders = parentEncDetails?.labs || encDetails.labs || labDetails?.orders || [];
                    const hasLabs = labOrders.length > 0;
                    const allResulted = hasLabs && labOrders.every((o: any) => o.status === "RESULTED");
                    
                    if (allResulted) return null;

                    return (
                      <div className="space-y-1.5 border-b border-[var(--line)] pb-3.5">
                        <label className="block font-bold text-[var(--muted)]">Upload External Lab Reports (PDF or Image)</label>
                        <div className="flex gap-2">
                          <input 
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleReportUpload(file);
                            }}
                            className="hidden"
                            id="revisit-report-upload"
                            disabled={uploadingReport}
                          />
                          <label 
                            htmlFor="revisit-report-upload"
                            className="btn outline sm cursor-pointer flex items-center justify-center gap-1 w-full"
                            style={{ 
                              borderColor: uploadedDocUri ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)", 
                              color: uploadedDocUri ? "#34d399" : "var(--dim)" 
                            }}
                          >
                            {uploadingReport ? "Uploading..." : uploadedDocUri ? "✓ Report Attached" : "📁 Choose File"}
                          </label>
                        </div>
                        {uploadedDocName && (
                          <div className="text-[10px] text-[var(--muted)] italic truncate">
                            File: {uploadedDocName}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Date Picker */}
                  <div className="space-y-1">
                    <label className="revisit-booking-modal__label block font-bold">Select Date</label>
                    <input 
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={revisitDate}
                      onChange={(e) => {
                        setRevisitDate(e.target.value);
                        setRevisitSlot("");
                      }}
                      className="revisit-booking-modal__date input w-full"
                    />
                  </div>

                  {/* Time Slot Picker */}
                  {revisitDate && (
                    <div className="space-y-1.5">
                      <label className="revisit-booking-modal__label block font-bold">Select Time Slot</label>
                      <div className="grid grid-cols-3 gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {[
                          "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", 
                          "11:00 AM", "11:30 AM", "02:00 PM", "02:30 PM", 
                          "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"
                        ].map((s) => {
                          const isSelected = revisitSlot === s;
                          return (
                            <button
                              key={s}
                              onClick={() => setRevisitSlot(s)}
                              className={`revisit-booking-modal__slot p-1.5 border rounded-lg text-center font-semibold transition ${isSelected ? "revisit-booking-modal__slot--selected" : ""}`}
                              style={{
                                borderColor: isSelected ? "var(--cyan)" : "var(--line2)",
                              }}
                            >
                               {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Booking action */}
                  <button
                    onClick={() => {
                      const docId = currentEpisode?.doctor_id || parentEncDetails?.doctor_id || encDetails?.doctor_id;
                      handleBookRevisit(docId!);
                    }}
                    disabled={bookingRevisit || uploadingReport || !revisitDate || !revisitSlot || (uploadedDocUri === null && !(encDetails?.labs?.length > 0 && encDetails.labs.every((o: any) => o.status === "RESULTED")))}
                    className="revisit-booking-modal__confirm btn w-full font-bold py-2 mt-2"
                  >
                    {bookingRevisit ? "Booking..." : "Confirm Free Re-visit"}
                  </button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Patient Profile Details Modal */}
      {showProfileModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md space-y-4 rounded-3xl border border-sky-600/30 p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            style={{ background: "linear-gradient(135deg, #0d3c66, #062038)" }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <UserRound size={20} className="text-[var(--cyan)]" />
                <h3 className="font-extrabold text-lg text-white">Patient Profile Details</h3>
              </div>
              <button 
                onClick={() => setShowProfileModal(false)}
                className="btn ghost sm text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex rounded-lg border border-white/10 bg-white/[0.02] p-1">
              <button
                type="button"
                onClick={() => setProfileModalTab("info")}
                className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-bold transition ${profileModalTab === "info" ? "bg-white/10 text-white" : "text-[var(--muted)]"}`}
              >
                Profile Info
              </button>
              <button
                type="button"
                onClick={() => setProfileModalTab("history")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold transition ${profileModalTab === "history" ? "bg-white/10 text-white" : "text-[var(--muted)]"}`}
              >
                <Ticket size={12} /> Token &amp; Billing
              </button>
            </div>

            {profileModalTab === "info" && (
            <>
            <div className="flex items-center gap-4 bg-sky-600/5 border border-sky-600/10 p-3.5 rounded-2xl">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-sky-500/20 bg-white/5">
                {(p360?.patient?.profile_photo || portalSession.profile_photo)
                  ? <img className="h-full w-full object-cover" src={p360?.patient?.profile_photo || portalSession.profile_photo} alt={`${portalPatientName} profile`} />
                  : <UserRound size={32} className="text-[var(--cyan)]" />}
              </div>
              <div>
                <h4 className="font-black text-lg text-white">{p360?.patient?.name || portalPatientName}</h4>
                <div className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-950/80 text-sky-400 border border-sky-600/30">
                  {p360?.patient?.mrn || portalSession?.mrn || "MRN Pending"}
                </div>
              </div>
            </div>

            <div>
              <input
                id="patient-profile-photo-modal"
                className="hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={photoUploading}
                onChange={(event) => {
                  void handlePhotoUpload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <div className="flex gap-2">
                <label htmlFor="patient-profile-photo-modal" className="btn ghost flex flex-1 cursor-pointer items-center justify-center gap-1.5 text-xs !py-1.5">
                  <Camera size={14} /> {photoUploading ? "Updating..." : "Upload profile photo"}
                </label>
                {(p360?.patient?.profile_photo || portalSession.profile_photo) && (
                  <button type="button" onClick={handlePhotoDelete} disabled={photoUploading}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-400 transition hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-50"
                    aria-label="Delete profile photo" title="Delete profile photo">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {photoError && <div className="mt-2 text-xs text-rose-300">{photoError}</div>}
              <div className="mt-2 text-center text-[10px] text-[var(--dim)]">JPEG, PNG or WebP · Maximum 2 MB</div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span className="text-[var(--dim)]">Medical Record Number (MRN)</span>
                <span className="font-mono font-bold text-sky-400">{p360?.patient?.mrn || portalSession?.mrn || "MRN Pending"}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span className="text-[var(--dim)]">Mobile Number</span>
                <span className="font-bold text-slate-100">{p360?.patient?.mobile || portalSession?.mobile || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span className="text-[var(--dim)]">Date of Birth / Age</span>
                <span className="font-bold text-slate-100">
                  {p360?.patient?.dob || portalSession?.dob || "N/A"}
                  {(() => {
                    const dobStr = p360?.patient?.dob || portalSession?.dob;
                    if (!dobStr) return "";
                    const birthYear = new Date(dobStr).getFullYear();
                    if (isNaN(birthYear)) return "";
                    const age = new Date().getFullYear() - birthYear;
                    return ` (${age} yrs)`;
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span className="text-[var(--dim)]">Gender</span>
                <span className="font-bold text-slate-100">{p360?.patient?.gender || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span className="text-[var(--dim)]">Blood Group</span>
                <span className="font-bold text-sky-500">{p360?.patient?.blood_group || "N/A"}</span>
              </div>
              <div className="py-1.5">
                <span className="text-[var(--dim)] block mb-1">Residential Address</span>
                <span className="font-medium text-slate-200 block bg-slate-900/60 p-2 rounded-xl border border-white/5">{p360?.patient?.address || "12 MG Road, Pune, Maharashtra"}</span>
              </div>
            </div>
            </>
            )}

            {profileModalTab === "history" && (
              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {!historyEpisodes.length && (
                  <div className="holo p-3 text-center text-xs text-[var(--muted)]">No visit history available yet.</div>
                )}
                {historyEpisodes.map((ep: any, idx: number) => {
                  const invoice = historyInvoiceQueries[idx]?.data as any;
                  const invoiceLoading = historyInvoiceQueries[idx]?.isLoading;
                  const subVisits = [...(ep.labs || []), ...(ep.followups || [])];
                  return (
                    <div key={ep.encounter_id} className="space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-white">{ep.date}</div>
                          <div className="text-[10px] text-[var(--dim)]">{ep.department} department</div>
                        </div>
                        <Tag tone={ep.status === "DISCHARGED" ? "green" : "blue"}>{ep.status}</Tag>
                      </div>

                      <div className="space-y-1.5">
                        {ep.token && (
                          <div className="flex items-center justify-between rounded-lg border border-sky-600/10 bg-sky-600/5 px-2.5 py-1.5 text-[11px]">
                            <span className="flex items-center gap-1.5 text-slate-200">
                              <Ticket size={12} className="text-[var(--cyan)]" /> Queue token
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white">{ep.token.number}</span>
                              <Tag tone={["DONE", "SERVED", "COMPLETED"].includes(ep.token.status) ? "green" : "amber"}>{ep.token.status}</Tag>
                            </span>
                          </div>
                        )}
                        {subVisits.map((sv: any) => sv.token && (
                          <div key={sv.encounter_id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-[11px]">
                            <span className="flex items-center gap-1.5 text-slate-300">
                              <Ticket size={12} className="text-emerald-400" /> {sv.department || "Follow-up"} token
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white">{sv.token.number}</span>
                              <Tag tone={["DONE", "SERVED", "COMPLETED"].includes(sv.token.status) ? "green" : "amber"}>{sv.token.status}</Tag>
                            </span>
                          </div>
                        ))}
                        {!ep.token && !subVisits.some((sv: any) => sv.token) && (
                          <div className="text-[10px] text-[var(--dim)]">No queue token recorded for this visit.</div>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[11px]">
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <Receipt size={12} className="text-[var(--cyan)]" /> Billing
                        </span>
                        {invoiceLoading ? (
                          <span className="text-[var(--dim)]">Loading…</span>
                        ) : invoice ? (
                          <span className="flex items-center gap-2">
                            <b className="text-white">₹{Number(invoice.total || 0).toFixed(2)}</b>
                            <Tag tone={invoice.status === "PAID" ? "green" : "amber"}>{invoice.status || "UNPAID"}</Tag>
                          </span>
                        ) : (
                          <span className="text-[var(--dim)]">No invoice yet</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => { handleEpisodeClick(ep); setShowProfileModal(false); }}
                        className="btn ghost sm w-full text-[10px] !py-1"
                      >
                        View full visit details
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => setShowProfileModal(false)}
                className="btn cyan w-full text-xs font-bold py-2"
              >
                Close Profile Details
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
