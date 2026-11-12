import { coarse } from './geo';

/**
 * Gym search straight from the phone against Nominatim (OpenStreetMap's search engine).
 * Public OSM services throttle shared cloud IPs, so the server only verifies the gym the
 * player picks (OSM API) instead of searching. The phone sends a position rounded to ~1 km.
 */
export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
/** "Autour de moi" widens step by step: towns outside big cities often have no gym within 3 km. */
export const NEAR_RADII_M = [3000, 10000, 25000] as const;
const NAME_RADIUS_M = 30000;
const LIMIT = 40;

export type OsmGymHit = {
  osm_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
};

export type OsmSearch =
  | { mode: 'near'; lat: number; lng: number }
  | { mode: 'name'; query: string; lat?: number; lng?: number };

/** "left,top,right,bottom" box of ±radius around a point. */
export function viewbox(lat: number, lng: number, radiusM: number): string {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const r = (v: number) => v.toFixed(4);
  return `${r(lng - dLng)},${r(lat + dLat)},${r(lng + dLng)},${r(lat - dLat)}`;
}

export function nominatimUrl(search: OsmSearch, nearRadiusM: number = NEAR_RADII_M[0]): string {
  const p = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', limit: String(LIMIT) });
  if (search.mode === 'near') {
    p.set('q', '[leisure=fitness_centre]');
    p.set('bounded', '1');
    p.set('viewbox', viewbox(coarse(search.lat), coarse(search.lng), nearRadiusM));
  } else {
    p.set('q', search.query.trim());
    if (search.lat !== undefined && search.lng !== undefined) {
      p.set('bounded', '1');
      p.set('viewbox', viewbox(coarse(search.lat), coarse(search.lng), NAME_RADIUS_M));
    } else {
      p.set('countrycodes', 'fr');
    }
  }
  return `${NOMINATIM_SEARCH_URL}?${p.toString()}`;
}

type Place = {
  osm_type?: unknown;
  osm_id?: unknown;
  lat?: unknown;
  lon?: unknown;
  category?: unknown;
  type?: unknown;
  name?: unknown;
  address?: Record<string, string>;
};

function formatAddress(a: Record<string, string> | undefined): string | null {
  if (!a || typeof a !== 'object') return null;
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const city = [a.postcode, a.city ?? a.town ?? a.village ?? a.municipality]
    .filter(Boolean)
    .join(' ');
  const parts = [street, city].filter((p) => p.length > 0);
  return parts.length ? parts.join(', ') : null;
}

/** Keeps named fitness centres (nodes and ways) with a valid position, without duplicates. */
export function parseNominatim(payload: unknown): OsmGymHit[] {
  if (!Array.isArray(payload)) return [];
  const hits: OsmGymHit[] = [];
  const seen = new Set<string>();
  for (const raw of payload as Place[]) {
    if (!raw || raw.category !== 'leisure' || raw.type !== 'fitness_centre') continue;
    if (raw.osm_type !== 'node' && raw.osm_type !== 'way') continue;
    if (typeof raw.osm_id !== 'number' || !Number.isInteger(raw.osm_id) || raw.osm_id <= 0)
      continue;
    const lat = Number(raw.lat);
    const lng = Number(raw.lon);
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !name) continue;
    const osmId = `${raw.osm_type}/${raw.osm_id}`;
    if (seen.has(osmId)) continue;
    seen.add(osmId);
    hits.push({
      osm_id: osmId,
      name: name.slice(0, 200),
      lat,
      lng,
      address: formatAddress(raw.address),
    });
  }
  return hits;
}
