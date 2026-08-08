// CivicPulse — prototype seed data
// Source of truth for wards, streets, departments, complaint types, and officers.
// Values are fixed for the BWCMC demo. Do not invent alternates.

export const wards = [
  {
    id: "W14",
    name: "Kaman-Anjur Cluster",
    committee: "Ward Committee 3",
  },
];

export const streets = [
  "Kaman Bhiwandi Road",
  "Anjur Phata",
  "Golani Naka",
  "Shanti Nagar",
  "Purna Village Rd",
  "Rahnal Naka",
];

export const departments = [
  "Road Department",
  "Water Supply",
  "Solid Waste Management",
];

export const complaintTypes = [
  {
    type: "Pothole",
    dept: "Road Department",
    slaHours: 72,
  },
  {
    type: "Water Leakage",
    dept: "Water Supply",
    slaHours: 24,
  },
  {
    type: "Garbage Collection",
    dept: "Solid Waste Management",
    slaHours: 12,
  },
  {
    type: "Drainage Blockage",
    dept: "Water Supply",
    slaHours: 12,
  },
  {
    type: "Streetlight",
    dept: "Road Department",
    slaHours: 24,
  },
];

export const officers = [
  {
    name: "Er. S. R. Patil",
    role: "Ward Engineer",
    ward: "W14",
  },
  {
    name: "R. K. Deshmukh",
    role: "Executive Engineer",
    ward: "W14",
  },
];
