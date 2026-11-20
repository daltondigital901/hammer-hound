// Distances for service areas. A pro's market is a circle: their ZIP (else their city) and a radius in miles (default 20).
// A lead is in the market when its city (or ZIP) is inside the circle. Data: src/geo-data.js (US ZIP centroids, built by scripts/build-geo.mjs).
import { CITY_ROWS, ZIP_ROWS } from "./geo-data.js";

export const DEFAULT_RADIUS = 20;
export const RADIUS_CHOICES = [10, 15, 20, 30, 40, 50, 75];

let cities = null, byCity = null, byZip = null;
function load() {
  if (cities) return;
  cities = []; byCity = new Map(); byZip = new Map();
  for (const row of CITY_ROWS.split("\n")) {
    const [city, state, lat, lng] = row.split("|");
    const c = { city, state, lat: Number(lat) / 100, lng: Number(lng) / 100 };
    cities.push(c); byCity.set(`${city.toLowerCase()}|${state}`, c);
  }
  for (const row of ZIP_ROWS.split("\n")) { const [zip, lat, lng] = row.split("|"); byZip.set(zip, { lat: Number(lat) / 100, lng: Number(lng) / 100 }); }
}
// Some cities are written differently on a form ("St Louis" / "Saint Louis", "Ft Worth"): try the common spellings.
const variants = (city) => { const c = String(city || "").trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " "); return [...new Set([c, c.replace(/^st /, "saint "), c.replace(/^saint /, "st "), c.replace(/^ft /, "fort "), c.replace(/^fort /, "ft "), c.replace(/^mt /, "mount "), c.replace(/^mount /, "mt ")])]; };

export function cityPoint(city, state) {
  load();
  if (!city) return null;
  for (const v of variants(city)) {
    if (state) { const hit = byCity.get(`${v}|${state}`); if (hit) return hit; continue; }
    const all = cities.filter((c) => c.city.toLowerCase() === v); if (all.length === 1) return all[0];
  }
  return null;
}
export function zipPoint(zip) { load(); return byZip.get(String(zip || "").slice(0, 5)) || null; }

export function miles(a, b) {
  const r = (d) => (d * Math.PI) / 180, dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

// The middle of a pro's circle: their ZIP, else their city.
export const centerOf = (f) => zipPoint(f.ZIP) || cityPoint(f.City, f.State);
export const radiusOf = (f) => { const r = Number(f["Service Radius"]); return r > 0 ? Math.min(r, 150) : DEFAULT_RADIUS; };
// Where a lead is: its ZIP when it has one, else its city.
export const pointOfPlace = (p) => zipPoint(p.ZIP || p.zip) || cityPoint(p.City || p.city, p.State || p.state);

// Is this place inside the pro's circle? null when either point is unknown (the caller falls back to matching by name).
export function inRadius(f, place) {
  const c = centerOf(f), p = pointOfPlace(place);
  if (!c || !p) return null;
  return miles(c, p) <= radiusOf(f) + 0.5;
}

// The towns inside the circle, nearest first, for "your market covers …".
export function citiesWithin(f, max = 400) {
  load();
  const c = centerOf(f), r = radiusOf(f);
  if (!c) return [];
  return cities.map((x) => ({ name: `${x.city}, ${x.state}`, miles: miles(c, x) })).filter((x) => x.miles <= r + 0.5).sort((a, b) => a.miles - b.miles).slice(0, max)
    .map((x) => ({ name: x.name, miles: Math.round(x.miles) }));
}
