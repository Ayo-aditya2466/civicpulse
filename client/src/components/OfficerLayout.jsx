import { useEffect, useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { LayoutGrid, UserRound } from "lucide-react";
import { APP_NAME } from "../config";
import { getCurrentStaffPerson } from "../lib/roles";
import { wards } from "../data/seed";

// Officer console shell — deliberately a distinct ops look from the citizen
// side. Shows the placeholder-signed-in staff context (display only, no auth).
// If nobody is selected, we say so plainly rather than pretending someone is
// authenticated.
export default function OfficerLayout() {
  const [person, setPerson] = useState(undefined); // undefined = loading

  useEffect(() => {
    let alive = true;
    getCurrentStaffPerson()
      .then((p) => {
        if (alive) setPerson(p);
      })
      .catch((err) => {
        console.error("CivicPulse: staff lookup failed", err);
        if (alive) setPerson(null);
      });
    return () => {
      alive = false;
    };
  }, []);

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
              <div className="font-semibold">{APP_NAME} · Staff Console</div>
              <div className="text-[11px] text-slate-300">
                {ward.name} ({ward.id}) · {ward.committee}
              </div>
            </div>
          </Link>
          <div className="text-right leading-tight">
            {person === undefined ? null : person ? (
              <>
                <div className="text-sm font-medium">{person.name}</div>
                <div className="text-[11px] text-slate-300">
                  {person.role} · {person.depts.join(" · ")}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <UserRound size={12} /> No staff selected —
                <Link to="/" className="underline hover:text-slate-200">
                  choose a person
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
