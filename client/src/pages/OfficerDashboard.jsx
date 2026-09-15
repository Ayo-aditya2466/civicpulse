import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { List, Loader2, Map as MapIcon, ImageIcon } from "lucide-react";
import { listComplaints } from "../lib/complaints";
import { listAssignments } from "../lib/assignments";
import { getCurrentStaffPerson, personById, ROLES } from "../lib/roles";
import { visibleComplaints, assignedTo } from "../lib/visibility";
import { slaFor, urgencyRank } from "../lib/sla";
import { STATUS_FLOW } from "../config";
import SlaBadge from "../components/SlaBadge";
import OfficerMap from "../components/OfficerMap";

// One complaint row — shared by the queue list and the worker's
// "My assignments" view so the two views never drift apart visually.
function QueueList({ rows, assigneeBy }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <ul className="divide-y divide-slate-100">
        {rows.map((c) => (
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
                  <span className="font-medium text-slate-900">{c.type}</span>
                  <span className="text-xs text-slate-400">{c.id}</span>
                </div>
                <div className="truncate text-sm text-slate-500">
                  {c.street} · {c.dept}
                  {assigneeBy[c.id] &&
                    ` · ${personById(assigneeBy[c.id])?.name ?? assigneeBy[c.id]}`}
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
    </div>
  );
}

export default function OfficerDashboard() {
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("urgency");
  const [view, setView] = useState("list"); // list | map | assigned
  // M8.5 Part B: scope defaults to the person's department; widening to all
  // Ward 6 complaints is explicit, never hidden.
  const [scope, setScope] = useState("dept"); // dept | all

  // Loaded once on mount, exactly like the useMemo(..., []) this replaces —
  // the queue still does not refresh after an officer changes a status
  // elsewhere. That known defect is preserved deliberately, not fixed here.
  const [all, setAll] = useState([]);
  // M8: current assignments, so the queue can show who is responsible.
  const [assignments, setAssignments] = useState([]);
  const [assigneeBy, setAssigneeBy] = useState({});
  const [staff, setStaff] = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listComplaints(),
      listAssignments(),
      getCurrentStaffPerson(),
    ])
      .then(([rows, assignmentRows, person]) => {
        if (!alive) return;
        setAll(rows);
        setAssignments(assignmentRows);
        setAssigneeBy(
          Object.fromEntries(
            assignmentRows.map((a) => [a.complaintId, a.assigneeId]),
          ),
        );
        setStaff(person);
      })
      .catch((err) => console.error("CivicPulse: queue load failed", err))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const isWorker = staff?.roleClass === ROLES.WORKER;

  // The base set for the current view/scope. Workers get a personal
  // "My assignments" view; everyone gets the department-scoped queue with an
  // explicit widen-to-all toggle. No staff selected → everything (placeholder
  // identity; scoping to nobody would just hide data).
  const base = useMemo(() => {
    if (view === "assigned" && staff) {
      return assignedTo(staff.id, all, assignments);
    }
    if (scope === "all" || !staff) return all;
    return visibleComplaints(staff, all, assignments);
  }, [view, scope, staff, all, assignments]);

  const filtered = useMemo(() => {
    let rows = base;
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
  }, [base, statusFilter, sortBy]);

  const openCount = base.filter((c) => c.status !== "Resolved").length;
  const overdueCount = base.filter((c) => slaFor(c).level === "overdue").length;

  const selectClass =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20";
  const toggleBtn = (active) =>
    "flex items-center gap-1 px-3 py-2 text-sm font-medium " +
    (active ? "bg-slate-900 text-white" : "bg-white text-slate-600");

  if (loading || staff === undefined) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {view === "assigned" ? "My assignments" : "Complaint queue"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {openCount} open · {overdueCount} overdue · {base.length} shown
            {view !== "assigned" &&
              ` of ${all.length} in Ward 6`}
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
              <List size={14} /> Queue
            </button>
            {isWorker && (
              <button
                type="button"
                onClick={() => setView("assigned")}
                className={toggleBtn(view === "assigned")}
              >
                My assignments
              </button>
            )}
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

      {view !== "assigned" && staff && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Scope:</span>
          <div className="flex overflow-hidden rounded-md border border-slate-300">
            <button
              type="button"
              onClick={() => setScope("dept")}
              className={toggleBtn(scope === "dept")}
            >
              My department ({staff.depts.join(" · ")})
            </button>
            <button
              type="button"
              onClick={() => setScope("all")}
              className={toggleBtn(scope === "all")}
            >
              All Ward 6 complaints
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          {base.length === 0 ? (
            <>
              <p className="text-sm font-medium text-slate-700">
                {view === "assigned"
                  ? "No complaints assigned to you."
                  : "No complaints in this view yet."}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {view === "assigned"
                  ? "Complaints appear here when a manager assigns them to you."
                  : scope === "dept"
                    ? "No complaints in your department — widen the scope to see all Ward 6 complaints."
                    : "New citizen reports appear here automatically as they are submitted."}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              No complaints match this filter.
            </p>
          )}
        </div>
      ) : view === "map" ? (
        <OfficerMap complaints={filtered} />
      ) : (
        <QueueList rows={filtered} assigneeBy={assigneeBy} />
      )}
    </div>
  );
}
