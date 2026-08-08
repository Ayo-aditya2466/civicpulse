// CivicPulse — representative street coordinates (PROTOTYPE MAP DATA)
//
// IMPORTANT: These latitude/longitude values are APPROXIMATE and
// REPRESENTATIVE only — hand-placed near the Kaman/Anjur area of
// Bhiwandi for demo map display. They are NOT surveyed, NOT GPS-accurate,
// and must NOT be used for any real dispatch or location decision.
//
// M1 collects a street NAME, not GPS. This lookup gives the officer map a
// plausible pin per seed street. Keys must match data/seed.js `streets`
// exactly. Reference data only — never hardcode these inside components.

export const STREET_COORDS = {
  "Kaman Bhiwandi Road": { lat: 19.2823, lng: 73.0231 },
  "Anjur Phata": { lat: 19.2705, lng: 73.0402 },
  "Golani Naka": { lat: 19.2891, lng: 73.0587 },
  "Shanti Nagar": { lat: 19.2967, lng: 73.0499 },
  "Purna Village Rd": { lat: 19.3042, lng: 73.0668 },
  "Rahnal Naka": { lat: 19.2758, lng: 73.0125 },
};

// Center for the map's initial view (roughly the cluster centroid).
export const MAP_CENTER = { lat: 19.286, lng: 73.041 };
export const MAP_ZOOM = 13;

export function coordsForStreet(street) {
  return STREET_COORDS[street] ?? null;
}
