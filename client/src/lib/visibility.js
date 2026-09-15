// CivicPulse — queue visibility (M8.5, Part B)
//
// Two visibility concepts, both pure application rules needing no municipal
// guesswork:
//   1. Department visibility: a staff person sees complaints whose department
//      matches their own (dept comes from the municipal complaint-type →
//      department mapping in seed data).
//   2. Individual assignment visibility: a worker sees complaints currently
//      assigned to them, regardless of department.
//
// Deliberately ABSENT (OPEN — no data, will not infer): complaint-type →
// specific worker routing. Nothing here knows or cares which worker "should"
// get which complaint type.
//
// No staff person selected → everything visible (placeholder identity; the
// console never pretends to lock data it cannot really lock).
//
// Pure functions only — callers (OfficerDashboard) already hold the
// complaints and assignments they need for rendering.

// Complaints currently assigned to a person, regardless of department.
export function assignedTo(personId, complaints, assignments = []) {
  if (!personId) return [];
  const mine = new Set(
    assignments
      .filter((a) => a.assigneeId === personId)
      .map((a) => a.complaintId),
  );
  return complaints.filter((c) => mine.has(c.id));
}

// The scoped default view: the person's department, plus anything assigned
// to them personally (union — assignment visibility is never hidden by the
// department filter).
export function visibleComplaints(staffPerson, complaints, assignments = []) {
  if (!staffPerson) return complaints;
  const mine = new Set(
    assignments
      .filter((a) => a.assigneeId === staffPerson.id)
      .map((a) => a.complaintId),
  );
  return complaints.filter(
    (c) => staffPerson.depts.includes(c.dept) || mine.has(c.id),
  );
}
