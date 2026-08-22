import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import CitizenLayout from "./components/CitizenLayout";
import OfficerLayout from "./components/OfficerLayout";
import LandingPage from "./pages/LandingPage";
import ReportPage from "./pages/ReportPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import TrackPage from "./pages/TrackPage";
import OfficerDashboard from "./pages/OfficerDashboard";
import OfficerComplaintDetail from "./pages/OfficerComplaintDetail";
import { ensureSeeded } from "./lib/complaints";

function App() {
  // Inject synthetic demo complaints once so duplicate suggestion can fire.
  useEffect(() => {
    ensureSeeded();
  }, []);

  return (
    <Routes>
      {/* Front door — role selector (placeholder auth), standalone shell */}
      <Route path="/" element={<LandingPage />} />

      {/* Citizen side — unchanged shell from M1; report form now at /report */}
      <Route element={<CitizenLayout />}>
        <Route path="/report" element={<ReportPage />} />
        <Route path="/confirmation/:id" element={<ConfirmationPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="/track/:id" element={<TrackPage />} />
      </Route>

      {/* Officer console — M2 */}
      <Route element={<OfficerLayout />}>
        <Route path="/officer" element={<OfficerDashboard />} />
        <Route path="/officer/:id" element={<OfficerComplaintDetail />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
