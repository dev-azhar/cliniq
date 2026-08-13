import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Syringe, Users, ScanLine, HeartPulse } from "lucide-react";
import { api } from "../../lib/api";
import { getPortalPatient } from "../../lib/patientAuth";
import { Card, Empty } from "../../components/ui";

import DiagnosisOverview from "../oncology/components/DiagnosisOverview";
import ChemoTracker from "../oncology/components/ChemoTracker";
import TumorBoardPanel from "../oncology/components/TumorBoardPanel";
import ReportsPanel from "../oncology/components/ReportsPanel";
import SurvivorshipPanel from "../oncology/components/SurvivorshipPanel";

const TABS = [
  { id: "overview", label: "Diagnosis & Biomarkers", icon: FileText },
  { id: "chemo", label: "Chemotherapy", icon: Syringe },
  { id: "board", label: "Tumor Board", icon: Users },
  { id: "reports", label: "Imaging & Pathology", icon: ScanLine },
  { id: "survivorship", label: "Survivorship", icon: HeartPulse },
] as const;

export default function PatientOncologyCare() {
  const nav = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const portalSession = getPortalPatient()!;
  const patientId = portalSession.patient_id;

  const { data: diagnoses, isLoading: loadingDiagnoses } = useQuery({
    queryKey: ["oncology-diagnoses", patientId],
    queryFn: () => api.oncologyDiagnoses(patientId),
    enabled: !!patientId,
  });

  const primaryDiagnosisId = diagnoses?.[0]?.diagnosis_id ?? null;

  const { data: diagnosis, isLoading: loadingDiagnosis } = useQuery({
    queryKey: ["oncology-diagnosis", primaryDiagnosisId],
    queryFn: () => api.oncologyDiagnosis(primaryDiagnosisId!),
    enabled: !!primaryDiagnosisId,
  });

  const loading = useMemo(
    () => loadingDiagnoses || (!!primaryDiagnosisId && loadingDiagnosis),
    [loadingDiagnoses, primaryDiagnosisId, loadingDiagnosis]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => nav("/patient")}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
          style={{ color: "var(--cyan)" }}
        >
          <ArrowLeft size={15} /> Back to dashboard
        </button>
      </div>

      <div>
        <h1 className="grad-text-page text-2xl font-extrabold">My Cancer Care</h1>
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          Your diagnosis, treatment progress and care team's recommendations, in one place.
        </p>
      </div>

      {loading ? (
        <Card><div className="py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>Loading your care record...</div></Card>
      ) : !diagnosis ? (
        <Card><Empty>No oncology records are on file for your account yet. If you're expecting to see cancer care information here, please check with your care team.</Empty></Card>
      ) : (
        <div className="space-y-4">
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
            <DiagnosisOverview diagnosis={diagnosis} readOnly />
          </div>
          <div className={tab === "chemo" ? "" : "hidden"}>
            <ChemoTracker diagnosis={diagnosis} readOnly />
          </div>
          <div className={tab === "board" ? "" : "hidden"}>
            <TumorBoardPanel diagnosis={diagnosis} readOnly />
          </div>
          <div className={tab === "reports" ? "" : "hidden"}>
            <ReportsPanel patientId={patientId} readOnly />
          </div>
          <div className={tab === "survivorship" ? "" : "hidden"}>
            <SurvivorshipPanel patientId={patientId} readOnly />
          </div>
        </div>
      )}
    </div>
  );
}
