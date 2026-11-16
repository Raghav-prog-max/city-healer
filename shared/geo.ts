/**
 * Distance on the Earth's surface, shared by the server and the browser so both
 * rank hospitals the same way.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Connaught Place. Used only when the user has not shared a location. */
export const DELHI_CENTRE: LatLng = { lat: 28.6139, lng: 77.209 };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres (Haversine formula). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A usable coordinate pair, or null. Rejects NaN, out-of-range values and 0,0. */
export function parseLatLng(lat: unknown, lng: unknown): LatLng | null {
  // Absent values must not become 0: Number(null) and Number("") are both 0.
  if (lat === null || lat === undefined || lat === "" || lng === null || lng === undefined || lng === "") return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  if (la === 0 && ln === 0) return null;
  return { lat: la, lng: ln };
}

/** Nearest first; items without a known position keep their order at the end. */
export function sortByDistance<T extends { distanceKm?: number | null }>(items: T[]): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const da = a.item.distanceKm ?? Infinity;
      const db = b.item.distanceKm ?? Infinity;
      return da === db ? a.i - b.i : da - db;
    })
    .map((x) => x.item);
}

/**
 * Nearest neighbour by linear scan (Milestone 4: A6), used by POST /api/emergency/sos.
 * O(n) time, O(1) extra space; ties keep the first item. Null for an empty list.
 * A k-d tree or geohash index would only pay off at thousands of facilities.
 */
export function nearest<T extends LatLng>(origin: LatLng, items: T[]): { item: T; distanceKm: number } | null {
  let best: T | null = null;
  let bestKm = Infinity;
  for (const item of items) {
    const d = haversineKm(origin, item);
    if (d < bestKm) { bestKm = d; best = item; }
  }
  return best ? { item: best, distanceKm: bestKm } : null;
}
