// CivicPulse — pilot seed data (BNCMC Ward 6)
// Source of truth for wards, streets, departments, complaint types, and officers.
// Values are grounded in the official Ward 6 election-boundary map and the
// supplied municipal department/hierarchy document. Do not invent alternates.
// Officers with phone: null are confirmed-ambiguous duplicate numbers pending
// clarification from the municipal office — leave them null, do not guess.

export const wards = [
  {
    id: "W6",
    name: "Ward 6",
    committee: "Prabhag No. 6",
    population: 32192,
  },
];

export const streets = [
  "Khadipar Road",
  "Kadak Road",
  "Kariwali Road",
  "Dargah Road",
  "Tilak Chowk",
  "Kalantri Chowk",
  "Bazar Peth",
  "Bunder Mohalla",
];

export const departments = [
  "Garden",
  "Water Supply",
  "Construction",
  "Electrical",
  "Health",
  "Sanitation",
];

// dept: null means deliberately unmapped (Encroachment, Other) — the complaint
// is created visibly unassigned rather than misrouted. deptForType in
// complaints.js already handles null without a logic change.
export const complaintTypes = [
  {
    type: "Pothole / Road Damage",
    dept: "Construction",
    slaHours: 72,
  },
  {
    type: "Garbage",
    dept: "Sanitation",
    slaHours: 12,
  },
  {
    type: "Drainage Issues",
    dept: "Sanitation",
    slaHours: 12,
  },
  {
    type: "Water Leakage / Supply",
    dept: "Water Supply",
    slaHours: 24,
  },
  {
    type: "Streetlight Failure",
    dept: "Electrical",
    slaHours: 24,
  },
  {
    type: "Illegal Dumping",
    dept: "Sanitation",
    slaHours: 24,
  },
  {
    type: "Public Toilet Issues",
    dept: "Sanitation",
    slaHours: 24,
  },
  {
    type: "Fallen Trees",
    dept: "Garden",
    slaHours: 24,
  },
  {
    type: "Dead Animal Removal",
    dept: "Sanitation",
    slaHours: 12,
  },
  {
    type: "Encroachment",
    dept: null,
    slaHours: 48,
  },
  {
    type: "Other",
    dept: null,
    slaHours: 48,
  },
];

// People (M8): each officer gains a stable application id and a `roleClass`
// (worker | manager | null). roleClass is an APPLICATION role classification
// for the pilot — it is NOT a claim about official municipal rank or reporting
// hierarchy, which the source data does not establish. Plain "Supervisor"
// titles are deliberately null (OPEN) pending municipal clarification; they
// can be selected as staff but cannot be assigned work in M8.
// ids are person references, NOT authentication credentials.
//
// M8.5 Part E: one person = one row. Senior officials overseeing multiple
// departments carry a `depts` ARRAY (their full affiliation from the source
// data — not invented hierarchy). In M8 these two people wrongly existed as
// two separate personIds; the retired ids (W6-CON-04, W6-ELE-04) still
// resolve through the alias map in lib/roles.js so stored records keep reading.
export const officers = [
  { id: "W6-GAR-01", name: "Ramnath Pandhure", role: "Supervisor", depts: ["Garden"], phone: null, roleClass: null },
  { id: "W6-GAR-02", name: "Nilesh Sankhe", role: "Chief Superintendent", depts: ["Garden"], phone: "9561680668", roleClass: "manager" },
  { id: "W6-GAR-03", name: "Sudhir Gurav", role: "Assistant Commissioner", depts: ["Garden"], phone: "9922786789", roleClass: "manager" },
  { id: "W6-GAR-04", name: "Balkrishna Kshirsagar", role: "Deputy Commissioner", depts: ["Garden"], phone: "9967461735", roleClass: "manager" },
  { id: "W6-GAR-05", name: "Vitthal Dake", role: "Additional Commissioner", depts: ["Garden", "Electrical"], phone: "7796491999", roleClass: "manager" },

  { id: "W6-WAT-01", name: "Ganesh Shingade", role: "Supervisor", depts: ["Water Supply"], phone: null, roleClass: null },
  { id: "W6-WAT-02", name: "Nafees Momin", role: "Senior Clerk", depts: ["Water Supply"], phone: "8208052655", roleClass: "manager" },
  { id: "W6-WAT-03", name: "Sarfaraz Ansari", role: "Deputy Engineer", depts: ["Water Supply"], phone: "9960620702", roleClass: "manager" },
  { id: "W6-WAT-04", name: "Sandeep Patnavar", role: "Executive Engineer (in-charge)", depts: ["Water Supply"], phone: "9823037828", roleClass: "manager" },
  { id: "W6-WAT-05", name: "Vikram Darade", role: "Deputy Commissioner", depts: ["Water Supply", "Construction"], phone: "9158552075", roleClass: "manager" },

  { id: "W6-CON-01", name: "Pradeep Gaikwad", role: "Supervisor", depts: ["Construction"], phone: "9860226066", roleClass: null },
  { id: "W6-CON-02", name: "Vinod Mate", role: "Deputy Engineer", depts: ["Construction"], phone: "9867296380", roleClass: "manager" },
  { id: "W6-CON-03", name: "Jamir Patel", role: "City Engineer", depts: ["Construction"], phone: "9850729134", roleClass: "manager" },

  { id: "W6-ELE-01", name: "Vilas Virkar", role: "Supervisor", depts: ["Electrical"], phone: "9822896607", roleClass: null },
  { id: "W6-ELE-02", name: "Dnyandev Waghmare", role: "Junior Engineer", depts: ["Electrical"], phone: null, roleClass: "worker" },
  { id: "W6-ELE-03", name: "Siddique Kazi", role: "Executive Engineer (in-charge)", depts: ["Electrical"], phone: "9273004115", roleClass: "manager" },

  { id: "W6-HEA-01", name: "Rupesh Gaikwad", role: "Health Inspector, Ward 6", depts: ["Health"], phone: "7276787773", roleClass: "manager" },
  { id: "W6-HEA-02", name: "Sunil Bhoir", role: "Prabhag Health Inspector", depts: ["Health"], phone: "9890206547", roleClass: "manager" },
  { id: "W6-HEA-03", name: "Haresh Bhandari", role: "Chief Health Inspector (in-charge)", depts: ["Health"], phone: null, roleClass: "manager" },
  { id: "W6-HEA-04", name: "Faisal Tatli", role: "Head, Health & Sanitation", depts: ["Health"], phone: "9890125353", roleClass: "manager" },

  { id: "W6-SAN-01", name: "Mahendra Bhika", role: "Mukadam (Foreman), Wards 1 & 6", depts: ["Sanitation"], phone: "7498203878", roleClass: "worker" },
  { id: "W6-SAN-02", name: "Kisan Gohil", role: "Mukadam (Foreman), Ward 6", depts: ["Sanitation"], phone: "7972211289", roleClass: "worker" },
  { id: "W6-SAN-03", name: "Tulshidas Chavan", role: "Vehicle Mukadam", depts: ["Sanitation"], phone: "8087934233", roleClass: "worker" },
  { id: "W6-SAN-04", name: "Santosh Chavan", role: "Supervisor (SI)", depts: ["Sanitation"], phone: "8793609886", roleClass: "worker" },
];
