// CivicPulse — tests for the application role model (M8)
//
// Covers: the explicit Ward 6 title→roleClass mapping (worker / manager /
// OPEN), the admin vocabulary (exists, unpopulated), person-id stability and
// uniqueness, and the placeholder staff session.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { officers } from "../data/seed";
import {
  ROLES,
  personById,
  roleClassOf,
  workersInDept,
  canAssignWorkers,
  canSubmitEvidence,
  canAdvanceStatus,
  canViewQueue,
  getCurrentStaffId,
  setCurrentStaff,
  clearCurrentStaff,
  getCurrentStaffPerson,
} from "./roles";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("role mapping", () => {
  it("gives every officer a roleClass of worker, manager, or null (OPEN)", () => {
    expect(officers.length).toBeGreaterThan(0);
    for (const p of officers) {
      expect(["worker", "manager", null]).toContain(p.roleClass);
    }
  });

  it("maps exactly the approved worker titles", () => {
    const workers = officers.filter((p) => p.roleClass === ROLES.WORKER);
    expect(workers.map((p) => p.id).sort()).toEqual(
      ["W6-ELE-02", "W6-SAN-01", "W6-SAN-02", "W6-SAN-03", "W6-SAN-04"].sort(),
    );
    for (const w of workers) {
      expect(w.role).toMatch(/Mukadam|Supervisor \(SI\)|Junior Engineer/);
    }
  });

  it("maps the approved manager titles", () => {
    const managers = officers.filter((p) => p.roleClass === ROLES.MANAGER);
    // 15 manager PERSONS (M8.5 Part E): 17 manager rows minus the two rows
    // that were the same person duplicated across two departments.
    expect(managers).toHaveLength(15);
    for (const m of managers) {
      expect(m.role).toMatch(
        /Health Inspector|Senior Clerk|Deputy Engineer|Executive Engineer|City Engineer|Chief Superintendent|Commissioner|Head, Health & Sanitation/,
      );
    }
  });

  it("keeps plain 'Supervisor' OPEN — never auto-classified", () => {
    const plain = officers.filter((p) => p.role === "Supervisor");
    expect(plain).toHaveLength(4);
    for (const p of plain) {
      expect(p.roleClass).toBeNull();
    }
  });

  it("admin exists as vocabulary only — no seeded admin person", () => {
    expect(ROLES.ADMIN).toBe("admin");
    expect(officers.filter((p) => p.roleClass === ROLES.ADMIN)).toHaveLength(0);
  });

  it("preserves the original municipal title in `role`", () => {
    expect(personById("W6-SAN-01").role).toBe("Mukadam (Foreman), Wards 1 & 6");
    expect(personById("W6-CON-03").role).toBe("City Engineer");
  });
});

describe("person ids", () => {
  it("are stable-shaped and unique", () => {
    const ids = officers.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^W6-[A-Z]{3}-\d{2}$/);
    }
  });

  it("resolve via personById; unknown ids return null", () => {
    expect(personById("W6-CON-03").name).toBe("Jamir Patel");
    expect(personById("W6-NOPE-99")).toBeNull();
    expect(roleClassOf(null)).toBeNull();
  });

  it("M8.5: one person = one row, with a depts array for multi-department officials", () => {
    // 24 rows = 24 unique persons (no person appears twice).
    expect(officers).toHaveLength(24);
    expect(new Set(officers.map((p) => p.name)).size).toBe(24);
    const vikram = personById("W6-WAT-05");
    expect(vikram.name).toBe("Vikram Darade");
    expect(vikram.depts).toEqual(["Water Supply", "Construction"]);
    const vitthal = personById("W6-GAR-05");
    expect(vitthal.depts).toEqual(["Garden", "Electrical"]);
  });

  it("M8.5: retired M8 person ids still resolve to the merged person (alias map)", () => {
    expect(personById("W6-CON-04")).toBe(personById("W6-WAT-05"));
    expect(personById("W6-ELE-04")).toBe(personById("W6-GAR-05"));
  });

  it("list assignable workers per department", () => {
    expect(workersInDept("Sanitation").map((p) => p.id)).toEqual([
      "W6-SAN-01",
      "W6-SAN-02",
      "W6-SAN-03",
      "W6-SAN-04",
    ]);
    expect(workersInDept("Electrical").map((p) => p.id)).toEqual(["W6-ELE-02"]);
    // Garden/Water/Construction/Health have no roleClass worker in the
    // supplied data — empty, not invented.
    expect(workersInDept("Garden")).toEqual([]);
    expect(workersInDept("Water Supply")).toEqual([]);
    expect(workersInDept("Construction")).toEqual([]);
    expect(workersInDept("Health")).toEqual([]);
  });
});

describe("application-level permissions (NOT security boundaries)", () => {
  it("allows only managers to assign workers and view the full queue", () => {
    expect(canAssignWorkers(ROLES.MANAGER)).toBe(true);
    expect(canAssignWorkers(ROLES.WORKER)).toBe(false);
    expect(canAssignWorkers(null)).toBe(false);
    expect(canViewQueue(ROLES.MANAGER)).toBe(true);
    expect(canViewQueue(ROLES.WORKER)).toBe(false);
  });

  it("allows workers and managers to submit evidence and advance status", () => {
    for (const fn of [canSubmitEvidence, canAdvanceStatus]) {
      expect(fn(ROLES.WORKER)).toBe(true);
      expect(fn(ROLES.MANAGER)).toBe(true);
      expect(fn(null)).toBe(false);
      expect(fn(ROLES.ADMIN)).toBe(false); // admin has no M8 UI/workflow
    }
  });
});

describe("placeholder staff session", () => {
  it("stores and resolves the selected personId — no authentication claimed", async () => {
    expect(await getCurrentStaffId()).toBeNull(); // nothing selected yet
    await setCurrentStaff("W6-CON-03");
    expect(await getCurrentStaffId()).toBe("W6-CON-03");
    const person = await getCurrentStaffPerson();
    expect(person.name).toBe("Jamir Patel");
    expect(person.depts).toEqual(["Construction"]);
  });

  it("rejects an unknown person rather than storing garbage", async () => {
    await expect(setCurrentStaff("W6-NOPE-99")).rejects.toThrow(/unknown staff person/);
    expect(await getCurrentStaffId()).toBeNull();
  });

  it("clears back to no selection", async () => {
    await setCurrentStaff("W6-SAN-02");
    await clearCurrentStaff();
    expect(await getCurrentStaffId()).toBeNull();
    expect(await getCurrentStaffPerson()).toBeNull();
  });

  it("propagates a refused store write (M6 contract)", async () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(setCurrentStaff("W6-CON-03")).rejects.toThrow(
      /storage write failed/,
    );
  });
});
