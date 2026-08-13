import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import RequirePatient from "./components/RequirePatient";

// Route-level code splitting: each feature loads as its own on-demand chunk.
const Home = lazy(() => import("./pages/Home"));
const PatientCheckIn = lazy(() => import("./features/patient/PatientCheckIn"));
const TriageWorkspace = lazy(() => import("./features/triage/TriageWorkspace"));
const DoctorWorkspace = lazy(() => import("./features/doctor/DoctorWorkspace"));
const LabWorkspace = lazy(() => import("./features/lab/LabWorkspace"));
const PatientDashboard = lazy(() => import("./features/patient/PatientDashboard"));
const CommandCenter = lazy(() => import("./features/admin/CommandCenter"));
const AdminPortal = lazy(() => import("./features/admin/AdminPortal"));
const PatientLogin = lazy(() => import("./features/patient/PatientLogin"));
const AppointmentBooking = lazy(() => import("./features/patient/AppointmentBooking"));
const PatientOncologyCare = lazy(() => import("./features/patient/PatientOncologyCare"));
const ReceptionWorkspace = lazy(() => import("./features/reception/ReceptionWorkspace"));
const PharmacyWorkspace = lazy(() => import("./features/pharmacy/PharmacyWorkspace"));
const OncologyWorkspace = lazy(() => import("./features/oncology/OncologyWorkspace"));
const CommandCenterOS = lazy(() => import("./features/os/CommandCenterOS"));
const LoginOS = lazy(() => import("./features/os/LoginOS"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function PageFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f6f4ef]">
      <div className="flex items-center gap-2 text-slate-400">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#0078d4]" />
        <span className="text-sm font-medium">Loading…</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/os/login" replace />} />
            <Route path="/os/login" element={<LoginOS />} />
            <Route path="/os" element={<CommandCenterOS />} />
            <Route
              path="/*"
              element={
                <Layout>
                  <Routes>
                    <Route path="/home" element={<Home />} />
                    <Route path="/triage" element={<TriageWorkspace />} />
                    <Route path="/copilot" element={<DoctorWorkspace />} />
                    <Route path="/oncology" element={<OncologyWorkspace />} />
                    <Route path="/lab" element={<LabWorkspace />} />
                    <Route path="/reception" element={<ReceptionWorkspace />} />
                    <Route path="/pharmacy" element={<PharmacyWorkspace />} />
                    <Route path="/patient/login" element={<PatientLogin />} />
                    <Route path="/patient" element={<RequirePatient><PatientDashboard /></RequirePatient>} />
                    <Route path="/patient/checkin" element={<RequirePatient><PatientCheckIn /></RequirePatient>} />
                    <Route path="/patient/appointments/book" element={<RequirePatient><AppointmentBooking /></RequirePatient>} />
                    <Route path="/patient/oncology" element={<RequirePatient><PatientOncologyCare /></RequirePatient>} />
                    <Route path="/command" element={<CommandCenter />} />
                    <Route path="/admin" element={<AdminPortal />} />
                  </Routes>
                </Layout>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
