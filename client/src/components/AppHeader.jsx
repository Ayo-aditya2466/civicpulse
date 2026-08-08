import { Link, NavLink } from "react-router-dom";
import { Activity } from "lucide-react";
import { APP_NAME } from "../config";

// Municipal-service shell: brand + primary citizen navigation.
export default function AppHeader() {
  const linkBase =
    "px-3 py-2 rounded-md text-sm font-medium transition-colors";
  const linkClass = ({ isActive }) =>
    isActive
      ? `${linkBase} bg-slate-900 text-white`
      : `${linkBase} text-slate-600 hover:bg-slate-100`;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Activity size={18} />
          </span>
          <div className="leading-tight">
            <div className="font-semibold text-slate-900">{APP_NAME}</div>
            <div className="text-[11px] text-slate-500">
              Bhiwandi-Nizampur City · Ward W14
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            Report
          </NavLink>
          <NavLink to="/track" className={linkClass}>
            Track
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
