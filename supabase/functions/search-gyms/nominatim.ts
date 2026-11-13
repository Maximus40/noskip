import { z } from 'zod';

import type { Fetcher } from '../_shared/fetcher.ts';
import type { OsmGym } from './overpass.ts';

// Nominatim (OpenStreetMap's search engine) answers in ~1 s where the public Overpass
// instances are often saturated. Same OSM data: only leisure=fitness_centre is kept.
// Usage policy: identify the app, stay well under 1 request/second (results are cached 7 days).
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'fr',
  'User-Agent':
    'Noxcuse/1.0 (gym search for a fitness app; +https://pulseaiagency.github.io/noxcuse/)',
  Referer: 'https://pulseaiagency.github.io/noxcuse/',
} as const;

const NAME_SEARCH_RADIUS_M = 30000;
const LIMIT = 40;

/** "left,top,right,bottom" box of ±radius around a point. */
export function viewbox(lat: number, lng: number, radiusM: number): string {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const r = (v: number) => v.toFixed(4);
  return `${r(lng - dLng)},${r(lat + dLat)},${r(lng + dLng)},${r(lat - dLat)}`;
}

export function nearUrl(lat: number, lng: number, radiusM: number): string {
  const p = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(LIMIT),
    bounded: '1',
    viewbox: viewbox(lat, lng, radiusM),
    q: '[leisure=fitness_centre]',
  });
  return `${NOMINATIM_URL}?${p}`;
}

export function nameUrl(name: string, near: { lat: number; lng: number } | null): string {
  const p = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(LIMIT),
    q: name,
  });
  if (near) {
    p.set('bounded', '1');
    p.set('viewbox', viewbox(near.lat, near.lng, NAME_SEARCH_RADIUS_M));
  } else {
    p.set('countrycodes', 'fr');
  }
  return `${NOMINATIM_URL}?${p}`;
}

const placeSchema = z.object({
  osm_type: z.enum(['node', 'way', 'relation']),
  osm_id: z.number().int().positive(),
  lat: z.string(),
  lon: z.string(),
  category: z.string().optional(),
  type: z.string().optional(),
  name: z.string().optional(),
  address: z.record(z.string(), z.string()).optional(),
});

function formatAddress(a: Record<string, string> | undefined): string | null {
  if (!a) return null;
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const city = [a.postcode, a.city ?? a.town ?? a.village ?? a.municipality]
    .filter(Boolean)
    .join(' ');
  const parts = [street, city].filter((p) => p.length > 0);
  return parts.length ? parts.join(', ') : null;
}

/** Keeps named fitness centres with a valid position. */
export function parseNominatim(payload: unknown): OsmGym[] {
  if (!Array.isArray(payload)) return [];
  const gyms: OsmGym[] = [];
  const seen = new Set<string>();
  for (const raw of payload) {
    const el = placeSchema.safeParse(raw);
    if (!el.success) continue;
    const p = el.data;
    if (p.category !== 'leisure' || p.type !== 'fitness_centre') continue;
    const lat = Number(p.lat);
    const lng = Number(p.lon);
    const name = p.name?.trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !name) continue;
    const osmId = `${p.osm_type}/${p.osm_id}`;
    if (seen.has(osmId)) continue;
    seen.add(osmId);
    gyms.push({
      osm_id: osmId,
      name: name.slice(0, 200),
      lat,
      lng,
      address: formatAddress(p.address),
    });
  }
  return gyms;
}

export async function runNominatim(fetcher: Fetcher, url: string): Promise<OsmGym[]> {
  const res = await fetcher(url, {
    method: 'GET',
    headers: NOMINATIM_HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`nominatim_http_${res.status}`);
  return parseNominatim(await res.json());
}
