import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";

// Citizen shell (unchanged from M1): brand header + centered content column.
export default function CitizenLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
