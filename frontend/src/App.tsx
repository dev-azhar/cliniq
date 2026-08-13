import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import PatientCheckIn from "./features/patient/PatientCheckIn";
import TriageWorkspace from "./features/triage/TriageWorkspace";
import DoctorWorkspace from "./features/doctor/DoctorWorkspace";
import LabWorkspace from "./features/lab/LabWorkspace";
import PatientDashboard from "./features/patient/PatientDashboard";
import CommandCenter from "./features/admin/CommandCenter";
import AdminPortal from "./features/admin/AdminPortal";
import PatientLogin from "./features/patient/PatientLogin";
import RequirePatient from "./components/RequirePatient";
import AppointmentBooking from "./features/patient/AppointmentBooking";
import PatientOncologyCare from "./features/patient/PatientOncologyCare";
import ReceptionWorkspace from "./features/reception/ReceptionWorkspace";
import PharmacyWorkspace from "./features/pharmacy/PharmacyWorkspace";
import OncologyWorkspace from "./features/oncology/OncologyWorkspace";
import CommandCenterOS from "./features/os/CommandCenterOS";
import LoginOS from "./features/os/LoginOS";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
      </BrowserRouter>
    </QueryClientProvider>
  );
}
