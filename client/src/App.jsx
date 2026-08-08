import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppHeader from "./components/AppHeader";
import ReportPage from "./pages/ReportPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import TrackPage from "./pages/TrackPage";
import { ensureSeeded } from "./lib/complaints";

function App() {
  // Inject synthetic demo complaints once so duplicate suggestion can fire.
  useEffect(() => {
    ensureSeeded();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Routes>
          <Route path="/" element={<ReportPage />} />
          <Route path="/confirmation/:id" element={<ConfirmationPage />} />
          <Route path="/track" element={<TrackPage />} />
          <Route path="/track/:id" element={<TrackPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
