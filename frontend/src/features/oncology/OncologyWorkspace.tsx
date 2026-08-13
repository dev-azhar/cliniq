import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Syringe, Users, ScanLine, HeartPulse, Plus } from "lucide-react";
import { api } from "../../lib/api";
import { Card, Empty } from "../../components/ui";

import PatientPicker from "./components/PatientPicker";
import DiagnosisOverview from "./components/DiagnosisOverview";
import ChemoTracker from "./components/ChemoTracker";
import TumorBoardPanel from "./components/TumorBoardPanel";
import ReportsPanel from "./components/ReportsPanel";
import SurvivorshipPanel from "./components/SurvivorshipPanel";
import RegisterDiagnosisModal from "./components/RegisterDiagnosisModal";

const TABS = [
  { id: "overview", label: "Diagnosis & Biomarkers", icon: FileText },
  { id: "chemo", label: "Chemotherapy", icon: Syringe },
  { id: "board", label: "Tumor Board", icon: Users },
  { id: "reports", label: "Imaging & Pathology", icon: ScanLine },
  { id: "survivorship", label: "Survivorship", icon: HeartPulse },
] as const;

export default function OncologyWorkspace() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const { data: patients, isLoading: loadingPatients } = useQuery({
    queryKey: ["oncology-patients"],
    queryFn: () => api.oncologyPatients(),
  });

  useEffect(() => {
    if (!patientId && patients?.length) {
      setPatientId(patients[0].patient_id);
    }
  }, [patients, patientId]);

  const selectedPatient = useMemo(
    () => patients?.find((p: any) => p.patient_id === patientId) || null,
    [patients, patientId]
  );

  const { data: diagnoses } = useQuery({
    queryKey: ["oncology-diagnoses", patientId],
    queryFn: () => api.oncologyDiagnoses(patientId!),
    enabled: !!patientId,
  });

  const primaryDiagnosisId = diagnoses?.[0]?.diagnosis_id ?? null;

  const { data: diagnosis } = useQuery({
    queryKey: ["oncology-diagnosis", primaryDiagnosisId],
    queryFn: () => api.oncologyDiagnosis(primaryDiagnosisId!),
    enabled: !!primaryDiagnosisId,
  });

  function handleSelectPatient(id: string) {
    setPatientId(id);
    setTab("overview");
  }

  function handleDiagnosisCreated(newPatientId: string) {
    setShowRegisterModal(false);
    queryClient.invalidateQueries({ queryKey: ["oncology-patients"] });
    queryClient.invalidateQueries({ queryKey: ["oncology-diagnoses", newPatientId] });
    setPatientId(newPatientId);
    setTab("overview");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="grad-text-page text-2xl font-extrabold">Oncology &amp; Cancer Care</h1>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            Diagnosis staging, chemotherapy tracking, tumor board discussions and survivorship care.
          </p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="btn g sm inline-flex items-center gap-1.5"
        >
          <Plus size={15} /> New Diagnosis
        </button>
      </div>

      {showRegisterModal && (
        <RegisterDiagnosisModal
          onClose={() => setShowRegisterModal(false)}
          onCreated={handleDiagnosisCreated}
        />
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <PatientPicker
          patients={patients || []}
          selectedId={patientId}
          onSelect={handleSelectPatient}
          search={search}
          onSearch={setSearch}
          loading={loadingPatients}
        />

        <div className="space-y-4 min-w-0">
          {!selectedPatient ? (
            <Card><Empty>No oncology patients found. Seed demo data or register a new diagnosis.</Empty></Card>
          ) : (
            <>
              <Card className="!py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>{selectedPatient.name}</h2>
                    <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                      {selectedPatient.mrn} · {selectedPatient.age}y · {selectedPatient.gender}
                    </p>
                  </div>
                </div>
              </Card>

              <div className="flex flex-wrap gap-2">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold transition"
                    style={{
                      color: tab === t.id ? "#004578" : "var(--muted)",
                      background: tab === t.id ? "linear-gradient(90deg, rgba(0,120,212,.18), rgba(0,69,120,.18))" : "var(--panel)",
                      border: `1px solid ${tab === t.id ? "var(--line2)" : "var(--glass-border)"}`,
                    }}
                  >
                    <t.icon size={15} /> {t.label}
                  </button>
                ))}
              </div>

              <div className={tab === "overview" ? "" : "hidden"}>
                <DiagnosisOverview diagnosis={diagnosis} />
              </div>
              <div className={tab === "chemo" ? "" : "hidden"}>
                <ChemoTracker diagnosis={diagnosis} />
              </div>
              <div className={tab === "board" ? "" : "hidden"}>
                <TumorBoardPanel diagnosis={diagnosis} />
              </div>
              <div className={tab === "reports" ? "" : "hidden"}>
                <ReportsPanel patientId={patientId!} diagnosisId={primaryDiagnosisId} />
              </div>
              <div className={tab === "survivorship" ? "" : "hidden"}>
                <SurvivorshipPanel patientId={patientId!} diagnosisId={primaryDiagnosisId} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
