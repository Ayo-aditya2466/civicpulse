import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { List, Map as MapIcon, ImageIcon } from "lucide-react";
import { listComplaints } from "../lib/complaints";
import { slaFor, urgencyRank } from "../lib/sla";
import { STATUS_FLOW } from "../config";
import SlaBadge from "../components/SlaBadge";
import OfficerMap from "../components/OfficerMap";

export default function OfficerDashboard() {
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("urgency");
  const [view, setView] = useState("list");

  const all = useMemo(() => listComplaints(), []);

  const filtered = useMemo(() => {
    let rows = all;
    if (statusFilter !== "All") {
      rows = rows.filter((c) => c.status === statusFilter);
    }
    rows = [...rows];
    if (sortBy === "urgency") {
      rows.sort((a, b) => urgencyRank(a) - urgencyRank(b));
    } else {
      rows.sort((a, b) => b.createdAt - a.createdAt);
    }
    return rows;
  }, [all, statusFilter, sortBy]);

  const openCount = all.filter((c) => c.status !== "Resolved").length;
  const overdueCount = all.filter(
    (c) => slaFor(c).level === "overdue"
  ).length;

  const selectClass =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20";
  const toggleBtn = (active) =>
    "flex items-center gap-1 px-3 py-2 text-sm font-medium " +
    (active ? "bg-slate-900 text-white" : "bg-white text-slate-600");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Complaint queue
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {openCount} open · {overdueCount} overdue · {all.length} total
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectClass}
          >
            <option value="All">All statuses</option>
            {STATUS_FLOW.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={selectClass}
          >
            <option value="urgency">Sort: Urgency</option>
            <option value="newest">Sort: Newest</option>
          </select>
          <div className="flex overflow-hidden rounded-md border border-slate-300">
            <button
              type="button"
              onClick={() => setView("list")}
              className={toggleBtn(view === "list")}
            >
              <List size={14} /> List
            </button>
            <button
              type="button"
              onClick={() => setView("map")}
              className={toggleBtn(view === "map")}
            >
              <MapIcon size={14} /> Map
            </button>
          </div>
        </div>
      </div>

      {view === "map" ? (
        <OfficerMap complaints={filtered} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No complaints match this filter.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/officer/${c.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
                      {c.photo ? (
                        <img
                          src={c.photo}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon size={18} className="text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {c.type}
                        </span>
                        <span className="text-xs text-slate-400">{c.id}</span>
                      </div>
                      <div className="truncate text-sm text-slate-500">
                        {c.street} · {c.dept}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {c.status}
                      </span>
                      <SlaBadge complaint={c} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
