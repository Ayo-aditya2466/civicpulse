import { Outlet, Link } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { APP_NAME } from "../config";
import { officers, wards } from "../data/seed";

// Officer console shell — deliberately a distinct ops look from the citizen
// side. Shows the logged-in-style officer context (display only, no auth).
export default function OfficerLayout() {
  const officer = officers[0];
  const ward = wards[0];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/officer" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
              <LayoutGrid size={18} />
            </span>
            <div className="leading-tight">
              <div className="font-semibold">{APP_NAME} · Officer Console</div>
              <div className="text-[11px] text-slate-300">
                {ward.name} ({ward.id}) · {ward.committee}
              </div>
            </div>
          </Link>
          <div className="text-right leading-tight">
            <div className="text-sm font-medium">{officer.name}</div>
            <div className="text-[11px] text-slate-300">{officer.role}</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
