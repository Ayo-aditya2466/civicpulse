// CivicPulse — Assignment policy seam (M8.5, Part A)
//
// ⚠️ INTERIM POLICY — the real municipal authority structure is an OPEN
// QUESTION (who may assign Ward 6 staff, and whether that authority is
// department-scoped, ward-scoped, or cross-department; we are awaiting the
// councillor's office). Editing THIS FILE is the intended way to apply the
// real rule when it arrives — no caller anywhere else makes authority
// decisions.
//
// Interim rule (deliberately permissive, deliberately dumb):
//   1. Any person with roleClass "manager" may assign any Ward 6 complaint.
//   2. The assignee must be a person with roleClass "worker" whose department
//      matches the complaint's department (from the municipal complaint-type →
//      department mapping in seed data — not invented hierarchy).
//
// Every authority decision is recorded as a DecisionResult
// (kind: "assignment-authority", source: "rule") carrying the policy string,
// so historical assignments can be re-audited when the real rule lands.
//
// People are referenced by personId only; no citizen contact data here.

import { recordDecision } from "./decisionResults";
import { roleClassOf, workersInDept, ROLES } from "./roles";

// Evaluate whether `actorPerson` may assign `complaint` to
// `candidateAssignee`. Pure decision + one DecisionResult append; performs no
// complaint/assignment writes. `actorPerson` may be null (unknown/absent id).
export async function canAssign(actorPerson, complaint, candidateAssignee) {
  let allowed = false;
  let reason;
  let policy;

  if (!actorPerson || roleClassOf(actorPerson) !== ROLES.MANAGER) {
    policy = "interim:actor-not-manager";
    reason = `assignment actor "${actorPerson?.id ?? "unknown"}" is not a manager`;
  } else if (!candidateAssignee || roleClassOf(candidateAssignee) !== ROLES.WORKER) {
    policy = "interim:assignee-not-worker";
    reason = candidateAssignee
      ? `"${candidateAssignee.id}" is not assignable (roleClass ` +
        `${JSON.stringify(candidateAssignee.roleClass)}; plain "Supervisor" is pending clarification)`
      : "assignee is not a seeded person";
  } else if (complaint.dept == null) {
    policy = "interim:complaint-no-dept";
    reason = `complaint "${complaint.id}" has no department to assign within`;
  } else if (!candidateAssignee.depts.includes(complaint.dept)) {
    policy = "interim:assignee-dept-mismatch";
    reason =
      `"${candidateAssignee.id}" (${candidateAssignee.depts.join(", ")}) does not ` +
      `match complaint department "${complaint.dept}"`;
  } else {
    allowed = true;
    policy = "interim:manager-any-dept+assignee-dept-match";
    reason =
      "interim policy: any Ward 6 manager may assign; assignee must be a " +
      "worker in the complaint's department";
  }

  // Source-neutral audit trail (M7): even denials are recorded, so the policy
  // string that fired is always reviewable. Strict-propagate on write failure.
  await recordDecision({
    complaintId: complaint.id,
    kind: "assignment-authority",
    result: { allowed, policy },
    source: "rule",
    detail: { reason },
  });

  return { allowed, reason, policy };
}

// Who `actorPerson` may choose among for `complaint` under the interim
// policy. Pure (no writes): UI gating should use this, not canAssign, so
// renders don't append DecisionResults.
export function eligibleAssignees(actorPerson, complaint) {
  if (!actorPerson || roleClassOf(actorPerson) !== ROLES.MANAGER) return [];
  if (!complaint || complaint.dept == null) return [];
  return workersInDept(complaint.dept);
}
