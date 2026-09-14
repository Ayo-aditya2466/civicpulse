// CivicPulse — representative street coordinates (PROTOTYPE MAP DATA)
//
// IMPORTANT: These latitude/longitude values are APPROXIMATE and
// REPRESENTATIVE only — hand-placed within the BNCMC Ward 6 (Prabhag No. 6)
// area of Bhiwandi based on the official election-boundary map's landmarks.
// They are NOT surveyed, NOT GPS-accurate, and must NOT be used for any real
// dispatch or location decision.
//
// M1 collects a street NAME, not GPS. This lookup gives the officer map a
// plausible pin per seed landmark. Keys must match data/seed.js `streets`
// exactly. Reference data only — never hardcode these inside components.

export const STREET_COORDS = {
  "Khadipar Road": { lat: 19.2965, lng: 73.0652 },
  "Kadak Road": { lat: 19.2931, lng: 73.0688 },
  "Kariwali Road": { lat: 19.3002, lng: 73.0604 },
  "Dargah Road": { lat: 19.2914, lng: 73.0623 },
  "Tilak Chowk": { lat: 19.2981, lng: 73.0673 },
  "Kalantri Chowk": { lat: 19.2946, lng: 73.0596 },
  "Bazar Peth": { lat: 19.2995, lng: 73.0640 },
  "Bunder Mohalla": { lat: 19.2972, lng: 73.0615 },
};

// Center for the map's initial view (roughly the ward centroid).
export const MAP_CENTER = { lat: 19.2958, lng: 73.0635 };
export const MAP_ZOOM = 15;

export function coordsForStreet(street) {
  return STREET_COORDS[street] ?? null;
}
