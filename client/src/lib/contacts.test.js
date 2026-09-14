// CivicPulse — CHARACTERIZATION tests for lib/contacts.js
//
// The citizen contact store is the privacy boundary: personal details live in a
// separate keyed map, and an anonymous submission creates no record at all.
// These tests pin that behaviour before the M6 refactor. All values below are
// obviously-fake placeholders; no real contact data appears in tests.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { saveContact, getContact } from "./contacts";
import { createComplaint, getComplaint } from "./complaints";
import { readStore } from "./storage";
import { STORAGE_KEYS } from "../config";

const COMPLAINT_ID = "CP-W6-0001";

const placeholder = {
  name: "Test Citizen",
  phone: "9999900000",
  email: "citizen@example.invalid",
};

beforeEach(() => {
  localStorage.clear();
});

describe("saveContact", () => {
  it("stores a full contact and returns true", async () => {
    expect(await saveContact(COMPLAINT_ID, placeholder)).toBe(true);
    expect(await getContact(COMPLAINT_ID)).toEqual(placeholder);
  });

  it("keys the record by complaint id in a store separate from complaints", async () => {
    await saveContact(COMPLAINT_ID, placeholder);
    expect(Object.keys(readStore(STORAGE_KEYS.contacts, {}))).toEqual([COMPLAINT_ID]);
    expect(readStore(STORAGE_KEYS.complaints, null)).toBeNull();
  });

  it("returns true when only one field is filled and nulls the rest", async () => {
    expect(await saveContact(COMPLAINT_ID, { phone: "9999900000" })).toBe(true);
    expect(await getContact(COMPLAINT_ID)).toEqual({
      name: null,
      phone: "9999900000",
      email: null,
    });
  });

  it("trims surrounding whitespace on every field", async () => {
    await saveContact(COMPLAINT_ID, {
      name: "  Test Citizen  ",
      phone: "  9999900000 ",
      email: " citizen@example.invalid ",
    });
    expect(await getContact(COMPLAINT_ID)).toEqual(placeholder);
  });

  it("returns false and stores nothing for a fully blank contact", async () => {
    expect(await saveContact(COMPLAINT_ID, { name: "", phone: "", email: "" })).toBe(false);
    expect(await getContact(COMPLAINT_ID)).toBeNull();
    expect(readStore(STORAGE_KEYS.contacts, null)).toBeNull();
  });

  it("treats whitespace-only input as blank", async () => {
    expect(await saveContact(COMPLAINT_ID, { name: "   ", phone: "\t", email: " " })).toBe(
      false,
    );
    expect(readStore(STORAGE_KEYS.contacts, null)).toBeNull();
  });

  it("treats a missing argument as an anonymous submission", async () => {
    expect(await saveContact(COMPLAINT_ID)).toBe(false);
    expect(readStore(STORAGE_KEYS.contacts, null)).toBeNull();
  });

  it("does not create an empty map entry for an anonymous submission", async () => {
    await saveContact(COMPLAINT_ID, { name: "", phone: "", email: "" });
    expect(readStore(STORAGE_KEYS.contacts, {})).toEqual({});
  });

  it("keeps contacts for different complaints independent", async () => {
    await saveContact("CP-W6-0001", { name: "First Citizen" });
    await saveContact("CP-W6-0002", { name: "Second Citizen" });
    expect((await getContact("CP-W6-0001")).name).toBe("First Citizen");
    expect((await getContact("CP-W6-0002")).name).toBe("Second Citizen");
  });

  it("overwrites an existing contact for the same complaint", async () => {
    await saveContact(COMPLAINT_ID, { name: "First Citizen" });
    await saveContact(COMPLAINT_ID, { email: "citizen@example.invalid" });
    expect(await getContact(COMPLAINT_ID)).toEqual({
      name: null,
      phone: null,
      email: "citizen@example.invalid",
    });
  });
});

describe("getContact", () => {
  it("returns null for a complaint with no contact record", async () => {
    expect(await getContact("CP-W6-0404")).toBeNull();
  });

  it("returns null when the contact store has never been written", async () => {
    expect(readStore(STORAGE_KEYS.contacts, null)).toBeNull();
    expect(await getContact(COMPLAINT_ID)).toBeNull();
  });
});

// A refused write used to resolve as though the details had been stored. It now
// rejects at the seam (repo.js). Note that false still means only "nothing to
// store" — the two outcomes never share a channel.
describe("write failure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function refuseWrites() {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
  }

  it("rejects rather than reporting a contact it did not store", async () => {
    refuseWrites();
    await expect(saveContact(COMPLAINT_ID, placeholder)).rejects.toThrow(
      /storage write failed/,
    );
  });

  it("persists nothing when the write is refused", async () => {
    refuseWrites();
    await expect(saveContact(COMPLAINT_ID, placeholder)).rejects.toThrow();
    vi.restoreAllMocks();
    expect(await getContact(COMPLAINT_ID)).toBeNull();
  });

  it("still returns false without attempting a write for a blank contact", async () => {
    refuseWrites();
    expect(await saveContact(COMPLAINT_ID, {})).toBe(false);
  });

  // ReportPage saves the complaint first and isolates the contact write in its
  // own catch, on the strength of this invariant: the two stores are separate,
  // so a refused contact write cannot damage or unsave a committed complaint.
  // Asserted here at the store level — the component's control flow around it is
  // not covered, as the suite has no DOM environment.
  it("leaves an already-saved complaint intact and readable", async () => {
    const complaint = await createComplaint({
      type: "Pothole / Road Damage",
      street: "Khadipar Road",
      description: "Large pothole near the junction.",
      photo: "data:image/jpeg;base64,TEST",
    });

    refuseWrites();
    await expect(saveContact(complaint.id, placeholder)).rejects.toThrow(
      /storage write failed/,
    );
    vi.restoreAllMocks();

    // The complaint survived the failure whole — same record, still trackable.
    expect(await getComplaint(complaint.id)).toEqual(complaint);
    // ...and no partial contact record was left keyed against it.
    expect(await getContact(complaint.id)).toBeNull();
  });
});
