import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Megaphone, Building2, ArrowRight, LogIn } from "lucide-react";
import { APP_NAME } from "../config";

// CivicPulse — role-selector landing page (the app's front door).
//
// ⚠️ PLACEHOLDER AUTH — NOT REAL AUTHENTICATION.
// The "Municipal Staff" form is a login-LOOKING screen only. It does NOT check
// credentials against anything, has no accounts, no database, no password
// hashing, and stores nothing. It only validates that both fields are non-empty
// and then routes to /officer. This will be replaced with real Supabase auth in
// a future milestone once ward/officer data is available. Do not treat this as
// a security boundary.
export default function LandingPage() {
  const navigate = useNavigate();
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Placeholder gate: non-empty check only — nothing is verified.
  function handleStaffSubmit(e) {
    e.preventDefault();
    if (!staffId.trim() || !password.trim()) {
      setError("Please enter both fields.");
      return;
    }
    navigate("/officer");
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10">
        {/* Brand — same block as the citizen header, for visual consistency. */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Activity size={24} />
          </span>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">
            {APP_NAME}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Bhiwandi-Nizampur City · Ward W14
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Citizen — straight into the (anonymous-friendly) report flow. */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Megaphone size={20} />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              I&apos;m a Citizen
            </h2>
            <p className="mt-1 flex-1 text-sm text-slate-500">
              Report a civic issue or track an existing complaint. No account
              needed.
            </p>
            <button
              type="button"
              onClick={() => navigate("/report")}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Continue <ArrowRight size={15} />
            </button>
          </div>

          {/* Municipal Staff — placeholder login (see file header). */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Building2 size={20} />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              I&apos;m Municipal Staff
            </h2>

            {!showStaffLogin ? (
              <>
                <p className="mt-1 flex-1 text-sm text-slate-500">
                  Sign in to access the officer console and complaint queue.
                </p>
                <button
                  type="button"
                  onClick={() => setShowStaffLogin(true)}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Continue <ArrowRight size={15} />
                </button>
              </>
            ) : (
              <form onSubmit={handleStaffSubmit} className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Staff ID
                  </label>
                  <input
                    value={staffId}
                    onChange={(e) => {
                      setStaffId(e.target.value);
                      setError("");
                    }}
                    placeholder="e.g. BWCMC-W14-ENG"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <LogIn size={15} /> Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStaffLogin(false);
                    setError("");
                  }}
                  className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Back
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Demo prototype — staff sign-in is a placeholder and does not verify
          credentials.
        </p>
      </main>
    </div>
  );
}
