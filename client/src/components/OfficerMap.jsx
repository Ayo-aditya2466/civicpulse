import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import { coordsForStreet, MAP_CENTER, MAP_ZOOM } from "../data/streetCoords";
import { slaFor, formatRemaining } from "../lib/sla";

// Marker color by SLA urgency level (same semantics as SlaBadge).
const LEVEL_COLOR = {
  overdue: "#dc2626",
  "due-soon": "#d97706",
  "on-track": "#059669",
  resolved: "#64748b",
};

// Small deterministic offset so multiple complaints on the same street don't
// perfectly overlap. Derived from the complaint's ID sequence (no randomness).
function jitter(complaint) {
  const seq = parseInt(String(complaint.id).split("-").pop(), 10) || 0;
  const angle = (seq * 137.5 * Math.PI) / 180; // golden-angle spread
  const r = 0.0016 * ((seq % 3) + 1);
  return { dLat: r * Math.cos(angle), dLng: r * Math.sin(angle) };
}

export default function OfficerMap({ complaints }) {
  const points = complaints
    .map((c) => {
      const base = coordsForStreet(c.street);
      if (!base) return null;
      const { dLat, dLng } = jitter(c);
      return { c, lat: base.lat + dLat, lng: base.lng + dLng };
    })
    .filter(Boolean);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300">
      <MapContainer
        center={[MAP_CENTER.lat, MAP_CENTER.lng]}
        zoom={MAP_ZOOM}
        style={{ height: 460, width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map(({ c, lat, lng }) => {
          const { level, remainingMs } = slaFor(c);
          const color = LEVEL_COLOR[level];
          return (
            <CircleMarker
              key={c.id}
              center={[lat, lng]}
              radius={9}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.7,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{c.id}</div>
                  <div>
                    {c.type} · {c.street}
                  </div>
                  <div className="text-slate-500">
                    {c.status}
                    {level !== "resolved" &&
                      ` · ${formatRemaining(remainingMs)}`}
                  </div>
                  <Link
                    to={`/officer/${c.id}`}
                    className="mt-1 inline-block font-medium text-slate-900 underline"
                  >
                    Open complaint
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <p className="bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        Pin locations are approximate/representative per street — not surveyed
        GPS coordinates.
      </p>
    </div>
  );
}
